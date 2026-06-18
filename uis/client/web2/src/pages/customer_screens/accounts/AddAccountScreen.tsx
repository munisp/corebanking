import React, { useState } from 'react';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { accountService } from '../../../services/account_service';

const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings Account', icon: '💰', description: 'Personal savings with competitive interest rates' },
  { value: 'current', label: 'Current Account', icon: '🏦', description: 'Business transactions with unlimited operations' },
  { value: 'fixed_deposit', label: 'Fixed Deposit', icon: '🔒', description: 'Long-term investment with higher returns' },
  { value: 'domiciliary', label: 'Domiciliary Account', icon: '💱', description: 'Foreign currency account' },
];

const AddAccountScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('savings');
  const [accountName, setAccountName] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accountName.trim()) { setError('Account name is required'); return; }
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}') as { id?: string };
    if (!currentUser.id) { setError('Unable to identify current user. Please log in again.'); return; }

    setSubmitting(true);
    try {
      const result = await accountService.createAccount({
        userId: currentUser.id,
        accountName: accountName.trim(),
        accountType: selectedType as 'savings' | 'current' | 'fixed_deposit' | 'domiciliary' | 'mint',
        currency,
      });
      if (result.success) {
        navigate('/accounts');
      } else {
        setError(result.message || 'Failed to create account');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInfo = ACCOUNT_TYPES.find(t => t.value === selectedType);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--primary-color)] to-blue-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-white/10 rounded-full">
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Add New Account</h1>
              <p className="text-white/70 text-sm">Open a new bank account</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Type */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Account Type</h2>
            <div className="space-y-2">
              {ACCOUNT_TYPES.map(type => (
                <button key={type.value} type="button" onClick={() => setSelectedType(type.value)}
                  className={`w-full flex items-center space-x-4 p-4 rounded-xl border-2 transition-colors text-left ${selectedType === type.value ? 'border-[var(--primary-color)] bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                  <span className="text-2xl">{type.icon}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${selectedType === type.value ? 'text-[var(--primary-color)]' : 'text-gray-900 dark:text-white'}`}>{type.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                  </div>
                  {selectedType === type.value && (
                    <div className="w-6 h-6 rounded-full bg-[var(--primary-color)] flex items-center justify-center shrink-0">
                      <FiCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Account Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Account Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name</label>
              <input value={accountName} onChange={e => setAccountName(e.target.value)} required
                placeholder={`My ${selectedInfo?.label || 'Account'}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]">
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                {selectedType === 'domiciliary' && <>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="JPY">JPY — Japanese Yen</option>
                </>}
              </select>
            </div>
          </div>

          {/* Summary */}
          {selectedInfo && accountName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Summary</h3>
              <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <p>Type: <strong>{selectedInfo.label}</strong></p>
                <p>Name: <strong>{accountName}</strong></p>
                <p>Currency: <strong>{currency}</strong></p>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-[var(--primary-color)] text-white rounded-xl font-semibold text-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddAccountScreen;
