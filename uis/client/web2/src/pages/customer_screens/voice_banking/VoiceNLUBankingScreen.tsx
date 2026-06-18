import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

interface NLUResult {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  response: string;
}

const intentMap: Record<string, NLUResult> = {
  'send money': { intent: 'TRANSFER', confidence: 0.97, entities: { action: 'transfer' }, response: 'I understand you want to transfer money. How much would you like to send and to whom?' },
  'check balance': { intent: 'BALANCE_CHECK', confidence: 0.99, entities: { query: 'balance' }, response: 'I will retrieve your account balance right away.' },
  'apply for loan': { intent: 'LOAN_APPLICATION', confidence: 0.94, entities: { product: 'loan' }, response: 'I can help you apply for a loan. What loan amount do you need?' },
  'pay bills': { intent: 'BILL_PAYMENT', confidence: 0.96, entities: { action: 'payment' }, response: 'Sure! Which bill would you like to pay — electricity, water, or internet?' },
  'buy airtime': { intent: 'AIRTIME_PURCHASE', confidence: 0.98, entities: { product: 'airtime' }, response: 'Which network — MTN, Airtel, Glo, or 9Mobile?' },
  'open savings': { intent: 'SAVINGS_CREATE', confidence: 0.92, entities: { product: 'savings' }, response: 'Let\'s open a savings account for you. What is your savings goal?' },
};

const VoiceNLUBankingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<NLUResult | null>(null);
  const [history, setHistory] = useState<Array<{ text: string; result: NLUResult }>>([]);

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  const analyzeIntent = () => {
    const lower = input.toLowerCase().trim();
    let matched: NLUResult | null = null;
    for (const key of Object.keys(intentMap)) {
      if (lower.includes(key)) { matched = intentMap[key]; break; }
    }
    if (!matched) {
      matched = { intent: 'UNKNOWN', confidence: 0.32, entities: {}, response: 'I\'m not sure I understood that. Could you rephrase your request?' };
    }
    setResult(matched);
    setHistory(h => [{ text: input, result: matched! }, ...h]);
    setInput('');
  };

  const intentColor: Record<string, string> = { TRANSFER: '#6366F1', BALANCE_CHECK: '#10B981', LOAN_APPLICATION: '#F59E0B', BILL_PAYMENT: '#3B82F6', AIRTIME_PURCHASE: '#8B5CF6', SAVINGS_CREATE: '#059669', UNKNOWN: '#EF4444' };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🧠 NLU Banking Engine</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Natural Language Understanding for banking intents</p>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Try It — Type a banking request</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && input.trim() && analyzeIntent()} placeholder='e.g. "Send money to John" or "Check my balance"' style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, background: isDark ? '#2D2D2D' : '#F9FAFB', color: isDark ? '#F3F4F6' : '#111827', fontSize: 14 }} />
          <button onClick={analyzeIntent} disabled={!input.trim()} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.5 }}>Analyze</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {['Send money to Emeka', 'Check my balance', 'Apply for loan', 'Pay my PHCN bill'].map(s => (
            <button key={s} onClick={() => { setInput(s); }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, background: isDark ? '#2D2D2D' : '#F3F4F6', color: isDark ? '#D1D5DB' : '#374151', cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      </div>

      {result && (
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NLU Analysis Result</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#2D2D2D' : '#F9FAFB' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase' }}>Intent</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: intentColor[result.intent] || '#6B7280', marginTop: 4 }}>{result.intent}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#2D2D2D' : '#F9FAFB' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase' }}>Confidence</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ background: isDark ? '#374151' : '#E5E7EB', borderRadius: 8, height: 8 }}>
                  <div style={{ width: `${result.confidence * 100}%`, height: '100%', background: result.confidence > 0.8 ? '#10B981' : result.confidence > 0.5 ? '#F59E0B' : '#EF4444', borderRadius: 8, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827', marginTop: 4 }}>{(result.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 8, background: isDark ? '#1a3a2a' : '#ECFDF5', border: `1px solid ${isDark ? '#065f46' : '#A7F3D0'}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#059669', textTransform: 'uppercase', marginBottom: 6 }}>🤖 AI Response</div>
            <div style={{ fontSize: 14, color: isDark ? '#6EE7B7' : '#065F46' }}>{result.response}</div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analysis History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: isDark ? '#2D2D2D' : '#F9FAFB', border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}` }}>
                <div style={{ fontSize: 13, color: isDark ? '#F3F4F6' : '#111827', marginBottom: 4 }}>"{h.text}"</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#fff', background: intentColor[h.result.intent] || '#6B7280' }}>{h.result.intent}</span>
                  <span style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' }}>{(h.result.confidence * 100).toFixed(0)}% confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceNLUBankingScreen;
