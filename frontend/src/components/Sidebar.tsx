import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.js';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  AlertCircle,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  FileText,
  X,
} from 'lucide-react';

export type TabType = 
  | 'dashboard' 
  | 'students' 
  | 'batches' 
  | 'fee-collection' 
  | 'dues' 
  | 'payments' 
  | 'reports' 
  | 'settings' 
  | 'admins'
  | 'audit';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen, onClose }) => {
  const { t } = useLanguage();

  const navItems: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'students', label: t.students, icon: Users },
    { id: 'batches', label: t.batches, icon: BookOpen },
    { id: 'fee-collection', label: t.feeCollection, icon: CreditCard },
    { id: 'dues', label: t.dueManagement, icon: AlertCircle },
    { id: 'payments', label: t.paymentHistory, icon: History },
    { id: 'reports', label: t.reports, icon: BarChart3 },
    { id: 'settings', label: t.settings, icon: Settings },
    { id: 'admins', label: t.adminPanel || 'Admin Panel', icon: ShieldCheck },
    { id: 'audit', label: t.auditLogs, icon: FileText },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-backdrop no-print" onClick={onClose} />}

      <aside className={`sidebar no-print ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="navbar-brand-logo" style={{ width: 34, height: 34 }}>৳</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Tuition Care BD</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Private Academic System</div>
          </div>
          <button 
            type="button" 
            className="btn btn-icon btn-secondary no-print" 
            onClick={onClose}
            style={{ width: 30, height: 30, background: 'transparent', border: 'none', color: '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                style={{ width: '100%', border: 'none', textAlign: 'left', background: isActive ? undefined : 'transparent' }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
            Bangladesh Tuition System v1.0
          </div>
        </div>
      </aside>
    </>
  );
};
