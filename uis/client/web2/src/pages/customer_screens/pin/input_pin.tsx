import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../../services/auth_service';

const InputPinScreen = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  // ...existing code...

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const verifyPin = async (pinValue: string) => {
    setLoading(true);
    setError(null);

    try {
      const email = localStorage.getItem('email') || '';
      await authService.login(email, pinValue);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-600 to-blue-800 py-8 px-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-white mb-6">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold mb-2">Enter Your PIN</h1>
          <p className="text-white text-opacity-80">Enter your 4-digit PIN to continue</p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-14 h-14 rounded-full border-2 border-white flex items-center justify-center ${
                pin.length > index ? 'bg-white' : 'bg-transparent'
              }`}
            >
              {pin.length > index && <div className="w-3 h-3 bg-[var(--primary-color)] rounded-full"></div>}
            </div>
          ))}
        </div>

        {/* Number Pad */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinInput(num.toString())}
                disabled={loading}
                className="h-16 text-2xl font-semibold text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <div className="h-16"></div>
            <button
              onClick={() => handlePinInput('0')}
              disabled={loading}
              className="h-16 text-2xl font-semibold text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="h-16 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('/forgot-pin')}
          className="w-full text-white text-center hover:underline"
        >
          Forgot PIN?
        </button>
      </div>
    </div>
  );
};

export default InputPinScreen;
