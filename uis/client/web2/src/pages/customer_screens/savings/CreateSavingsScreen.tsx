import React, { useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheck, FiDollarSign, FiTag } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { savingsService } from '../../../services/savings_service';

const CreateSavingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  });
  const [enableAutoSave, setEnableAutoSave] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    const amount = parseInt(targetAmount.replace(/\D/g, ''));
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      // Convert targetDate to DateTime - matching mobile API format
      const targetDateObj = new Date(targetDate);

      // Debug log: show payload being sent
      console.log('Creating savings with:', {
        name: name.trim(),
        targetAmount: amount,
        targetDate: targetDateObj,
        enableAutoSave: enableAutoSave,
      });

      // Use mobile API format: name, target_amount (int), target_date, enable_auto_save
      await savingsService.createSavings({
        name: name.trim(),
        targetAmount: amount,
        targetDate: targetDateObj,
        enableAutoSave: enableAutoSave,
      });

      // Navigate back to list - matching mobile behavior
      navigate('/savings');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create savings');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar - matching mobile */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center">
          <button
            onClick={() => navigate('/savings')}
            className="p-2 -ml-2 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Create Savings Plan</h1>
        </div>
      </div>

      {/* Form - matching mobile */}
      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Name field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Savings Name
          </label>
          <div className="relative">
            <FiTag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ferrari Savings, Emergency Fund"
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        {/* Target amount field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Target Amount
          </label>
          <div className="relative">
            <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <span className="absolute left-12 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
            <input
              type="text"
              value={targetAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setTargetAmount(value);
              }}
              placeholder="100000"
              className="w-full pl-16 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        {/* Target date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Target Date
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); return d.toISOString().split('T')[0]; })()}
              className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              required
            />
          </div>
        </div>

        {/* Enable Auto Save toggle */}
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="enableAutoSave"
            checked={enableAutoSave}
            onChange={(e) => setEnableAutoSave(e.target.checked)}
            className="mt-1 w-5 h-5 text-[var(--primary-color)] border-gray-300 rounded focus:ring-[var(--primary-color)]"
          />
          <div className="flex-1">
            <label htmlFor="enableAutoSave" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Enable Auto Save
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Automatically save money to this plan
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={processing}
          className="w-full py-4 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] disabled:bg-gray-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
        >
          {processing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span>Creating...</span>
            </>
          ) : (
            <>
              <FiCheck className="w-5 h-5" />
              <span>Create Savings Plan</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateSavingsScreen;

