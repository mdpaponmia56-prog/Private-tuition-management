import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { Batch } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  BookOpen,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Users,
  DollarSign,
  AlertCircle,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { DeleteBatchModal } from '../components/DeleteBatchModal.js';

export const Batches: React.FC = () => {
  const { language, t } = useLanguage();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [defaultFee, setDefaultFee] = useState('');
  const [defaultBillingMode, setDefaultBillingMode] = useState<'AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
  const [billingDayOfMonth, setBillingDayOfMonth] = useState(1);
  const [gracePeriodDays, setGracePeriodDays] = useState(7);
  const [scheduleText, setScheduleText] = useState('');
  const [notes, setNotes] = useState('');

  // Expanded Batch Detail
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ batches: Batch[] }>('/api/batches');
      setBatches(res.batches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const openCreateModal = () => {
    setEditingBatch(null);
    setName('');
    setCode('');
    setClassName('');
    setSubject('');
    setDefaultFee('2500');
    setDefaultBillingMode('AUTOMATIC');
    setBillingDayOfMonth(1);
    setGracePeriodDays(7);
    setScheduleText('');
    setNotes('');
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (b: Batch) => {
    setEditingBatch(b);
    setName(b.name);
    setCode(b.code);
    setClassName(b.class_name);
    setSubject(b.subject || '');
    setDefaultFee(String(b.default_fee));
    setDefaultBillingMode(b.default_billing_mode);
    setBillingDayOfMonth(b.billing_day_of_month);
    setGracePeriodDays(b.grace_period_days);
    setScheduleText(b.schedule_text || '');
    setNotes(b.notes || '');
    setModalError('');
    setShowModal(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      if (editingBatch) {
        await apiFetch(`/api/batches/${editingBatch.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            code,
            className,
            subject,
            defaultFee: parseFloat(defaultFee),
            defaultBillingMode,
            billingDayOfMonth,
            gracePeriodDays,
            scheduleText,
            notes,
          }),
        });
      } else {
        await apiFetch('/api/batches', {
          method: 'POST',
          body: JSON.stringify({
            name,
            code,
            className,
            subject,
            defaultFee: parseFloat(defaultFee),
            defaultBillingMode,
            billingDayOfMonth,
            gracePeriodDays,
            scheduleText,
            notes,
          }),
        });
      }

      setShowModal(false);
      fetchBatches();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save batch.');
    } finally {
      setModalLoading(false);
    }
  };

  const toggleArchiveBatch = async (b: Batch) => {
    try {
      if (b.is_active) {
        if (!confirm(`Are you sure you want to archive batch "${b.name}"?`)) return;
        await apiFetch(`/api/batches/${b.id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/batches/${b.id}/restore`, { method: 'POST' });
      }
      fetchBatches();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  };

  const openDeleteModal = (b: Batch) => {
    setBatchToDelete(b);
  };

  const toggleExpand = async (id: number) => {
    if (expandedBatchId === id) {
      setExpandedBatchId(null);
      setBatchStudents([]);
      return;
    }

    setExpandedBatchId(id);
    setStudentsLoading(true);
    try {
      const res = await apiFetch<{ students: any[] }>(`/api/batches/${id}`);
      setBatchStudents(res.students);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.batches}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Batch schedules, tuition fee rates, billing defaults, and student enrollments
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          <span>Create New Batch</span>
        </button>
      </div>

      {/* Batches Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          {t.loading}
        </div>
      ) : batches.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {batches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;
            return (
              <div key={batch.id} className="card" style={{ opacity: batch.is_active ? 1 : 0.75, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {batch.name}
                      </h3>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                        {batch.code}
                      </span>
                      <span className={`badge ${batch.is_active ? 'badge-active' : 'badge-archived'}`}>
                        {batch.is_active ? 'Active' : 'Archived'}
                      </span>
                      <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        {batch.default_billing_mode}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <div><strong>Class:</strong> {batch.class_name}</div>
                      {batch.subject && <div><strong>Subject:</strong> {batch.subject}</div>}
                      {batch.schedule_text && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={13} />
                          <span>{batch.schedule_text}</span>
                        </div>
                      )}
                      <div><strong>Billing Day:</strong> {batch.billing_day_of_month}th (+{batch.grace_period_days}d grace)</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(batch)}
                      title="Edit Batch"
                    >
                      <Edit2 size={14} />
                      <span>{t.edit}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleArchiveBatch(batch)}
                      title={batch.is_active ? 'Archive Batch' : 'Restore Batch'}
                    >
                      {batch.is_active ? <Archive size={14} /> : <RotateCcw size={14} color="var(--success)" />}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => openDeleteModal(batch)}
                      title="Permanently Delete Batch"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleExpand(batch.id)}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span>{isExpanded ? 'Hide Students' : `Students (${batch.active_student_count || 0})`}</span>
                    </button>
                  </div>
                </div>

                {/* Batch Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Default Tuition Fee</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {formatBDT(batch.default_fee, language)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Enrolled Students</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {batch.active_student_count || 0}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected Monthly Fees</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {formatBDT(batch.expected_monthly_fees || 0, language)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Outstanding Dues</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: (batch.total_outstanding_dues || 0) > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                      {formatBDT(batch.total_outstanding_dues || 0, language)}
                    </div>
                  </div>
                </div>

                {/* Expanded Students Sub-Table */}
                {isExpanded && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 10 }}>Enrolled Students ({batchStudents.length})</h4>
                    {studentsLoading ? (
                      <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.loading}</div>
                    ) : batchStudents.length > 0 ? (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student ID</th>
                            <th>Full Name</th>
                            <th>Guardian Phone</th>
                            <th>Monthly Fee</th>
                            <th>Status</th>
                            <th>Current Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchStudents.map((s) => (
                            <tr key={s.id}>
                              <td style={{ fontFamily: 'monospace' }}>{s.student_code}</td>
                              <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                              <td>{s.guardian_phone}</td>
                              <td>
                                {s.monthly_fee ? formatBDT(s.monthly_fee, language) : `${formatBDT(batch.default_fee, language)} (Default)`}
                              </td>
                              <td>
                                <span className={`badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-archived'}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: parseFloat(s.total_due || 0) > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                                {formatBDT(s.total_due, language)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No students enrolled in this batch yet.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          No batches found. Click "Create New Batch" to add one!
        </div>
      )}

      {/* Create / Edit Batch Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div className="modal-title">
                {editingBatch ? 'Edit Batch' : 'Create New Batch'}
              </div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBatch}>
              <div className="modal-body">
                {modalError && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
                    {modalError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Batch Name *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. HSC 2026 Physics Morning"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unique Batch Code *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. HSC-PHY-M01"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Class / Session *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. HSC 2026 / Class 10"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Physics / Mathematics"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Default Tuition Fee (BDT) *</label>
                    <input
                      type="number"
                      step="50"
                      required
                      className="form-control"
                      placeholder="e.g. 2500"
                      value={defaultFee}
                      onChange={(e) => setDefaultFee(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Billing Mode *</label>
                    <select
                      className="form-control"
                      value={defaultBillingMode}
                      onChange={(e) => setDefaultBillingMode(e.target.value as any)}
                    >
                      <option value="AUTOMATIC">Automatic Recurring Monthly</option>
                      <option value="MANUAL">Manual Payment Recording</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Billing Day of Month (1-28)</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      className="form-control"
                      value={billingDayOfMonth}
                      onChange={(e) => setBillingDayOfMonth(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Grace Period (Days)</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      required
                      className="form-control"
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Schedule</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Sun, Tue, Thu 8:00 AM - 9:30 AM"
                    value={scheduleText}
                    onChange={(e) => setScheduleText(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Batch notes or instructions"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={modalLoading}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? t.loading : (editingBatch ? 'Save Changes' : 'Create Batch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Batch Modal */}
      <DeleteBatchModal
        batch={batchToDelete}
        allBatches={batches}
        onClose={() => setBatchToDelete(null)}
        onDeleted={() => {
          fetchBatches();
        }}
      />
    </div>
  );
};
