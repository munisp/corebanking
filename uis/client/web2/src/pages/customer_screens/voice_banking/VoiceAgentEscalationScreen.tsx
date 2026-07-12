import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

interface Agent {
  id: string;
  name: string;
  specialization: string;
  status: 'available' | 'busy' | 'offline';
  avgWait: string;
  rating: number;
}

const agents: Agent[] = [
  { id: 'AGT-001', name: 'Chioma Okafor', specialization: 'Loans & Credit', status: 'available', avgWait: '< 1 min', rating: 4.9 },
  { id: 'AGT-002', name: 'Babatunde Adeyemi', specialization: 'Account Services', status: 'busy', avgWait: '3–5 min', rating: 4.7 },
  { id: 'AGT-003', name: 'Fatima Ibrahim', specialization: 'International Banking', status: 'available', avgWait: '< 2 min', rating: 4.8 },
  { id: 'AGT-004', name: 'Emeka Nwosu', specialization: 'Fraud & Disputes', status: 'offline', avgWait: 'N/A', rating: 4.6 },
];

const VoiceAgentEscalationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  const statusConfig = { available: { color: '#10B981', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }, busy: { color: '#F59E0B', bg: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB' }, offline: { color: '#6B7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#F9FAFB' } };

  const handleEscalate = () => {
    setEscalating(true);
    setTimeout(() => { setEscalating(false); setEscalated(true); }, 2000);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>👤 Agent Escalation</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Connect with a live banking agent</p>
        </div>
      </div>

      {escalated ? (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#10B981', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Connected to Agent!</h2>
          <p style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 14, margin: '0 0 24px' }}>
            {agents.find(a => a.id === selectedAgent)?.name} will assist you shortly.
          </p>
          <button onClick={() => { setEscalated(false); setSelectedAgent(null); setReason(''); }} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            End Session
          </button>
        </div>
      ) : (
        <>
          <div style={card}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Agents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agents.map(agent => {
                const sc = statusConfig[agent.status];
                return (
                  <div key={agent.id} onClick={() => agent.status !== 'offline' && setSelectedAgent(agent.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: `2px solid ${selectedAgent === agent.id ? 'var(--primary-color)' : isDark ? '#374151' : '#E5E7EB'}`, background: selectedAgent === agent.id ? (isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF') : isDark ? '#2D2D2D' : '#FAFAFA', cursor: agent.status !== 'offline' ? 'pointer' : 'not-allowed', opacity: agent.status === 'offline' ? 0.6 : 1, transition: 'all 0.2s' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {agent.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#F3F4F6' : '#111827' }}>{agent.name}</div>
                      <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' }}>{agent.specialization}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: sc.bg, color: sc.color, display: 'block', marginBottom: 4 }}>{agent.status}</span>
                      <div style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' }}>Wait: {agent.avgWait}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#F59E0B', fontWeight: 700 }}>{'⭐'.repeat(Math.floor(agent.rating))}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Escalation</h3>
            <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, background: isDark ? '#2D2D2D' : '#F9FAFB', color: isDark ? '#F3F4F6' : '#111827', fontSize: 14, marginBottom: 12 }}>
              <option value="">Select reason...</option>
              <option>Voice assistant could not resolve my issue</option>
              <option>Complex transaction query</option>
              <option>Dispute or complaint</option>
              <option>Technical issue</option>
              <option>Prefer to speak with a human</option>
            </select>
            <button onClick={handleEscalate} disabled={!selectedAgent || !reason || escalating} style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: selectedAgent && reason ? 'pointer' : 'not-allowed', opacity: selectedAgent && reason ? 1 : 0.5 }}>
              {escalating ? '⏳ Connecting...' : '📞 Connect to Agent'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceAgentEscalationScreen;
