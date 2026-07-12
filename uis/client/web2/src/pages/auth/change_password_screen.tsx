import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ChangePasswordScreen = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { authService } = await import('../../services/auth_service');
      await authService.changePassword(
        formData.currentPassword,
        formData.newPassword,
        formData.confirmPassword,
      );

      setSuccessMessage('Password changed successfully. Redirecting to settings...');

      setTimeout(() => {
        navigate('/settings');
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to change password',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-600 mb-6">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--primary-color)20' }}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-color)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Change Password</h1>
          <p className="text-gray-600">Secure your account by updating your password</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-5">
          {errorMessage && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">{errorMessage}</div>
          )}

          {successMessage && (
            <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm">{successMessage}</div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.current ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:bg-gray-400 py-3 rounded-lg font-semibold"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {/* Security Tips */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Security Tips</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a strong, unique password</li>
                <li>Include uppercase, lowercase, numbers & symbols</li>
                <li>Never share your password with anyone</li>
                <li>Change password regularly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordScreen;
