import { useNavigate } from 'react-router-dom';

const FaceVerificationSuccessScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-700 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="mx-auto w-32 h-32 bg-white rounded-full flex items-center justify-center animate-scale-in">
            <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          {/* Ripple effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-white rounded-full opacity-20 animate-ping"></div>
          </div>
        </div>

        <h1 className="text-white text-3xl font-bold mb-3">Verification Successful!</h1>
        <p className="text-white text-opacity-90 mb-4">
          Your face has been verified and registered successfully.
        </p>
        <p className="text-white text-opacity-80 text-sm mb-8">
          You can now use face verification to quickly and securely access your account.
        </p>

        {/* Features */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6 mb-8 text-left">
          <h3 className="text-white font-semibold mb-4">What's Next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-white mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white text-sm">Quick login without entering password</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-white mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white text-sm">Enhanced security for transactions</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-white mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white text-sm">Manage in Settings anytime</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-white text-green-600 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
          >
            Continue to Dashboard
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white py-4 rounded-xl font-semibold hover:bg-opacity-30 transition-all"
          >
            Go to Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceVerificationSuccessScreen;
