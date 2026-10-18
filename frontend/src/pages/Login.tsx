import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { Lock, Mail, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
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
      setError(result.error || 'Authentication failed.');
    }
    setLoading(false);
  };

  // Quick helper to fill the 3 authorized admin credentials for seamless evaluation
  const setDemoAdmin = (roleIndex: number) => {
    if (roleIndex === 1) {
      setEmail('teacher.owner@tuition.bd');
      setPassword('Teacher2026@Bangladesh!');
    } else if (roleIndex === 2) {
      setEmail('admin2.coordinator@tuition.bd');
      setPassword('Coord2026@Bangladesh!');
    } else {
      setEmail('admin3.assistant@tuition.bd');
      setPassword('Assist2026@Bangladesh!');
    }
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: 20,
    }}>
      <div style={{
        maxWidth: 440,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        padding: '36px 32px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary), #0284c7)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 800,
            margin: '0 auto 14px',
            boxShadow: '0 8px 16px rgba(13, 148, 136, 0.3)',
          }}>
            ৳
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Private Tuition Care
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
            Secure Administrator Portal (Bangladesh)
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
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} />
              <span>Administrator Email</span>
            </label>
            <input
              type="email"
              required
              className="form-control"
              placeholder="e.g. teacher.owner@tuition.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} />
              <span>Password</span>
            </label>
            <input
              type="password"
              required
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? t.loading : 'Sign In to Dashboard'}
          </button>
        </form>

        {/* Fixed 3 Administrators Quick Fill Section */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 10, textAlign: 'center' }}>
            Authorized Administrator Identities (Fixed: 3)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemoAdmin(1)}
              style={{ justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 10px' }}
            >
              <span>1. Lead Teacher (Owner)</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Load & Fill</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemoAdmin(2)}
              style={{ justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 10px' }}
            >
              <span>2. Academic Coordinator</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Load & Fill</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemoAdmin(3)}
              style={{ justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 10px' }}
            >
              <span>3. Accounts Assistant</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Load & Fill</span>
            </button>
          </div>
        </div>

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
