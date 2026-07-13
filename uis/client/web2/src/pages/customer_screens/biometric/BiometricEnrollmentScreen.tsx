import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiInfo } from 'react-icons/fi';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { useTheme } from '../../../contexts/ThemeContext';

interface BiometricSettings {
  fingerprint: boolean;
  faceId: boolean;
  voice: boolean;
}

const STORAGE_KEY = '54link_biometric_settings';

const loadSettings = (): BiometricSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { fingerprint: false, faceId: false, voice: false };
};

const BiometricEnrollmentScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { tenant } = useTenantConfig();
  const primaryColor = tenant.branding.primary_color;

  const [settings, setSettings] = useState<BiometricSettings>(loadSettings);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof BiometricSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setLoading(false);
    setSaved(true);
  };

  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const border = isDark ? '#333' : '#E5E7EB';
  const textPrimary = isDark ? '#F3F4F6' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  const options: { key: keyof BiometricSettings; icon: string; title: string; subtitle: string }[] = [
    { key: 'fingerprint', icon: '🫆', title: 'Fingerprint', subtitle: 'Use your fingerprint to authenticate' },
    { key: 'faceId', icon: '🤳', title: 'Face ID', subtitle: 'Use facial recognition to authenticate' },
    { key: 'voice', icon: '🎙️', title: 'Voice Recognition', subtitle: 'Use your voice as an authentication factor' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Biometric Authentication</h1>
        </div>
      </div>

      <div className="p-5 max-w-lg mx-auto space-y-7">
        {/* Header card */}
        <div
          className="p-5 rounded-2xl flex items-center gap-4"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${primaryColor}1A, ${primaryColor}0A)`
              : `linear-gradient(135deg, ${primaryColor}18, ${primaryColor}08)`,
            border: `1px solid ${primaryColor}33`,
          }}
        >
          <div
            className="p-3.5 rounded-2xl flex-shrink-0"
            style={{ backgroundColor: `${primaryColor}26` }}
          >
            <span style={{ fontSize: 32 }}>🫆</span>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: textPrimary }}>Secure Biometric Login</p>
            <p className="text-[13px] mt-1" style={{ color: textSecondary }}>
              Use your biometrics for faster, more secure authentication.
            </p>
          </div>
        </div>

        {/* Authentication Methods */}
        <div>
          <h2 className="text-base font-bold mb-4" style={{ color: textPrimary }}>
            Authentication Methods
          </h2>
          <div className="space-y-3">
            {options.map(opt => {
              const active = settings[opt.key];
              return (
                <button
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all"
                  style={{
                    backgroundColor: cardBg,
                    border: `1.5px solid ${active ? `${primaryColor}4D` : 'transparent'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 p-2.5 rounded-xl"
                    style={{
                      backgroundColor: active ? `${primaryColor}1F` : isDark ? '#374151' : '#F3F4F6',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[15px] font-semibold"
                      style={{ color: textPrimary }}
                    >
                      {opt.title}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: textSecondary }}>
                      {opt.subtitle}
                    </p>
                  </div>
                  {/* Toggle */}
                  <div
                    className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: active ? primaryColor : isDark ? '#4B5563' : '#D1D5DB' }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ transform: active ? 'translateX(24px)' : 'translateX(2px)' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security note */}
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{
            backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <FiInfo size={18} color="#B45309" className="flex-shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
            Biometric data is stored securely on your device and never transmitted to our servers.
          </p>
        </div>

        {/* Save button */}
        {saved && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm text-center font-medium border border-green-200 dark:border-green-800">
            Biometric settings saved
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </div>
  );
};

export default BiometricEnrollmentScreen;
