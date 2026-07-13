import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTheme } from '../../../contexts/ThemeContext';

interface DiasporaAccount {
  id: string;
  name: string;
  country: string;
  type: string;
  balance: string;
  currency: string;
  status: string;
}

const seed: DiasporaAccount[] = [
  { id: 'DIA-001', name: 'Emeka Obi', country: 'United Kingdom', type: 'Domiciliary', balance: '25,000', currency: 'GBP', status: 'Active' },
  { id: 'DIA-002', name: 'Fatima Bello', country: 'United Arab Emirates', type: 'Savings', balance: '50,000', currency: 'USD', status: 'Active' },
  { id: 'DIA-003', name: 'Chidi Nwachukwu', country: 'Canada', type: 'Current', balance: '12,500', currency: 'CAD', status: 'Active' },
  { id: 'DIA-004', name: 'Amina Garba', country: 'Germany', type: 'Domiciliary', balance: '8,750', currency: 'EUR', status: 'Pending' },
];

const countryFlag: Record<string, string> = {
  'United Kingdom': '🇬🇧', 'United Arab Emirates': '🇦🇪', 'Canada': '🇨🇦', 'Germany': '🇩🇪',
  'United States': '🇺🇸', 'Australia': '🇦🇺', 'France': '🇫🇷',
};

const DiasporaBankingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [accounts, setAccounts] = useState<DiasporaAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.get('/api/diaspora/v1/accounts');
        const data = res.data as DiasporaAccount[] | Record<string, unknown>;
        setAccounts(Array.isArray(data) ? data : ((data as Record<string, unknown>).data as DiasporaAccount[]) ?? seed);
      } catch {
        setAccounts(seed);
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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>Diaspora Banking</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Manage your international banking accounts</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Accounts', value: accounts.length, icon: '🏦' },
          { label: 'Active Accounts', value: accounts.filter(a => a.status === 'Active').length, icon: '✅' },
          { label: 'Countries', value: new Set(accounts.map(a => a.country)).size, icon: '🌍' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-color)', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827' }}>Diaspora Accounts</h2>
          <button style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            + New Account
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading accounts...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                  {['ID', 'Customer', 'Country', 'Type', 'Balance', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${isDark ? '#1F2937' : '#F3F4F6'}`, backgroundColor: i % 2 === 0 ? 'transparent' : isDark ? '#161616' : '#FAFAFA' }}>
                    <td style={{ padding: '12px', color: isDark ? '#60A5FA' : 'var(--primary-color)', fontFamily: 'monospace' }}>{a.id}</td>
                    <td style={{ padding: '12px', color: isDark ? '#F3F4F6' : '#111827', fontWeight: 500 }}>{a.name}</td>
                    <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{countryFlag[a.country] || '🌍'} {a.country}</td>
                    <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{a.type}</td>
                    <td style={{ padding: '12px', color: isDark ? '#F3F4F6' : '#111827', fontWeight: 600 }}>{a.currency} {a.balance}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: a.status === 'Active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : (isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB'), color: a.status === 'Active' ? '#10B981' : '#F59E0B' }}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remittance Quick Action */}
      <div style={{ ...card, marginTop: 16, background: isDark ? 'linear-gradient(135deg,#1a2744,#1e1e3f)' : 'linear-gradient(135deg,#EEF2FF,#E0E7FF)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#A5B4FC' : '#3730A3' }}>🌐 International Remittance</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#818CF8' : '#6366F1' }}>Send money to Nigeria from anywhere in the world</p>
          </div>
          <button onClick={() => navigate('/remittance')} style={{ background: isDark ? '#4F46E5' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Send Remittance →
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiasporaBankingScreen;
