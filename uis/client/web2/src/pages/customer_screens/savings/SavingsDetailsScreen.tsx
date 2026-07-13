import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiEdit2, FiMinus, FiMoreVertical, FiPause, FiPlay, FiPlus, FiRepeat } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import type { Savings } from '../../../services/savings_service';
import { savingsService } from '../../../services/savings_service';

const SavingsDetailsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { tenant } = useTenantConfig();
  const [savings, setSavings] = useState<Savings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContributeDialog, setShowContributeDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      loadSavings();
    }
  }, [id]);

  const loadSavings = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await savingsService.getSavingsById(id);
      setSavings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load savings');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!savings || !contributeAmount) return;
    
    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setProcessing(true);
      await savingsService.makeContribution({ savingsId: savings.id, amount });
      setShowContributeDialog(false);
      setContributeAmount('');
      await loadSavings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to make contribution');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!savings || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (amount > savings.currentAmount) {
      alert('Insufficient balance');
      return;
    }

    try {
      setProcessing(true);
      await savingsService.withdrawFromSavings({
        savingsId: savings.id,
        amount,
        reason: withdrawReason.trim() || undefined,
      });
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      setWithdrawReason('');
      await loadSavings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setProcessing(false);
    }
  };

  const handlePause = async () => {
    if (!savings) return;
    
    try {
      setProcessing(true);
      await savingsService.pauseSavings(savings.id);
      setShowPauseDialog(false);
      await loadSavings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to pause savings');
    } finally {
      setProcessing(false);
    }
  };

  const handleResume = async () => {
    if (!savings) return;
    
    try {
      setProcessing(true);
      await savingsService.resumeSavings(savings.id);
      await loadSavings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to resume savings');
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!savings) return;
    
    try {
      setProcessing(true);
      await savingsService.updateSavings(savings.id, { status: 'completed' });
      setShowCompleteDialog(false);
      await loadSavings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to complete savings');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!savings) return;
    
    try {
      setProcessing(true);
      await savingsService.deleteSavings(savings.id);
      // Navigate back to list - matching mobile behavior
      navigate('/savings');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete savings');
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const parseColor = (colorString: string) => {
    try {
      return colorString.startsWith('#') ? colorString : `#${colorString}`;
    } catch (e) {
      return '#3B82F6';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent"></div>
      </div>
    );
  }

  if (error || !savings) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Savings not found'}</p>
          <button
            onClick={() => navigate('/savings')}
            className="px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg"
          >
            Back to Savings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar - matching mobile */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/savings')}
              className="p-2 -ml-2 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Savings Details</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FiMoreVertical className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Header card with progress - matching mobile */}
      <div
        className="w-full p-6"
        style={{
          background: `linear-gradient(135deg, ${parseColor(tenant.branding.primary_color)} 0%, ${parseColor(tenant.branding.primary_color)}CC 100%)`,
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-bold text-white flex-1 mr-2">{savings.name}</h2>
          <div
            className="px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <span className="text-xs font-semibold text-white">{savings.status.toUpperCase()}</span>
          </div>
        </div>
        <p className="text-sm text-white opacity-90 mb-6">{savings.description}</p>
        <p className="text-xs text-white opacity-80 mb-1">Current Balance</p>
        <p className="text-3xl font-bold text-white mb-4">{formatCurrency(savings.currentAmount)}</p>
        <div className="w-full h-3 bg-white bg-opacity-30 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${savings.progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white">{Math.round(savings.progress * 100)}% Complete</span>
          <span className="text-xs text-white">Goal: {formatCurrency(savings.targetAmount)}</span>
        </div>
      </div>

      {/* Action buttons - matching mobile */}
      <div className="p-4">
        {savings.status.toLowerCase() === 'active' ? (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowContributeDialog(true)}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg font-semibold transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Add Funds</span>
            </button>
            <button
              onClick={() => savings.currentAmount > 0 && setShowWithdrawDialog(true)}
              disabled={savings.currentAmount === 0}
              className="flex-1 flex items-center justify-center space-x-2 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMinus className="w-5 h-5" />
              <span>Withdraw</span>
            </button>
          </div>
        ) : savings.status.toLowerCase() === 'paused' ? (
          <button
            onClick={handleResume}
            disabled={processing}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <FiPlay className="w-5 h-5" />
            <span>Resume Savings</span>
          </button>
        ) : null}
      </div>

      {/* Details section - matching mobile */}
      <div className="px-4 pb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Savings Details</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <FiRepeat className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Contribution</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(savings.contributionAmount)} / {savings.frequency}
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <FiCalendar className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatDate(savings.startDate)}
              </p>
            </div>
          </div>
          {savings.endDate && (
            <div className="flex items-start space-x-3">
              <FiCalendar className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatDate(savings.endDate)}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start space-x-3">
            <FiClock className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Created</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatDate(savings.createdAt)}
              </p>
            </div>
          </div>
          {savings.updatedAt && (
            <div className="flex items-start space-x-3">
              <FiEdit2 className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Updated</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatDate(savings.updatedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Management actions - matching mobile */}
      {savings.status.toLowerCase() !== 'completed' && (
        <div className="px-4 pb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Manage Savings</h3>
          <div className="space-y-2">
            {savings.status.toLowerCase() === 'active' && (
              <button
                onClick={() => setShowPauseDialog(true)}
                className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <FiPause className="w-5 h-5" />
                <span>Pause Savings</span>
              </button>
            )}
            {savings.progress >= 1.0 && (
              <button
                onClick={() => setShowCompleteDialog(true)}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                <FiCheckCircle className="w-5 h-5" />
                <span>Mark as Completed</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contribute Dialog */}
      {showContributeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Make Contribution</h3>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                <input
                  type="number"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowContributeDialog(false);
                  setContributeAmount('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContribute}
                disabled={processing || !contributeAmount}
                className="flex-1 px-4 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] disabled:bg-gray-400 text-white rounded-xl transition-colors font-semibold"
              >
                {processing ? 'Processing...' : 'Contribute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Dialog */}
      {showWithdrawDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Withdraw from Savings</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={savings.currentAmount}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Enter reason for withdrawal"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowWithdrawDialog(false);
                  setWithdrawAmount('');
                  setWithdrawReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processing || !withdrawAmount}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-xl transition-colors font-semibold"
              >
                {processing ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Dialog */}
      {showPauseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Pause Savings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to pause this savings plan?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPauseDialog(false)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] disabled:bg-gray-400 text-white rounded-xl transition-colors font-semibold"
              >
                {processing ? 'Processing...' : 'Pause'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Dialog */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Complete Savings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to mark this savings plan as completed? You can withdraw the full amount after completion.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl transition-colors font-semibold"
              >
                {processing ? 'Processing...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Savings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this savings plan? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl transition-colors font-semibold"
              >
                {processing ? 'Processing...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsDetailsScreen;

