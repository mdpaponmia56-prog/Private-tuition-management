import { query, withTransaction } from '../db/index.js';
import { recordAuditLog } from '../middleware/audit.js';

export interface BillingRecordView {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  guardianPhone: string;
  batchId: number;
  batchName: string;
  batchCode: string;
  billingYear: number;
  billingMonth: number;
  feeAmount: number;
  adjustedAmount: number;
  netFee: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'WAIVED';
  notes: string | null;
  createdAt: string;
}

export class BillingService {
  /**
   * Helper to compute dynamic status of billing records from DB query results
   */
  public static mapBillingRow(row: any): BillingRecordView {
    const fee = parseFloat(row.fee_amount || '0');
    const adjusted = parseFloat(row.adjusted_amount || '0');
    const paid = parseFloat(row.paid_amount || '0');
    const netFee = Math.max(0, fee - adjusted);
    const balance = Math.max(0, netFee - paid);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dueDateStr = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : String(row.due_date);

    let status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'WAIVED' = 'UNPAID';
    if (netFee === 0 && adjusted > 0) {
      status = 'WAIVED';
    } else if (balance <= 0) {
      status = 'PAID';
    } else if (paid > 0) {
      status = 'PARTIAL';
    } else if (todayStr > dueDateStr) {
      status = 'OVERDUE';
    } else {
      status = 'UNPAID';
    }

    return {
      id: row.id,
      studentId: row.student_id,
      studentCode: row.student_code,
      studentName: row.full_name,
      guardianPhone: row.guardian_phone,
      batchId: row.batch_id,
      batchName: row.batch_name,
      batchCode: row.batch_code,
      billingYear: row.billing_year,
      billingMonth: row.billing_month,
      feeAmount: fee,
      adjustedAmount: adjusted,
      netFee,
      paidAmount: paid,
      balance,
      dueDate: dueDateStr,
      status,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  /**
   * Get billing records with filtering
   */
  public static async getBillingRecords(filters: {
    studentId?: number;
    batchId?: number;
    billingYear?: number;
    billingMonth?: number;
    status?: string;
    search?: string;
  }): Promise<BillingRecordView[]> {
    let sql = `
      SELECT 
        b.id,
        b.student_id,
        s.student_code,
        s.full_name,
        s.guardian_phone,
        b.batch_id,
        bt.name as batch_name,
        bt.code as batch_code,
        b.billing_year,
        b.billing_month,
        b.fee_amount,
        b.adjusted_amount,
        b.due_date,
        b.notes,
        b.created_at,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
          ), 0
        ) as paid_amount
      FROM billing_records b
      JOIN students s ON b.student_id = s.id
      JOIN batches bt ON b.batch_id = bt.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.studentId) {
      params.push(filters.studentId);
      sql += ` AND b.student_id = $${params.length}`;
    }

    if (filters.batchId) {
      params.push(filters.batchId);
      sql += ` AND b.batch_id = $${params.length}`;
    }

    if (filters.billingYear) {
      params.push(filters.billingYear);
      sql += ` AND b.billing_year = $${params.length}`;
    }

    if (filters.billingMonth) {
      params.push(filters.billingMonth);
      sql += ` AND b.billing_month = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.student_code ILIKE $${params.length} OR s.guardian_phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY b.billing_year DESC, b.billing_month DESC, s.full_name ASC`;

    const res = await query(sql, params);
    const mapped = res.rows.map(this.mapBillingRow);

    if (filters.status && filters.status !== 'ALL') {
      return mapped.filter((r) => r.status === filters.status);
    }

    return mapped;
  }

  /**
   * Preview or Generate Recurring Monthly Bills (Mode A)
   */
  public static async generateMonthlyBills(options: {
    year: number;
    month: number;
    batchId?: number;
    isPreview?: boolean;
    adminId: number;
    adminName: string;
    ipAddress?: string;
  }): Promise<{
    year: number;
    month: number;
    generatedCount: number;
    skippedCount: number;
    eligibleStudents: any[];
  }> {
    const { year, month, batchId, isPreview, adminId, adminName, ipAddress } = options;

    // Find eligible students:
    // 1. status = 'ACTIVE'
    // 2. billing_mode = 'AUTOMATIC' or (billing_mode IS NULL AND batch.default_billing_mode = 'AUTOMATIC')
    // 3. billing_start_date <= end of this target month
    const targetMonthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

    let sql = `
      SELECT 
        s.id as student_id,
        s.student_code,
        s.full_name,
        s.guardian_phone,
        s.monthly_fee as student_fee,
        s.billing_mode as student_mode,
        s.billing_start_date,
        b.id as batch_id,
        b.name as batch_name,
        b.default_fee as batch_fee,
        b.default_billing_mode as batch_mode,
        b.billing_day_of_month,
        b.grace_period_days,
        br.id as existing_bill_id
      FROM students s
      JOIN batches b ON s.batch_id = b.id
      LEFT JOIN billing_records br ON (br.student_id = s.id AND br.billing_year = $1 AND br.billing_month = $2)
      WHERE s.status = 'ACTIVE'
        AND s.billing_start_date <= $3
        AND COALESCE(s.billing_mode, b.default_billing_mode) = 'AUTOMATIC'
    `;
    const params: any[] = [year, month, targetMonthEnd];

    if (batchId) {
      params.push(batchId);
      sql += ` AND s.batch_id = $${params.length}`;
    }

    sql += ` ORDER BY b.name ASC, s.full_name ASC`;

    const res = await query(sql, params);

    const eligibleList: any[] = [];
    let generatedCount = 0;
    let skippedCount = 0;

    for (const row of res.rows) {
      const effectiveFee = parseFloat(row.student_fee !== null ? row.student_fee : row.batch_fee);
      
      // Calculate due date
      const billingDay = Math.min(row.billing_day_of_month || 1, 28);
      const graceDays = row.grace_period_days || 7;
      const dueDateObj = new Date(year, month - 1, billingDay);
      dueDateObj.setDate(dueDateObj.getDate() + graceDays);
      const dueDateStr = dueDateObj.toISOString().slice(0, 10);

      const alreadyExists = !!row.existing_bill_id;

      eligibleList.push({
        studentId: row.student_id,
        studentCode: row.student_code,
        studentName: row.full_name,
        guardianPhone: row.guardian_phone,
        batchId: row.batch_id,
        batchName: row.batch_name,
        feeAmount: effectiveFee,
        dueDate: dueDateStr,
        alreadyExists,
      });

      if (alreadyExists) {
        skippedCount++;
      } else {
        generatedCount++;
      }
    }

    // If not preview mode, actually insert new records within transaction
    if (!isPreview && generatedCount > 0) {
      await withTransaction(async (client) => {
        for (const item of eligibleList) {
          if (!item.alreadyExists) {
            await client.query(
              `INSERT INTO billing_records (student_id, batch_id, billing_year, billing_month, fee_amount, adjusted_amount, due_date, created_by)
               VALUES ($1, $2, $3, $4, $5, 0.00, $6, $7)
               ON CONFLICT (student_id, billing_year, billing_month) DO NOTHING`,
              [item.studentId, item.batchId, year, month, item.feeAmount, item.dueDate, adminId]
            );
          }
        }

        await recordAuditLog({
          adminId,
          adminName,
          action: 'GENERATE_MONTHLY_BILLS',
          entityType: 'BILLING',
          entityId: `${year}-${month}`,
          newValues: { year, month, batchId: batchId || 'ALL', generatedCount, skippedCount },
          ipAddress,
        });
      });
    }

    return {
      year,
      month,
      generatedCount,
      skippedCount,
      eligibleStudents: eligibleList,
    };
  }

  /**
   * Create Manual Fee Obligation (Mode B or ad-hoc fee)
   */
  public static async createManualBill(params: {
    studentId: number;
    billingYear: number;
    billingMonth: number;
    feeAmount: number;
    dueDate: string;
    notes?: string;
    adminId: number;
    adminName: string;
    ipAddress?: string;
  }): Promise<BillingRecordView> {
    const studentRes = await query('SELECT batch_id, status FROM students WHERE id = $1', [params.studentId]);
    if (studentRes.rows.length === 0) {
      throw new Error('Student not found.');
    }
    const batchId = studentRes.rows[0].batch_id;

    // Check if bill already exists for this month/year
    const existing = await query(
      'SELECT id FROM billing_records WHERE student_id = $1 AND billing_year = $2 AND billing_month = $3',
      [params.studentId, params.billingYear, params.billingMonth]
    );

    if (existing.rows.length > 0) {
      throw new Error(`A billing record for ${params.billingMonth}/${params.billingYear} already exists for this student.`);
    }

    const insertRes = await query(
      `INSERT INTO billing_records (student_id, batch_id, billing_year, billing_month, fee_amount, adjusted_amount, due_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, 0.00, $6, $7, $8)
       RETURNING id`,
      [
        params.studentId,
        batchId,
        params.billingYear,
        params.billingMonth,
        params.feeAmount,
        params.dueDate,
        params.notes || 'Manual fee entry',
        params.adminId,
      ]
    );

    await recordAuditLog({
      adminId: params.adminId,
      adminName: params.adminName,
      action: 'CREATE_MANUAL_BILL',
      entityType: 'BILLING_RECORD',
      entityId: insertRes.rows[0].id,
      newValues: params,
      ipAddress: params.ipAddress,
    });

    const records = await this.getBillingRecords({ studentId: params.studentId, billingYear: params.billingYear, billingMonth: params.billingMonth });
    return records[0];
  }

  /**
   * Add Fee Adjustment (Waiver / Scholarship / Correction)
   */
  public static async addAdjustment(params: {
    billingRecordId: number;
    adjustmentType: 'WAIVER' | 'SCHOLARSHIP' | 'DISCOUNT' | 'CORRECTION';
    amount: number;
    reason: string;
    adminId: number;
    adminName: string;
    ipAddress?: string;
  }): Promise<BillingRecordView> {
    const billRes = await query('SELECT id, student_id, fee_amount, adjusted_amount FROM billing_records WHERE id = $1', [params.billingRecordId]);
    if (billRes.rows.length === 0) {
      throw new Error('Billing record not found.');
    }

    const bill = billRes.rows[0];
    const currentAdjusted = parseFloat(bill.adjusted_amount || '0');
    const fee = parseFloat(bill.fee_amount || '0');
    const newAdjusted = currentAdjusted + params.amount;

    if (newAdjusted > fee) {
      throw new Error(`Total adjustments (৳${newAdjusted}) cannot exceed the fee amount (৳${fee}).`);
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO fee_adjustments (billing_record_id, adjustment_type, amount, reason, approved_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.billingRecordId, params.adjustmentType, params.amount, params.reason, params.adminId]
      );

      await client.query(
        `UPDATE billing_records SET adjusted_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newAdjusted, params.billingRecordId]
      );

      await recordAuditLog({
        adminId: params.adminId,
        adminName: params.adminName,
        action: 'ADD_FEE_ADJUSTMENT',
        entityType: 'BILLING_RECORD',
        entityId: params.billingRecordId,
        oldValues: { adjustedAmount: currentAdjusted },
        newValues: { adjustedAmount: newAdjusted, adjustment: params },
        ipAddress: params.ipAddress,
      });
    });

    const records = await this.getBillingRecords({ studentId: bill.student_id });
    return records.find((r) => r.id === params.billingRecordId)!;
  }
}
