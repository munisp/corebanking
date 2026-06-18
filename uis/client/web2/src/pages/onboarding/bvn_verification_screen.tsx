import { Alert } from 'antd';
import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

const BvnVerificationScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useTenant();
  const primaryColor = tenant.branding.primary_color || '#2563eb';
  const accountType = location.state?.accountType || 'individual';
  const [bvn, setBvn] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [bvnIsValid, setBvnIsValid] = useState<boolean | null>(null);
  const [verificationMessage, setVerificationMessage] = useState('');

  const handleBvnChange = async (value: string) => {
    setBvn(value);
    setVerificationMessage('');
    setBvnIsValid(null);
    if (value.length === 11) {
      setIsVerifying(true);
      // Simulate API call for BVN verification
      setTimeout(() => {
        if (/^\d{11}$/.test(value)) {
          setBvnIsValid(true);
          setVerificationMessage('BVN is valid');
        } else {
          setBvnIsValid(false);
          setVerificationMessage('Invalid BVN');
        }
        setIsVerifying(false);
      }, 1000);
    }
  };

  const handleContinue = () => {
    if (bvn.length === 11 && bvnIsValid) {
      localStorage.setItem('onboarding_bvn', bvn);
      navigate('/onboarding-address', { state: { accountType } });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        <button
          type="button"
          className="flex items-center gap-2 text-base font-semibold mb-6 focus:outline-none hover:underline"
          style={{ color: primaryColor }}
          onClick={() => navigate('/onboarding-account-type')}
        >
          <FiArrowLeft size={20} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-center text-primary-900 dark:text-primary-100 mb-2">BVN Verification</h1>
        <div className="flex items-center rounded-xl px-4 py-3 mb-6" style={{ background: '#eff6ff', border: '1.5px solid #93c5fd' }}>
          <span className="font-bold mr-3" style={{ color: primaryColor }}>i</span>
          <span className="text-gray-800 dark:text-gray-200 text-sm">CBN requires BVN for all accounts</span>
        </div>
        <label className="block font-semibold text-gray-700 dark:text-gray-300 text-base mb-1">Bank Verification Number (BVN)</label>
        <input
          type="text"
          value={bvn}
          maxLength={11}
          onChange={e => handleBvnChange(e.target.value.replace(/\D/g, ''))}
          placeholder="12345678901"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg mb-2 focus:outline-none focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        {isVerifying && <div className="text-sm font-medium mb-2" style={{ color: primaryColor }}>Verifying...</div>}
        {verificationMessage && (
          <Alert
            message={verificationMessage}
            type={bvnIsValid ? 'success' : 'error'}
            showIcon
            style={{ marginBottom: 8 }}
          />
        )}
        <button
          className="w-full py-3 text-white font-bold rounded-xl shadow mt-6 hover:opacity-90 transition"
          style={{ background: primaryColor }}
          disabled={bvn.length !== 11 || !bvnIsValid}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default BvnVerificationScreen;
