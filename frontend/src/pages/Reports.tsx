import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { language, t } = useLanguage();

  const [activeReport, setActiveReport] = useState<'daily' | 'monthly'>('monthly');

  // Daily Report State
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyData, setDailyData] = useState<any | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Monthly Report State
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchDailyReport = async () => {
    setDailyLoading(true);
    try {
      const res = await apiFetch(`/api/reports/daily?date=${dailyDate}`);
      setDailyData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setDailyLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setMonthlyLoading(true);
    try {
      const res = await apiFetch(`/api/reports/monthly?year=${monthlyYear}`);
      setMonthlyData(res.monthlySummary);
    } catch (err) {
      console.error(err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    if (activeReport === 'daily') {
      fetchDailyReport();
    } else {
      fetchMonthlyReport();
    }
  }, [activeReport, dailyDate, monthlyYear]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.reports} & Analytics
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Financial collection reports, performance metrics, and CSV data export
          </p>
        </div>

        {/* Quick CSV Export Shortcuts */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href="/api/reports/export/collections.csv"
            download
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '38px' }}
          >
            <FileSpreadsheet size={16} />
            <span>Collections CSV</span>
          </a>
          <a
            href="/api/reports/export/dues.csv"
            download
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '38px' }}
          >
            <FileSpreadsheet size={16} />
            <span>Dues CSV</span>
          </a>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${activeReport === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('monthly')}
          style={{ flex: '1 1 auto', minHeight: '40px', justifyContent: 'center' }}
        >
          <TrendingUp size={16} />
          <span>Annual / Monthly Summary</span>
        </button>

        <button
          type="button"
          className={`btn ${activeReport === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveReport('daily')}
          style={{ flex: '1 1 auto', minHeight: '40px', justifyContent: 'center' }}
        >
          <Calendar size={16} />
          <span>Daily Collection Ledger</span>
        </button>
      </div>

      {/* MONTHLY SUMMARY REPORT */}
      {activeReport === 'monthly' && (
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Academic Year:</span>
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(parseInt(e.target.value, 10))}
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Students Billed</th>
                  <th>Expected Fees</th>
                  <th>Collected Fees</th>
                  <th>Uncollected Dues</th>
                  <th>Collection Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {monthlyLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {t.loading}
                    </td>
                  </tr>
                ) : monthlyData.length > 0 ? (
                  monthlyData.map((m) => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 700 }}>{m.monthName}</td>
                      <td>{m.totalStudentsBilled}</td>
                      <td style={{ fontWeight: 600 }}>{formatBDT(m.expectedFees, language)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatBDT(m.collectedFees, language)}</td>
                      <td style={{ fontWeight: 600, color: m.balanceDue > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                        {formatBDT(m.balanceDue, language)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 8, maxWidth: 100 }}>
                            <div
                              style={{
                                width: `${Math.min(m.collectionEfficiency, 100)}%`,
                                background: m.collectionEfficiency >= 80 ? 'var(--success)' : m.collectionEfficiency >= 50 ? 'var(--warning)' : 'var(--danger)',
                                height: '100%',
                                borderRadius: 4,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{m.collectionEfficiency}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      {t.noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DAILY COLLECTIONS REPORT */}
      {activeReport === 'daily' && (
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Collection Date:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 'auto' }}
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>

              {dailyData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Received on Date:</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatBDT(dailyData.totalCollected, language)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Amount Received</th>
                  <th>Payment Method</th>
                  <th>Transaction Reference</th>
                  <th>Status</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {dailyLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {t.loading}
                    </td>
                  </tr>
                ) : dailyData && dailyData.transactions?.length > 0 ? (
                  dailyData.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.receipt_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.student_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{t.student_code}</div>
                      </td>
                      <td>{t.batch_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {formatBDT(t.amount, language)}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                          {t.payment_method}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{t.transaction_reference || '—'}</td>
                      <td>
                        <span className={`badge ${t.status === 'COMPLETED' ? 'badge-paid' : 'badge-overdue'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>{t.recorded_by_admin}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No payments recorded on {dailyDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
