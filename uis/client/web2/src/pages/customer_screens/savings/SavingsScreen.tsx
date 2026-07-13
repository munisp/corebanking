import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiPause, FiPauseCircle, FiPlay, FiPlayCircle, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { Savings } from '../../../services/savings_service';
import { savingsService } from '../../../services/savings_service';

const SavingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [savingsGoals, setSavingsGoals] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<Savings | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [contributionAmount, setContributionAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadSavingsGoals();
  }, []);

  const loadSavingsGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await savingsService.getAllSavings();
      setSavingsGoals(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load savings goals');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSavings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !targetAmount || !contributionAmount || !startDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      await savingsService.createSavings({
        name,
        description,
        targetAmount: parseFloat(targetAmount),
        frequency,
        contributionAmount: parseFloat(contributionAmount),
        startDate: new Date(startDate),
        endDate: hasEndDate && endDate ? new Date(endDate) : undefined,
      });

      setShowCreateModal(false);
      loadSavingsGoals();
      // Reset form
      setName('');
      setTargetAmount('');
      setStartDate('');
      setEndDate('');
      setHasEndDate(false);
      setFrequency('monthly');
      setContributionAmount('');
      setDescription('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create savings goal');
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePauseSavings = async (savingsId: string) => {
    try {
      await savingsService.pauseSavings(savingsId);
      loadSavingsGoals();
      if (selectedSavings?.id === savingsId) {
        setShowDetailsModal(false);
        setSelectedSavings(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to pause savings goal');
    }
  };

  const handleResumeSavings = async (savingsId: string) => {
    try {
      await savingsService.resumeSavings(savingsId);
      loadSavingsGoals();
      if (selectedSavings?.id === savingsId) {
        setShowDetailsModal(false);
        setSelectedSavings(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to resume savings goal');
    }
  };

  const handleDeleteSavings = async (savingsId: string) => {
    if (!window.confirm('Are you sure you want to delete this savings goal?')) return;

    try {
      await savingsService.deleteSavings(savingsId);
      loadSavingsGoals();
      setShowDetailsModal(false);
      setSelectedSavings(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete savings goal');
    }
  };

  const handleContribute = async (savingsId: string) => {
    const amountStr = prompt('Enter contribution amount:');
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await savingsService.makeContribution({ savingsId, amount });
      loadSavingsGoals();
      if (selectedSavings?.id === savingsId) {
        const updated = await savingsService.getSavingsById(savingsId);
        setSelectedSavings(updated);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to make contribution');
    }
  };

  const handleWithdraw = async (savingsId: string) => {
    const amountStr = prompt('Enter withdrawal amount:');
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const reason = prompt('Enter withdrawal reason (optional):') || undefined;

    try {
      await savingsService.withdrawFromSavings({ savingsId, amount, reason });
      loadSavingsGoals();
      if (selectedSavings?.id === savingsId) {
        const updated = await savingsService.getSavingsById(savingsId);
        setSelectedSavings(updated);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'paused':
        return 'text-orange-600 bg-orange-50';
      case 'completed':
        return 'text-[var(--primary-color)] bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <FiPlayCircle className="w-4 h-4" />;
      case 'paused':
        return <FiPauseCircle className="w-4 h-4" />;
      case 'completed':
        return <FiCheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Savings</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">New Savings</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadSavingsGoals}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {savingsGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-blue-50 dark:bg-[var(--primary-color)]/30 rounded-full flex items-center justify-center mb-6">
              <FiDollarSign className="w-12 h-12 text-[var(--primary-color)] dark:text-[var(--primary-color)]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Savings Plans Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Start building your financial future</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Create Savings Plan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savingsGoals.map((savings) => (
              <div
                key={savings.id}
                onClick={() => {
                  setSelectedSavings(savings);
                  setShowDetailsModal(true);
                }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">
                      {savings.name}
                    </h3>
                    <span className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(savings.status)}`}>
                      {getStatusIcon(savings.status)}
                      <span>{savings.status.toUpperCase()}</span>
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(savings.currentAmount)}
                      </span>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {Math.round(savings.progress * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-green-500 to-green-600 transition-all duration-300"
                        style={{ width: `${Math.min(savings.progress * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Goal: {formatCurrency(savings.targetAmount)}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <FiCalendar className="w-4 h-4" />
                      <span>{formatCurrency(savings.contributionAmount)} / {savings.frequency}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FiClock className="w-4 h-4" />
                      <span>Started {formatDate(savings.startDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Savings Plan</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <form onSubmit={handleCreateSavings} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Savings Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Emergency Fund, Vacation"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you saving for?"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                  required
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Target Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Contribution Frequency *
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Contribution Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Contribution Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                  required
                />
              </div>

              {/* End Date Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasEndDate"
                  checked={hasEndDate}
                  onChange={(e) => setHasEndDate(e.target.checked)}
                  className="w-4 h-4 text-[var(--primary-color)] border-gray-300 rounded focus:ring-[var(--primary-color)]"
                />
                <label htmlFor="hasEndDate" className="text-sm text-gray-700 dark:text-gray-300">
                  Set end date (optional)
                </label>
              </div>

              {/* End Date */}
              {hasEndDate && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-4 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] disabled:bg-gray-400 text-white rounded-lg transition-colors font-semibold"
                >
                  {createLoading ? 'Creating...' : 'Create Savings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSavings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedSavings.name}</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedSavings(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedSavings.status)}`}>
                  {getStatusIcon(selectedSavings.status)}
                  <span>{selectedSavings.status.toUpperCase()}</span>
                </span>
              </div>

              {/* Progress Circle */}
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 88}`}
                      strokeDashoffset={`${2 * Math.PI * 88 * (1 - selectedSavings.progress)}`}
                      className="text-green-500 transition-all duration-300"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {Math.round(selectedSavings.progress * 100)}%
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Complete</span>
                  </div>
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Amount</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedSavings.currentAmount)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Target Amount</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedSavings.targetAmount)}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedSavings.description}</p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Contribution</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(selectedSavings.contributionAmount)} / {selectedSavings.frequency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Start Date</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatDate(selectedSavings.startDate)}
                  </span>
                </div>
                {selectedSavings.endDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">End Date</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatDate(selectedSavings.endDate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => handleContribute(selectedSavings.id)}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
                >
                  Make Contribution
                </button>
                <button
                  onClick={() => handleWithdraw(selectedSavings.id)}
                  className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-semibold"
                >
                  Withdraw
                </button>
                <div className="grid grid-cols-2 gap-3">
                  {selectedSavings.status === 'active' ? (
                    <button
                      onClick={() => handlePauseSavings(selectedSavings.id)}
                      className="flex items-center justify-center space-x-2 px-4 py-3 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      <FiPause className="w-5 h-5" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResumeSavings(selectedSavings.id)}
                      className="flex items-center justify-center space-x-2 px-4 py-3 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <FiPlay className="w-5 h-5" />
                      <span>Resume</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSavings(selectedSavings.id)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <FiTrash2 className="w-5 h-5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsScreen;
