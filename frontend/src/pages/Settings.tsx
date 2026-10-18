import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../utils/i18n.js';
import {
  Settings as SettingsIcon,
  Shield,
  Save,
  CheckCircle,
  Database,
  Lock,
  Download,
  AlertCircle,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { admin } = useAuth();
  const { t } = useLanguage();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [administrators, setAdministrators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Editable fields
  const [institutionName, setInstitutionName] = useState('');
  const [institutionContact, setInstitutionContact] = useState('');
  const [institutionAddress, setInstitutionAddress] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/settings');
      setSettings(res.settings || {});
      setAdministrators(res.administrators || []);

      setInstitutionName(res.settings.institution_name || '');
      setInstitutionContact(res.settings.institution_contact || '');
      setInstitutionAddress(res.settings.institution_address || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            institution_name: institutionName.trim(),
            institution_contact: institutionContact.trim(),
            institution_address: institutionAddress.trim(),
          },
        }),
      });
      setMessage('Institution settings updated successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings. (Only OWNER role can update institutional settings)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {t.settings} & Security Configuration
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Tuition center branding, receipt header info, database backup guidelines, and pre-authorized administrator accounts
        </p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
        {/* Tuition Center Profile Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <SettingsIcon size={20} color="var(--primary)" />
              <span>{t.tuitionCenterProfile}</span>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">{t.centerName}</label>
              <input
                type="text"
                required
                className="form-control"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                disabled={admin?.role !== 'OWNER'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.contactNumber} (Helpline)</label>
              <input
                type="text"
                required
                className="form-control"
                value={institutionContact}
                onChange={(e) => setInstitutionContact(e.target.value)}
                disabled={admin?.role !== 'OWNER'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.officialAddress}</label>
              <input
                type="text"
                required
                className="form-control"
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                disabled={admin?.role !== 'OWNER'}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input
                  type="text"
                  disabled
                  className="form-control"
                  value="Bangladeshi Taka (BDT / ৳)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Timezone</label>
                <input
                  type="text"
                  disabled
                  className="form-control"
                  value="Asia/Dhaka (UTC+6)"
                />
              </div>
            </div>

            {admin?.role === 'OWNER' ? (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ marginTop: 8 }}
              >
                <Save size={16} />
                <span>{saving ? t.loading : 'Save Institutional Settings'}</span>
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                * Institutional configuration can only be altered by the Lead Teacher (Owner account).
              </div>
            )}
          </form>
        </div>

        {/* 3 Pre-Provisioned Administrator Identities */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={20} color="var(--primary)" />
              <span>{t.preProvisionedAdmins}</span>
            </div>
            <span className="badge badge-active">Enforced Invariant: 3/3</span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            {t.securityNotice}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {administrators.map((adm, idx) => (
              <div
                key={adm.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    {idx + 1}. {adm.full_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {adm.email}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 2 }}>
                    Last Login: {adm.last_login_at ? new Date(adm.last_login_at).toLocaleString() : 'Never'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', marginBottom: 4 }}>
                    {adm.role}
                  </span>
                  <div>
                    <span className="badge badge-active" style={{ fontSize: '0.68rem' }}>Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Database Backup & Disaster Recovery Guide */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <Database size={20} color="var(--primary)" />
            <span>PostgreSQL Disaster Recovery & Backup Strategy</span>
          </div>
        </div>

        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 12 }}>
            The Private Tuition Management System runs on PostgreSQL with strict relational integrity, foreign key cascades, and transactional audit trails.
          </p>
          <div style={{ background: '#0f172a', color: '#f8fafc', padding: 16, borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: 14 }}>
            # Create a full encrypted/compressed snapshot of tuition records:<br />
            pg_dump "$DATABASE_URL" -F c -b -v -f tuition_backup_$(date +%Y%m%d).dump<br /><br />
            # Restore backup in a secure disaster recovery environment:<br />
            pg_restore -d "$DATABASE_URL" -v tuition_backup_20261018.dump
          </div>
          <p>
            * All financial transactions and audit logs are append-only. Automated daily logical backups should be stored in secure, private object storage with restricted administrator-only decryption keys.
          </p>
        </div>
      </div>
    </div>
  );
};
