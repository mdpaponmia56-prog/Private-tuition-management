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
          >
            <Globe size={16} />
            <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
          </button>

          {/* Admin Identity Info */}
          {admin && (
            <div className="admin-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="admin-avatar">
                {admin.fullName.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{admin.fullName}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
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
          >
            <KeyRound size={17} />
          </button>

          {/* Logout */}
          <button 
            type="button"
            className="btn btn-danger btn-sm" 
            onClick={logout}
            title={t.logout}
          >
            <LogOut size={16} />
            <span>{t.logout}</span>
          </button>
        </div>
      </header>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
};
