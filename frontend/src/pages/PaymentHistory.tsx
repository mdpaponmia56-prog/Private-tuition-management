import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { PaymentTransaction, PaymentReceipt } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  History,
  Search,
  Printer,
  RotateCcw,
  AlertTriangle,
  Receipt,
  Download,
  X,
  Filter,
} from 'lucide-react';
import { ReceiptModal } from '../components/ReceiptModal.js';

export const PaymentHistory: React.FC = () => {
  const { language, t } = useLanguage();

  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [reversalPayment, setReversalPayment] = useState<PaymentTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let query = '/api/payments?';
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (paymentMethod !== 'ALL') query += `&paymentMethod=${paymentMethod}`;
      if (status !== 'ALL') query += `&status=${status}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;

      const res = await apiFetch<{ payments: PaymentTransaction[] }>(query);
      setPayments(res.payments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, paymentMethod, status, startDate, endDate]);

  const viewReceipt = async (id: number) => {
    try {
      const res = await apiFetch<{ receipt: PaymentReceipt }>(`/api/payments/${id}/receipt`);
      setSelectedReceipt(res.receipt);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch receipt.');
    }
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment) return;
    if (!reversalReason.trim()) {
      setReversalError('Please provide a specific reason for reversing this financial transaction.');
      return;
    }

    setReversalError('');
    setReversing(true);

    try {
      await apiFetch(`/api/payments/${reversalPayment.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      setReversalPayment(null);
      setReversalReason('');
      fetchPayments();
    } catch (err: any) {
      setReversalError(err.message || 'Payment reversal failed.');
    } finally {
      setReversing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.paymentHistory}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Immutable financial transaction ledger, receipt reprints, and audited payment reversals
          </p>
        </div>

        <a
          href="/api/reports/export/collections.csv"
          download
          className="btn btn-secondary"
        >
          <Download size={16} />
          <span>{t.exportCsv}</span>
        </a>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search receipt #, student, TrxID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>

          {/* Payment Method */}
          <select
            className="form-control"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="BKASH">bKash</option>
            <option value="NAGAD">Nagad</option>
            <option value="ROCKET">Rocket</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>

          {/* Status */}
          <select
            className="form-control"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed (Valid)</option>
            <option value="REVERSED">Reversed</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start Date"
          />

          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End Date"
          />
        </div>
      </div>

      {/* Payment Transactions Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date</th>
              <th>Student Name</th>
              <th>Batch</th>
              <th>Amount Received</th>
              <th>Method & TrxID</th>
              <th>Recorded By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t.loading}
                </td>
              </tr>
            ) : payments.length > 0 ? (
              payments.map((p) => {
                const isReversed = p.status === 'REVERSED';
                return (
                  <tr key={p.id} style={{ opacity: isReversed ? 0.65 : 1 }}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem' }}>
                        {p.receipt_number}
                      </span>
                    </td>
                    <td>{p.payment_date}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.student_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{p.student_code}</div>
                    </td>
                    <td>{p.batch_name}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: isReversed ? 'var(--text-muted)' : 'var(--primary)', textDecoration: isReversed ? 'line-through' : 'none' }}>
                        {formatBDT(p.amount, language)}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a' }}>{p.payment_method}</span>
                      </div>
                      {p.transaction_reference && (
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.transaction_reference}
                        </div>
                      )}
                    </td>
                    <td>{p.recorded_by_admin}</td>
                    <td>
                      <span className={`badge ${isReversed ? 'badge-overdue' : 'badge-paid'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          onClick={() => viewReceipt(p.id)}
                          title="Print / View Money Receipt"
                        >
                          <Receipt size={15} />
                        </button>

                        {!isReversed && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => {
                              setReversalPayment(p);
                              setReversalReason('');
                              setReversalError('');
                            }}
                            title="Reverse Payment Transaction"
                          >
                            <RotateCcw size={15} color="var(--danger)" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Controlled Payment Reversal Modal */}
      {reversalPayment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                <AlertTriangle size={20} />
                <span>Reverse Payment Transaction</span>
              </div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setReversalPayment(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteReversal}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  Reversing this payment will restore the student's outstanding billing balance and record an immutable audit event. The original transaction will not be deleted.
                </p>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.85rem' }}>
                  <div><strong>Receipt Number:</strong> {reversalPayment.receipt_number}</div>
                  <div><strong>Student:</strong> {reversalPayment.student_name}</div>
                  <div><strong>Amount:</strong> {formatBDT(reversalPayment.amount, language)}</div>
                </div>

                {reversalError && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 14, fontSize: '0.85rem' }}>
                    {reversalError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Mandatory Reason for Reversal *</label>
                  <textarea
                    rows={3}
                    required
                    className="form-control"
                    placeholder="e.g. bKash payment charged back / mistakenly entered wrong amount"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReversalPayment(null)} disabled={reversing}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-danger" disabled={reversing}>
                  {reversing ? t.loading : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
