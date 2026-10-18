import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.js';
import { apiFetch } from '../utils/api.js';
import { X, Lock, CheckCircle2 } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={20} color="var(--primary)" />
            {t.changePassword}
          </div>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.88rem' }}>
                {error}
              </div>
            )}

            {success ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--success-text)' }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Password Updated!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your credentials have been securely updated.</p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                  />
                </div>
              </>
            )}
          </div>

          {!success && (
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                {t.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t.loading : t.save}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
