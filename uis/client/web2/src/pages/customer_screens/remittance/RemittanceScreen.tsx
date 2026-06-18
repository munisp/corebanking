import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTheme } from '../../../contexts/ThemeContext';

interface RemittanceTransfer {
  id: string;
  sender: string;
  receiver: string;
  amount: string;
  corridor: string;
  status: string;
  date: string;
  fee: string;
}

const seed: RemittanceTransfer[] = [
  { id: 'REM-001', sender: 'Emeka Obi (London)', receiver: 'Chidinma Obi (Lagos)', amount: 'GBP 500', corridor: 'UK → NG', status: 'Completed', date: '2026-05-14', fee: 'GBP 4.99' },
  { id: 'REM-002', sender: 'Fatima Bello (Dubai)', receiver: 'Ibrahim Bello (Kano)', amount: 'USD 1,000', corridor: 'UAE → NG', status: 'Completed', date: '2026-05-12', fee: 'USD 5.00' },
  { id: 'REM-003', sender: 'Chidi Nwachukwu (Toronto)', receiver: 'Ngozi Nwachukwu (Enugu)', amount: 'CAD 750', corridor: 'CA → NG', status: 'Processing', date: '2026-05-15', fee: 'CAD 6.50' },
  { id: 'REM-004', sender: 'Amina Garba (Berlin)', receiver: 'Usman Garba (Katsina)', amount: 'EUR 300', corridor: 'DE → NG', status: 'Pending', date: '2026-05-15', fee: 'EUR 3.00' },
];

const corridorEmoji: Record<string, string> = {
  'UK → NG': '🇬🇧→🇳🇬', 'UAE → NG': '🇦🇪→🇳🇬', 'CA → NG': '🇨🇦→🇳🇬', 'DE → NG': '🇩🇪→🇳🇬', 'US → NG': '🇺🇸→🇳🇬',
};

const RemittanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [transfers, setTransfers] = useState<RemittanceTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.get('/remittance/v1/transfers');
        const data = res.data as RemittanceTransfer[] | Record<string, unknown>;
        setTransfers(Array.isArray(data) ? data : ((data as Record<string, unknown>).data as RemittanceTransfer[]) ?? seed);
      } catch {
        setTransfers(seed);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
  };

  const statusColor: Record<string, { bg: string; text: string }> = {
    Completed: { bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', text: '#10B981' },
    Processing: { bg: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF', text: '#6366F1' },
    Pending: { bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB', text: '#F59E0B' },
    Failed: { bg: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', text: '#EF4444' },
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>International Remittance</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Send money across borders, fast & secure</p>
        </div>
      </div>

      {/* Quick Send Card */}
      <div style={{ ...card, background: isDark ? 'linear-gradient(135deg,#1e3a5f,#1a2744)' : 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: 'none', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#93C5FD' : '#1D4ED8' }}>🌐 Send Money Abroad</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#BFDBFE' : '#3B82F6' }}>Competitive rates • 150+ countries • Same-day delivery</p>
          </div>
          <button style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Send Now →
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Transfers', value: transfers.length, icon: '📤' },
          { label: 'Completed', value: transfers.filter(t => t.status === 'Completed').length, icon: '✅' },
          { label: 'Corridors Active', value: new Set(transfers.map(t => t.corridor)).size, icon: '🗺️' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Transfers Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827' }}>Transfer History</h2>
          <button style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ New Transfer</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading transfers...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                  {['ID', 'Sender', 'Receiver', 'Amount', 'Corridor', 'Fee', 'Date', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => {
                  const sc = statusColor[t.status] ?? { bg: 'transparent', text: '#6B7280' };
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${isDark ? '#1F2937' : '#F3F4F6'}`, backgroundColor: i % 2 === 0 ? 'transparent' : isDark ? '#161616' : '#FAFAFA' }}>
                      <td style={{ padding: '12px', color: isDark ? '#60A5FA' : 'var(--primary-color)', fontFamily: 'monospace' }}>{t.id}</td>
                      <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{t.sender}</td>
                      <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{t.receiver}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827' }}>{t.amount}</td>
                      <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{corridorEmoji[t.corridor] || t.corridor}</td>
                      <td style={{ padding: '12px', color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>{t.fee}</td>
                      <td style={{ padding: '12px', color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>{t.date}</td>
                      <td style={{ padding: '12px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>{t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemittanceScreen;
