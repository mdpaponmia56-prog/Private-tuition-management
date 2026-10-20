import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../utils/i18n.js';
import {
  Shield,
  ShieldCheck,
  UserPlus,
  Edit2,
  Trash2,
  Key,
  Mail,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface Administrator {
  id: number;
  email: string;
  full_name: string;
  role: 'OWNER' | 'ADMINISTRATOR_2' | 'ADMINISTRATOR_3';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export const AdminPanel: React.FC = () => {
  const { admin: currentAdmin } = useAuth();
  const { t } = useLanguage();

  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [maxLimit, setMaxLimit] = useState(3);
  const [availableSpots, setAvailableSpots] = useState(2);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Administrator | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Administrator | null>(null);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'OWNER' | 'ADMINISTRATOR_2' | 'ADMINISTRATOR_3'>('ADMINISTRATOR_2');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admins');
      setAdministrators(res.administrators || []);
      setMaxLimit(res.maxLimit || 3);
      setAvailableSpots(res.availableSpots !== undefined ? res.availableSpots : 3 - (res.administrators?.length || 0));
    } catch (err: any) {
      console.error('[Fetch Admins Error]:', err);
      setError(err.message || 'Failed to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openAddModal = () => {
    setFormFullName('');
    setFormEmail('');
    setFormRole(administrators.length === 1 ? 'ADMINISTRATOR_2' : 'ADMINISTRATOR_3');
    setFormPassword('');
    setShowAddModal(true);
  };

  const openEditModal = (adm: Administrator) => {
    setEditingAdmin(adm);
    setFormFullName(adm.full_name);
    setFormEmail(adm.email);
    setFormRole(adm.role);
    setFormPassword(''); // blank means unchanged
    setFormIsActive(adm.is_active);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await apiFetch('/api/admins', {
        method: 'POST',
        body: JSON.stringify({
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          role: formRole,
          password: formPassword,
        }),
      });

      setMessage('New administrator account created successfully.');
      setShowAddModal(false);
      fetchAdmins();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const body: any = {
        fullName: formFullName.trim(),
        email: formEmail.trim(),
      };

      if (currentAdmin?.role === 'OWNER') {
        body.role = formRole;
        body.isActive = formIsActive;
      }

      if (formPassword.trim()) {
        body.password = formPassword.trim();
      }

      await apiFetch(`/api/admins/${editingAdmin.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      setMessage(`Administrator "${formFullName}" updated successfully.`);
      setEditingAdmin(null);
      fetchAdmins();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deletingAdmin) return;

    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await apiFetch(`/api/admins/${deletingAdmin.id}`, {
        method: 'DELETE',
      });

      setMessage(`Administrator "${deletingAdmin.full_name}" removed. An admin spot is now vacant.`);
      setDeletingAdmin(null);
      fetchAdmins();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>Lead Owner</span>;
      case 'ADMINISTRATOR_2':
        return <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Coordinator</span>;
      case 'ADMINISTRATOR_3':
        return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Assistant</span>;
      default:
        return <span className="badge">{role}</span>;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              Admin Panel
            </h1>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
              প্রশাসনিক প্যানেল
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Manage authorized administrator accounts. The system enforces a strict security limit of at most 3 admin slots.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Slots indicator pill */}
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              background: availableSpots > 0 ? '#ecfdf5' : '#f1f5f9',
              border: `1px solid ${availableSpots > 0 ? '#a7f3d0' : '#cbd5e1'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              fontWeight: 700,
              color: availableSpots > 0 ? '#065f46' : '#475569',
            }}
          >
            <ShieldCheck size={16} color={availableSpots > 0 ? '#10b981' : '#64748b'} />
            <span>
              {administrators.length} of {maxLimit} Slots Filled
              {availableSpots > 0 ? ` (${availableSpots} Available)` : ' (Limit Reached)'}
            </span>
          </div>

          {currentAdmin?.role === 'OWNER' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAddModal}
              disabled={availableSpots <= 0}
              title={availableSpots <= 0 ? 'Maximum 3 administrators reached. Remove an account first.' : 'Add new administrator'}
            >
              <UserPlus size={16} />
              <span>Add Administrator</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={fetchAdmins}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Admin Slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        {administrators.map((adm, idx) => (
          <div key={adm.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              height: 4,
              background: adm.role === 'OWNER' ? 'var(--primary)' : adm.role === 'ADMINISTRATOR_2' ? '#10b981' : '#f59e0b',
              margin: '-20px -20px 16px -20px'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: adm.role === 'OWNER' ? '#e0e7ff' : '#f1f5f9',
                  color: adm.role === 'OWNER' ? 'var(--primary)' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}>
                  {adm.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                    {adm.full_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {adm.email}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                {getRoleBadge(adm.role)}
                <div style={{ marginTop: 4 }}>
                  {adm.is_active ? (
                    <span className="badge badge-active" style={{ fontSize: '0.68rem' }}>Active</span>
                  ) : (
                    <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.68rem' }}>Inactive</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Slot Index:</span>
                <span style={{ fontWeight: 600 }}>Spot {idx + 1} of 3</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Last Login:</span>
                <span>{adm.last_login_at ? new Date(adm.last_login_at).toLocaleString() : 'Never logged in'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Created Date:</span>
                <span>{new Date(adm.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem' }}
                onClick={() => openEditModal(adm)}
              >
                <Edit2 size={14} />
                <span>Edit Account</span>
              </button>

              {currentAdmin?.role === 'OWNER' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '7px 12px',
                    fontSize: '0.82rem',
                    color: '#ef4444',
                    borderColor: '#fca5a5',
                  }}
                  onClick={() => setDeletingAdmin(adm)}
                  disabled={administrators.length <= 1 || (adm.role === 'OWNER' && adm.id === currentAdmin.id && administrators.filter(a => a.role === 'OWNER').length <= 1)}
                  title={administrators.length <= 1 ? 'Cannot delete the sole administrator.' : 'Remove administrator to free up slot'}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Vacant Slot Cards */}
        {Array.from({ length: availableSpots }).map((_, i) => (
          <div
            key={`vacant-${i}`}
            className="card"
            style={{
              border: '2px dashed var(--border-color)',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '36px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              minHeight: 220,
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              color: '#94a3b8',
            }}>
              <Shield size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>
              Vacant Administrator Spot #{administrators.length + i + 1}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 220, marginTop: 4, marginBottom: 16 }}>
              Available for an assistant teacher, accountant, or coordinator.
            </div>

            {currentAdmin?.role === 'OWNER' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={openAddModal}
              >
                <UserPlus size={14} />
                <span>Fill This Spot</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Security notice card */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <Lock size={18} color="var(--primary)" />
            <span>Administrator Security Policies</span>
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px 0' }}>
            • <strong>Fixed 3-Account Invariant:</strong> At the PostgreSQL database level, a trigger rejects any attempt to insert a 4th administrator.
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            • <strong>Strict Privacy:</strong> Unauthenticated visitors cannot view student records, collections, or reports. Public registration is permanently blocked.
          </p>
          <p style={{ margin: 0 }}>
            • <strong>Session Termination on Removal:</strong> When an administrator account is deleted or deactivated, all active browser sessions for that user are immediately purged.
          </p>
        </div>
      </div>

      {/* ADD ADMINISTRATOR MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserPlus size={20} color="var(--primary)" />
                <h3 className="modal-title">Add Administrator (Spot {administrators.length + 1} of 3)</h3>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Asif Mahmud"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="e.g. asif.teacher@tuition.bd"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Administrative Role *</label>
                  <select
                    className="form-control"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                  >
                    <option value="ADMINISTRATOR_2">Academic Coordinator (ADMINISTRATOR_2)</option>
                    <option value="ADMINISTRATOR_3">Accounts Assistant (ADMINISTRATOR_3)</option>
                    <option value="OWNER">Lead Owner (Full Permissions)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Password * (Minimum 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="form-control"
                    placeholder="••••••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMINISTRATOR MODAL */}
      {editingAdmin && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit2 size={20} color="var(--primary)" />
                <h3 className="modal-title">Edit Administrator: {editingAdmin.full_name}</h3>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-secondary"
                onClick={() => setEditingAdmin(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                {currentAdmin?.role === 'OWNER' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Administrative Role</label>
                      <select
                        className="form-control"
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value as any)}
                      >
                        <option value="OWNER">Lead Owner (OWNER)</option>
                        <option value="ADMINISTRATOR_2">Academic Coordinator (ADMINISTRATOR_2)</option>
                        <option value="ADMINISTRATOR_3">Accounts Assistant (ADMINISTRATOR_3)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        id="chk_is_active"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      <label htmlFor="chk_is_active" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                        Account is Active
                      </label>
                    </div>
                  </>
                )}

                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Change Password (Leave blank to keep current)</label>
                  <input
                    type="password"
                    minLength={6}
                    className="form-control"
                    placeholder="New password (optional)"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingAdmin(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ADMINISTRATOR MODAL */}
      {deletingAdmin && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={20} color="#ef4444" />
                <h3 className="modal-title" style={{ color: '#ef4444' }}>Remove Administrator</h3>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-secondary"
                onClick={() => setDeletingAdmin(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                Are you sure you want to remove administrator <strong>{deletingAdmin.full_name}</strong> ({deletingAdmin.email})?
              </p>
              <div style={{ padding: '12px 14px', background: '#fee2e2', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '0.82rem', marginTop: 12 }}>
                • All active login sessions for this account will be terminated immediately.<br />
                • The administrator slot will be freed, allowing a new admin to be added if needed.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingAdmin(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={handleDeleteAdmin}
                disabled={submitting}
              >
                {submitting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
