import { Router, Request, Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';

export const reportRouter = Router();

reportRouter.use(requireAuth);

/**
 * GET /api/reports/daily - Daily collection breakdown
 */
reportRouter.get('/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const transRes = await query(
      `SELECT 
        pt.id, pt.receipt_number, pt.payment_date, pt.amount, pt.payment_method, pt.transaction_reference, pt.status,
        s.student_code, s.full_name as student_name, s.guardian_phone,
        b.name as batch_name,
        adm.full_name as recorded_by_admin
       FROM payment_transactions pt
       JOIN students s ON pt.student_id = s.id
       JOIN batches b ON s.batch_id = b.id
       JOIN administrators adm ON pt.recorded_by = adm.id
       WHERE pt.payment_date = $1
       ORDER BY pt.id DESC`,
      [targetDate]
    );

    const totalCollected = transRes.rows
      .filter((r: any) => r.status === 'COMPLETED')
      .reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

    res.json({
      date: targetDate,
      totalCollected,
      count: transRes.rows.length,
      transactions: transRes.rows,
    });
  } catch (err: any) {
    console.error('[Daily Report Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate daily report.' });
  }
});

/**
 * GET /api/reports/monthly - Monthly summary by academic year
 */
reportRouter.get('/monthly', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

    const sql = `
      SELECT 
        b.billing_month,
        COALESCE(SUM(b.fee_amount - b.adjusted_amount), 0) as expected_fees,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            JOIN billing_records br ON pa.billing_record_id = br.id
            WHERE br.billing_year = $1 AND br.billing_month = b.billing_month AND pt.status = 'COMPLETED'
          ), 0
        ) as collected_fees,
        COUNT(DISTINCT b.student_id) as total_students_billed
      FROM billing_records b
      WHERE b.billing_year = $1
      GROUP BY b.billing_month
      ORDER BY b.billing_month ASC
    `;

    const resMonths = await query(sql, [year]);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const summary = resMonths.rows.map((row: any) => {
      const exp = parseFloat(row.expected_fees);
      const col = parseFloat(row.collected_fees);
      const mIdx = parseInt(row.billing_month, 10) - 1;
      return {
        month: row.billing_month,
        monthName: monthNames[mIdx],
        expectedFees: exp,
        collectedFees: col,
        balanceDue: Math.max(0, exp - col),
        collectionEfficiency: exp > 0 ? Math.round((col / exp) * 100) : 0,
        totalStudentsBilled: parseInt(row.total_students_billed, 10),
      };
    });

    res.json({ year, monthlySummary: summary });
  } catch (err: any) {
    console.error('[Monthly Report Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate monthly summary.' });
  }
});

/**
 * GET /api/reports/export/collections.csv - Export payment transactions to CSV
 */
reportRouter.get('/export/collections.csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, batchId } = req.query;

    let sql = `
      SELECT 
        pt.receipt_number,
        pt.payment_date,
        s.student_code,
        s.full_name as student_name,
        b.name as batch_name,
        pt.amount,
        pt.payment_method,
        pt.transaction_reference,
        pt.status,
        adm.full_name as recorded_by
      FROM payment_transactions pt
      JOIN students s ON pt.student_id = s.id
      JOIN batches b ON s.batch_id = b.id
      JOIN administrators adm ON pt.recorded_by = adm.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      sql += ` AND pt.payment_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND pt.payment_date <= $${params.length}`;
    }
    if (batchId) {
      params.push(batchId);
      sql += ` AND b.id = $${params.length}`;
    }

    sql += ` ORDER BY pt.payment_date DESC, pt.id DESC`;

    const result = await query(sql, params);

    const records = result.rows.map((r: any) => [
      r.receipt_number,
      r.payment_date instanceof Date ? r.payment_date.toISOString().slice(0, 10) : r.payment_date,
      r.student_code,
      r.student_name,
      r.batch_name,
      r.amount,
      r.payment_method,
      r.transaction_reference || '',
      r.status,
      r.recorded_by,
    ]);

    const csvData = stringify([
      ['Receipt Number', 'Payment Date', 'Student ID', 'Student Name', 'Batch', 'Amount (BDT)', 'Payment Method', 'Transaction Ref', 'Status', 'Recorded By'],
      ...records,
    ]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'EXPORT_COLLECTIONS_CSV',
      entityType: 'REPORT',
      newValues: { rowCount: records.length, startDate, endDate },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="collections_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvData);
  } catch (err: any) {
    console.error('[CSV Export Error]:', err.message);
    res.status(500).json({ error: 'Failed to export collections.' });
  }
});

/**
 * GET /api/reports/export/dues.csv - Export due list to CSV
 */
reportRouter.get('/export/dues.csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        s.student_code,
        s.full_name as student_name,
        s.guardian_phone,
        s.student_phone,
        b.name as batch_name,
        s.class_name,
        COALESCE(s.billing_mode, b.default_billing_mode) as billing_mode,
        SUM(GREATEST(0, (br.fee_amount - br.adjusted_amount) - COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
          ), 0)
        )) as total_due,
        COUNT(br.id) as unpaid_months_count
      FROM students s
      JOIN batches b ON s.batch_id = b.id
      JOIN billing_records br ON s.id = br.student_id
      WHERE s.status = 'ACTIVE'
      GROUP BY s.id, s.student_code, s.full_name, s.guardian_phone, s.student_phone, b.name, s.class_name, s.billing_mode, b.default_billing_mode
      HAVING SUM(GREATEST(0, (br.fee_amount - br.adjusted_amount) - COALESCE(
        (
          SELECT SUM(pa.allocated_amount)
          FROM payment_allocations pa
          JOIN payment_transactions pt ON pa.payment_id = pt.id
          WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
        ), 0)
      )) > 0
      ORDER BY total_due DESC`;

    const result = await query(sql);

    const records = result.rows.map((r: any) => [
      r.student_code,
      r.student_name,
      r.guardian_phone,
      r.student_phone || '',
      r.batch_name,
      r.class_name,
      r.billing_mode,
      r.total_due,
      r.unpaid_months_count,
    ]);

    const csvData = stringify([
      ['Student ID', 'Student Name', 'Guardian Phone', 'Student Phone', 'Batch', 'Class', 'Billing Mode', 'Total Outstanding Due (BDT)', 'Unpaid Months'],
      ...records,
    ]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'EXPORT_DUES_CSV',
      entityType: 'REPORT',
      newValues: { rowCount: records.length },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dues_report_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvData);
  } catch (err: any) {
    console.error('[CSV Dues Export Error]:', err.message);
    res.status(500).json({ error: 'Failed to export dues.' });
  }
});
