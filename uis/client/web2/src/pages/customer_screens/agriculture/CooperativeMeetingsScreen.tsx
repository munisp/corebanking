import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTheme } from '../../../contexts/ThemeContext';

const CooperativeMeetingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [data, setData] = useState<Record<string, string>[]>([{id:'MTG-001',coop:'Benue Yam Farmers',type:'AGM',date:'2026-03-15',venue:'Makurdi Town Hall',attendance:'142/156',status:'Completed'},{id:'MTG-002',coop:'Kano Groundnut Coop',type:'Monthly',date:'2026-05-20',venue:'Kano Cooperative House',attendance:'TBD',status:'Scheduled'}]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.get('/agricultural/api/v1/cooperative-meetings/list');
        const raw = res.data as Record<string, string>[] | Record<string, unknown>;
        setData(Array.isArray(raw) ? raw as Record<string, string>[] : ((raw as Record<string, unknown>).data as Record<string, string>[]) ?? [{id:'MTG-001',coop:'Benue Yam Farmers',type:'AGM',date:'2026-03-15',venue:'Makurdi Town Hall',attendance:'142/156',status:'Completed'},{id:'MTG-002',coop:'Kano Groundnut Coop',type:'Monthly',date:'2026-05-20',venue:'Kano Cooperative House',attendance:'TBD',status:'Scheduled'}]);
      } catch {
        setData([{id:'MTG-001',coop:'Benue Yam Farmers',type:'AGM',date:'2026-03-15',venue:'Makurdi Town Hall',attendance:'142/156',status:'Completed'},{id:'MTG-002',coop:'Kano Groundnut Coop',type:'Monthly',date:'2026-05-20',venue:'Kano Cooperative House',attendance:'TBD',status:'Scheduled'}]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
  };

  const cols = ['ID','Cooperative','Meeting Type','Date','Venue','Attendance','Status'];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🌾 Cooperative Meetings</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Meeting schedule and minutes management</p>
        </div>
      </div>
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                  {cols.map((h: string) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${isDark ? '#1F2937' : '#F3F4F6'}`, backgroundColor: i % 2 === 0 ? 'transparent' : isDark ? '#161616' : '#FAFAFA' }}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: '12px', color: j === 0 ? (isDark ? '#60A5FA' : 'var(--primary-color)') : isDark ? '#D1D5DB' : '#374151', fontFamily: j === 0 ? 'monospace' : 'inherit', fontWeight: j === 0 ? 600 : 400 }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CooperativeMeetingsScreen;
