import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';

type AuthState = 'idle' | 'enrolling' | 'enrolled' | 'verifying' | 'verified' | 'failed';

const VoiceBiometricAuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [state, setState] = useState<AuthState>('idle');
  const [progress, setProgress] = useState(0);
  const [passphrase] = useState('My voice is my password, verify me');

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: 16,
  };

  const startEnrollment = () => {
    setState('enrolling');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setState('enrolled'); return 100; }
        return p + 5;
      });
    }, 150);
  };

  const startVerification = () => {
    setState('verifying');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setState(Math.random() > 0.1 ? 'verified' : 'failed'); return 100; }
        return p + 8;
      });
    }, 100);
  };

  const stateIcons: Record<AuthState, string> = { idle: '🎤', enrolling: '⏺️', enrolled: '✅', verifying: '🔍', verified: '🔓', failed: '❌' };
  const stateColors: Record<AuthState, string> = { idle: 'var(--primary-color)', enrolling: '#F59E0B', enrolled: '#10B981', verifying: '#6366F1', verified: '#10B981', failed: '#EF4444' };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: isDark ? '#E3E3E3' : '#374151' }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>🔐 Voice Biometric Auth</h1>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280' }}>Authenticate using your unique voiceprint</p>
        </div>
      </div>

      {/* Status Card */}
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: stateColors[state], display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: `0 0 30px ${stateColors[state]}40`, transition: 'all 0.3s' }}>
          <span style={{ fontSize: 50 }}>{stateIcons[state]}</span>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: isDark ? '#F3F4F6' : '#111827' }}>
          {state === 'idle' ? 'Voice Biometrics' : state === 'enrolling' ? 'Enrolling Voice...' : state === 'enrolled' ? 'Voice Enrolled!' : state === 'verifying' ? 'Verifying...' : state === 'verified' ? 'Identity Verified!' : 'Verification Failed'}
        </h2>
        <p style={{ margin: 0, color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13 }}>
          {state === 'idle' ? 'Enroll your voice or verify your identity' : state === 'enrolling' || state === 'verifying' ? 'Please speak clearly...' : state === 'enrolled' ? 'Your voiceprint has been saved securely' : state === 'verified' ? 'Welcome! Authentication successful' : 'Voice did not match. Please try again'}
        </p>

        {(state === 'enrolling' || state === 'verifying') && (
          <div style={{ margin: '20px auto', maxWidth: 300 }}>
            <div style={{ background: isDark ? '#374151' : '#E5E7EB', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: stateColors[state], transition: 'width 0.1s', borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8 }}>{progress}%</div>
          </div>
        )}
      </div>

      {/* Passphrase */}
      <div style={card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passphrase</h3>
        <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#2D2D2D' : '#F9FAFB', border: `1px solid ${isDark ? '#444' : '#E5E7EB'}`, fontSize: 16, fontWeight: 600, color: isDark ? '#F3F4F6' : '#111827', fontStyle: 'italic', textAlign: 'center' }}>
          "{passphrase}"
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', textAlign: 'center' }}>Speak this phrase clearly for enrollment and verification</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button onClick={startEnrollment} disabled={state === 'enrolling' || state === 'verifying'} style={{ padding: '14px', borderRadius: 10, border: 'none', background: state === 'enrolled' ? '#10B981' : 'var(--primary-color)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {state === 'enrolling' ? '⏺ Enrolling...' : state === 'enrolled' ? '✅ Re-Enroll' : '🎤 Enroll Voice'}
        </button>
        <button onClick={startVerification} disabled={state !== 'enrolled' && state !== 'failed' && state !== 'verified'} style={{ padding: '14px', borderRadius: 10, border: 'none', background: state === 'verified' ? '#10B981' : '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: state === 'enrolled' || state === 'failed' || state === 'verified' ? 'pointer' : 'not-allowed', opacity: state === 'enrolled' || state === 'failed' || state === 'verified' ? 1 : 0.5 }}>
          {state === 'verifying' ? '🔍 Verifying...' : state === 'verified' ? '🔓 Verified!' : '🔍 Verify Identity'}
        </button>
      </div>
    </div>
  );
};

export default VoiceBiometricAuthScreen;
