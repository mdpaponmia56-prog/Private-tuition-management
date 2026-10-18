import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { BillingService } from '../services/billing.service.js';

export const billingRouter = Router();

billingRouter.use(requireAuth);

/**
 * GET /api/billing - List billing records with search and status filters
 */
billingRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, batchId, billingYear, billingMonth, status, search } = req.query;

    const records = await BillingService.getBillingRecords({
      studentId: studentId ? parseInt(studentId as string, 10) : undefined,
      batchId: batchId ? parseInt(batchId as string, 10) : undefined,
      billingYear: billingYear ? parseInt(billingYear as string, 10) : undefined,
      billingMonth: billingMonth ? parseInt(billingMonth as string, 10) : undefined,
      status: status as string,
      search: search as string,
    });

    res.json({ records, total: records.length });
  } catch (err: any) {
    console.error('[Billing Records Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch billing records.' });
  }
});

/**
 * POST /api/billing/generate - Generate or preview monthly recurring bills (Mode A)
 */
billingRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month, batchId, isPreview } = req.body;

    if (!year || !month) {
      res.status(400).json({ error: 'Year and month are required.' });
      return;
    }

    const result = await BillingService.generateMonthlyBills({
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      batchId: batchId ? parseInt(batchId, 10) : undefined,
      isPreview: Boolean(isPreview),
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[Generate Bills Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate monthly bills.' });
  }
});

/**
 * POST /api/billing/manual - Create manual fee obligation (Mode B)
 */
billingRouter.post('/manual', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, billingYear, billingMonth, feeAmount, dueDate, notes } = req.body;

    if (!studentId || !billingYear || !billingMonth || feeAmount === undefined || !dueDate) {
      res.status(400).json({ error: 'Student, billing year, month, fee amount, and due date are required.' });
      return;
    }

    const record = await BillingService.createManualBill({
      studentId: parseInt(studentId, 10),
      billingYear: parseInt(billingYear, 10),
      billingMonth: parseInt(billingMonth, 10),
      feeAmount: parseFloat(feeAmount),
      dueDate,
      notes,
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Manual billing obligation created successfully.', record });
  } catch (err: any) {
    console.error('[Manual Bill Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create manual bill.' });
  }
});

/**
 * POST /api/billing/:id/adjust - Add fee adjustment / waiver / scholarship
 */
billingRouter.post('/:id/adjust', async (req: Request, res: Response): Promise<void> => {
  try {
    const billingRecordId = parseInt(req.params.id, 10);
    const { adjustmentType, amount, reason } = req.body;

    if (!adjustmentType || !amount || !reason) {
      res.status(400).json({ error: 'Adjustment type, amount, and reason are required.' });
      return;
    }

    const updatedBill = await BillingService.addAdjustment({
      billingRecordId,
      adjustmentType,
      amount: parseFloat(amount),
      reason: reason.trim(),
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      ipAddress: req.ip,
    });

    res.json({ message: 'Fee adjustment recorded successfully.', record: updatedBill });
  } catch (err: any) {
    console.error('[Fee Adjustment Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to apply fee adjustment.' });
  }
});

/**
 * DELETE /api/billing/:id - Delete an unpaid billing obligation
 */
billingRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const billingRecordId = parseInt(req.params.id, 10);

    const billRes = await query(
      `SELECT 
        b.*,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            WHERE pa.billing_record_id = b.id AND pt.status = 'COMPLETED'
          ), 0
        ) as paid_amount
       FROM billing_records b
       WHERE b.id = $1`,
      [billingRecordId]
    );

    if (billRes.rows.length === 0) {
      res.status(404).json({ error: 'Billing record not found.' });
      return;
    }

    const bill = billRes.rows[0];
    const paid = parseFloat(bill.paid_amount || '0');

    if (paid > 0) {
      res.status(400).json({
        error: `Cannot delete billing record with ৳${paid} allocated payments. Reverse payments first.`,
      });
      return;
    }

    // Delete adjustments first then billing record
    await query('DELETE FROM fee_adjustments WHERE billing_record_id = $1', [billingRecordId]);
    await query('DELETE FROM payment_allocations WHERE billing_record_id = $1', [billingRecordId]);
    await query('DELETE FROM billing_records WHERE id = $1', [billingRecordId]);

    const { recordAuditLog } = await import('../middleware/audit.js');
    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'DELETE_BILLING_RECORD',
      entityType: 'BILLING_RECORD',
      entityId: billingRecordId,
      oldValues: bill,
      ipAddress: req.ip,
    });

    res.json({ message: 'Billing record deleted successfully.' });
  } catch (err: any) {
    console.error('[Delete Billing Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete billing record.' });
  }
});

