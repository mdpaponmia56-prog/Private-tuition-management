import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { DashboardData, PaymentReceipt } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  Users,
  BookOpen,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Receipt,
  MessageSquare,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ReceiptModal } from '../components/ReceiptModal.js';
import { ReminderModal } from '../components/ReminderModal.js';

interface DashboardProps {
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { language, t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [error, setError] = useState('');

  // Batches for filtering
  const [batches, setBatches] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');

  // Selected period
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [selectedReminderStudentId, setSelectedReminderStudentId] = useState<number | null>(null);

  // Load batches list for filter
  useEffect(() => {
    apiFetch<{ batches: Array<{ id: number; name: string }> }>('/api/batches')
      .then((res) => setBatches(res.batches || []))
      .catch(() => {});
  }, []);

  const fetchDashboard = async (showFullLoader = true) => {
    if (showFullLoader && !data) setLoading(true);
    setIsRefreshing(true);
    setError('');
    try {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}`;
      if (selectedBatchId) {
        url += `&batchId=${selectedBatchId}`;
      }
      const res = await apiFetch<DashboardData>(url);
      setData(res);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard(true);
  }, [selectedMonth, selectedYear, selectedBatchId]);

  // Real-time automatic sync when tab or window regains focus
  useEffect(() => {
    const onFocus = () => {
      fetchDashboard(false);
    };
    window.addEventListener('focus', onFocus);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedMonth, selectedYear, selectedBatchId]);

  const viewReceipt = async (paymentId: number) => {
    try {
      const res = await apiFetch<{ receipt: PaymentReceipt }>(`/api/payments/${paymentId}/receipt`);
      setSelectedReceipt(res.receipt);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch receipt.');
    }
  };

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const currentMonthNames = language === 'bn' ? monthNamesBn : monthNamesEn;

  return (
    <div>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              {t.dashboard}
            </h1>
            <span
              className="badge badge-active"
              style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Real-time data synced with PostgreSQL"
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Real-time ({lastUpdated})
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Financial overview, cash collections, and tuition performance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          {/* Batch selector */}
          <select
            className="form-control"
            style={{ flex: '1 1 140px', minWidth: '120px', fontWeight: 600, fontSize: '0.85rem' }}
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value ? parseInt(e.target.value, 10) : '')}
          >
            <option value="">All Batches (সব ব্যাচ)</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Month selector */}
          <select
            className="form-control"
            style={{ flex: '1 1 110px', minWidth: '100px', fontWeight: 600, fontSize: '0.85rem' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {currentMonthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Year selector */}
          <select
            className="form-control"
            style={{ flex: '1 1 80px', minWidth: '75px', fontWeight: 600, fontSize: '0.85rem' }}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => fetchDashboard(false)}
            title="Refresh Live Data"
            style={{ minWidth: 40, height: 40 }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 12px' }} />
          <p>{t.loading}</p>
        </div>
      ) : error ? (
        <div style={{ padding: 20, background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      ) : data ? (
        <>
          {/* Stat Cards Grid (8 Core Metrics) */}
          <div className="stat-grid">
            {/* 1. Active Students */}
            <div className="stat-card" style={{ '--card-accent': '#0284c7', '--card-bg': '#e0f2fe' } as any}>
              <div className="stat-icon">
                <Users size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">{t.activeStudents}</div>
                <div className="stat-value">{data.cards.activeStudents}</div>
                <div className="stat-sub">{data.cards.totalBatches} {t.totalBatches}</div>
              </div>
            </div>

            {/* 2. Expected Fees for Month */}
            <div className="stat-card" style={{ '--card-accent': '#6366f1', '--card-bg': '#e0e7ff' } as any}>
              <div className="stat-icon">
                <TrendingUp size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">{t.expectedFeesThisMonth}</div>
                <div className="stat-value">{formatBDT(data.cards.expectedFees, language)}</div>
                <div className="stat-sub">{currentMonthNames[selectedMonth - 1]} {selectedYear}</div>
              </div>
            </div>

            {/* 3. Collected Fees for Month */}
            <div className="stat-card" style={{ '--card-accent': '#0d9488', '--card-bg': '#ccfbf1' } as any}>
              <div className="stat-icon">
                <DollarSign size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">{t.collectedFeesThisMonth}</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  {formatBDT(data.cards.collectedFees, language)}
                </div>
                <div className="stat-sub">
                  Efficiency: {data.cards.expectedFees > 0 ? Math.round((data.cards.collectedFees / data.cards.expectedFees) * 100) : 0}%
                </div>
              </div>
            </div>

            {/* 4. Total Outstanding All-Time Dues */}
            <div className="stat-card" style={{ '--card-accent': '#ef4444', '--card-bg': '#fee2e2' } as any}>
              <div className="stat-icon">
                <AlertCircle size={26} />
              </div>
              <div className="stat-info">
                <div className="stat-label">{t.totalOutstandingDues}</div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>
                  {formatBDT(data.cards.totalOutstanding, language)}
                </div>
                <div className="stat-sub">{data.cards.overdueCount} {t.overdueStudents}</div>
              </div>
            </div>
          </div>

          {/* Secondary Stat Mini Cards (Status Distribution) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12, marginBottom: 24 }}>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={24} color="var(--success)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.fullyPaidStudents}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{data.cards.fullyPaidCount}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <TrendingUp size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partial Payments</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{data.cards.partialCount}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={24} color="#64748b" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unpaid</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{data.cards.unpaidCount}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overdue</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--danger)' }}>{data.cards.overdueCount}</div>
              </div>
            </div>
          </div>

          {/* Visual Charts & Trends Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: 20, marginBottom: 24 }}>
            {/* 6-Month Collection Trend Bar Chart (SVG) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <TrendingUp size={20} color="var(--primary)" />
                  <span>{t.monthlyCollectionTrends}</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Last 6 Months</span>
              </div>

              <div style={{ padding: '10px 0' }}>
                {/* SVG Visualizer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 180, paddingTop: 20 }}>
                  {data.monthlyTrends.map((trend, i) => {
                    const maxVal = Math.max(...data.monthlyTrends.map((t) => Math.max(t.expected, t.collected)), 1000);
                    const expHeight = Math.max((trend.expected / maxVal) * 140, 4);
                    const colHeight = Math.max((trend.collected / maxVal) * 140, 4);

                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
                          {/* Expected Bar */}
                          <div
                            title={`Expected: ৳${trend.expected.toLocaleString()}`}
                            style={{
                              width: 14,
                              height: `${expHeight}px`,
                              background: '#cbd5e1',
                              borderRadius: '3px 3px 0 0',
                            }}
                          />
                          {/* Collected Bar */}
                          <div
                            title={`Collected: ৳${trend.collected.toLocaleString()}`}
                            style={{
                              width: 14,
                              height: `${colHeight}px`,
                              background: 'var(--primary)',
                              borderRadius: '3px 3px 0 0',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {trend.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16, fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#cbd5e1', borderRadius: 2 }} />
                    <span>Expected Fee</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: 'var(--primary)', borderRadius: 2 }} />
                    <span>Collected Fee</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Breakdown */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <BookOpen size={20} color="var(--primary)" />
                  <span>{t.batchPerformance}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('batches')}>
                  {t.viewAll}
                </button>
              </div>

              <div className="table-responsive" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Students</th>
                      <th>Collected</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batchBreakdown.length > 0 ? (
                      data.batchBreakdown.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{b.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{b.code}</div>
                          </td>
                          <td>{b.studentCount}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            {formatBDT(b.collectedAmount, language)}
                          </td>
                          <td style={{ color: b.outstandingDue > 0 ? 'var(--danger)' : 'var(--success-text)', fontWeight: 600 }}>
                            {formatBDT(b.outstandingDue, language)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {t.noData}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Recent Payments & Urgent Follow-ups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: 20 }}>
            {/* Recent Payments */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Receipt size={20} color="var(--primary)" />
                  <span>{t.recentPayments}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('payments')}>
                  {t.viewAll}
                </button>
              </div>

              {/* Desktop Table */}
              <div className="table-responsive desktop-only" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Student</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentPayments || []).length > 0 ? (
                      (data.recentPayments || []).map((p: any) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.receipt_number || p.receiptNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{p.payment_date || p.paymentDate}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.student_name || p.studentName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.batch_name || p.batchName}</div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {formatBDT(p.amount, language)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => viewReceipt(p.id)}
                              title="View & Print Receipt"
                            >
                              <Receipt size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {t.noData}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-only" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data.recentPayments || []).length > 0 ? (
                  (data.recentPayments || []).map((p: any) => (
                    <div key={p.id} className="entity-card" style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.student_name || p.studentName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.batch_name || p.batchName} &bull; <span style={{ fontFamily: 'monospace' }}>{p.receipt_number || p.receiptNumber}</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {formatBDT(p.amount, language)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.payment_date || p.paymentDate}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => viewReceipt(p.id)}
                          style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          <Receipt size={14} />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                    {t.noData}
                  </div>
                )}
              </div>
            </div>

            {/* Urgent Follow-ups (Overdue Students) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <MessageSquare size={20} color="var(--danger)" />
                  <span>{t.urgentFollowUps}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('dues')}>
                  {t.viewAll}
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="table-responsive desktop-only" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Guardian Phone</th>
                      <th>Due Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.followUpAlerts || data.urgentFollowUps || []).length > 0 ? (
                      (data.followUpAlerts || data.urgentFollowUps || []).map((s: any) => (
                        <tr key={s.student_id || s.studentId}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{s.full_name || s.fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{s.batch_name || s.batchName}</div>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{s.guardian_phone || s.guardianPhone}</td>
                          <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                            {formatBDT(s.total_due || s.totalDue, language)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setSelectedReminderStudentId(s.student_id || s.studentId)}
                              title="Send Reminder"
                            >
                              <MessageSquare size={14} />
                              <span>{t.sendReminder}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No overdue students requiring urgent follow-up!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-only" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data.followUpAlerts || data.urgentFollowUps || []).length > 0 ? (
                  (data.followUpAlerts || data.urgentFollowUps || []).map((s: any) => (
                    <div key={s.student_id || s.studentId} className="entity-card" style={{ padding: '12px', borderLeft: '4px solid var(--danger)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.full_name || s.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.batch_name || s.batchName}</div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>
                          {formatBDT(s.total_due || s.totalDue, language)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                        <a
                          href={`tel:${s.guardian_phone || s.guardianPhone}`}
                          style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          📞 {s.guardian_phone || s.guardianPhone}
                        </a>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setSelectedReminderStudentId(s.student_id || s.studentId)}
                          style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          <MessageSquare size={14} />
                          <span>Remind</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                    No overdue students requiring urgent follow-up!
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Reminder Message Modal */}
      {selectedReminderStudentId && (
        <ReminderModal
          studentId={selectedReminderStudentId}
          onClose={() => setSelectedReminderStudentId(null)}
        />
      )}
    </div>
  );
};
