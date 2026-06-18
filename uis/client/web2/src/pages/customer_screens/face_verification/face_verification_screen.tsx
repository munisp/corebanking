import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTier } from '../../../contexts/TierContext';

const FaceVerificationScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateTierStatus } = useTier();
  const [loading, setLoading] = useState(true);
  
  // Check if this is from onboarding or KYC
  const isFromOnboarding = location.pathname.includes('/onboarding-');
  
  // Face verification URL with query parameters
  const verificationUrl = 'https://e5b5cb9fed75.ngrok-free.app?verification_id=2673c57a-d2b0-48f9-b622-6d0a5a4d4a5d&identity_provider=default&metadata={"keycloak_id":"d73e9fee-0ab4-467b-bb8c-54742e2e8a2c","tenant_id":"lilia"}';
  
  const handleVerificationComplete = () => {
    // Update tier status
    updateTierStatus({ hasFaceVerification: true });
    
    if (isFromOnboarding) {
      // Continue to onboarding completion
      navigate('/onboarding-completion');
    } else {
      // Show success and return to settings
      alert('Face verification completed successfully!');
      navigate('/settings');
    }
  };
  
  useEffect(() => {
    // Listen for messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'verification_complete') {
        handleVerificationComplete();
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="text-gray-600 dark:text-gray-400 mb-6 flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">Face Verification</h1>
          <p className="text-gray-600 dark:text-gray-400">Complete your identity verification</p>
        </div>

        {/* Iframe Container */}
        <div className="relative w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden" style={{ height: '80vh' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary-color)] mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading verification...</p>
              </div>
            </div>
          )}
          
          <iframe
            src={verificationUrl}
            className="w-full h-full border-0"
            title="Face Verification"
            onLoad={() => setLoading(false)}
            allow="camera; microphone"
          />
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 dark:bg-[var(--primary-color)]/20 border border-[var(--primary-color)] dark:border-[var(--primary-color)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--primary-color)] dark:text-[var(--primary-color)] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)]">
              <p className="font-semibold mb-1">Secure Verification</p>
              <p>Follow the on-screen instructions to complete your face verification. Your data is encrypted and processed securely.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceVerificationScreen;
