import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

/**
 * GET /api/dashboard - Real database-derived statistics and charts
 */
dashboardRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetMonth = req.query.month ? parseInt(req.query.month as string, 10) : new Date().getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string, 10) : undefined;

    // 1. Basic Counts
    const countsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM students WHERE status = 'ACTIVE' ${batchId ? 'AND batch_id = ' + batchId : ''}) as active_students,
        (SELECT COUNT(*) FROM batches WHERE is_active = true) as total_batches`
    );
    const activeStudents = parseInt(countsRes.rows[0].active_students, 10);
    const totalBatches = parseInt(countsRes.rows[0].total_batches, 10);

    // 2. Selected Month Obligations & Collections
    let monthStatsSql = `
      SELECT 
        COALESCE(SUM(b.fee_amount - b.adjusted_amount), 0) as expected_fees,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            JOIN billing_records br ON pa.billing_record_id = br.id
            WHERE br.billing_year = $1 
              AND br.billing_month = $2 
              AND pt.status = 'COMPLETED'
              ${batchId ? 'AND br.batch_id = ' + batchId : ''}
          ), 0
        ) as collected_fees
      FROM billing_records b
      WHERE b.billing_year = $1 AND b.billing_month = $2
      ${batchId ? 'AND b.batch_id = ' + batchId : ''}
    `;
    const monthStatsRes = await query(monthStatsSql, [targetYear, targetMonth]);
    const expectedFees = parseFloat(monthStatsRes.rows[0].expected_fees || '0');
    const collectedFees = parseFloat(monthStatsRes.rows[0].collected_fees || '0');

    // 3. All-time Outstanding Dues
    let dueSql = `
      SELECT COALESCE(
        SUM(
          GREATEST(0, (br.fee_amount - br.adjusted_amount) - COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
            ), 0)
          )
        ), 0
      ) as total_outstanding
      FROM billing_records br
      JOIN students s ON br.student_id = s.id
      WHERE s.status = 'ACTIVE'
      ${batchId ? 'AND br.batch_id = ' + batchId : ''}
    `;
    const dueRes = await query(dueSql);
    const totalOutstanding = parseFloat(dueRes.rows[0].total_outstanding || '0');

    // 4. Student status distribution for selected month
    let statusSql = `
      SELECT 
        b.id,
        b.fee_amount - b.adjusted_amount as net_fee,
        b.due_date,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
          ), 0
        ) as paid_amount
      FROM billing_records b
      WHERE b.billing_year = $1 AND b.billing_month = $2
      ${batchId ? 'AND b.batch_id = ' + batchId : ''}
    `;
    const statusRes = await query(statusSql, [targetYear, targetMonth]);

    let fullyPaidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const r of statusRes.rows) {
      const net = parseFloat(r.net_fee);
      const paid = parseFloat(r.paid_amount);
      const balance = Math.max(0, net - paid);
      const dueDate = r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date);

      if (balance <= 0) {
        fullyPaidCount++;
      } else if (paid > 0) {
        partialCount++;
      } else if (todayStr > dueDate) {
        overdueCount++;
      } else {
        unpaidCount++;
      }
    }

    // 5. Last 6 Months Collection Trend Chart Data
    const trendMonths: Array<{ year: number; month: number; label: string }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      trendMonths.push({ year: y, month: m, label: `${monthNames[m - 1]} ${y}` });
    }

    const monthlyTrends: Array<{
      label: string;
      year: number;
      month: number;
      expected: number;
      collected: number;
    }> = [];

    for (const tm of trendMonths) {
      const trRes = await query(
        `SELECT 
          COALESCE(SUM(b.fee_amount - b.adjusted_amount), 0) as exp,
          COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              JOIN billing_records br ON pa.billing_record_id = br.id
              WHERE br.billing_year = $1 AND br.billing_month = $2 AND pt.status = 'COMPLETED'
            ), 0
          ) as col
         FROM billing_records b
         WHERE b.billing_year = $1 AND b.billing_month = $2`,
        [tm.year, tm.month]
      );

      monthlyTrends.push({
        label: tm.label,
        year: tm.year,
        month: tm.month,
        expected: parseFloat(trRes.rows[0].exp || '0'),
        collected: parseFloat(trRes.rows[0].col || '0'),
      });
    }

    // 6. Batch Performance Breakdown
    const batchBreakdownRes = await query(
      `SELECT 
        b.id,
        b.name,
        b.code,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'ACTIVE') as student_count,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            JOIN billing_records br ON pa.billing_record_id = br.id
            WHERE br.batch_id = b.id AND br.billing_year = $1 AND br.billing_month = $2 AND pt.status = 'COMPLETED'
          ), 0
        ) as collected_amount,
        COALESCE(
          (
            SELECT SUM(GREATEST(0, (br2.fee_amount - br2.adjusted_amount) - COALESCE(
              (
                SELECT SUM(pa2.allocated_amount)
                FROM payment_allocations pa2
                JOIN payment_transactions pt2 ON pa2.payment_id = pt2.id
                WHERE pa2.billing_record_id = br2.id AND pt2.status = 'COMPLETED'
              ), 0)
            ))
            FROM billing_records br2
            WHERE br2.batch_id = b.id
          ), 0
        ) as outstanding_due
      FROM batches b
      LEFT JOIN students s ON s.batch_id = b.id
      WHERE b.is_active = true
      GROUP BY b.id
      ORDER BY collected_amount DESC, b.name ASC`,
      [targetYear, targetMonth]
    );

    // 7. Recent 5 Payments
    const recentPaymentsRes = await query(
      `SELECT 
        pt.id, pt.receipt_number, pt.payment_date, pt.amount, pt.payment_method, pt.status,
        s.student_code, s.full_name as student_name, b.name as batch_name
       FROM payment_transactions pt
       JOIN students s ON pt.student_id = s.id
       JOIN batches b ON s.batch_id = b.id
       ORDER BY pt.id DESC LIMIT 5`
    );

    // 8. Recent 5 Student Admissions
    const recentAdmissionsRes = await query(
      `SELECT s.id, s.student_code, s.full_name, s.admission_date, s.status, b.name as batch_name
       FROM students s
       JOIN batches b ON s.batch_id = b.id
       ORDER BY s.id DESC LIMIT 5`
    );

    // 9. Follow-up Urgent Alerts (Overdue > 1 month)
    const alertsRes = await query(
      `WITH overdue_counts AS (
        SELECT 
          s.id as student_id,
          s.student_code,
          s.full_name,
          s.guardian_phone,
          b.name as batch_name,
          COUNT(br.id) as overdue_month_count,
          SUM(
            GREATEST(0, (br.fee_amount - br.adjusted_amount) - COALESCE(
              (
                SELECT SUM(pa.allocated_amount)
                FROM payment_allocations pa
                JOIN payment_transactions pt ON pa.payment_id = pt.id
                WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
              ), 0)
            )
          ) as total_due
        FROM students s
        JOIN batches b ON s.batch_id = b.id
        JOIN billing_records br ON s.id = br.student_id
        WHERE s.status = 'ACTIVE' 
          AND br.due_date < CURRENT_DATE
          AND (br.fee_amount - br.adjusted_amount) > COALESCE(
            (
              SELECT SUM(pa2.allocated_amount)
              FROM payment_allocations pa2
              JOIN payment_transactions pt2 ON pa2.payment_id = pt2.id
              WHERE pa2.billing_record_id = br.id AND pt2.status = 'COMPLETED'
            ), 0)
        GROUP BY s.id, s.student_code, s.full_name, s.guardian_phone, b.name
        HAVING COUNT(br.id) >= 1
      )
      SELECT * FROM overdue_counts ORDER BY total_due DESC LIMIT 5`
    );

    res.json({
      cards: {
        activeStudents,
        totalBatches,
        expectedFees,
        collectedFees,
        totalOutstanding,
        fullyPaidCount,
        partialCount,
        unpaidCount,
        overdueCount,
      },
      selectedPeriod: {
        year: targetYear,
        month: targetMonth,
      },
      monthlyTrends,
      batchBreakdown: batchBreakdownRes.rows.map((b: any) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        studentCount: parseInt(b.student_count, 10),
        collectedAmount: parseFloat(b.collected_amount),
        outstandingDue: parseFloat(b.outstanding_due),
      })),
      recentPayments: recentPaymentsRes.rows,
      recentAdmissions: recentAdmissionsRes.rows,
      followUpAlerts: alertsRes.rows,
    });
  } catch (err: any) {
    console.error('[Dashboard Error]:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});
