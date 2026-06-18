import { useNavigate } from 'react-router-dom';

const PinCreatedScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-700 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-white text-3xl font-bold mb-3">PIN Created Successfully!</h1>
        <p className="text-white text-opacity-90 mb-8">
          Your 4-digit PIN has been created and your account is now secured.
        </p>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-white text-green-600 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PinCreatedScreen;
