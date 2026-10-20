import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useLanguage } from '../utils/i18n.js';
import { FileText, Search, ShieldCheck, Eye, RefreshCw } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const { t } = useLanguage();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = '/api/audit?';
      if (search) query += `search=${encodeURIComponent(search)}`;

      const res = await apiFetch<{ logs: any[]; total: number }>(query);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {t.auditLogs}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Immutable chronological record of administrative actions, billing generations, and financial transactions
          </p>
        </div>

        <button type="button" className="btn btn-secondary btn-icon" onClick={fetchLogs} title="Refresh Logs">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search action, administrator, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
        </div>
      </div>

      {/* Desktop Logs Table View */}
      <div className="table-responsive desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Administrator</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>IP Address</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t.loading}
                </td>
              </tr>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.admin_name}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 700 }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.entity_type}</td>
                  <td style={{ fontFamily: 'monospace' }}>{log.entity_id || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {log.ip_address || '—'}
                  </td>
                  <td>
                    {(log.old_values || log.new_values) ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                  {t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Audit Cards View */}
      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {t.loading}
          </div>
        ) : logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.id} className="entity-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.75rem' }}>
                    {log.action}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: 4 }}>
                    {log.admin_name}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleDateString()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0' }}>
                <span>Entity: <strong>{log.entity_type}</strong> #{log.entity_id || '—'}</span>
                <span style={{ fontFamily: 'monospace' }}>{log.ip_address || '—'}</span>
              </div>

              {(log.old_values || log.new_values) && (
                <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedLog(log)}
                    style={{ minHeight: '34px', padding: '3px 10px', fontSize: '0.78rem' }}
                  >
                    <Eye size={12} />
                    <span>Inspect</span>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
            {t.noData}
          </div>
        )}
      </div>

      {/* Inspect Log Modal */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div className="modal-title">Audit Record Details</div>
              <button type="button" className="btn btn-icon btn-secondary" onClick={() => setSelectedLog(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12 }}>
                <strong>Action:</strong> <span className="badge" style={{ background: '#f1f5f9' }}>{selectedLog.action}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>By:</strong> {selectedLog.admin_name} on {new Date(selectedLog.created_at).toLocaleString()}
              </div>

              {selectedLog.old_values && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Before State:</div>
                  <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: '0.78rem', overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>After State / Parameters:</div>
                  <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: '0.78rem', overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
