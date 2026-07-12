import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ForgotPinScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      alert('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const { authService } = await import('../../../services/auth_service');
      await authService.forgotPassword(email);
      alert('PIN reset instructions sent to your email');
      navigate('/login');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send reset instructions');
    } finally {
      setLoading(false);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-gray-800 text-2xl font-bold mb-2">Forgot PIN?</h1>
          <p className="text-gray-600">Enter your email to reset your PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:bg-gray-400 py-3 rounded-lg font-semibold"
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/login')} className="text-[var(--primary-color)] hover:underline">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPinScreen;
