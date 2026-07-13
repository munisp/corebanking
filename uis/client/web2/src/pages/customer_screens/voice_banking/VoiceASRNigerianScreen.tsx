import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

const languages = [
  { code: 'en-NG', name: 'Nigerian English', accuracy: '97.2%', icon: '🇳🇬' },
  { code: 'yo-NG', name: 'Yoruba', accuracy: '94.8%', icon: '🗣️' },
  { code: 'ig-NG', name: 'Igbo', accuracy: '93.1%', icon: '🗣️' },
  { code: 'ha-NG', name: 'Hausa', accuracy: '95.5%', icon: '🗣️' },
  { code: 'pcm-NG', name: 'Pidgin English', accuracy: '91.7%', icon: '🗣️' },
];

const VoiceASRNigerianScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [selectedLang, setSelectedLang] = useState('en-NG');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🎙️ Nigerian ASR Engine</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Automatic Speech Recognition for Nigerian languages</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {languages.map(lang => (
          <div key={lang.code} onClick={() => setSelectedLang(lang.code)} style={{ ...card, cursor: 'pointer', border: selectedLang === lang.code ? '2px solid var(--primary-color)' : `1px solid ${isDark ? '#333' : '#E5E7EB'}`, transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{lang.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827', fontSize: 14 }}>{lang.name}</div>
                <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>Accuracy: {lang.accuracy}</div>
              </div>
              {selectedLang === lang.code && <span style={{ marginLeft: 'auto', color: 'var(--primary-color)', fontWeight: 700 }}>✓</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, textAlign: 'center', padding: 40 }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: isListening ? '#EF4444' : 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', cursor: 'pointer', boxShadow: isListening ? '0 0 0 20px rgba(239,68,68,0.2)' : 'none', transition: 'all 0.3s' }} onClick={() => { setIsListening(l => !l); if (!isListening) setTranscript(''); }}>
          <span style={{ fontSize: 40 }}>{isListening ? '⏹️' : '🎤'}</span>
        </div>
        <h2 style={{ color: isDark ? '#F3F4F6' : '#111827', fontSize: 18, fontWeight: 700 }}>{isListening ? 'Listening...' : 'Tap to speak'}</h2>
        <p style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13 }}>Speaking in: <strong>{languages.find(l => l.code === selectedLang)?.name}</strong></p>
        {transcript && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: isDark ? '#2D2D2D' : '#F9FAFB', border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 6 }}>TRANSCRIPT</div>
            <div style={{ color: isDark ? '#F3F4F6' : '#111827', fontSize: 15 }}>{transcript}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceASRNigerianScreen;
