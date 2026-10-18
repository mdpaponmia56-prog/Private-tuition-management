import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { query, withTransaction } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';
import { uploadStudentPhoto } from '../middleware/upload.js';
import { config } from '../config/index.js';
import { BillingService } from '../services/billing.service.js';

export const studentRouter = Router();

studentRouter.use(requireAuth);

/**
 * Generate unique student code: STU-YYYY-XXXX
 */
async function generateStudentCode(client: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `STU-${currentYear}-`;

  const countRes = await client.query(
    `SELECT COUNT(*) as count FROM students WHERE student_code LIKE $1`,
    [`${prefix}%`]
  );
  const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * GET /api/students - List students with search, filters, pagination, and balance
 */
studentRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId, className, status, billingMode, search, dueFilter } = req.query;

    let sql = `
      SELECT 
        s.*,
        b.name as batch_name,
        b.code as batch_code,
        b.default_fee as batch_default_fee,
        b.default_billing_mode as batch_default_billing_mode,
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
      JOIN batches b ON s.batch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (batchId) {
      params.push(parseInt(batchId as string, 10));
      sql += ` AND s.batch_id = $${params.length}`;
    }

    if (className) {
      params.push(className);
      sql += ` AND s.class_name = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND s.status = $${params.length}`;
    } else if (!status) {
      // Default to non-archived
      sql += ` AND s.status != 'ARCHIVED'`;
    }

    if (billingMode && billingMode !== 'ALL') {
      params.push(billingMode);
      sql += ` AND COALESCE(s.billing_mode, b.default_billing_mode) = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.student_code ILIKE $${params.length} OR s.guardian_phone ILIKE $${params.length} OR s.student_phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY s.id DESC`;

    const result = await query(sql, params);

    let rows = result.rows;
    if (dueFilter === 'WITH_DUE') {
      rows = rows.filter((r) => parseFloat(r.total_due) > 0);
    } else if (dueFilter === 'NO_DUE') {
      rows = rows.filter((r) => parseFloat(r.total_due) <= 0);
    }

    res.json({ students: rows, total: rows.length });
  } catch (err: any) {
    console.error('[Students List Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

/**
 * GET /api/students/:id - Detailed profile
 */
studentRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);

    const studentRes = await query(
      `SELECT s.*, 
        b.name as batch_name, 
        b.code as batch_code,
        b.default_fee as batch_default_fee,
        b.default_billing_mode as batch_default_billing_mode
       FROM students s
       JOIN batches b ON s.batch_id = b.id
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const student = studentRes.rows[0];

    // Fetch enrollment history
    const enrollRes = await query(
      `SELECT eh.*, b.name as batch_name, b.code as batch_code
       FROM enrollment_history eh
       JOIN batches b ON eh.batch_id = b.id
       WHERE eh.student_id = $1
       ORDER BY eh.effective_from DESC, eh.id DESC`,
      [studentId]
    );

    // Fetch billing ledger
    const billingRecords = await BillingService.getBillingRecords({ studentId });

    // Fetch payment transactions
    const paymentRes = await query(
      `SELECT pt.*, adm.full_name as recorded_by_admin
       FROM payment_transactions pt
       JOIN administrators adm ON pt.recorded_by = adm.id
       WHERE pt.student_id = $1
       ORDER BY pt.payment_date DESC, pt.id DESC`,
      [studentId]
    );

    // Total due calculation
    const totalDue = billingRecords.reduce((acc, b) => acc + b.balance, 0);
    const totalPaid = billingRecords.reduce((acc, b) => acc + b.paidAmount, 0);

    res.json({
      student,
      enrollmentHistory: enrollRes.rows,
      billingRecords,
      paymentTransactions: paymentRes.rows,
      financialSummary: {
        totalDue,
        totalPaid,
        totalBillsCount: billingRecords.length,
        unpaidBillsCount: billingRecords.filter((b) => b.status === 'UNPAID' || b.status === 'OVERDUE').length,
      },
    });
  } catch (err: any) {
    console.error('[Student Detail Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch student details.' });
  }
});

/**
 * POST /api/students - Register student
 */
studentRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      studentPhone,
      guardianPhone,
      batchId,
      className,
      admissionDate,
      monthlyFee,
      billingMode,
      billingStartDate,
      address,
      notes,
    } = req.body;

    if (!fullName || !guardianPhone || !batchId || !className) {
      res.status(400).json({ error: 'Full name, guardian phone, batch, and class are required.' });
      return;
    }

    const newStudent = await withTransaction(async (client) => {
      // Verify batch
      const batchRes = await client.query('SELECT * FROM batches WHERE id = $1', [batchId]);
      if (batchRes.rows.length === 0) {
        throw new Error('Selected batch not found.');
      }
      const batch = batchRes.rows[0];

      const studentCode = await generateStudentCode(client);
      const feeOverride = monthlyFee !== undefined && monthlyFee !== '' ? parseFloat(monthlyFee) : null;
      const modeOverride = billingMode ? billingMode : null;

      const insertRes = await client.query(
        `INSERT INTO students (
          student_code, full_name, student_phone, guardian_phone, batch_id, class_name,
          admission_date, monthly_fee, billing_mode, billing_start_date, status, address, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $12)
        RETURNING *`,
        [
          studentCode,
          fullName.trim(),
          studentPhone ? studentPhone.trim() : null,
          guardianPhone.trim(),
          batchId,
          className.trim(),
          admissionDate || new Date().toISOString().slice(0, 10),
          feeOverride,
          modeOverride,
          billingStartDate || admissionDate || new Date().toISOString().slice(0, 10),
          address ? address.trim() : null,
          notes ? notes.trim() : null,
        ]
      );

      const student = insertRes.rows[0];

      // Record initial enrollment history
      const effectiveFee = feeOverride !== null ? feeOverride : parseFloat(batch.default_fee);
      const effectiveMode = modeOverride || batch.default_billing_mode;

      await client.query(
        `INSERT INTO enrollment_history (
          student_id, batch_id, effective_from, fee_snapshot, billing_mode_snapshot, notes
        ) VALUES ($1, $2, $3, $4, $5, 'Initial batch admission')`,
        [student.id, batchId, student.admission_date, effectiveFee, effectiveMode]
      );

      await recordAuditLog({
        adminId: req.admin!.id,
        adminName: req.admin!.fullName,
        action: 'CREATE_STUDENT',
        entityType: 'STUDENT',
        entityId: student.id,
        newValues: student,
        ipAddress: req.ip,
      });

      return student;
    });

    res.status(201).json({ message: 'Student registered successfully.', student: newStudent });
  } catch (err: any) {
    console.error('[Create Student Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to register student.' });
  }
});

/**
 * PUT /api/students/:id - Update student & track batch movement
 */
studentRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);

    const updatedStudent = await withTransaction(async (client) => {
      const existingRes = await client.query('SELECT * FROM students WHERE id = $1', [studentId]);
      if (existingRes.rows.length === 0) {
        throw new Error('Student not found.');
      }
      const existing = existingRes.rows[0];

      const {
        fullName,
        studentPhone,
        guardianPhone,
        batchId,
        className,
        admissionDate,
        monthlyFee,
        billingMode,
        billingStartDate,
        status,
        address,
        notes,
      } = req.body;

      const newBatchId = batchId !== undefined ? parseInt(batchId, 10) : existing.batch_id;
      const isBatchChanged = newBatchId !== existing.batch_id;

      const feeOverride = monthlyFee !== undefined ? (monthlyFee === '' ? null : parseFloat(monthlyFee)) : existing.monthly_fee;
      const modeOverride = billingMode !== undefined ? (billingMode === '' ? null : billingMode) : existing.billing_mode;

      const updateRes = await client.query(
        `UPDATE students SET
          full_name = COALESCE($1, full_name),
          student_phone = $2,
          guardian_phone = COALESCE($3, guardian_phone),
          batch_id = $4,
          class_name = COALESCE($5, class_name),
          admission_date = COALESCE($6, admission_date),
          monthly_fee = $7,
          billing_mode = $8,
          billing_start_date = COALESCE($9, billing_start_date),
          status = COALESCE($10, status),
          address = $11,
          notes = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $13
        RETURNING *`,
        [
          fullName ? fullName.trim() : null,
          studentPhone !== undefined ? (studentPhone ? studentPhone.trim() : null) : existing.student_phone,
          guardianPhone ? guardianPhone.trim() : null,
          newBatchId,
          className ? className.trim() : null,
          admissionDate || null,
          feeOverride,
          modeOverride,
          billingStartDate || null,
          status || null,
          address !== undefined ? (address ? address.trim() : null) : existing.address,
          notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          studentId,
        ]
      );

      const student = updateRes.rows[0];

      // If batch changed, close previous enrollment record and insert new one
      if (isBatchChanged) {
        const today = new Date().toISOString().slice(0, 10);
        await client.query(
          `UPDATE enrollment_history 
           SET effective_to = $1 
           WHERE student_id = $2 AND effective_to IS NULL`,
          [today, studentId]
        );

        const newBatchRes = await client.query('SELECT default_fee, default_billing_mode FROM batches WHERE id = $1', [newBatchId]);
        const newBatch = newBatchRes.rows[0];
        const effectiveFee = feeOverride !== null ? feeOverride : parseFloat(newBatch.default_fee);
        const effectiveMode = modeOverride || newBatch.default_billing_mode;

        await client.query(
          `INSERT INTO enrollment_history (
            student_id, batch_id, effective_from, fee_snapshot, billing_mode_snapshot, notes
          ) VALUES ($1, $2, $3, $4, $5, 'Transferred from previous batch')`,
          [studentId, newBatchId, today, effectiveFee, effectiveMode]
        );
      }

      await recordAuditLog({
        adminId: req.admin!.id,
        adminName: req.admin!.fullName,
        action: isBatchChanged ? 'TRANSFER_STUDENT_BATCH' : 'UPDATE_STUDENT',
        entityType: 'STUDENT',
        entityId: studentId,
        oldValues: existing,
        newValues: student,
        ipAddress: req.ip,
      });

      return student;
    });

    res.json({ message: 'Student updated successfully.', student: updatedStudent });
  } catch (err: any) {
    console.error('[Update Student Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update student.' });
  }
});

/**
 * POST /api/students/:id/photo - Upload student photo (Strict type & size validation)
 */
studentRouter.post('/:id/photo', uploadStudentPhoto.single('photo'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded.' });
      return;
    }

    const filename = req.file.filename;
    const mimeType = req.file.mimetype;

    const existingRes = await query('SELECT photo_filename FROM students WHERE id = $1', [studentId]);
    if (existingRes.rows.length === 0) {
      // Remove uploaded file if student not found
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // Delete old photo if existed
    const oldPhoto = existingRes.rows[0].photo_filename;
    if (oldPhoto) {
      const oldPath = path.join(config.storageDir, 'photos', oldPhoto);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    await query(
      `UPDATE students SET photo_filename = $1, photo_mime_type = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [filename, mimeType, studentId]
    );

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'UPLOAD_STUDENT_PHOTO',
      entityType: 'STUDENT',
      entityId: studentId,
      newValues: { filename, mimeType },
      ipAddress: req.ip,
    });

    res.json({ message: 'Student photo updated successfully.', photoFilename: filename });
  } catch (err: any) {
    console.error('[Photo Upload Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to upload photo.' });
  }
});

/**
 * GET /api/students/:id/photo - Secure photo serving (Authenticated only, prevents open browsing)
 */
studentRouter.get('/:id/photo', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const studentRes = await query('SELECT photo_filename, photo_mime_type FROM students WHERE id = $1', [studentId]);

    if (studentRes.rows.length === 0 || !studentRes.rows[0].photo_filename) {
      res.status(404).json({ error: 'Student photo not found.' });
      return;
    }

    const { photo_filename, photo_mime_type } = studentRes.rows[0];
    const photoPath = path.join(config.storageDir, 'photos', photo_filename);

    if (!fs.existsSync(photoPath)) {
      res.status(404).json({ error: 'Photo file missing on server.' });
      return;
    }

    res.setHeader('Content-Type', photo_mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(photoPath).pipe(res);
  } catch (err: any) {
    console.error('[Photo Serve Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve photo.' });
  }
});

/**
 * POST /api/students/:id/archive - Soft delete / archive
 */
studentRouter.post('/:id/archive', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);
    await query('UPDATE students SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['ARCHIVED', studentId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'ARCHIVE_STUDENT',
      entityType: 'STUDENT',
      entityId: studentId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Student archived successfully.' });
  } catch (err: any) {
    console.error('[Archive Student Error]:', err.message);
    res.status(500).json({ error: 'Failed to archive student.' });
  }
});

/**
 * POST /api/students/:id/restore - Restore archived student
 */
studentRouter.post('/:id/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);
    await query('UPDATE students SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['ACTIVE', studentId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'RESTORE_STUDENT',
      entityType: 'STUDENT',
      entityId: studentId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Student restored to active status.' });
  } catch (err: any) {
    console.error('[Restore Student Error]:', err.message);
    res.status(500).json({ error: 'Failed to restore student.' });
  }
});

/**
 * DELETE /api/students/:id - Permanent deletion check
 * A student with financial history MUST NOT be permanently deleted.
 */
studentRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id, 10);

    const historyCheck = await query(
      `SELECT 
        (SELECT COUNT(*) FROM billing_records WHERE student_id = $1) as bill_count,
        (SELECT COUNT(*) FROM payment_transactions WHERE student_id = $1) as pay_count`,
      [studentId]
    );

    const billCount = parseInt(historyCheck.rows[0].bill_count, 10);
    const payCount = parseInt(historyCheck.rows[0].pay_count, 10);

    if (billCount > 0 || payCount > 0) {
      res.status(400).json({
        error: `Cannot permanently delete student: ${billCount} billing records and ${payCount} payment transactions exist. Archival is required to preserve financial records.`,
      });
      return;
    }

    await query('DELETE FROM students WHERE id = $1', [studentId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'DELETE_STUDENT',
      entityType: 'STUDENT',
      entityId: studentId,
      ipAddress: req.ip,
    });

    res.json({ message: 'Student deleted successfully.' });
  } catch (err: any) {
    console.error('[Delete Student Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete student.' });
  }
});
