import { Router } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
/**
 * GET /api/dashboard - High-performance, real-time database-derived statistics and charts
 */
dashboardRouter.get('/', async (req, res) => {
    try {
        const targetMonth = req.query.month ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
        const targetYear = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
        const batchId = req.query.batchId ? parseInt(req.query.batchId, 10) : undefined;
        // 1. Counts query
        const countsSql = `
      SELECT 
        (SELECT COUNT(*) FROM students WHERE status = 'ACTIVE' ${batchId ? 'AND batch_id = ' + batchId : ''}) as active_students,
        (SELECT COUNT(*) FROM batches WHERE is_active = true) as total_batches
    `;
        // 2. Selected Month Expected & Collections query
        // Computes both billed amounts and real cash collections so manual mode & newly added payments reflect in real-time
        const monthStatsSql = `
      SELECT 
        -- Billed expected
        COALESCE(
          (
            SELECT SUM(b.fee_amount - b.adjusted_amount)
            FROM billing_records b
            WHERE b.billing_year = $1 AND b.billing_month = $2
            ${batchId ? 'AND b.batch_id = ' + batchId : ''}
          ), 0
        ) as billed_expected,
        -- Base expected from active students if no bills are generated yet
        COALESCE(
          (
            SELECT SUM(COALESCE(s.monthly_fee, bt.default_fee))
            FROM students s
            JOIN batches bt ON s.batch_id = bt.id
            WHERE s.status = 'ACTIVE'
            ${batchId ? 'AND s.batch_id = ' + batchId : ''}
          ), 0
        ) as base_expected,
        -- Actual cash collected in this calendar month
        COALESCE(
          (
            SELECT SUM(pt.amount)
            FROM payment_transactions pt
            JOIN students s ON pt.student_id = s.id
            WHERE pt.status = 'COMPLETED'
              AND EXTRACT(YEAR FROM pt.payment_date) = $1
              AND EXTRACT(MONTH FROM pt.payment_date) = $2
              ${batchId ? 'AND s.batch_id = ' + batchId : ''}
          ), 0
        ) as cash_collected,
        -- Allocations to this month's bills
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
        ) as allocated_collected
    `;
        // 3. All-time Outstanding Dues
        const dueSql = `
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
        // 4. Status distribution query
        const statusSql = `
      SELECT 
        b.id,
        b.student_id,
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
        // 5. Single Set-Based 6-Month Trends Query (Replaces 6 separate round-trips)
        const trendsSql = `
      WITH months AS (
        SELECT 
          EXTRACT(YEAR FROM d)::int as y,
          EXTRACT(MONTH FROM d)::int as m,
          to_char(d, 'Mon YYYY') as lbl
        FROM generate_series(
          (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months')::date,
          DATE_TRUNC('month', CURRENT_DATE)::date,
          '1 month'::interval
        ) d
      ),
      cash_by_month AS (
        SELECT 
          EXTRACT(YEAR FROM pt.payment_date)::int as y,
          EXTRACT(MONTH FROM pt.payment_date)::int as m,
          SUM(pt.amount) as col
        FROM payment_transactions pt
        JOIN students s ON pt.student_id = s.id
        WHERE pt.status = 'COMPLETED'
        ${batchId ? 'AND s.batch_id = ' + batchId : ''}
        GROUP BY EXTRACT(YEAR FROM pt.payment_date), EXTRACT(MONTH FROM pt.payment_date)
      ),
      billed_by_month AS (
        SELECT 
          br.billing_year as y,
          br.billing_month as m,
          SUM(br.fee_amount - br.adjusted_amount) as exp
        FROM billing_records br
        WHERE 1=1 ${batchId ? 'AND br.batch_id = ' + batchId : ''}
        GROUP BY br.billing_year, br.billing_month
      ),
      base_active AS (
        SELECT COALESCE(SUM(COALESCE(s.monthly_fee, bt.default_fee)), 0) as fallback_exp
        FROM students s
        JOIN batches bt ON s.batch_id = bt.id
        WHERE s.status = 'ACTIVE' ${batchId ? 'AND s.batch_id = ' + batchId : ''}
      )
      SELECT 
        m.lbl,
        m.y as year,
        m.m as month,
        COALESCE(bm.exp, ba.fallback_exp, 0) as exp,
        COALESCE(cm.col, 0) as col
      FROM months m
      CROSS JOIN base_active ba
      LEFT JOIN cash_by_month cm ON m.y = cm.y AND m.m = cm.m
      LEFT JOIN billed_by_month bm ON m.y = bm.y AND m.m = bm.m
      ORDER BY m.y ASC, m.m ASC
    `;
        // 6. Batch Performance Breakdown
        const batchBreakdownSql = `
      SELECT 
        b.id,
        b.name,
        b.code,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'ACTIVE') as student_count,
        GREATEST(
          COALESCE(
            (
              SELECT SUM(pt.amount)
              FROM payment_transactions pt
              JOIN students s2 ON pt.student_id = s2.id
              WHERE s2.batch_id = b.id 
                AND pt.status = 'COMPLETED'
                AND EXTRACT(YEAR FROM pt.payment_date) = $1
                AND EXTRACT(MONTH FROM pt.payment_date) = $2
            ), 0
          ),
          COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              JOIN billing_records br ON pa.billing_record_id = br.id
              WHERE br.batch_id = b.id AND br.billing_year = $1 AND br.billing_month = $2 AND pt.status = 'COMPLETED'
            ), 0
          )
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
      ORDER BY collected_amount DESC, b.name ASC
    `;
        // 7. Recent 5 Payments
        const recentPaymentsSql = `
      SELECT 
        pt.id, pt.receipt_number, pt.payment_date, pt.amount, pt.payment_method, pt.status,
        s.student_code, s.full_name as student_name, b.name as batch_name
      FROM payment_transactions pt
      JOIN students s ON pt.student_id = s.id
      JOIN batches b ON s.batch_id = b.id
      ORDER BY pt.id DESC LIMIT 5
    `;
        // 8. Recent 5 Student Admissions
        const recentAdmissionsSql = `
      SELECT s.id, s.student_code, s.full_name, s.admission_date, s.status, b.name as batch_name
      FROM students s
      JOIN batches b ON s.batch_id = b.id
      ORDER BY s.id DESC LIMIT 5
    `;
        // 9. Follow-up Urgent Alerts (Overdue > 1 month)
        const alertsSql = `
      WITH overdue_counts AS (
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
      SELECT * FROM overdue_counts ORDER BY total_due DESC LIMIT 5
    `;
        // 10. Active student payment lookup for real-time status distribution when no bills exist
        const activeStudentPaymentsSql = `
      SELECT 
        s.id as student_id,
        COALESCE(s.monthly_fee, bt.default_fee) as monthly_fee,
        COALESCE(
          (
            SELECT SUM(pt.amount)
            FROM payment_transactions pt
            WHERE pt.student_id = s.id 
              AND pt.status = 'COMPLETED'
              AND EXTRACT(YEAR FROM pt.payment_date) = $1
              AND EXTRACT(MONTH FROM pt.payment_date) = $2
          ), 0
        ) as paid_in_month
      FROM students s
      JOIN batches bt ON s.batch_id = bt.id
      WHERE s.status = 'ACTIVE'
      ${batchId ? 'AND s.batch_id = ' + batchId : ''}
    `;
        // Execute all queries in PARALLEL via Promise.all (Eliminates laggy loading round-trips)
        const [countsRes, monthStatsRes, dueRes, statusRes, trendsRes, batchBreakdownRes, recentPaymentsRes, recentAdmissionsRes, alertsRes, activeStudentPaymentsRes,] = await Promise.all([
            query(countsSql),
            query(monthStatsSql, [targetYear, targetMonth]),
            query(dueSql),
            query(statusSql, [targetYear, targetMonth]),
            query(trendsSql),
            query(batchBreakdownSql, [targetYear, targetMonth]),
            query(recentPaymentsSql),
            query(recentAdmissionsSql),
            query(alertsSql),
            query(activeStudentPaymentsSql, [targetYear, targetMonth]),
        ]);
        const activeStudents = parseInt(countsRes.rows[0].active_students, 10);
        const totalBatches = parseInt(countsRes.rows[0].total_batches, 10);
        const billedExpected = parseFloat(monthStatsRes.rows[0].billed_expected || '0');
        const baseExpected = parseFloat(monthStatsRes.rows[0].base_expected || '0');
        const expectedFees = billedExpected > 0 ? billedExpected : baseExpected;
        const cashCollected = parseFloat(monthStatsRes.rows[0].cash_collected || '0');
        const allocatedCollected = parseFloat(monthStatsRes.rows[0].allocated_collected || '0');
        const collectedFees = Math.max(cashCollected, allocatedCollected);
        const totalOutstanding = parseFloat(dueRes.rows[0].total_outstanding || '0');
        // Student status distribution for selected month
        let fullyPaidCount = 0;
        let partialCount = 0;
        let unpaidCount = 0;
        let overdueCount = 0;
        const todayStr = new Date().toISOString().slice(0, 10);
        if (statusRes.rows.length > 0) {
            for (const r of statusRes.rows) {
                const net = parseFloat(r.net_fee);
                const paid = parseFloat(r.paid_amount);
                const balance = Math.max(0, net - paid);
                const dueDate = r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date);
                if (balance <= 0) {
                    fullyPaidCount++;
                }
                else if (paid > 0) {
                    partialCount++;
                }
                else if (todayStr > dueDate) {
                    overdueCount++;
                }
                else {
                    unpaidCount++;
                }
            }
        }
        else {
            // If no billing records exist for this month yet, derive status directly from active student payments
            for (const s of activeStudentPaymentsRes.rows) {
                const fee = parseFloat(s.monthly_fee || '0');
                const paid = parseFloat(s.paid_in_month || '0');
                if (paid >= fee && fee > 0) {
                    fullyPaidCount++;
                }
                else if (paid > 0) {
                    partialCount++;
                }
                else {
                    unpaidCount++;
                }
            }
        }
        // Format trends
        const monthlyTrends = trendsRes.rows.map((r) => ({
            label: r.lbl,
            year: parseInt(r.year, 10),
            month: parseInt(r.month, 10),
            expected: parseFloat(r.exp || '0'),
            collected: parseFloat(r.col || '0'),
        }));
        // Format batch performance
        const batchBreakdown = batchBreakdownRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
            studentCount: parseInt(r.student_count || '0', 10),
            collectedAmount: parseFloat(r.collected_amount || '0'),
            outstandingDue: parseFloat(r.outstanding_due || '0'),
        }));
        // Format recent payments (support both camelCase and snake_case for frontend & API compatibility)
        const recentPayments = recentPaymentsRes.rows.map((r) => ({
            id: r.id,
            receiptNumber: r.receipt_number,
            receipt_number: r.receipt_number,
            paymentDate: r.payment_date instanceof Date ? r.payment_date.toISOString().slice(0, 10) : String(r.payment_date),
            payment_date: r.payment_date instanceof Date ? r.payment_date.toISOString().slice(0, 10) : String(r.payment_date),
            amount: parseFloat(r.amount),
            paymentMethod: r.payment_method,
            payment_method: r.payment_method,
            status: r.status,
            studentCode: r.student_code,
            student_code: r.student_code,
            studentName: r.student_name,
            student_name: r.student_name,
            batchName: r.batch_name,
            batch_name: r.batch_name,
        }));
        // Format recent admissions
        const recentAdmissions = recentAdmissionsRes.rows.map((r) => ({
            id: r.id,
            studentCode: r.student_code,
            student_code: r.student_code,
            fullName: r.full_name,
            full_name: r.full_name,
            admissionDate: r.admission_date instanceof Date ? r.admission_date.toISOString().slice(0, 10) : String(r.admission_date),
            admission_date: r.admission_date instanceof Date ? r.admission_date.toISOString().slice(0, 10) : String(r.admission_date),
            status: r.status,
            batchName: r.batch_name,
            batch_name: r.batch_name,
        }));
        // Format urgent overdue follow-ups
        const urgentFollowUps = alertsRes.rows.map((r) => ({
            studentId: r.student_id,
            student_id: r.student_id,
            studentCode: r.student_code,
            student_code: r.student_code,
            fullName: r.full_name,
            full_name: r.full_name,
            guardianPhone: r.guardian_phone,
            guardian_phone: r.guardian_phone,
            batchName: r.batch_name,
            batch_name: r.batch_name,
            overdueMonthsCount: parseInt(r.overdue_month_count, 10),
            overdue_month_count: parseInt(r.overdue_month_count, 10),
            totalDue: parseFloat(r.total_due),
            total_due: parseFloat(r.total_due),
        }));
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
            monthlyTrends,
            batchBreakdown,
            recentPayments,
            recentAdmissions,
            followUpAlerts: urgentFollowUps,
            urgentFollowUps,
            serverTimestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error('[Dashboard Error]:', err.message);
        res.status(500).json({ error: 'Failed to retrieve dashboard analytics.' });
    }
});
