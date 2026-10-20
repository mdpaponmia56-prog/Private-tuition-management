import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.js';
import { apiFetch } from './utils/api.js';
import { Login } from './pages/Login.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, TabType } from './components/Sidebar.js';
import { BottomNav } from './components/BottomNav.js';
import { Dashboard } from './pages/Dashboard.js';
import { Students } from './pages/Students.js';
import { StudentDetail } from './pages/StudentDetail.js';
import { Batches } from './pages/Batches.js';
import { FeeCollection } from './pages/FeeCollection.js';
import { DueManagement } from './pages/DueManagement.js';
import { PaymentHistory } from './pages/PaymentHistory.js';
import { Reports } from './pages/Reports.js';
import { Settings } from './pages/Settings.js';
import { AdminPanel } from './pages/AdminPanel.js';
import { AuditLogs } from './pages/AuditLogs.js';
import { Student } from './types/index.js';

const getInitialTab = (): TabType => {
  const path = window.location.pathname.toLowerCase();
  if (path === '/admin' || path === '/admins') return 'admins';
  if (path === '/settings') return 'settings';
  if (path === '/students') return 'students';
  if (path === '/batches') return 'batches';
  if (path === '/dues') return 'dues';
  if (path === '/fee-collection') return 'fee-collection';
  if (path === '/payments') return 'payments';
  if (path === '/reports') return 'reports';
  if (path === '/audit' || path === '/audit-logs') return 'audit';
  return 'dashboard';
};

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>(getInitialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Cross-page navigation context
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [prefilledStudentForFee, setPrefilledStudentForFee] = useState<Student | null>(null);

  // Institution profile info for headers
  const [institutionName, setInstitutionName] = useState<string>('');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getInitialTab());
      setSelectedStudentId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/api/settings')
        .then((res) => {
          if (res?.settings?.institution_name) {
            setInstitutionName(res.settings.institution_name);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            margin: '0 auto 16px',
          }}>
            ৳
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
            Private Tuition Care
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
            Verifying security session...
          </div>
        </div>
      </div>
    );
  }

  // Strict Private Website Access: If not authenticated, only Login is accessible
  if (!isAuthenticated) {
    if (window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
    return <Login onSuccess={() => {
      const target = getInitialTab();
      navigateToTab(target === 'admins' ? 'admins' : 'dashboard');
    }} />;
  }

  const navigateToTab = (tab: TabType) => {
    setCurrentTab(tab);
    setSelectedStudentId(null);
    const newPath = tab === 'dashboard' ? '/' : '/' + (tab === 'admins' ? 'admin' : tab);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  const handleOpenStudentDetail = (id: number) => {
    setSelectedStudentId(id);
  };

  const handleCollectFeeForStudent = (student: Student) => {
    setPrefilledStudentForFee(student);
    setCurrentTab('fee-collection');
    setSelectedStudentId(null);
  };

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={navigateToTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          institutionName={institutionName}
        />

        <main className="page-body">
          {selectedStudentId !== null ? (
            <StudentDetail
              studentId={selectedStudentId}
              onBack={() => setSelectedStudentId(null)}
              onCollectFee={handleCollectFeeForStudent}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <Dashboard onNavigate={navigateToTab} />
              )}

              {currentTab === 'students' && (
                <Students
                  onSelectStudent={handleOpenStudentDetail}
                  onCollectFeeForStudent={handleCollectFeeForStudent}
                />
              )}

              {currentTab === 'batches' && <Batches />}

              {currentTab === 'fee-collection' && (
                <FeeCollection initialStudent={prefilledStudentForFee} />
              )}

              {currentTab === 'dues' && (
                <DueManagement onCollectFeeForStudent={handleCollectFeeForStudent} />
              )}

              {currentTab === 'payments' && <PaymentHistory />}

              {currentTab === 'reports' && <Reports />}

              {currentTab === 'settings' && <Settings onOpenAdminPanel={() => navigateToTab('admins')} />}

              {currentTab === 'admins' && <AdminPanel />}

              {currentTab === 'audit' && <AuditLogs />}
            </>
          )}
        </main>
      </div>

      <BottomNav
        currentTab={currentTab}
        onSelectTab={navigateToTab}
        onOpenMenu={() => setIsSidebarOpen(true)}
        isMenuOpen={isSidebarOpen}
      />
    </div>
  );
};
