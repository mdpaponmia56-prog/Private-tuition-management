import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { formatBDT } from '../utils/i18n.js';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';

interface ReminderModalProps {
  studentId: number;
  onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({ studentId, onClose }) => {
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    studentName: string;
    guardianPhone: string;
    totalDue: number;
    unpaidMonths: string[];
    banglaMessage: string;
    englishMessage: string;
  } | null>(null);

  const [copiedBn, setCopiedBn] = useState(false);
  const [copiedEn, setCopiedEn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/dues/${studentId}/reminder`);
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  const copyToClipboard = (text: string, isBn: boolean) => {
    navigator.clipboard.writeText(text);
    if (isBn) {
      setCopiedBn(true);
      setTimeout(() => setCopiedBn(false), 2000);
    } else {
      setCopiedEn(true);
      setTimeout(() => setCopiedEn(false), 2000);
    }
  };

  const getWhatsAppLink = (text: string, phone: string) => {
    // Format Bangladesh phone to international format: e.g. 017... -> 88017...
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = `88${cleanPhone}`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={20} color="var(--primary)" />
            <span>Fee Reminder Notification - {data?.studentName}</span>
          </div>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>{t.loading}</div>
          ) : data ? (
            <div>
              {/* Summary Header */}
              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{data.studentName}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Guardian Phone: <strong>{data.guardianPhone}</strong></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Outstanding Due</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>
                    {formatBDT(data.totalDue, language)}
                  </div>
                </div>
              </div>

              {/* Bangla Message Box */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.reminderTextBn}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(data.banglaMessage, true)}
                  >
                    {copiedBn ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    <span>{copiedBn ? 'Copied' : t.copyMessage}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  className="form-control"
                  style={{ fontFamily: "'Hind Siliguri', sans-serif", fontSize: '0.92rem', lineHeight: 1.6 }}
                  value={data.banglaMessage}
                />
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={getWhatsAppLink(data.banglaMessage, data.guardianPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success btn-sm"
                  >
                    <Send size={14} />
                    <span>{t.openWhatsApp}</span>
                  </a>
                </div>
              </div>

              {/* English Message Box */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.reminderTextEn}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(data.englishMessage, false)}
                  >
                    {copiedEn ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    <span>{copiedEn ? 'Copied' : t.copyMessage}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  className="form-control"
                  style={{ fontSize: '0.88rem', lineHeight: 1.5 }}
                  value={data.englishMessage}
                />
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={getWhatsAppLink(data.englishMessage, data.guardianPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success btn-sm"
                  >
                    <Send size={14} />
                    <span>{t.openWhatsApp}</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div>Failed to load reminder message.</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
