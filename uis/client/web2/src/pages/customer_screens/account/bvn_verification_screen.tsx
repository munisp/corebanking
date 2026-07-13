import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';

const BvnVerificationScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const accountType = (location.state as any)?.accountType;
  const [bvn, setBvn] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Store BVN for later use in customer creation (no API call) - only if provided
    if (bvn.length === 11) {
      localStorage.setItem('onboarding_bvn', bvn);
    } else {
      localStorage.removeItem('onboarding_bvn');
    }
    
    // Navigate to address verification
    navigate('/onboarding-address', { state: { accountType, bvn: bvn || undefined } });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <button
          type="button"
          className="flex items-center gap-2 text-base font-semibold mb-6 focus:outline-none hover:underline"
          style={{ color: 'var(--primary-color)' }}
          onClick={() => navigate(-1)}
        >
          <FiArrowLeft size={20} />
          Back
        </button>
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--primary-color)' }}>Enter Your BVN</h1>
          <p className="text-center text-gray-600 dark:text-gray-300">Provide your Bank Verification Number</p>
        </div>
        <form onSubmit={handleSubmit} className="">
          <div className="mb-6">
            <label className="block font-semibold mb-2" style={{ color: 'var(--primary-color)' }}>Bank Verification Number (BVN)</label>
            <input
              type="text"
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Enter your 11-digit BVN (optional)"
              maxLength={11}
              className="w-full px-4 py-3 text-center text-xl tracking-wider border rounded-lg focus:ring-2 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              style={{ borderColor: 'var(--primary-color)', outlineColor: 'var(--primary-color)' }}
            />
            <p className="text-xs text-gray-500 mt-2">Your BVN is safe and secure with us</p>
          </div>
          <div className="space-y-3">
            <button
              type="submit"
              disabled={bvn.length !== 11 && bvn.length !== 0}
              className="w-full text-white py-3 rounded-lg font-semibold transition-colors"
              style={{ background: 'var(--primary-color)', opacity: bvn.length !== 11 && bvn.length !== 0 ? 0.5 : 1 }}
            >
              Continue
            </button>
            {/* <button
              type="button"
              onClick={() => {
                localStorage.removeItem('onboarding_bvn');
                navigate('/onboarding-address', { state: { accountType } });
              }}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
              style={{ border: '1px solid var(--primary-color)', color: 'var(--primary-color)', background: 'transparent' }}
            >
              Skip for now
            </button> */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default BvnVerificationScreen;
