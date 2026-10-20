import { query, withTransaction } from '../db/index.js';
import { recordAuditLog } from '../middleware/audit.js';
export class PaymentService {
    /**
     * Generate atomic sequential receipt number: REC-YYYYMM-XXXX
     */
    static async generateReceiptNumber(client) {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prefix = `REC-${yearMonth}-`;
        const countRes = await client.query(`SELECT COUNT(*) as count FROM payment_transactions WHERE receipt_number LIKE $1`, [`${prefix}%`]);
        const seq = parseInt(countRes.rows[0].count, 10) + 1;
        return `${prefix}${String(seq).padStart(4, '0')}`;
    }
    /**
     * Record a payment and allocate across billing records
     */
    static async recordPayment(input) {
        if (input.amount <= 0) {
            throw new Error('Payment amount must be greater than zero.');
        }
        return await withTransaction(async (client) => {
            // 1. Verify student exists
            const studentRes = await client.query(`SELECT s.id, s.student_code, s.full_name, s.guardian_phone, s.class_name, b.name as batch_name
         FROM students s
         JOIN batches b ON s.batch_id = b.id
         WHERE s.id = $1`, [input.studentId]);
            if (studentRes.rows.length === 0) {
                throw new Error('Student not found.');
            }
            const student = studentRes.rows[0];
            // 2. Lock student's unpaid/partial billing records FOR UPDATE to prevent race conditions
            let billsSql = `
        SELECT 
          b.id,
          b.billing_year,
          b.billing_month,
          b.fee_amount,
          b.adjusted_amount,
          COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
            ), 0
          ) as paid_amount
        FROM billing_records b
        WHERE b.student_id = $1
      `;
            const billParams = [input.studentId];
            if (input.billingRecordId) {
                billParams.push(input.billingRecordId);
                billsSql += ` AND b.id = $2`;
            }
            billsSql += ` ORDER BY b.billing_year ASC, b.billing_month ASC FOR UPDATE`;
            const billsRes = await client.query(billsSql, billParams);
            // Compute remaining balance on each bill
            const eligibleBills = billsRes.rows
                .map((b) => {
                const fee = parseFloat(b.fee_amount);
                const adj = parseFloat(b.adjusted_amount);
                const paid = parseFloat(b.paid_amount);
                const net = Math.max(0, fee - adj);
                const remaining = Math.max(0, net - paid);
                return {
                    id: b.id,
                    period: `${b.billing_year}-${String(b.billing_month).padStart(2, '0')}`,
                    remaining,
                };
            })
                .filter((b) => b.remaining > 0);
            // 3. Generate receipt number & insert transaction
            const receiptNumber = await this.generateReceiptNumber(client);
            const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
            const transRes = await client.query(`INSERT INTO payment_transactions 
         (receipt_number, student_id, payment_date, amount, payment_method, transaction_reference, notes, recorded_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COMPLETED')
         RETURNING id`, [
                receiptNumber,
                input.studentId,
                paymentDate,
                input.amount,
                input.paymentMethod,
                input.transactionReference || null,
                input.notes || null,
                input.adminId,
            ]);
            const paymentId = transRes.rows[0].id;
            // 4. Allocate amount to eligible bills
            let remainingPayment = input.amount;
            const allocations = [];
            for (const bill of eligibleBills) {
                if (remainingPayment <= 0)
                    break;
                const allocAmount = Math.min(remainingPayment, bill.remaining);
                if (allocAmount > 0) {
                    await client.query(`INSERT INTO payment_allocations (payment_id, billing_record_id, allocated_amount)
             VALUES ($1, $2, $3)`, [paymentId, bill.id, allocAmount]);
                    allocations.push({
                        billingRecordId: bill.id,
                        billingPeriod: bill.period,
                        allocatedAmount: allocAmount,
                        remainingBillBalance: Math.max(0, bill.remaining - allocAmount),
                    });
                    remainingPayment -= allocAmount;
                }
            }
            // If there is any unallocated surplus payment, allow it as unallocated advance credit or general receipt
            // 5. Audit log
            await recordAuditLog({
                adminId: input.adminId,
                adminName: input.adminName,
                action: 'RECORD_PAYMENT',
                entityType: 'PAYMENT_TRANSACTION',
                entityId: paymentId,
                newValues: {
                    receiptNumber,
                    studentId: input.studentId,
                    amount: input.amount,
                    paymentMethod: input.paymentMethod,
                    allocationsCount: allocations.length,
                    unallocatedCredit: remainingPayment,
                },
                ipAddress: input.ipAddress,
            });
            // 6. Calculate total remaining outstanding balance for the student
            const dueRes = await client.query(`SELECT COALESCE(
          SUM(
            GREATEST(0, (b.fee_amount - b.adjusted_amount) - COALESCE(
              (
                SELECT SUM(pa.allocated_amount)
                FROM payment_allocations pa
                JOIN payment_transactions pt ON pa.payment_id = pt.id
                WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
              ), 0)
            )
          ), 0) as total_due
         FROM billing_records b
         WHERE b.student_id = $1`, [input.studentId]);
            const totalStudentOutstandingBalance = parseFloat(dueRes.rows[0].total_due || '0');
            return {
                id: paymentId,
                receiptNumber,
                paymentDate,
                amount: input.amount,
                paymentMethod: input.paymentMethod,
                transactionReference: input.transactionReference || null,
                notes: input.notes || null,
                status: 'COMPLETED',
                reversalReason: null,
                reversedAt: null,
                recordedByAdmin: input.adminName,
                student: {
                    id: student.id,
                    studentCode: student.student_code,
                    fullName: student.full_name,
                    guardianPhone: student.guardian_phone,
                    batchName: student.batch_name,
                    className: student.class_name,
                },
                allocations,
                totalStudentOutstandingBalance,
            };
        });
    }
    /**
     * Reverse an existing payment (Audited, never silently deleted)
     */
    static async reversePayment(params) {
        await withTransaction(async (client) => {
            const transRes = await client.query(`SELECT id, receipt_number, student_id, amount, status FROM payment_transactions WHERE id = $1 FOR UPDATE`, [params.paymentId]);
            if (transRes.rows.length === 0) {
                throw new Error('Payment transaction not found.');
            }
            const trans = transRes.rows[0];
            if (trans.status === 'REVERSED') {
                throw new Error('This payment transaction has already been reversed.');
            }
            // Mark transaction REVERSED
            await client.query(`UPDATE payment_transactions 
         SET status = 'REVERSED', reversal_reason = $1, reversed_at = CURRENT_TIMESTAMP, reversed_by = $2
         WHERE id = $3`, [params.reason, params.adminId, params.paymentId]);
            // Audit log
            await recordAuditLog({
                adminId: params.adminId,
                adminName: params.adminName,
                action: 'REVERSE_PAYMENT',
                entityType: 'PAYMENT_TRANSACTION',
                entityId: params.paymentId,
                oldValues: { status: 'COMPLETED', receiptNumber: trans.receipt_number, amount: trans.amount },
                newValues: { status: 'REVERSED', reversalReason: params.reason },
                ipAddress: params.ipAddress,
            });
        });
    }
    /**
     * List payment transactions with filters
     */
    static async getPayments(filters) {
        let sql = `
      SELECT 
        pt.id,
        pt.receipt_number,
        pt.payment_date,
        pt.amount,
        pt.payment_method,
        pt.transaction_reference,
        pt.notes,
        pt.status,
        pt.reversal_reason,
        pt.reversed_at,
        pt.created_at,
        s.id as student_id,
        s.student_code,
        s.full_name as student_name,
        s.guardian_phone,
        b.id as batch_id,
        b.name as batch_name,
        adm.full_name as recorded_by_admin
      FROM payment_transactions pt
      JOIN students s ON pt.student_id = s.id
      JOIN batches b ON s.batch_id = b.id
      JOIN administrators adm ON pt.recorded_by = adm.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.studentId) {
            params.push(filters.studentId);
            sql += ` AND pt.student_id = $${params.length}`;
        }
        if (filters.batchId) {
            params.push(filters.batchId);
            sql += ` AND b.id = $${params.length}`;
        }
        if (filters.startDate) {
            params.push(filters.startDate);
            sql += ` AND pt.payment_date >= $${params.length}`;
        }
        if (filters.endDate) {
            params.push(filters.endDate);
            sql += ` AND pt.payment_date <= $${params.length}`;
        }
        if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
            params.push(filters.paymentMethod);
            sql += ` AND pt.payment_method = $${params.length}`;
        }
        if (filters.status && filters.status !== 'ALL') {
            params.push(filters.status);
            sql += ` AND pt.status = $${params.length}`;
        }
        if (filters.search) {
            params.push(`%${filters.search}%`);
            sql += ` AND (pt.receipt_number ILIKE $${params.length} OR s.full_name ILIKE $${params.length} OR s.student_code ILIKE $${params.length} OR s.guardian_phone ILIKE $${params.length} OR pt.transaction_reference ILIKE $${params.length})`;
        }
        sql += ` ORDER BY pt.payment_date DESC, pt.id DESC`;
        const res = await query(sql, params);
        return res.rows;
    }
    /**
     * Get detailed receipt info for reprint
     */
    static async getReceipt(receiptIdOrNumber) {
        const isId = typeof receiptIdOrNumber === 'number' || !isNaN(Number(receiptIdOrNumber));
        const transRes = await query(`SELECT 
        pt.*,
        s.id as s_id, s.student_code, s.full_name as s_name, s.guardian_phone, s.class_name,
        b.name as batch_name,
        adm.full_name as admin_name
       FROM payment_transactions pt
       JOIN students s ON pt.student_id = s.id
       JOIN batches b ON s.batch_id = b.id
       JOIN administrators adm ON pt.recorded_by = adm.id
       WHERE ${isId ? 'pt.id = $1' : 'pt.receipt_number = $1'}`, [receiptIdOrNumber]);
        if (transRes.rows.length === 0) {
            throw new Error('Receipt not found.');
        }
        const t = transRes.rows[0];
        // Fetch allocations
        const allocRes = await query(`SELECT 
        pa.billing_record_id,
        pa.allocated_amount,
        br.billing_year,
        br.billing_month,
        (br.fee_amount - br.adjusted_amount) as net_fee,
        COALESCE(
          (
            SELECT SUM(pa2.allocated_amount)
            FROM payment_allocations pa2
            JOIN payment_transactions pt2 ON pa2.payment_id = pt2.id
            WHERE pa2.billing_record_id = br.id AND pt2.status = 'COMPLETED'
          ), 0) as total_paid
       FROM payment_allocations pa
       JOIN billing_records br ON pa.billing_record_id = br.id
       WHERE pa.payment_id = $1`, [t.id]);
        const allocations = allocRes.rows.map((a) => ({
            billingRecordId: a.billing_record_id,
            billingPeriod: `${a.billing_year}-${String(a.billing_month).padStart(2, '0')}`,
            allocatedAmount: parseFloat(a.allocated_amount),
            remainingBillBalance: Math.max(0, parseFloat(a.net_fee) - parseFloat(a.total_paid)),
        }));
        // Calculate total remaining student due
        const dueRes = await query(`SELECT COALESCE(
        SUM(
          GREATEST(0, (b.fee_amount - b.adjusted_amount) - COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
            ), 0)
          )
        ), 0) as total_due
       FROM billing_records b
       WHERE b.student_id = $1`, [t.student_id]);
        return {
            id: t.id,
            receiptNumber: t.receipt_number,
            paymentDate: t.payment_date instanceof Date ? t.payment_date.toISOString().slice(0, 10) : String(t.payment_date),
            amount: parseFloat(t.amount),
            paymentMethod: t.payment_method,
            transactionReference: t.transaction_reference,
            notes: t.notes,
            status: t.status,
            reversalReason: t.reversal_reason,
            reversedAt: t.reversed_at,
            recordedByAdmin: t.admin_name,
            student: {
                id: t.s_id,
                studentCode: t.student_code,
                fullName: t.s_name,
                guardianPhone: t.guardian_phone,
                batchName: t.batch_name,
                className: t.class_name,
            },
            allocations,
            totalStudentOutstandingBalance: parseFloat(dueRes.rows[0].total_due || '0'),
        };
    }
}
