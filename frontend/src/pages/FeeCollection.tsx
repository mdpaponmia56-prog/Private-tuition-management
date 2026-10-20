import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { Student, Batch, BillingRecord, PaymentReceipt } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  CreditCard,
  Search,
  CheckCircle,
  Receipt,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { ReceiptModal } from '../components/ReceiptModal.js';

interface FeeCollectionProps {
  initialStudent?: Student | null;
}

export const FeeCollection: React.FC<FeeCollectionProps> = ({ initialStudent }) => {
  const { language, t } = useLanguage();

  const [activeMode, setActiveMode] = useState<'collect' | 'recurring-generator'>('collect');

  // Student selection
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(initialStudent || null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBills, setStudentBills] = useState<BillingRecord[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);

  // Payment Form Fields
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER' | 'OTHER'>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactionReference, setTransactionReference] = useState('');
  const [targetBillId, setTargetBillId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Generated Receipt Modal
  const [createdReceipt, setCreatedReceipt] = useState<PaymentReceipt | null>(null);

  // Mode A: Recurring Monthly Generator State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genBatchId, setGenBatchId] = useState<number | ''>('');
  const [genPreview, setGenPreview] = useState<any | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [studRes, batchRes] = await Promise.all([
          apiFetch<{ students: Student[] }>('/api/students?status=ACTIVE'),
          apiFetch<{ batches: Batch[] }>('/api/batches'),
        ]);
        setStudents(studRes.students);
        setBatches(batchRes.batches);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const loadStudentBills = async (stud: Student) => {
    setSelectedStudent(stud);
    setBillsLoading(true);
    setFormError('');
    try {
      const res = await apiFetch<{ records: BillingRecord[] }>(`/api/billing?studentId=${stud.id}`);
      setStudentBills(res.records);

      // Calculate total unpaid balance
      const unpaidBills = res.records.filter((b) => b.balance > 0);
      const totalDue = unpaidBills.reduce((acc, b) => acc + b.balance, 0);

      // Pre-fill amount with oldest bill or total due
      if (unpaidBills.length > 0) {
        setTargetBillId(unpaidBills[0].id);
        setAmount(String(unpaidBills[0].balance));
      } else {
        setTargetBillId('');
        setAmount(String(stud.monthly_fee || 2500));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (initialStudent) {
      loadStudentBills(initialStudent);
    }
  }, [initialStudent]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setFormError('Please select a student.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      const res = await apiFetch<{ receipt: PaymentReceipt }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          amount: parseFloat(amount),
          paymentMethod,
          paymentDate,
          transactionReference: transactionReference ? transactionReference.trim() : undefined,
          billingRecordId: targetBillId !== '' ? targetBillId : undefined,
          notes: notes ? notes.trim() : undefined,
        }),
      });

      setCreatedReceipt(res.receipt);
      setAmount('');
      setTransactionReference('');
      setNotes('');
      // Reload bills
      loadStudentBills(selectedStudent);
    } catch (err: any) {
      setFormError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mode A: Preview & Generate Recurring Bills
  const handlePreviewRecurringBills = async () => {
    setGenLoading(true);
    setGenMessage('');
    try {
      const res = await apiFetch('/api/billing/generate', {
        method: 'POST',
        body: JSON.stringify({
          year: genYear,
          month: genMonth,
          batchId: genBatchId !== '' ? genBatchId : undefined,
          isPreview: true,
        }),
      });
      setGenPreview(res);
    } catch (err: any) {
      alert(err.message || 'Failed to preview bills.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleExecuteRecurringBills = async () => {
    if (!confirm(`Are you sure you want to generate recurring bills for ${genMonth}/${genYear}? Duplicate bills will be automatically prevented.`)) return;

    setGenLoading(true);
    try {
      const res = await apiFetch('/api/billing/generate', {
        method: 'POST',
        body: JSON.stringify({
          year: genYear,
          month: genMonth,
          batchId: genBatchId !== '' ? genBatchId : undefined,
          isPreview: false,
        }),
      });
      setGenPreview(res);
      setGenMessage(`Successfully generated ${res.generatedCount} monthly bills (${res.skippedCount} students already billed).`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate bills.');
    } finally {
      setGenLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.student_code.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.guardian_phone.includes(studentSearch)
  );

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.feeCollection}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Record cash/mobile payments, allocate to monthly bills, and generate instant printable money receipts
          </p>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${activeMode === 'collect' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('collect')}
          >
            <CreditCard size={16} />
            <span>Record Payment (Mode B & A)</span>
          </button>

          <button
            type="button"
            className={`btn ${activeMode === 'recurring-generator' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('recurring-generator')}
          >
            <Clock size={16} />
            <span>{t.generateMonthlyBills} (Mode A)</span>
          </button>
        </div>
      </div>

      {activeMode === 'collect' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 18 }}>
          {/* Left Column: Select Student & Dues */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title">
                  <Search size={18} color="var(--primary)" />
                  <span>1. Select Student</span>
                </div>
              </div>

              {/* Student Search */}
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type name, student ID, or mobile..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>

              {/* Student Selector List */}
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 6 }}>
                {filteredStudents.length > 0 ? (
                  filteredStudents.slice(0, 15).map((s) => {
                    const isSelected = selectedStudent?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => loadStudentBills(s)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--primary-light)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #f1f5f9',
                          minHeight: '44px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {s.student_code} • {s.batch_name} • {s.guardian_phone}
                          </div>
                        </div>
                        {isSelected && <CheckCircle size={16} color="var(--primary)" />}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No matching active students.
                  </div>
                )}
              </div>
            </div>

            {/* Selected Student Ledger Overview */}
            {selectedStudent && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Receipt size={18} color="var(--primary)" />
                    <span>2. Pending Billing Obligations</span>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selectedStudent.full_name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Batch: {selectedStudent.batch_name} | Guardian: {selectedStudent.guardian_phone}
                  </div>
                </div>

                {billsLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t.loading}</div>
                ) : studentBills.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {studentBills.map((b) => {
                      const isTarget = targetBillId === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            setTargetBillId(b.id);
                            setAmount(String(b.balance));
                          }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: isTarget ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            background: isTarget ? 'rgba(13, 148, 136, 0.05)' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: '44px',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {monthNames[b.billingMonth - 1]} {b.billingYear}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Due Date: {b.dueDate} | Fee: ৳{b.netFee}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: b.balance > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                              Due: {formatBDT(b.balance, language)}
                            </div>
                            <span className={`badge ${b.status === 'PAID' ? 'badge-paid' : b.status === 'PARTIAL' ? 'badge-partial' : 'badge-overdue'}`}>
                              {b.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div
                      onClick={() => setTargetBillId('')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: targetBillId === '' ? '2px solid var(--primary)' : '1px dashed var(--border-color)',
                        textAlign: 'center',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Auto-allocate payment to oldest unpaid bills or general tuition advance
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No unpaid bills found. Recording payment will allocate to general student credit or auto-generate obligation.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Payment Entry Form */}
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <CreditCard size={18} color="var(--primary)" />
                  <span>3. Payment Details</span>
                </div>
              </div>

              {formError && (
                <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleRecordPayment}>
                <div className="form-group">
                  <label className="form-label">Payment Amount (BDT / ৳) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="10"
                    required
                    className="form-control"
                    placeholder="Enter collected amount in BDT"
                    style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', padding: '12px 14px' }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">{t.paymentMethod} *</label>
                  {/* Quick Mobile Touch Pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {(['CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER'] as const).map((method) => {
                      const isSelected = paymentMethod === method;
                      const labels: Record<string, string> = {
                        CASH: '💵 Cash',
                        BKASH: '📱 bKash',
                        NAGAD: '📱 Nagad',
                        ROCKET: '🚀 Rocket',
                        BANK_TRANSFER: '🏦 Bank',
                      };
                      return (
                        <button
                          key={method}
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setPaymentMethod(method)}
                          style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.82rem', flex: '1 1 auto' }}
                        >
                          {labels[method]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.paymentDate} *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Reference (TrxID / Receipt Ref)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 9J8K7L6M (for bKash / Nagad / Bank slip)"
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Received from student's mother"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '1.05rem', marginTop: 10 }}
                  disabled={submitting || !selectedStudent}
                >
                  {submitting ? t.loading : 'Confirm Payment & Print Receipt'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* MODE A: RECURRING MONTHLY GENERATOR */
        <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="card-header">
            <div className="card-title">
              <Clock size={20} color="var(--primary)" />
              <span>{t.generateMonthlyBills} (Mode A)</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Generates monthly tuition fee obligations for all active students enrolled in recurring billing mode. Duplicate records are strictly prevented by database constraints.
            </p>
          </div>

          {genMessage && (
            <div style={{ padding: '12px 16px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} />
              <span>{genMessage}</span>
            </div>
          )}

          <div className="form-row" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Billing Year</label>
              <select
                className="form-control"
                value={genYear}
                onChange={(e) => setGenYear(parseInt(e.target.value, 10))}
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Billing Month</label>
              <select
                className="form-control"
                value={genMonth}
                onChange={(e) => setGenMonth(parseInt(e.target.value, 10))}
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Batch (Optional)</label>
              <select
                className="form-control"
                value={genBatchId}
                onChange={(e) => setGenBatchId(e.target.value ? parseInt(e.target.value, 10) : '')}
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePreviewRecurringBills}
              disabled={genLoading}
            >
              <Search size={16} />
              <span>{t.generatePreview}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecuteRecurringBills}
              disabled={genLoading}
            >
              <Sparkles size={16} />
              <span>{t.confirmGeneration}</span>
            </button>
          </div>

          {/* Preview Results */}
          {genPreview && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  Eligible Students: {genPreview.eligibleStudents?.length || 0}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{genPreview.generatedCount} New Bills</span>
                  &nbsp;•&nbsp;
                  <span style={{ color: 'var(--text-muted)' }}>{genPreview.skippedCount} Already Billed</span>
                </div>
              </div>

              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Batch</th>
                      <th>Fee</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genPreview.eligibleStudents?.map((s: any) => (
                      <tr key={s.studentId}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.studentName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{s.studentCode}</div>
                        </td>
                        <td>{s.batchName}</td>
                        <td style={{ fontWeight: 600 }}>{formatBDT(s.feeAmount, language)}</td>
                        <td>{s.dueDate}</td>
                        <td>
                          {s.alreadyExists ? (
                            <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Already Billed</span>
                          ) : (
                            <span className="badge badge-active">Ready to Generate</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated Receipt Modal Popup */}
      {createdReceipt && (
        <ReceiptModal
          receipt={createdReceipt}
          onClose={() => setCreatedReceipt(null)}
        />
      )}
    </div>
  );
};
