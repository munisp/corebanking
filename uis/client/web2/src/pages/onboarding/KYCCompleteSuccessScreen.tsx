import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../../hooks/useTenantConfig';

const BENEFITS = [
  { icon: '⬆️', text: 'Increased transaction limits' },
  { icon: '💵', text: 'Access to loans & credit' },
  { icon: '🛡️', text: 'Insurance products available' },
  { icon: '⭐', text: 'Premium features unlocked' },
];

const KYCCompleteSuccessScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  const primaryColor = tenant.branding.primary_color;

  const [scaled, setScaled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setScaled(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <div className="flex-1 flex flex-col items-stretch px-6 pb-8 pt-16 max-w-md mx-auto w-full">
        {/* Animated success icon */}
        <div className="flex justify-center mb-10">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center border-2 border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 transition-transform duration-700 ease-out"
            style={{
              transform: scaled ? 'scale(1)' : 'scale(0)',
            }}
          >
            <span style={{ fontSize: 64 }}>✅</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-3">
          KYC Verification Complete!
        </h1>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 text-center mb-10">
          Your account has been upgraded with full access
        </p>

        {/* Benefits card */}
        <div className="rounded-2xl p-5 mb-auto" style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '1px solid #6EE7B7' }}>
          <div className="flex items-center gap-3 mb-4">
            <span style={{ fontSize: 24 }}>🏆</span>
            <h2 className="text-lg font-bold text-gray-900">Benefits Unlocked</h2>
          </div>
          <div className="space-y-3">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span style={{ fontSize: 20 }}>{b.icon}</span>
                <p className="flex-1 text-[14px] text-gray-800">{b.text}</p>
                <span style={{ fontSize: 18 }}>✅</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-10" />

        {/* CTA buttons */}
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="w-full py-4 rounded-xl text-white text-base font-bold mb-4 transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => navigate('/settings', { replace: true })}
          className="w-full py-3 text-[15px] font-semibold"
          style={{ color: primaryColor }}
        >
          View Account Settings
        </button>
      </div>
    </div>
  );
};

export default KYCCompleteSuccessScreen;
