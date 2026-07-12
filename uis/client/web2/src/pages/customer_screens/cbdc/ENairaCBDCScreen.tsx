import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTheme } from '../../../contexts/ThemeContext';

interface ENairaWallet {
  id: string;
  wallet: string;
  tier: string;
  balance: string;
  status: string;
  lastActivity: string;
}

const seed: ENairaWallet[] = [
  { id: 'EN-001', wallet: 'eNGN-001-ABCD', tier: 'Tier 3', balance: '5,000,000', status: 'Active', lastActivity: '2026-05-14' },
  { id: 'EN-002', wallet: 'eNGN-002-EFGH', tier: 'Tier 2', balance: '500,000', status: 'Active', lastActivity: '2026-05-12' },
  { id: 'EN-003', wallet: 'eNGN-003-IJKL', tier: 'Tier 1', balance: '50,000', status: 'Active', lastActivity: '2026-05-10' },
  { id: 'EN-004', wallet: 'eNGN-004-MNOP', tier: 'Tier 2', balance: '200,000', status: 'Suspended', lastActivity: '2026-04-30' },
];

const ENairaCBDCScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [wallets, setWallets] = useState<ENairaWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wallets' | 'transactions'>('wallets');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.get('/enaira-cbdc/v1/wallets');
        const data = res.data as ENairaWallet[] | Record<string, unknown>;
        setWallets(Array.isArray(data) ? data : ((data as Record<string, unknown>).data as ENairaWallet[]) ?? seed);
      } catch {
        setWallets(seed);
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

  const tierColor: Record<string, string> = { 'Tier 1': '#F59E0B', 'Tier 2': '#10B981', 'Tier 3': '#6366F1' };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>eNaira / CBDC</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Central Bank Digital Currency management</p>
        </div>
      </div>

      {/* Hero Banner */}
      <div style={{ ...card, background: isDark ? 'linear-gradient(135deg,#064e3b,#065f46)' : 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border: 'none', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>🇳🇬</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isDark ? '#6EE7B7' : '#065F46' }}>eNaira (eNGN)</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#A7F3D0' : '#059669' }}>Central Bank of Nigeria Digital Currency — Powered by the CBN</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Wallets', value: wallets.length, icon: '👛' },
          { label: 'Active', value: wallets.filter(w => w.status === 'Active').length, icon: '✅' },
          { label: 'Tier 3 Wallets', value: wallets.filter(w => w.tier === 'Tier 3').length, icon: '⭐' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['wallets', 'transactions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: activeTab === tab ? 'var(--primary-color)' : isDark ? '#374151' : '#F3F4F6', color: activeTab === tab ? '#fff' : isDark ? '#D1D5DB' : '#374151', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827' }}>
          {activeTab === 'wallets' ? 'eNaira Wallets' : 'Recent Transactions'}
        </h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading...</div>
        ) : activeTab === 'wallets' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                  {['ID', 'Wallet Address', 'Tier', 'Balance (eNGN)', 'Last Activity', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wallets.map((w, i) => (
                  <tr key={w.id} style={{ borderBottom: `1px solid ${isDark ? '#1F2937' : '#F3F4F6'}`, backgroundColor: i % 2 === 0 ? 'transparent' : isDark ? '#161616' : '#FAFAFA' }}>
                    <td style={{ padding: '12px', color: isDark ? '#60A5FA' : 'var(--primary-color)', fontFamily: 'monospace' }}>{w.id}</td>
                    <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151', fontFamily: 'monospace', fontSize: 12 }}>{w.wallet}</td>
                    <td style={{ padding: '12px' }}><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: tierColor[w.tier] || '#6B7280' }}>{w.tier}</span></td>
                    <td style={{ padding: '12px', color: isDark ? '#F3F4F6' : '#111827', fontWeight: 600 }}>₦{w.balance}</td>
                    <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151', fontSize: 12 }}>{w.lastActivity}</td>
                    <td style={{ padding: '12px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: w.status === 'Active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : (isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2'), color: w.status === 'Active' ? '#10B981' : '#EF4444' }}>{w.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <p>Transaction history will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ENairaCBDCScreen;
