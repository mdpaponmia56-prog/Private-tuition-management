import React, { useState } from 'react';
import { Student } from '../types/index.js';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../utils/i18n.js';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteStudentModalProps {
  student: Student | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteStudentModal: React.FC<DeleteStudentModalProps> = ({
  student,
  onClose,
  onDeleted,
}) => {
  const { admin } = useAuth();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canForce, setCanForce] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [reason, setReason] = useState('');

  if (!student) return null;

  const handleDelete = async () => {
    setError('');

    if (forceDelete) {
      if (!reason.trim() || reason.trim().length < 5) {
        setError('Please enter a specific audit reason (minimum 5 characters).');
        return;
      }
    }

    setLoading(true);
    try {
      if (forceDelete) {
        await apiFetch(`/api/students/${student.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            force: true,
            reason: reason.trim(),
          }),
        });
      } else {
        await apiFetch(`/api/students/${student.id}`, {
          method: 'DELETE',
        });
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete student.');
      // If server response indicates financial records exist and user is OWNER
      if (admin?.role === 'OWNER') {
        setCanForce(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-full)',
                background: '#fee2e2',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Delete Student Profile
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Permanent removal confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                color: '#b91c1c',
                fontSize: '0.85rem',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          {/* Target Student Summary */}
          <div
            style={{
              background: '#f8fafc',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
              {student.full_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Student ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{student.student_code}</span> • Batch: {student.batch_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Guardian Mobile: <span style={{ fontFamily: 'monospace' }}>{student.guardian_phone}</span>
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            {canForce || forceDelete ? (
              <span style={{ color: '#b91c1c', fontWeight: 500 }}>
                This student has recorded fee obligations or payments. As Owner, an audited exceptional purge will permanently remove all billing records and receipts.
              </span>
            ) : (
              <span>
                Standard deletion permanently removes the student. (If this student has recorded financial transactions, the system will protect the audit trail and require Owner authorization or Archival).
              </span>
            )}
          </p>

          {/* Owner Override Section */}
          {(canForce || admin?.role === 'OWNER') && (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                marginBottom: 16,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: '#9a3412',
                  marginBottom: forceDelete ? 10 : 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                />
                <span>Enable Exceptional Purge (Owner Override)</span>
              </label>

              {forceDelete && (
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', color: '#9a3412', marginTop: 8 }}>
                    Mandatory Audit Justification / Reason *
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Test entry created during training, registered in error..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'var(--danger)',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 size={15} />
            <span>
              {loading ? 'Deleting...' : forceDelete ? 'Purge Student & Records' : 'Delete Student'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
