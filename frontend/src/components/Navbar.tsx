import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { Menu, LogOut, KeyRound, Globe, Shield } from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  institutionName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, institutionName }) => {
  const { admin, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'Owner (Lead Teacher)';
      case 'ADMINISTRATOR_2':
        return 'Admin (Coordinator)';
      case 'ADMINISTRATOR_3':
        return 'Admin (Assistant)';
      default:
        return 'Administrator';
    }
  };

  return (
    <>
      <header className="navbar no-print">
        <div className="navbar-brand">
          <button 
            type="button"
            className="btn btn-icon btn-secondary no-print" 
            onClick={onToggleSidebar} 
            title="Toggle Menu"
            style={{ display: 'flex' }}
          >
            <Menu size={20} />
          </button>
          <div className="navbar-brand-logo">৳</div>
          <div>
            <h1 className="navbar-brand-title">{institutionName || t.appName}</h1>
          </div>
        </div>

        <div className="navbar-actions">
          {/* Language Switcher */}
          <button 
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleLanguage}
            title="Toggle English / বাংলা"
            style={{ padding: '6px 10px', minHeight: '36px' }}
          >
            <Globe size={16} />
            <span className="desktop-only">{language === 'en' ? 'বাংলা' : 'English'}</span>
            <span className="mobile-only" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {language === 'en' ? 'বাং' : 'EN'}
            </span>
          </button>

          {/* Admin Identity Info */}
          {admin && (
            <div className="admin-badge" title={`${admin.fullName} (${getRoleBadge(admin.role)})`}>
              <div className="admin-avatar">
                {admin.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="admin-badge-info desktop-only" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{admin.fullName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Shield size={10} color="var(--primary)" />
                  {getRoleBadge(admin.role)}
                </span>
              </div>
            </div>
          )}

          {/* Change Password */}
          <button 
            type="button"
            className="btn btn-icon btn-secondary" 
            onClick={() => setShowPasswordModal(true)}
            title={t.changePassword}
            style={{ width: 36, height: 36 }}
          >
            <KeyRound size={16} />
          </button>

          {/* Logout */}
          <button 
            type="button"
            className="btn btn-danger btn-sm" 
            onClick={() => setShowLogoutModal(true)}
            title={t.logout}
            style={{ padding: '6px 10px', minHeight: '36px' }}
          >
            <LogOut size={16} />
            <span className="desktop-only">{t.logout}</span>
          </button>
        </div>
      </header>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {showLogoutModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24 }}>
            <div className="modal-header" style={{ marginBottom: 16 }}>
              <div className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {language === 'bn' ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout'}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setShowLogoutModal(false)}
                style={{ width: 32, height: 32 }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              {language === 'bn'
                ? 'আপনি কি নিশ্চিত যে আপনার প্রশাসনিক সেশন শেষ করতে এবং লগআউট করতে চান?'
                : 'Are you sure you want to terminate your administrative session and log out?'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowLogoutModal(false)}
                style={{ minHeight: '40px', padding: '8px 16px' }}
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setShowLogoutModal(false);
                  await logout();
                }}
                style={{ minHeight: '40px', padding: '8px 16px', fontWeight: 700 }}
              >
                <LogOut size={16} />
                <span>{language === 'bn' ? 'হ্যাঁ, লগআউট করুন' : 'Yes, Log Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
