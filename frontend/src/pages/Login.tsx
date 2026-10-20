import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { Lock, Mail, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';

export interface LoginProps {
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Authentication failed. Please check your credentials.');
      setLoading(false);
    } else {
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '16px 12px',
    }}>
      <div style={{
        maxWidth: 440,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        padding: '32px 24px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), #0284c7)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            fontWeight: 800,
            margin: '0 auto 14px',
            boxShadow: '0 8px 16px rgba(13, 148, 136, 0.3)',
          }}>
            ৳
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Private Tuition Care
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6 }}>
            {language === 'bn' ? 'প্রশাসনিক লগইন পোর্টাল' : 'Authorized Administrator Portal'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Mail size={15} />
              <span>{language === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Administrator Email'}</span>
            </label>
            <input
              type="email"
              required
              className="form-control"
              placeholder="admin@tuitioncare.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              style={{ height: '46px', fontSize: '0.95rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Lock size={15} />
              <span>{language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</span>
            </label>
            <input
              type="password"
              required
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ height: '46px', fontSize: '0.95rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '46px', fontSize: '1rem', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? t.loading : (language === 'bn' ? 'লগইন করুন' : 'Sign In to Portal')}
          </button>
        </form>

        {/* Language switch */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleLanguage}
            style={{ fontSize: '0.78rem' }}
          >
            {language === 'en' ? 'বাংলা ইন্টারফেস (Switch to Bangla)' : 'English Interface'}
          </button>
        </div>
      </div>
    </div>
  );
};
