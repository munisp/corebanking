import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

const OnboardingStartScreen = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();

  useEffect(() => {
    // Mark that user has seen the onboarding screen
    localStorage.setItem('hasSeenOnboarding', 'true');
  }, []);

  const steps = [
    { number: '1', title: 'Account Type', description: 'Select Individual or Business', required: true },
    { number: '2', title: 'Enter BVN', description: 'Provide your Bank Verification Number', required: false },
    { number: '3', title: 'Address Details', description: 'Provide your address information', required: false },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-10 mt-10">
          {/* Logo */}
          <div 
            className="w-[100px] h-[100px] rounded-3xl shadow-2xl flex items-center justify-center mb-10"
            style={{ backgroundColor: tenant.branding.primary_color }}
          >
            {tenant.logo ? (
              <img src={tenant.logo} alt={tenant.displayName} className="w-20 h-20 object-contain" />
            ) : (
              <span className="text-white text-[42px] font-bold">
                {tenant.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-white mb-4 text-center">
            Welcome to {tenant.displayName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-base leading-relaxed max-w-md">
            Complete your account setup to unlock all features and ensure CBN compliance.
          </p>
        </div>

        {/* Steps Overview */}
        <div className="space-y-3 mb-12">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`p-4 rounded-xl border-2 ${
                step.required 
                  ? 'bg-blue-50 dark:bg-[var(--primary-color)]/20 border-[var(--primary-color)] dark:border-[var(--primary-color)]' 
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${
                  step.required 
                    ? 'bg-[var(--primary-color)] text-white' 
                    : 'bg-gray-400 dark:bg-gray-600 text-white'
                }`}>
                  {step.number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[15px] text-gray-900 dark:text-white">{step.title}</h3>
                    {!step.required && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200 rounded-lg">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => navigate('/onboarding-account-type')}
            className="w-full btn-primary py-4 rounded-xl font-semibold shadow-lg"
          >
            Start Onboarding
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-transparent text-[var(--primary-color)] dark:text-[var(--primary-color)] py-4 rounded-xl font-semibold hover:bg-blue-50 dark:hover:bg-[var(--primary-color)]/30 transition-colors"
          >
            Already have an account? Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStartScreen;
