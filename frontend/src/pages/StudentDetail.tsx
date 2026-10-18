import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { Student, BillingRecord, PaymentReceipt } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  ArrowLeft,
  Calendar,
  Phone,
  DollarSign,
  FileText,
  CreditCard,
  PlusCircle,
  Receipt,
  Printer,
  History,
  X,
  Gift,
  Trash2,
} from 'lucide-react';
import { ReceiptModal } from '../components/ReceiptModal.js';
import { DeleteStudentModal } from '../components/DeleteStudentModal.js';

interface StudentDetailProps {
  studentId: number;
  onBack: () => void;
  onCollectFee: (student: Student) => void;
}

export const StudentDetail: React.FC<StudentDetailProps> = ({ studentId, onBack, onCollectFee }) => {
  const { language, t } = useLanguage();

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollmentHistory, setEnrollmentHistory] = useState<any[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalDue: number; totalPaid: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ledger' | 'payments' | 'enrollment' | 'statement'>('ledger');

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [showManualBillModal, setShowManualBillModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<number | null>(null); // billingRecordId
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);

  // Manual Bill Form
  const [mbYear, setMbYear] = useState(new Date().getFullYear());
  const [mbMonth, setMbMonth] = useState(new Date().getMonth() + 1);
  const [mbAmount, setMbAmount] = useState('');
  const [mbDueDate, setMbDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [mbNotes, setMbNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Adjustment Form
  const [adjType, setAdjType] = useState<'WAIVER' | 'SCHOLARSHIP' | 'DISCOUNT' | 'CORRECTION'>('WAIVER');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/students/${studentId}`);
      setStudent(res.student);
      setEnrollmentHistory(res.enrollmentHistory);
      setBillingRecords(res.billingRecords);
      setPaymentTransactions(res.paymentTransactions);
      setSummary(res.financialSummary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const handleCreateManualBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      await apiFetch('/api/billing/manual', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          billingYear: mbYear,
          billingMonth: mbMonth,
          feeAmount: parseFloat(mbAmount),
          dueDate: mbDueDate,
          notes: mbNotes,
        }),
      });
      setShowManualBillModal(false);
      setMbAmount('');
      setMbNotes('');
      fetchStudentData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create bill.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustmentModal) return;
    setModalError('');
    setModalLoading(true);

    try {
      await apiFetch(`/api/billing/${showAdjustmentModal}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          adjustmentType: adjType,
          amount: parseFloat(adjAmount),
          reason: adjReason,
        }),
      });
      setShowAdjustmentModal(null);
      setAdjAmount('');
      setAdjReason('');
      fetchStudentData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to add adjustment.');
    } finally {
      setModalLoading(false);
    }
  };

  const viewReceipt = async (paymentId: number) => {
    try {
      const res = await apiFetch<{ receipt: PaymentReceipt }>(`/api/payments/${paymentId}/receipt`);
      setSelectedReceipt(res.receipt);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch receipt.');
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Are you sure you want to remove the photo for this student?')) return;
    try {
      await apiFetch(`/api/students/${studentId}/photo`, { method: 'DELETE' });
      fetchStudentData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo.');
    }
  };

  const handleDeleteBill = async (bill: BillingRecord) => {
    const monthName = monthNames[bill.billingMonth - 1];
    if (!confirm(`Are you sure you want to delete the unpaid tuition fee bill for ${monthName} ${bill.billingYear} (${formatBDT(bill.netFee, language)})?`)) {
      return;
    }
    try {
      await apiFetch(`/api/billing/${bill.id}`, { method: 'DELETE' });
      fetchStudentData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete billing record.');
    }
  };

  if (loading || !student) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        {t.loading}
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-paid">{t.paid}</span>;
      case 'PARTIAL':
        return <span className="badge badge-partial">{t.partial}</span>;
      case 'OVERDUE':
        return <span className="badge badge-overdue">{t.overdue}</span>;
      case 'WAIVED':
        return <span className="badge badge-waived">{t.waived}</span>;
      default:
        return <span className="badge badge-unpaid">{t.unpaid}</span>;
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ marginBottom: 20 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Students List</span>
        </button>
      </div>

      {/* Student Profile Header Card */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Student Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 'var(--radius-lg)',
                background: '#f1f5f9',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.75rem',
                color: 'var(--primary)',
                border: '2px solid var(--border-color)',
                flexShrink: 0,
              }}>
                {student.photo_filename ? (
                  <img
                    src={`/api/students/${student.id}/photo`}
                    alt={student.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e: any) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  student.full_name.charAt(0).toUpperCase()
                )}
              </div>
              {student.photo_filename && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.68rem', padding: '2px 6px', color: 'var(--danger)', height: 22 }}
                  onClick={handleDeletePhoto}
                  title="Delete student photo"
                >
                  <Trash2 size={11} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {student.full_name}
                </h2>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, padding: '3px 8px', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  {student.student_code}
                </span>
                <span className={`badge ${student.status === 'ACTIVE' ? 'badge-active' : 'badge-archived'}`}>
                  {student.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                <div><strong>Batch:</strong> {student.batch_name}</div>
                <div><strong>Class:</strong> {student.class_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={13} />
                  <span>Guardian: {student.guardian_phone}</span>
                </div>
                {student.student_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={13} />
                    <span>Self: {student.student_phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} />
                  <span>Admitted: {student.admission_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Outstanding Balance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Balance Due</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (summary?.totalDue || 0) > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                {formatBDT(summary?.totalDue || 0, language)}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onCollectFee(student)}
            >
              <CreditCard size={18} />
              <span>Collect Fee</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => setShowDeleteStudentModal(true)}
              title="Delete Student Profile"
            >
              <Trash2 size={16} />
              <span>Delete Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-secondary ${activeTab === 'ledger' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('ledger')}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
        >
          <DollarSign size={16} />
          <span>Monthly Fee Ledger ({billingRecords.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-secondary ${activeTab === 'payments' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('payments')}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
        >
          <History size={16} />
          <span>Payment History ({paymentTransactions.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-secondary ${activeTab === 'enrollment' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('enrollment')}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
        >
          <Calendar size={16} />
          <span>Batch & Enrollment History ({enrollmentHistory.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-secondary ${activeTab === 'statement' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('statement')}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
        >
          <FileText size={16} />
          <span>Printable Statement</span>
        </button>
      </div>

      {/* TAB 1: MONTHLY FEE LEDGER */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setMbAmount(String(student.monthly_fee || ''));
                setShowManualBillModal(true);
              }}
            >
              <PlusCircle size={15} />
              <span>Add Fee Obligation (Mode B)</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month & Year</th>
                  <th>Fee Amount</th>
                  <th>Adjustments / Waiver</th>
                  <th>Net Obligation</th>
                  <th>Paid Amount</th>
                  <th>Remaining Due</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.length > 0 ? (
                  billingRecords.map((bill) => (
                    <tr key={bill.id}>
                      <td style={{ fontWeight: 600 }}>
                        {monthNames[bill.billingMonth - 1]} {bill.billingYear}
                      </td>
                      <td>{formatBDT(bill.feeAmount, language)}</td>
                      <td style={{ color: bill.adjustedAmount > 0 ? 'var(--purple-text)' : 'inherit' }}>
                        {bill.adjustedAmount > 0 ? formatBDT(bill.adjustedAmount, language) : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatBDT(bill.netFee, language)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {formatBDT(bill.paidAmount, language)}
                      </td>
                      <td style={{ fontWeight: 700, color: bill.balance > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                        {formatBDT(bill.balance, language)}
                      </td>
                      <td>{bill.dueDate}</td>
                      <td>{getStatusBadge(bill.status)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {bill.balance > 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setShowAdjustmentModal(bill.id);
                                setAdjAmount('');
                                setAdjReason('');
                              }}
                              title="Add Waiver or Scholarship"
                            >
                              <Gift size={13} />
                              <span>Waiver</span>
                            </button>
                          )}
                          {bill.paidAmount === 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeleteBill(bill)}
                              title="Delete Unpaid Fee Record"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No billing records generated for this student yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT HISTORY */}
      {activeTab === 'payments' && (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Payment Date</th>
                <th>Amount Received</th>
                <th>Payment Method</th>
                <th>Transaction Reference</th>
                <th>Recorded By</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {paymentTransactions.length > 0 ? (
                paymentTransactions.map((pt) => (
                  <tr key={pt.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{pt.receipt_number}</td>
                    <td>{pt.payment_date}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatBDT(pt.amount, language)}
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                        {pt.payment_method}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{pt.transaction_reference || '—'}</td>
                    <td>{pt.recorded_by_admin}</td>
                    <td>
                      <span className={`badge ${pt.status === 'COMPLETED' ? 'badge-paid' : 'badge-overdue'}`}>
                        {pt.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => viewReceipt(pt.id)}
                      >
                        <Receipt size={14} />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                    No payment transactions recorded for this student yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: ENROLLMENT & BATCH HISTORY */}
      {activeTab === 'enrollment' && (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Name</th>
                <th>Batch Code</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Agreed Fee Snapshot</th>
                <th>Billing Mode Snapshot</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {enrollmentHistory.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.batch_name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{h.batch_code}</td>
                  <td>{h.effective_from}</td>
                  <td>{h.effective_to ? h.effective_to : <span className="badge badge-active">Current Active Batch</span>}</td>
                  <td style={{ fontWeight: 600 }}>{formatBDT(h.fee_snapshot, language)}</td>
                  <td>{h.billing_mode_snapshot}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{h.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: PRINTABLE STATEMENT */}
      {activeTab === 'statement' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }} className="no-print">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} />
              <span>Print Statement</span>
            </button>
          </div>

          <div className="card" style={{ padding: 32 }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>STUDENT FINANCIAL STATEMENT</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Tuition Fee Ledger & Payment Summary</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontSize: '0.88rem' }}>
              <div>
                <div><strong>Student Name:</strong> {student.full_name}</div>
                <div><strong>Student ID:</strong> {student.student_code}</div>
                <div><strong>Batch:</strong> {student.batch_name} ({student.class_name})</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Guardian Phone:</strong> {student.guardian_phone}</div>
                <div><strong>Admission Date:</strong> {student.admission_date}</div>
                <div><strong>Statement Date:</strong> {new Date().toISOString().slice(0, 10)}</div>
              </div>
            </div>

            <table className="data-table" style={{ marginBottom: 24 }}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Fee Amount</th>
                  <th>Waiver</th>
                  <th>Net Obligation</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.map((b) => (
                  <tr key={b.id}>
                    <td>{monthNames[b.billingMonth - 1]} {b.billingYear}</td>
                    <td>{formatBDT(b.feeAmount, language)}</td>
                    <td>{b.adjustedAmount > 0 ? formatBDT(b.adjustedAmount, language) : '—'}</td>
                    <td>{formatBDT(b.netFee, language)}</td>
                    <td>{formatBDT(b.paidAmount, language)}</td>
                    <td>{formatBDT(b.balance, language)}</td>
                    <td>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1rem', fontWeight: 800, padding: 12, background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
              <span>Net Total Balance Due:&nbsp;</span>
              <span style={{ color: (summary?.totalDue || 0) > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                {formatBDT(summary?.totalDue || 0, language)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Manual Bill Modal (Mode B) */}
      {showManualBillModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">Create Manual Fee Obligation</div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setShowManualBillModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateManualBill}>
              <div className="modal-body">
                {modalError && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
                    {modalError}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Billing Year</label>
                    <input
                      type="number"
                      required
                      className="form-control"
                      value={mbYear}
                      onChange={(e) => setMbYear(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Billing Month</label>
                    <select
                      className="form-control"
                      value={mbMonth}
                      onChange={(e) => setMbMonth(parseInt(e.target.value, 10))}
                    >
                      {monthNames.map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Fee Amount (BDT) *</label>
                  <input
                    type="number"
                    step="50"
                    required
                    className="form-control"
                    placeholder="e.g. 2500"
                    value={mbAmount}
                    onChange={(e) => setMbAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={mbDueDate}
                    onChange={(e) => setMbDueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Special Exam / Extra Class Fee"
                    value={mbNotes}
                    onChange={(e) => setMbNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualBillModal(false)} disabled={modalLoading}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? t.loading : 'Create Fee Obligation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fee Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">Record Fee Adjustment / Waiver</div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setShowAdjustmentModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAdjustment}>
              <div className="modal-body">
                {modalError && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
                    {modalError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <select
                    className="form-control"
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}
                  >
                    <option value="WAIVER">Full/Partial Waiver</option>
                    <option value="SCHOLARSHIP">Merit Scholarship</option>
                    <option value="DISCOUNT">Special Discount</option>
                    <option value="CORRECTION">Billing Correction</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Adjustment Amount (BDT) *</label>
                  <input
                    type="number"
                    step="50"
                    required
                    className="form-control"
                    placeholder="e.g. 500"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Justification *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Academic Excellence Award"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustmentModal(null)} disabled={modalLoading}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? t.loading : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Delete Student Modal */}
      <DeleteStudentModal
        student={showDeleteStudentModal ? student : null}
        onClose={() => setShowDeleteStudentModal(false)}
        onDeleted={() => {
          onBack();
        }}
      />
    </div>
  );
};
