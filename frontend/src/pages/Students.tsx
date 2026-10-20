import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { Student, Batch } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  UserPlus,
  Search,
  Filter,
  Eye,
  Archive,
  RotateCcw,
  Camera,
  X,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { DeleteStudentModal } from '../components/DeleteStudentModal.js';

interface StudentsProps {
  onSelectStudent: (id: number) => void;
  onCollectFeeForStudent: (student: Student) => void;
}

export const Students: React.FC<StudentsProps> = ({ onSelectStudent, onCollectFeeForStudent }) => {
  const { language, t } = useLanguage();

  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [dueFilter, setDueFilter] = useState<string>('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [batchId, setBatchId] = useState<number | ''>('');
  const [className, setClassName] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [billingMode, setBillingMode] = useState<'AUTOMATIC' | 'MANUAL' | ''>('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchBatches = async () => {
    try {
      const res = await apiFetch<{ batches: Batch[] }>('/api/batches');
      setBatches(res.batches);
      if (res.batches.length > 0 && batchId === '') {
        setBatchId(res.batches[0].id);
        setClassName(res.batches[0].class_name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let query = `/api/students?status=${statusFilter}`;
      if (selectedBatch) query += `&batchId=${selectedBatch}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (dueFilter !== 'ALL') query += `&dueFilter=${dueFilter}`;

      const res = await apiFetch<{ students: Student[] }>(query);
      setStudents(res.students);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedBatch, statusFilter, dueFilter, search]);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const res = await apiFetch<{ student: Student }>('/api/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          guardianPhone,
          studentPhone,
          batchId,
          className,
          monthlyFee: monthlyFee !== '' ? parseFloat(monthlyFee) : undefined,
          billingMode: billingMode || undefined,
          admissionDate,
          address,
          notes,
        }),
      });

      // Upload photo if selected
      if (photoFile && res.student.id) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        await apiFetch(`/api/students/${res.student.id}/photo`, {
          method: 'POST',
          body: formData,
        });
      }

      setShowAddModal(false);
      resetForm();
      fetchStudents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register student.');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setGuardianPhone('');
    setStudentPhone('');
    setMonthlyFee('');
    setBillingMode('');
    setAddress('');
    setNotes('');
    setPhotoFile(null);
  };

  const archiveStudent = async (id: number) => {
    if (!confirm('Are you sure you want to archive this student? Their financial history will be preserved.')) return;
    try {
      await apiFetch(`/api/students/${id}/archive`, { method: 'POST' });
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to archive student.');
    }
  };

  const restoreStudent = async (id: number) => {
    try {
      await apiFetch(`/api/students/${id}/restore`, { method: 'POST' });
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to restore student.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.students}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Complete directory of enrolled students, fee settings, and guardian contacts
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          <UserPlus size={18} />
          <span>Register New Student</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>

          {/* Batch Filter */}
          <select
            className="form-control"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="">{t.all} Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ACTIVE">Active Students</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All Statuses</option>
          </select>

          {/* Due Filter */}
          <select
            className="form-control"
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value)}
          >
            <option value="ALL">All Balances</option>
            <option value="WITH_DUE">With Outstanding Due</option>
            <option value="NO_DUE">Zero Due (Fully Cleared)</option>
          </select>
        </div>
      </div>

      {/* Desktop Students Table View */}
      <div className="table-responsive desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID & Photo</th>
              <th>Student Name</th>
              <th>Batch & Class</th>
              <th>Guardian Contact</th>
              <th>Monthly Fee</th>
              <th>Billing Mode</th>
              <th>Balance Due</th>
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
            ) : students.length > 0 ? (
              students.map((student) => {
                const due = parseFloat(String(student.total_due || 0));
                return (
                  <tr key={student.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-full)',
                          background: '#f1f5f9',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: 'var(--primary)',
                          border: '1px solid var(--border-color)',
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
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                          {student.student_code}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{student.full_name}</div>
                      {student.student_phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          Self: {student.student_phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{student.batch_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{student.class_name}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {student.guardian_phone}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {student.monthly_fee !== null ? (
                        formatBDT(student.monthly_fee, language)
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Batch Default</span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.72rem' }}>
                        {student.billing_mode || 'Default'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: due > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                      {formatBDT(due, language)}
                    </td>
                    <td>
                      <span className={`badge ${student.status === 'ACTIVE' ? 'badge-active' : 'badge-archived'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          onClick={() => onSelectStudent(student.id)}
                          title="Open Full Profile & Fee Ledger"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-icon"
                          onClick={() => onCollectFeeForStudent(student)}
                          title="Collect Fee"
                        >
                          <CreditCard size={15} />
                        </button>

                        {student.status === 'ARCHIVED' ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => restoreStudent(student.id)}
                            title="Restore Student"
                          >
                            <RotateCcw size={15} color="var(--success)" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => archiveStudent(student.id)}
                            title="Archive Student"
                          >
                            <Archive size={15} color="#94a3b8" />
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          onClick={() => setStudentToDelete(student)}
                          title="Delete Student"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                  {t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Student Cards View */}
      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {t.loading}
          </div>
        ) : students.length > 0 ? (
          students.map((student) => {
            const due = parseFloat(String(student.total_due || 0));
            return (
              <div key={student.id} className="entity-card" style={{ padding: 14 }}>
                {/* Header: Photo, Name, Code, Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-full)',
                    background: '#f1f5f9',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--primary)',
                    flexShrink: 0,
                    border: '1px solid var(--border-color)',
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.full_name}
                      </div>
                      <span className={`badge ${student.status === 'ACTIVE' ? 'badge-active' : 'badge-archived'}`} style={{ fontSize: '0.7rem' }}>
                        {student.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{student.student_code}</span>
                      <span>&bull;</span>
                      <span>{student.batch_name}</span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: 10 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Monthly Fee:</span>
                    <span style={{ fontWeight: 600 }}>
                      {student.monthly_fee !== null ? formatBDT(student.monthly_fee, language) : 'Batch Default'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Balance Due:</span>
                    <span style={{ fontWeight: 700, color: due > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                      {formatBDT(due, language)}
                    </span>
                  </div>
                </div>

                {/* Contact Links */}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', marginBottom: 12, flexWrap: 'wrap' }}>
                  <a
                    href={`tel:${student.guardian_phone}`}
                    style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                  >
                    📞 Guardian: <span style={{ fontFamily: 'monospace' }}>{student.guardian_phone}</span>
                  </a>
                  {student.student_phone && (
                    <a
                      href={`tel:${student.student_phone}`}
                      style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      📱 Self: <span style={{ fontFamily: 'monospace' }}>{student.student_phone}</span>
                    </a>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onSelectStudent(student.id)}
                    style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                  >
                    <Eye size={15} />
                    <span>Profile</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onCollectFeeForStudent(student)}
                    style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                  >
                    <CreditCard size={15} />
                    <span>Collect</span>
                  </button>

                  {student.status === 'ARCHIVED' ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => restoreStudent(student.id)}
                      title="Restore"
                      style={{ minWidth: 38, minHeight: 38 }}
                    >
                      <RotateCcw size={15} color="var(--success)" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => archiveStudent(student.id)}
                      title="Archive"
                      style={{ minWidth: 38, minHeight: 38 }}
                    >
                      <Archive size={15} color="#94a3b8" />
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => setStudentToDelete(student)}
                    title="Delete"
                    style={{ minWidth: 38, minHeight: 38, color: 'var(--danger)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
            {t.noData}
          </div>
        )}
      </div>

      {/* Register Student Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} color="var(--primary)" />
                <span>Register New Student</span>
              </div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterStudent}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.fullName} *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="Student full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.guardianPhone} *</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      className="form-control"
                      placeholder="e.g. 01711223344"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.studentPhone}</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="form-control"
                      placeholder="Optional student mobile"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.batch} *</label>
                    <select
                      required
                      className="form-control"
                      value={batchId}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setBatchId(val);
                        const b = batches.find((x) => x.id === val);
                        if (b) setClassName(b.class_name);
                      }}
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (Fee: ৳{b.default_fee})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.class} *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="Class 10 / HSC 2026"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Fee Override (BDT)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="50"
                      className="form-control"
                      placeholder="Leave blank to use batch default fee"
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Billing Mode Override</label>
                    <select
                      className="form-control"
                      value={billingMode}
                      onChange={(e) => setBillingMode(e.target.value as any)}
                    >
                      <option value="">Inherit Batch Default</option>
                      <option value="AUTOMATIC">Automatic Recurring Monthly</option>
                      <option value="MANUAL">Manual Payment Recording</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.admissionDate}</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.photo} (Optional, max 2MB)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="form-control"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setPhotoFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.address}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Residential address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.notes}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Administrative or academic notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={formLoading}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? t.loading : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      <DeleteStudentModal
        student={studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onDeleted={() => {
          fetchStudents();
        }}
      />
    </div>
  );
};
