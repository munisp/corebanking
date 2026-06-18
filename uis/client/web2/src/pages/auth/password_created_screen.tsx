import { useNavigate } from 'react-router-dom';

const PasswordCreatedScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-b from-green-500 to-green-700 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 animate-bounce-slow">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-white text-3xl font-bold mb-3">Password Created!</h1>
        <p className="text-white text-opacity-90 mb-8">
          Your password has been successfully created. You can now log in to your account.
        </p>

        <button
          onClick={() => navigate('/login')}
          className="w-full bg-white text-green-600 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
        >
          Continue to Login
        </button>
      </div>
    </div>
  );
};

export default PasswordCreatedScreen;
