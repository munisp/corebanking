import React, { useState } from 'react';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬', native: 'Yorùbá' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬', native: 'Hausa' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬', native: 'Igbo' },
  { code: 'fr', name: 'French', flag: '🇫🇷', native: 'Français' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', native: 'العربية' },
  { code: 'sw', name: 'Swahili', flag: '🌍', native: 'Kiswahili' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', native: 'Português' },
];

const LanguageSettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(localStorage.getItem('app_language') || 'en');
  const [saved, setSaved] = useState(false);

  const handleSelect = (code: string) => {
    setSelected(code);
    localStorage.setItem('app_language', code);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center space-x-3">
          <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Language</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {saved && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center space-x-2">
            <FiCheck className="w-4 h-4" /><span>Language preference saved</span>
          </div>
        )}

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose your preferred language for the app interface.</p>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {LANGUAGES.map((lang, i) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${i < LANGUAGES.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{lang.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{lang.native}</p>
                </div>
              </div>
              {selected === lang.code && (
                <div className="w-6 h-6 rounded-full bg-[var(--primary-color)] flex items-center justify-center">
                  <FiCheck className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
          Full multi-language support is coming soon. Your preference has been saved.
        </p>
      </div>
    </div>
  );
};

export default LanguageSettingsScreen;
