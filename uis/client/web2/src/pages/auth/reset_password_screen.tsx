import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type ResetLocationState = {
  email?: string;
  keycloakId?: string;
};

const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as ResetLocationState | null) ?? null;

  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const keycloakId = state?.keycloakId || localStorage.getItem('password_reset_keycloak_id') || '';
  const email = state?.email || '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!keycloakId) {
      setErrorMessage('Reset session is missing. Please start from Forgot Password again.');
      return;
    }

    if (!otpCode) {
      setErrorMessage('Please enter the OTP code.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { authService } = await import('../../services/auth_service');
      await authService.resetPassword({
        keycloakId,
        otpCode,
        newPassword,
        confirmPassword,
      });

      localStorage.removeItem('password_reset_keycloak_id');
      setSuccessMessage('Password reset successful. Redirecting to login...');

      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reset password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <Link to="/forgot-password" className="text-[var(--primary-color)] font-semibold text-sm">
          {'<- Back'}
        </Link>

        <div className="text-center mt-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-600 mt-2">
            Enter the OTP code sent during forgot password and set a new password.
          </p>
          {email && <p className="text-sm text-gray-500 mt-1">For: {email}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          {errorMessage && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">{errorMessage}</div>
          )}

          {successMessage && (
            <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm">{successMessage}</div>
          )}

          <div>
            <label className="block text-gray-700 font-semibold mb-2">OTP Code</label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter OTP"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:bg-gray-400 py-3 rounded-lg font-semibold"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
