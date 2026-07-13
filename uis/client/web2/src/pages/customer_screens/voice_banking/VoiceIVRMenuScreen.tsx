import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

interface IVRNode {
  key: string;
  label: string;
  action?: string;
  children?: IVRNode[];
}

const ivrTree: IVRNode = {
  key: 'root',
  label: '54Link Bank — Main Menu',
  children: [
    { key: '1', label: 'Account Services', children: [
      { key: '1', label: 'Check Balance', action: 'balance' },
      { key: '2', label: 'Mini Statement', action: 'statement' },
      { key: '3', label: 'Account Details', action: 'account' },
      { key: '9', label: 'Back to Main Menu', action: 'back' },
    ]},
    { key: '2', label: 'Transfers & Payments', children: [
      { key: '1', label: 'Transfer Funds', action: 'transfer' },
      { key: '2', label: 'Pay Bills', action: 'bills' },
      { key: '3', label: 'Buy Airtime', action: 'airtime' },
      { key: '9', label: 'Back to Main Menu', action: 'back' },
    ]},
    { key: '3', label: 'Loans & Credit', children: [
      { key: '1', label: 'Check Loan Status', action: 'loan_status' },
      { key: '2', label: 'Apply for Loan', action: 'loan_apply' },
      { key: '3', label: 'Loan Repayment', action: 'loan_pay' },
      { key: '9', label: 'Back to Main Menu', action: 'back' },
    ]},
    { key: '4', label: 'Cards Services', action: 'cards' },
    { key: '0', label: 'Speak to an Agent', action: 'agent' },
  ],
};

const VoiceIVRMenuScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [currentNode, setCurrentNode] = useState(ivrTree);
  const [breadcrumb, setBreadcrumb] = useState<IVRNode[]>([ivrTree]);
  const [log, setLog] = useState<string[]>(['📞 Connected to 54Link Bank IVR System']);

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  const handleSelect = (node: IVRNode) => {
    if (node.action === 'back') {
      const prev = breadcrumb[breadcrumb.length - 2];
      if (prev) { setCurrentNode(prev); setBreadcrumb(b => b.slice(0, -1)); }
      setLog(l => [...l, `⬅ Back to: ${prev?.label}`]);
    } else if (node.children) {
      setCurrentNode(node);
      setBreadcrumb(b => [...b, node]);
      setLog(l => [...l, `▶ Navigated to: ${node.label}`]);
    } else {
      setLog(l => [...l, `✅ Action: ${node.label}`]);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>📞 IVR Menu System</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Interactive Voice Response for banking services</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                <span style={{ fontSize: 12, color: i === breadcrumb.length - 1 ? 'var(--primary-color)' : isDark ? '#9CA3AF' : '#6B7280', fontWeight: i === breadcrumb.length - 1 ? 700 : 400, cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default' }} onClick={() => { if (i < breadcrumb.length - 1) { setCurrentNode(b); setBreadcrumb(bc => bc.slice(0, i + 1)); }}}>
                  {i === 0 ? '🏠 Main' : b.label}
                </span>
                {i < breadcrumb.length - 1 && <span style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>›</span>}
              </React.Fragment>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>📣 {currentNode.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentNode.children?.map(child => (
                <button key={child.key} onClick={() => handleSelect(child)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, background: isDark ? '#2D2D2D' : '#F9FAFB', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{child.key}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#F3F4F6' : '#111827' }}>{child.label}</span>
                  {child.children && <span style={{ marginLeft: 'auto', color: isDark ? '#9CA3AF' : '#6B7280' }}>›</span>}
                </button>
              ))}
            </div>
            {breadcrumb.length > 1 && <button onClick={() => handleSelect({ key: '9', label: 'Back', action: 'back' })} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`, background: 'transparent', color: isDark ? '#9CA3AF' : '#6B7280', cursor: 'pointer', fontSize: 13 }}>⬅ Go Back</button>}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Session Log</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {log.map((l, i) => <div key={i} style={{ fontSize: 12, color: isDark ? '#D1D5DB' : '#374151', padding: '4px 0', borderBottom: `1px solid ${isDark ? '#2D2D2D' : '#F3F4F6'}` }}>{l}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceIVRMenuScreen;
