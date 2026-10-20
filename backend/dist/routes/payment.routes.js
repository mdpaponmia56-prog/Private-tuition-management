import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PaymentService } from '../services/payment.service.js';
export const paymentRouter = Router();
paymentRouter.use(requireAuth);
/**
 * GET /api/payments - List payments with filters
 */
paymentRouter.get('/', async (req, res) => {
    try {
        const { studentId, batchId, startDate, endDate, paymentMethod, status, search } = req.query;
        const payments = await PaymentService.getPayments({
            studentId: studentId ? parseInt(studentId, 10) : undefined,
            batchId: batchId ? parseInt(batchId, 10) : undefined,
            startDate: startDate,
            endDate: endDate,
            paymentMethod: paymentMethod,
            status: status,
            search: search,
        });
        res.json({ payments, total: payments.length });
    }
    catch (err) {
        console.error('[Payments List Error]:', err.message);
        res.status(500).json({ error: 'Failed to fetch payment records.' });
    }
});
/**
 * POST /api/payments - Record a new payment and allocate to bills
 */
paymentRouter.post('/', async (req, res) => {
    try {
        const { studentId, amount, paymentMethod, paymentDate, transactionReference, notes, billingRecordId } = req.body;
        if (!studentId || !amount || !paymentMethod) {
            res.status(400).json({ error: 'Student, amount, and payment method are required.' });
            return;
        }
        const receipt = await PaymentService.recordPayment({
            studentId: parseInt(studentId, 10),
            amount: parseFloat(amount),
            paymentMethod,
            paymentDate,
            transactionReference,
            notes,
            billingRecordId: billingRecordId ? parseInt(billingRecordId, 10) : undefined,
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            ipAddress: req.ip,
        });
        res.status(201).json({ message: 'Payment recorded successfully.', receipt, payment: receipt });
    }
    catch (err) {
        console.error('[Record Payment Error]:', err.message);
        res.status(500).json({ error: err.message || 'Failed to record payment.' });
    }
});
/**
 * GET /api/payments/:id/receipt - Get full receipt details for reprint
 */
paymentRouter.get('/:id/receipt', async (req, res) => {
    try {
        const receipt = await PaymentService.getReceipt(req.params.id);
        res.json({ receipt });
    }
    catch (err) {
        console.error('[Get Receipt Error]:', err.message);
        res.status(404).json({ error: err.message || 'Receipt not found.' });
    }
});
/**
 * POST /api/payments/:id/reverse - Reverse payment transaction with reason
 */
paymentRouter.post('/:id/reverse', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id, 10);
        const { reason } = req.body;
        if (!reason || reason.trim().length === 0) {
            res.status(400).json({ error: 'A valid reason is required to reverse a payment transaction.' });
            return;
        }
        await PaymentService.reversePayment({
            paymentId,
            reason: reason.trim(),
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            ipAddress: req.ip,
        });
        res.json({ message: 'Payment transaction reversed successfully.' });
    }
    catch (err) {
        console.error('[Reverse Payment Error]:', err.message);
        res.status(500).json({ error: err.message || 'Failed to reverse payment.' });
    }
});
