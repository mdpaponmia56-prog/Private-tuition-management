import React from 'react';
import { PaymentReceipt } from '../types/index.js';
import { formatBDT } from '../utils/i18n.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { Printer, X, CheckCircle, AlertTriangle } from 'lucide-react';

import { apiFetch } from '../utils/api.js';

interface ReceiptModalProps {
  receipt: PaymentReceipt;
  onClose: () => void;
  institutionName?: string;
  institutionContact?: string;
  institutionAddress?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  onClose,
  institutionName: initialName = 'Tuition Care',
  institutionContact: initialContact = '01911735403',
  institutionAddress: initialAddress = 'Gazipur, Dhaka, Bangladesh',
}) => {
  const { language, t } = useLanguage();
  const [instName, setInstName] = React.useState(initialName);
  const [instAddress, setInstAddress] = React.useState(initialAddress);
  const [instContact, setInstContact] = React.useState(initialContact);

  React.useEffect(() => {
    apiFetch('/api/settings')
      .then((res) => {
        if (res?.settings) {
          if (res.settings.institution_name) setInstName(res.settings.institution_name);
          if (res.settings.institution_address) setInstAddress(res.settings.institution_address);
          if (res.settings.institution_contact) setInstContact(res.settings.institution_contact);
        }
      })
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const isReversed = receipt.status === 'REVERSED';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header no-print">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={20} color="var(--primary)" />
            <span>Official Payment Receipt - {receipt.receiptNumber}</span>
          </div>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px' }}>
          {/* Printable Receipt Container */}
          <div className="receipt-voucher" style={{
            background: 'white',
            border: isReversed ? '2px dashed var(--danger)' : '1px solid #cbd5e1',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            position: 'relative',
          }}>
            {/* Watermark for reversed transactions */}
            {isReversed && (
              <div style={{
                position: 'absolute',
                top: '40%',
                left: '10%',
                right: '10%',
                textAlign: 'center',
                transform: 'rotate(-20deg)',
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'rgba(239, 68, 68, 0.18)',
                pointerEvents: 'none',
                letterSpacing: '0.1em',
                border: '4px dashed rgba(239, 68, 68, 0.3)',
                padding: '8px 16px',
              }}>
                REVERSED / বাতিল
              </div>
            )}

            {/* Institution Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>{instName}</h2>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 2px 0', fontWeight: 500 }}>{instAddress}</p>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 6px 0', fontWeight: 600 }}>Official Contact / Helpline: {instContact}</p>
              <div style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '3px 12px',
                background: '#f1f5f9',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.78rem',
                letterSpacing: '0.05em',
              }}>
                MONEY RECEIPT / ফি আদায় রসিদ
              </div>
            </div>

            {/* Meta Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, marginBottom: 16, fontSize: '0.82rem' }}>
              <div>
                <div><strong>Receipt No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{receipt.receiptNumber}</span></div>
                <div><strong>Payment Date:</strong> {receipt.paymentDate}</div>
                <div><strong>Payment Method:</strong> {receipt.paymentMethod} {receipt.transactionReference ? `(Trx: ${receipt.transactionReference})` : ''}</div>
              </div>
              <div>
                <div><strong>Student ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{receipt.student.studentCode}</span></div>
                <div><strong>Student Name:</strong> {receipt.student.fullName}</div>
                <div><strong>Batch:</strong> {receipt.student.batchName} ({receipt.student.className})</div>
                <div><strong>Guardian Phone:</strong> {receipt.student.guardianPhone}</div>
              </div>
            </div>

            {/* Allocation Table */}
            <div className="table-responsive" style={{ marginBottom: 16, border: 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description / Period</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Allocated</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.allocations.length > 0 ? (
                    receipt.allocations.map((alloc) => (
                      <tr key={alloc.billingRecordId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px' }}>Tuition Fee ({alloc.billingPeriod})</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          {formatBDT(alloc.allocatedAmount, language)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: alloc.remainingBillBalance > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                          {formatBDT(alloc.remainingBillBalance, language)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ padding: '12px 10px', textAlign: 'center', color: '#64748b' }}>
                        General advance payment / fee credit
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Balance Remaining</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: receipt.totalStudentOutstandingBalance > 0 ? 'var(--danger)' : 'var(--success-text)' }}>
                  {formatBDT(receipt.totalStudentOutstandingBalance, language)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Paid Amount</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatBDT(receipt.amount, language)}
                </div>
              </div>
            </div>

            {receipt.notes && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>
                <strong>Note:</strong> {receipt.notes}
              </div>
            )}

            {isReversed && (
              <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: 16 }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                <strong>Payment Reversed on:</strong> {receipt.reversedAt} | Reason: {receipt.reversalReason}
              </div>
            )}

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 24, paddingTop: 12, borderTop: '1px dashed #cbd5e1', fontSize: '0.8rem' }}>
              <div style={{ textAlign: 'center', flex: '1 1 120px' }}>
                <div style={{ height: 20 }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4 }}>Guardian Signature</div>
              </div>
              <div style={{ textAlign: 'center', flex: '1 1 140px' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{receipt.recordedByAdmin}</div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4 }}>Authorized Teacher</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.close}
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} />
            <span>{t.print}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
