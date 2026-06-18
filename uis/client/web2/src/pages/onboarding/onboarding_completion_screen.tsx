import { useEffect, useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';

const OnboardingCompletionScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const accountType = (location.state as { accountType?: string })?.accountType || 'individual';
  const verificationLink = (location.state as { verificationLink?: string })?.verificationLink;
  const { updateTierStatus } = useTier();
  const { completeOnboarding } = useAuth();

  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setTimeout(() => setAnimate(true), 100);
    
    // Mark onboarding as completed
    completeOnboarding();
    
    // Update tier status - user completed BVN and face verification in onboarding
    updateTierStatus({ 
      hasBVN: true, 
      hasFaceVerification: true 
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusiness = accountType === 'business';

  const statusItems = [
    { title: 'Account Type', value: isBusiness ? 'Business' : 'Individual', verified: true },
    { title: isBusiness ? 'Registration Submitted' : 'BVN Verification', value: 'Verified', verified: true },
  ];

  const handleContinue = () => {
    // Navigate to login
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Icon */}
        <div className="flex justify-center mb-8">
          <div
            className={`transition-all duration-700 ${
              animate ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            }`}
          >
            <div className="w-32 h-32 bg-green-50 border-2 border-green-300 rounded-full flex items-center justify-center">
              <FiCheckCircle size={80} className="text-green-700" />
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Onboarding Complete!
          </h1>
          <p className="text-gray-600">
            {isBusiness
              ? <>Your business has been registered.<br/><span className="font-semibold text-blue-700">Complete KYB verification to activate your account.</span></>
              : <>Your CBN-compliant KYC verification is complete.<br/><span className="font-semibold text-blue-700">Proceed to complete your KYC.</span></>
            }
          </p>
          {verificationLink ? (
            <a
              href={verificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              {isBusiness ? 'Complete KYB Verification' : 'Complete KYC Verification'}
            </a>
          ) : (
            <a
              href={isBusiness ? '/kyb-documents' : '/kyc-documents'}
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              {isBusiness ? 'Go to KYB Verification' : 'Go to KYC Verification'}
            </a>
          )}
        </div>

        {/* Status Cards */}
        <div className="space-y-3 mb-8">
          {statusItems.map((item, index) => (
            <div
              key={item.title}
              className={`bg-white border border-gray-200 rounded-xl p-5 transition-all duration-500 ${
                animate ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{item.title}</p>
                  <p className="font-semibold text-gray-900">{item.value}</p>
                </div>
                {item.verified && (
                  <div className="bg-green-100 p-2 rounded-full">
                    <FiCheckCircle size={20} className="text-green-600" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Account Number Card */}
        {/* <div className="bg-linear-to-r var(--primary-color) var(--secondary-color) rounded-2xl p-6 shadow-xl mb-8  ">
          <p className="text-sm opacity-90 mb-2">Your Account Number</p>
          <p className="text-3xl font-bold mb-4 tracking-wider text-gray-900">{user?.accountNumber || "-"}</p>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <p className="text-xs opacity-90 mb-1">Account Name</p>
            <p className="font-semibold">{user?.firstName + " " + user?.lastName || "-"}</p>
          </div>
        </div> */}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-(--primary-color) rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-gray-900 mb-3">Next Steps</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-(--primary-color) mt-0.5">•</span>
              <span>Go to settings to set password</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--primary-color) mt-0.5">•</span>
              <span>Deposit funds to start transacting</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--primary-color) mt-0.5">•</span>
              <span>Explore loans, LPO financing, and bill payments</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleContinue}
            className="w-full btn-primary py-4 rounded-xl font-semibold shadow-lg"
          >
            Go to Login
          </button>

          {/* <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-4 rounded-xl font-semibold transition-colors"
          >
            Go to Dashboard
          </button> */}
        </div>

        {/* Support Link */}
        {/* <div className="text-center mt-6">
          <button
            onClick={() => navigate('/support')}
            className="text-(--primary-color) hover:text-(--primary-color) font-medium text-sm"
          >
            Need help? Contact Support
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default OnboardingCompletionScreen;
