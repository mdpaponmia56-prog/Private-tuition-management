import React, { useState } from 'react';
import { Batch } from '../types/index.js';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { Trash2, AlertTriangle, ArrowRight, X } from 'lucide-react';

interface DeleteBatchModalProps {
  batch: Batch | null;
  allBatches: Batch[];
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteBatchModal: React.FC<DeleteBatchModalProps> = ({
  batch,
  allBatches,
  onClose,
  onDeleted,
}) => {
  const { admin } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Resolution mode when students exist
  const [resolutionMode, setResolutionMode] = useState<'reassign' | 'purge'>('reassign');
  const [targetBatchId, setTargetBatchId] = useState<number | ''>('');
  const [purgeReason, setPurgeReason] = useState('');

  if (!batch) return null;

  const studentCount = parseInt(String(batch.active_student_count || 0), 10);
  const otherBatches = allBatches.filter((b) => b.id !== batch.id);

  // Set default target batch if not selected yet
  if (resolutionMode === 'reassign' && targetBatchId === '' && otherBatches.length > 0) {
    setTargetBatchId(otherBatches[0].id);
  }

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      if (studentCount === 0) {
        // Standard clean deletion of empty batch
        await apiFetch(`/api/batches/${batch.id}?permanent=true`, {
          method: 'DELETE',
        });
      } else if (resolutionMode === 'reassign') {
        if (!targetBatchId) {
          setError('Please select a destination batch to reassign enrolled students to.');
          setLoading(false);
          return;
        }

        await apiFetch(`/api/batches/${batch.id}?permanent=true`, {
          method: 'DELETE',
          body: JSON.stringify({
            permanent: true,
            reassignToBatchId: targetBatchId,
          }),
        });
      } else if (resolutionMode === 'purge') {
        if (!purgeReason.trim() || purgeReason.trim().length < 5) {
          setError('Please enter an audit reason (at least 5 characters) for exceptional batch purge.');
          setLoading(false);
          return;
        }

        await apiFetch(`/api/batches/${batch.id}?permanent=true`, {
          method: 'DELETE',
          body: JSON.stringify({
            permanent: true,
            force: true,
            reason: purgeReason.trim(),
          }),
        });
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete batch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 540 }}>
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
                Delete Batch
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Permanent batch removal confirmation
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

          {/* Batch Details Card */}
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
              {batch.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Code: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{batch.code}</span> • Class: {batch.class_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: studentCount > 0 ? '#b91c1c' : 'var(--success-text)', marginTop: 2, fontWeight: 600 }}>
              Enrolled Students: {studentCount}
            </div>
          </div>

          {studentCount === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              This batch has <strong>0 enrolled students</strong> and can be permanently removed from the system.
            </p>
          ) : (
            <div>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 'var(--radius-md)',
                  color: '#9a3412',
                  fontSize: '0.85rem',
                  marginBottom: 16,
                }}
              >
                <strong>Notice:</strong> This batch currently has <strong>{studentCount}</strong> enrolled student(s). Choose how you wish to proceed:
              </div>

              {/* Resolution Option 1: Reassign */}
              {otherBatches.length > 0 && (
                <div
                  style={{
                    padding: 14,
                    border: resolutionMode === 'reassign' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 12,
                    cursor: 'pointer',
                    background: resolutionMode === 'reassign' ? 'var(--primary-light)' : '#ffffff',
                  }}
                  onClick={() => setResolutionMode('reassign')}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="batchResolution"
                      checked={resolutionMode === 'reassign'}
                      onChange={() => setResolutionMode('reassign')}
                    />
                    <span>Reassign enrolled students to another batch (Recommended)</span>
                  </label>

                  {resolutionMode === 'reassign' && (
                    <div style={{ marginTop: 10, paddingLeft: 24 }}>
                      <label className="form-label" style={{ fontSize: '0.82rem' }}>
                        Destination Batch:
                      </label>
                      <select
                        className="form-control"
                        value={targetBatchId}
                        onChange={(e) => setTargetBatchId(parseInt(e.target.value, 10))}
                      >
                        {otherBatches.map((ob) => (
                          <option key={ob.id} value={ob.id}>
                            {ob.name} ({ob.code}) — {ob.class_name}
                          </option>
                        ))}
                      </select>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        All {studentCount} student profiles and their tuition ledger records will transfer automatically to this batch.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Resolution Option 2: Owner Purge */}
              {admin?.role === 'OWNER' && (
                <div
                  style={{
                    padding: 14,
                    border: resolutionMode === 'purge' ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 12,
                    cursor: 'pointer',
                    background: resolutionMode === 'purge' ? '#fef2f2' : '#ffffff',
                  }}
                  onClick={() => setResolutionMode('purge')}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#b91c1c' }}>
                    <input
                      type="radio"
                      name="batchResolution"
                      checked={resolutionMode === 'purge'}
                      onChange={() => setResolutionMode('purge')}
                    />
                    <span>Exceptional Purge (Owner Override)</span>
                  </label>

                  {resolutionMode === 'purge' && (
                    <div style={{ marginTop: 10, paddingLeft: 24 }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', color: '#9a3412' }}>
                        Mandatory Audit Reason *
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="e.g. Duplicate batch entered in error, test batch cleanup..."
                        value={purgeReason}
                        onChange={(e) => setPurgeReason(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                      <p style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: 6 }}>
                        Warning: This permanently deletes this batch and all associated student profiles and billing records!
                      </p>
                    </div>
                  )}
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
              {loading
                ? 'Processing...'
                : studentCount > 0 && resolutionMode === 'reassign'
                ? 'Reassign & Delete Batch'
                : studentCount > 0 && resolutionMode === 'purge'
                ? 'Purge Batch & All Records'
                : 'Delete Batch'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
