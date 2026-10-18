import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';

export const batchRouter = Router();

batchRouter.use(requireAuth);

/**
 * GET /api/batches - List batches with live student counts and financial metrics
 */
batchRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const sql = `
      SELECT 
        b.*,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'ACTIVE') as active_student_count,
        COALESCE(
          SUM(
            CASE 
              WHEN s.status = 'ACTIVE' THEN COALESCE(s.monthly_fee, b.default_fee)
              ELSE 0 
            END
          ), 0
        ) as expected_monthly_fees,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            JOIN billing_records br ON pa.billing_record_id = br.id
            WHERE br.batch_id = b.id 
              AND br.billing_year = $1 
              AND br.billing_month = $2 
              AND pt.status = 'COMPLETED'
          ), 0
        ) as current_month_collections,
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
        ) as total_outstanding_dues
      FROM batches b
      LEFT JOIN students s ON s.batch_id = b.id
      GROUP BY b.id
      ORDER BY b.is_active DESC, b.name ASC
    `;

    const result = await query(sql, [currentYear, currentMonth]);
    res.json({ batches: result.rows });
  } catch (err: any) {
    console.error('[Batches List Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch batches.' });
  }
});

/**
 * GET /api/batches/:id - Get batch details with enrolled students
 */
batchRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const batchId = parseInt(req.params.id, 10);
    const batchRes = await query('SELECT * FROM batches WHERE id = $1', [batchId]);
    if (batchRes.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }

    const studentsRes = await query(
      `SELECT s.*, 
        COALESCE(
          (
            SELECT SUM(GREATEST(0, (br.fee_amount - br.adjusted_amount) - COALESCE(
              (
                SELECT SUM(pa.allocated_amount)
                FROM payment_allocations pa
                JOIN payment_transactions pt ON pa.payment_id = pt.id
                WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
              ), 0)
            ))
            FROM billing_records br
            WHERE br.student_id = s.id
          ), 0
        ) as total_due
       FROM students s
       WHERE s.batch_id = $1
       ORDER BY s.status ASC, s.full_name ASC`,
      [batchId]
    );

    res.json({
      batch: batchRes.rows[0],
      students: studentsRes.rows,
    });
  } catch (err: any) {
    console.error('[Batch Detail Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch batch details.' });
  }
});

/**
 * POST /api/batches - Create batch
 */
batchRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      code,
      className,
      subject,
      defaultFee,
      defaultBillingMode,
      billingDayOfMonth,
      gracePeriodDays,
      startDate,
      scheduleText,
      notes,
    } = req.body;

    if (!name || !code || !className) {
      res.status(400).json({ error: 'Batch name, code, and class are required.' });
      return;
    }

    const existingCode = await query('SELECT id FROM batches WHERE code = $1', [code.trim().toUpperCase()]);
    if (existingCode.rows.length > 0) {
      res.status(409).json({ error: 'A batch with this code already exists.' });
      return;
    }

    const insertRes = await query(
      `INSERT INTO batches (
        name, code, class_name, subject, default_fee, default_billing_mode,
        billing_day_of_month, grace_period_days, start_date, schedule_text, notes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        className.trim(),
        subject ? subject.trim() : null,
        parseFloat(defaultFee || '0'),
        defaultBillingMode || 'AUTOMATIC',
        parseInt(billingDayOfMonth || '1', 10),
        parseInt(gracePeriodDays || '7', 10),
        startDate || new Date().toISOString().slice(0, 10),
        scheduleText ? scheduleText.trim() : null,
        notes ? notes.trim() : null,
      ]
    );

    const newBatch = insertRes.rows[0];

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: newBatch.id,
      newValues: newBatch,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Batch created successfully.', batch: newBatch });
  } catch (err: any) {
    console.error('[Create Batch Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create batch.' });
  }
});

/**
 * PUT /api/batches/:id - Update batch
 */
batchRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const batchId = parseInt(req.params.id, 10);
    const existing = await query('SELECT * FROM batches WHERE id = $1', [batchId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }

    const {
      name,
      code,
      className,
      subject,
      defaultFee,
      defaultBillingMode,
      billingDayOfMonth,
      gracePeriodDays,
      startDate,
      scheduleText,
      notes,
      isActive,
    } = req.body;

    const updateRes = await query(
      `UPDATE batches SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        class_name = COALESCE($3, class_name),
        subject = COALESCE($4, subject),
        default_fee = COALESCE($5, default_fee),
        default_billing_mode = COALESCE($6, default_billing_mode),
        billing_day_of_month = COALESCE($7, billing_day_of_month),
        grace_period_days = COALESCE($8, grace_period_days),
        start_date = COALESCE($9, start_date),
        schedule_text = COALESCE($10, schedule_text),
        notes = COALESCE($11, notes),
        is_active = COALESCE($12, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        className ? className.trim() : null,
        subject !== undefined ? (subject ? subject.trim() : null) : null,
        defaultFee !== undefined ? parseFloat(defaultFee) : null,
        defaultBillingMode || null,
        billingDayOfMonth !== undefined ? parseInt(billingDayOfMonth, 10) : null,
        gracePeriodDays !== undefined ? parseInt(gracePeriodDays, 10) : null,
        startDate || null,
        scheduleText !== undefined ? (scheduleText ? scheduleText.trim() : null) : null,
        notes !== undefined ? (notes ? notes.trim() : null) : null,
        isActive !== undefined ? Boolean(isActive) : null,
        batchId,
      ]
    );

    const updatedBatch = updateRes.rows[0];

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'UPDATE_BATCH',
      entityType: 'BATCH',
      entityId: batchId,
      oldValues: existing.rows[0],
      newValues: updatedBatch,
      ipAddress: req.ip,
    });

    res.json({ message: 'Batch updated successfully.', batch: updatedBatch });
  } catch (err: any) {
    console.error('[Update Batch Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update batch.' });
  }
});

/**
 * DELETE /api/batches/:id - Archive or permanently delete batch
 */
batchRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const batchId = parseInt(req.params.id, 10);
    const permanent = req.query.permanent === 'true';

    const existing = await query('SELECT * FROM batches WHERE id = $1', [batchId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }

    if (permanent) {
      // Check if students exist in batch
      const studentCountRes = await query('SELECT COUNT(*) as count FROM students WHERE batch_id = $1', [batchId]);
      const studentCount = parseInt(studentCountRes.rows[0].count, 10);
      if (studentCount > 0) {
        res.status(400).json({ error: `Cannot permanently delete batch: ${studentCount} students are enrolled. Move or archive students first.` });
        return;
      }

      // Check if billing records reference this batch
      const billingCountRes = await query('SELECT COUNT(*) as count FROM billing_records WHERE batch_id = $1', [batchId]);
      const billingCount = parseInt(billingCountRes.rows[0].count, 10);
      if (billingCount > 0) {
        res.status(400).json({ error: `Cannot permanently delete batch: ${billingCount} historical billing records reference this batch. Archive instead.` });
        return;
      }

      await query('DELETE FROM batches WHERE id = $1', [batchId]);

      await recordAuditLog({
        adminId: req.admin!.id,
        adminName: req.admin!.fullName,
        action: 'DELETE_BATCH',
        entityType: 'BATCH',
        entityId: batchId,
        oldValues: existing.rows[0],
        ipAddress: req.ip,
      });

      res.json({ message: 'Batch permanently deleted successfully.' });
      return;
    }

    // Default: Soft delete / archive
    await query('UPDATE batches SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [batchId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'ARCHIVE_BATCH',
      entityType: 'BATCH',
      entityId: batchId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Batch archived successfully.' });
  } catch (err: any) {
    console.error('[Archive/Delete Batch Error]:', err.message);
    res.status(500).json({ error: 'Failed to archive or delete batch.' });
  }
});

/**
 * POST /api/batches/:id/restore - Restore archived batch
 */
batchRouter.post('/:id/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const batchId = parseInt(req.params.id, 10);
    await query('UPDATE batches SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [batchId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'RESTORE_BATCH',
      entityType: 'BATCH',
      entityId: batchId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Batch restored successfully.' });
  } catch (err: any) {
    console.error('[Restore Batch Error]:', err.message);
    res.status(500).json({ error: 'Failed to restore batch.' });
  }
});
