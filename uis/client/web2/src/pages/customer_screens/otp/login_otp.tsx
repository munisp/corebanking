import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginOtpScreen = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      alert('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    
    try {
      const { authService } = await import('../../../services/auth_service');
      await authService.verifyOtp(otp);
      navigate('/dashboard');
    } catch (error) {
      alert('OTP verification failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { authService } = await import('../../../services/auth_service');
      await authService.resendOtp();
      alert('OTP has been resent to your phone/email');
    } catch (error) {
      alert('Failed to resend OTP: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
          <div className="mx-auto w-20 h-20 bg-[var(--primary-color)] rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-gray-800 text-2xl font-bold mb-2">Verify OTP</h1>
          <p className="text-gray-600">Enter the 6-digit code sent to your phone/email</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">OTP Code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:bg-gray-400 py-3 rounded-lg font-semibold mb-3"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            className="w-full text-[var(--primary-color)] hover:underline"
          >
            Resend OTP
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginOtpScreen;
