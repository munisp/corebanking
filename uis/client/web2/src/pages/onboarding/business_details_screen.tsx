import { useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiHash } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

const BusinessDetailsScreen = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const primaryColor = tenant.branding.primary_color || '#2563eb';

  const [businessName, setBusinessName] = useState('');
  const [tin, setTin] = useState('');
  const [cac, setCac] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }
    if (!tin.trim()) {
      setError('Tax Identification Number (TIN) is required.');
      return;
    }
    if (!cac.trim()) {
      setError('CAC Registration Number is required.');
      return;
    }

    localStorage.setItem('onboarding_business_name', businessName.trim());
    localStorage.setItem('onboarding_tin', tin.trim());
    localStorage.setItem('onboarding_cac', cac.trim());

    navigate('/onboarding-address', { state: { accountType: 'business' } });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center p-6 relative">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 mt-10">
        <button
          type="button"
          className="flex items-center gap-2 text-base font-semibold mb-6 focus:outline-none hover:underline"
          style={{ color: primaryColor }}
          onClick={() => navigate('/onboarding-account-type')}
        >
          <FiArrowLeft size={20} />
          Back
        </button>

        <h1 className="text-3xl font-extrabold mb-2 text-gray-900 dark:text-white tracking-tight">
          Business Details
        </h1>
        <p className="text-base font-medium text-gray-600 dark:text-gray-400 mb-8">
          Provide your business registration information to set up your business account.
        </p>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
              <FiBriefcase className="mr-3 flex-shrink-0" style={{ color: primaryColor }} />
              <input
                type="text"
                className="w-full bg-transparent py-3 outline-none dark:text-white"
                placeholder="Registered business name"
                value={businessName}
                onChange={(e) => { setBusinessName(e.target.value); setError(''); }}
              />
            </div>
          </div>

          {/* TIN */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Tax Identification Number (TIN) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
              <FiHash className="mr-3 flex-shrink-0" style={{ color: primaryColor }} />
              <input
                type="text"
                className="w-full bg-transparent py-3 outline-none dark:text-white"
                placeholder="e.g. 1234567-0001"
                value={tin}
                onChange={(e) => { setTin(e.target.value); setError(''); }}
              />
            </div>
          </div>

          {/* CAC Registration Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              CAC Registration Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
              <FiHash className="mr-3 flex-shrink-0" style={{ color: primaryColor }} />
              <input
                type="text"
                className="w-full bg-transparent py-3 outline-none dark:text-white"
                placeholder="e.g. RC-1234567"
                value={cac}
                onChange={(e) => { setCac(e.target.value); setError(''); }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              As shown on your CAC certificate
            </p>
          </div>

          <button
            className="w-full h-14 rounded-xl font-bold text-lg mt-4 text-white transition hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessDetailsScreen;
