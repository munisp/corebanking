import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

const voices = [
  { id: 'ng-en-male', name: 'Emeka (Nigerian English Male)', lang: 'en-NG', gender: 'Male' },
  { id: 'ng-en-female', name: 'Ngozi (Nigerian English Female)', lang: 'en-NG', gender: 'Female' },
  { id: 'ng-yo-female', name: 'Ọpẹ (Yoruba Female)', lang: 'yo-NG', gender: 'Female' },
  { id: 'ng-ha-male', name: 'Musa (Hausa Male)', lang: 'ha-NG', gender: 'Male' },
  { id: 'ng-ig-female', name: 'Adaeze (Igbo Female)', lang: 'ig-NG', gender: 'Female' },
];

const sampleTexts = [
  'Your transfer of ₦50,000 to John Doe was successful.',
  'You have a new credit alert of ₦250,000.',
  'Welcome to 54Link Bank. How may I assist you today?',
];

const VoiceTTSNigerianScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [text, setText] = useState(sampleTexts[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 3000);
  };

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🔊 Nigerian TTS Engine</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Text-to-Speech for Nigerian languages & accents</p>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Voice</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {voices.map(v => (
            <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedVoice === v.id ? 'var(--primary-color)' : isDark ? '#374151' : '#E5E7EB'}`, cursor: 'pointer', background: selectedVoice === v.id ? (isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF') : 'transparent', transition: 'all 0.2s' }}>
              <input type="radio" name="voice" value={v.id} checked={selectedVoice === v.id} onChange={() => setSelectedVoice(v.id)} style={{ accentColor: 'var(--primary-color)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#F3F4F6' : '#111827' }}>{v.name}</div>
                <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' }}>{v.lang} · {v.gender}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text to Speak</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {sampleTexts.map((s, i) => (
            <button key={i} onClick={() => setText(s)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, background: text === s ? 'var(--primary-color)' : isDark ? '#2D2D2D' : '#F9FAFB', color: text === s ? '#fff' : isDark ? '#D1D5DB' : '#374151', cursor: 'pointer' }}>Sample {i + 1}</button>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, background: isDark ? '#2D2D2D' : '#F9FAFB', color: isDark ? '#F3F4F6' : '#111827', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        <button onClick={handleSpeak} disabled={isSpeaking || !text.trim()} style={{ marginTop: 12, width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none', background: isSpeaking ? '#10B981' : 'var(--primary-color)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: isSpeaking ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span>{isSpeaking ? '🔊 Speaking...' : '▶ Speak Text'}</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceTTSNigerianScreen;
