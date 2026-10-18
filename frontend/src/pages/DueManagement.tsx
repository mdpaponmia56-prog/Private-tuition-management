import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { DueItem, Batch, Student } from '../types/index.js';
import { formatBDT, useLanguage } from '../utils/i18n.js';
import {
  AlertCircle,
  Search,
  MessageSquare,
  CreditCard,
  Phone,
  Clock,
  Filter,
  DollarSign,
  Download,
} from 'lucide-react';
import { ReminderModal } from '../components/ReminderModal.js';

interface DueManagementProps {
  onCollectFeeForStudent: (student: any) => void;
}

export const DueManagement: React.FC<DueManagementProps> = ({ onCollectFeeForStudent }) => {
  const { language, t } = useLanguage();

  const [dueData, setDueData] = useState<{
    summary: { totalDueAmount: number; totalDueStudents: number; overdueStudentsCount: number };
    students: DueItem[];
  } | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [minDue, setMinDue] = useState<string>('');

  // Reminder Modal
  const [selectedReminderStudentId, setSelectedReminderStudentId] = useState<number | null>(null);

  const fetchDueData = async () => {
    setLoading(true);
    try {
      let query = '/api/dues?';
      if (selectedBatch) query += `&batchId=${selectedBatch}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (minDue) query += `&minDue=${minDue}`;

      const res = await apiFetch(query);
      setDueData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ batches: Batch[] }>('/api/batches');
        setBatches(res.batches);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  useEffect(() => {
    fetchDueData();
  }, [selectedBatch, search, minDue]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.dueManagement}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Track overdue student balances, unpaid monthly obligations, and send polite bilingual reminders
          </p>
        </div>

        <a
          href="/api/reports/export/dues.csv"
          download
          className="btn btn-secondary"
        >
          <Download size={16} />
          <span>{t.exportCsv}</span>
        </a>
      </div>

      {/* Summary Stat Banner */}
      {dueData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--danger)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t.totalOutstandingDues}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger)' }}>
              {formatBDT(dueData.summary.totalDueAmount, language)}
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--warning)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Students with Unpaid Dues</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              {dueData.summary.totalDueStudents}
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #991b1b' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Critical Overdue Past Grace Period</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b' }}>
              {dueData.summary.overdueStudentsCount}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by student name, code, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>

          <select
            className="form-control"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <input
            type="number"
            step="100"
            className="form-control"
            placeholder="Min Due Amount (e.g. 2000)"
            value={minDue}
            onChange={(e) => setMinDue(e.target.value)}
          />
        </div>
      </div>

      {/* Dues Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student Details</th>
              <th>Batch & Class</th>
              <th>Guardian Contact</th>
              <th>Total Outstanding Due</th>
              <th>Unpaid Months</th>
              <th>Oldest Unpaid Period</th>
              <th>Last Payment</th>
              <th>Billing Mode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t.loading}
                </td>
              </tr>
            ) : dueData && dueData.students.length > 0 ? (
              dueData.students.map((item) => (
                <tr key={item.studentId}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{item.studentName}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      {item.studentCode}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.batchName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{item.className}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                      <Phone size={13} color="var(--text-muted)" />
                      <span>{item.guardianPhone}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--danger)' }}>
                      {formatBDT(item.totalOutstandingDue, language)}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-overdue">
                      {item.overdueMonthsCount} {item.overdueMonthsCount === 1 ? 'Month' : 'Months'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {item.oldestBillingPeriod}
                    </span>
                  </td>
                  <td>
                    {item.lastPaymentDate ? (
                      <div>
                        <div>{item.lastPaymentDate}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                          {formatBDT(item.lastPaymentAmount, language)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>No payment yet</span>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                      {item.billingMode}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setSelectedReminderStudentId(item.studentId)}
                        title="Generate Polite Fee Reminder"
                      >
                        <MessageSquare size={14} />
                        <span>{t.sendReminder}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onCollectFeeForStudent({
                          id: item.studentId,
                          full_name: item.studentName,
                          student_code: item.studentCode,
                          guardian_phone: item.guardianPhone,
                          batch_name: item.batchName,
                          class_name: item.className,
                        })}
                        title="Collect Payment Now"
                      >
                        <CreditCard size={14} />
                        <span>Collect</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  🎉 No outstanding dues found matching current filters!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
