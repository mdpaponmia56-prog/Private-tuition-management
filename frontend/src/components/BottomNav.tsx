import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.js';
import { LayoutDashboard, Users, CreditCard, AlertCircle, Menu } from 'lucide-react';
import { TabType } from './Sidebar.js';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMenu,
  isMenuOpen,
}) => {
  const { t } = useLanguage();

  const isMoreActive = [
    'batches',
    'payments',
    'reports',
    'settings',
    'admins',
    'audit',
  ].includes(currentTab);

  return (
    <nav className="bottom-nav no-print" aria-label="Mobile Navigation">
      <button
        type="button"
        className={`bottom-nav-item ${currentTab === 'dashboard' && !isMenuOpen ? 'active' : ''}`}
        onClick={() => onSelectTab('dashboard')}
        aria-label={t.dashboard}
      >
        <LayoutDashboard size={20} />
        <span>{t.dashboard}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${currentTab === 'students' && !isMenuOpen ? 'active' : ''}`}
        onClick={() => onSelectTab('students')}
        aria-label={t.students}
      >
        <Users size={20} />
        <span>{t.students}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${currentTab === 'fee-collection' && !isMenuOpen ? 'active' : ''}`}
        onClick={() => onSelectTab('fee-collection')}
        aria-label={t.feeCollection}
      >
        <CreditCard size={20} />
        <span>{t.feeCollection}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${currentTab === 'dues' && !isMenuOpen ? 'active' : ''}`}
        onClick={() => onSelectTab('dues')}
        aria-label={t.dueManagement}
      >
        <AlertCircle size={20} />
        <span>{t.dueManagement}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${(isMoreActive || isMenuOpen) ? 'active' : ''}`}
        onClick={onOpenMenu}
        aria-label="More Menu"
      >
        <Menu size={20} />
        <span>{t.settings ? 'More' : 'মেনু'}</span>
      </button>
    </nav>
  );
};
