import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTheme } from '../../../contexts/ThemeContext';

interface Portfolio {
  id: string;
  client: string;
  aum: string;
  strategy: string;
  ytdReturn: string;
  riskProfile: string;
  status: string;
}

const seed: Portfolio[] = [
  { id: 'WM-001', client: 'Otedola Family Office', aum: 'NGN 85B', strategy: 'Growth', ytdReturn: '+18.5%', riskProfile: 'Aggressive', status: 'Active' },
  { id: 'WM-002', client: 'Adenuga Trust', aum: 'NGN 120B', strategy: 'Balanced', ytdReturn: '+14.2%', riskProfile: 'Moderate', status: 'Active' },
  { id: 'WM-003', client: 'Dangote Portfolio', aum: 'NGN 250B', strategy: 'Conservative', ytdReturn: '+9.7%', riskProfile: 'Low', status: 'Active' },
  { id: 'WM-004', client: 'Elumelu Foundation', aum: 'NGN 42B', strategy: 'ESG', ytdReturn: '+11.3%', riskProfile: 'Moderate', status: 'Review' },
];

const strategyColors: Record<string, string> = {
  Growth: '#6366F1', Balanced: '#10B981', Conservative: '#3B82F6', ESG: '#059669',
};

const WealthManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.get('/wealth/v1/portfolios');
        const data = res.data as Portfolio[] | Record<string, unknown>;
        setPortfolios(Array.isArray(data) ? data : ((data as Record<string, unknown>).data as Portfolio[]) ?? seed);
      } catch {
        setPortfolios(seed);
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

  const totalAUM = portfolios.length * 124; // approximation for display

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>Wealth Management</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Portfolio management & investment advisory</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Portfolios', value: portfolios.length, icon: '📊', sub: 'Under management' },
          { label: 'Avg YTD Return', value: '+13.4%', icon: '📈', sub: 'Across all portfolios' },
          { label: 'Active Clients', value: portfolios.filter(p => p.status === 'Active').length, icon: '👤', sub: 'High net worth' },
          { label: 'Total AUM', value: `NGN ${totalAUM}B+`, icon: '💰', sub: 'Assets under mgmt' },
        ].map(s => (
          <div key={s.label} style={{ ...card }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-color)' }}>{s.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827', marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Portfolio Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827' }}>Client Portfolios</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ background: isDark ? '#374151' : '#F3F4F6', color: isDark ? '#D1D5DB' : '#374151', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Filter</button>
            <button style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ New Portfolio</button>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading portfolios...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                  {['ID', 'Client', 'AUM', 'Strategy', 'Risk Profile', 'YTD Return', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolios.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${isDark ? '#1F2937' : '#F3F4F6'}`, backgroundColor: i % 2 === 0 ? 'transparent' : isDark ? '#161616' : '#FAFAFA', cursor: 'pointer' }}>
                    <td style={{ padding: '12px', color: isDark ? '#60A5FA' : 'var(--primary-color)', fontFamily: 'monospace' }}>{p.id}</td>
                    <td style={{ padding: '12px', color: isDark ? '#F3F4F6' : '#111827', fontWeight: 500 }}>{p.client}</td>
                    <td style={{ padding: '12px', color: isDark ? '#F3F4F6' : '#111827', fontWeight: 600 }}>{p.aum}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#fff', backgroundColor: strategyColors[p.strategy] || '#6B7280' }}>{p.strategy}</span>
                    </td>
                    <td style={{ padding: '12px', color: isDark ? '#D1D5DB' : '#374151' }}>{p.riskProfile}</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: p.ytdReturn.startsWith('+') ? '#10B981' : '#EF4444' }}>{p.ytdReturn}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: p.status === 'Active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : (isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB'), color: p.status === 'Active' ? '#10B981' : '#F59E0B' }}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Strategy Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginTop: 16 }}>
        {[
          { strategy: 'Growth', desc: 'High-yield equity focused', return: '15–25%', risk: 'High', icon: '🚀' },
          { strategy: 'Balanced', desc: 'Mixed equity & bonds', return: '10–18%', risk: 'Medium', icon: '⚖️' },
          { strategy: 'Conservative', desc: 'Capital preservation focus', return: '7–12%', risk: 'Low', icon: '🛡️' },
          { strategy: 'ESG', desc: 'Sustainable investments', return: '8–15%', risk: 'Medium', icon: '🌱' },
        ].map(s => (
          <div key={s.strategy} style={{ ...card }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>{s.strategy}</h3>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' }}>{s.desc}</p>
            <div style={{ fontSize: 12, color: isDark ? '#D1D5DB' : '#374151' }}>Target: <strong>{s.return}</strong> | Risk: <strong>{s.risk}</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WealthManagementScreen;
