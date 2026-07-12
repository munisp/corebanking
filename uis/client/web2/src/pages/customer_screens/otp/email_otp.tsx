import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EmailOtpScreen = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      alert('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    
    try {
      const { authService } = await import('../../../services/auth_service');
      await authService.verifyOtp(otp);
      navigate('/password-created');
    } catch (error) {
      alert('Email verification failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { authService } = await import('../../../services/auth_service');
      await authService.resendOtp();
      alert('Verification code has been resent to your email');
    } catch (error) {
      alert('Failed to resend code: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-600 mb-6">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-gray-800 text-2xl font-bold mb-2">Email Verification</h1>
          <p className="text-gray-600">Enter the 6-digit code sent to your email</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">Verification Code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold mb-3 transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            className="w-full text-green-600 hover:underline"
          >
            Resend Code
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailOtpScreen;
