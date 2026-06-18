import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

interface GatewayService {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: string;
  requests: string;
  icon: string;
  path: string;
}

const services: GatewayService[] = [
  { id: 'asr', name: 'ASR Engine', status: 'online', latency: '45ms', requests: '12,450/min', icon: '🎙️', path: '/voice-asr' },
  { id: 'tts', name: 'TTS Engine', status: 'online', latency: '38ms', requests: '8,230/min', icon: '🔊', path: '/voice-tts' },
  { id: 'nlu', name: 'NLU Engine', status: 'online', latency: '62ms', requests: '9,870/min', icon: '🧠', path: '/voice-nlu' },
  { id: 'ivr', name: 'IVR System', status: 'online', latency: '22ms', requests: '4,100/min', icon: '📞', path: '/voice-ivr' },
  { id: 'bio', name: 'Biometric Auth', status: 'degraded', latency: '120ms', requests: '2,340/min', icon: '🔐', path: '/voice-biometric' },
  { id: 'esc', name: 'Agent Escalation', status: 'online', latency: '15ms', requests: '890/min', icon: '👤', path: '/voice-escalation' },
];

const VoiceBankingGatewayScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<'all' | 'online' | 'degraded' | 'offline'>('all');

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  const statusConfig = { online: { color: '#10B981', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', dot: '#10B981' }, degraded: { color: '#F59E0B', bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB', dot: '#F59E0B' }, offline: { color: '#EF4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', dot: '#EF4444' } };

  const filtered = filter === 'all' ? services : services.filter(s => s.status === filter);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🌐 Voice Banking Gateway</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Central hub for all voice banking microservices</p>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Services Online', value: services.filter(s => s.status === 'online').length, icon: '✅', color: '#10B981' },
          { label: 'Degraded', value: services.filter(s => s.status === 'degraded').length, icon: '⚠️', color: '#F59E0B' },
          { label: 'Offline', value: services.filter(s => s.status === 'offline').length, icon: '❌', color: '#EF4444' },
          { label: 'Avg Latency', value: '50ms', icon: '⚡', color: '#6366F1' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'online', 'degraded', 'offline'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, textTransform: 'capitalize', background: filter === f ? 'var(--primary-color)' : isDark ? '#374151' : '#F3F4F6', color: filter === f ? '#fff' : isDark ? '#D1D5DB' : '#374151' }}>{f}</button>
        ))}
      </div>

      {/* Service Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {filtered.map(svc => {
          const sc = statusConfig[svc.status];
          return (
            <div key={svc.id} onClick={() => navigate(svc.path)} style={{ ...card, marginBottom: 0, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{svc.icon}</div>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: sc.bg, color: sc.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                  {svc.status}
                </span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>{svc.name}</h3>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>⚡ {svc.latency}</span>
                <span style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>📊 {svc.requests}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VoiceBankingGatewayScreen;
