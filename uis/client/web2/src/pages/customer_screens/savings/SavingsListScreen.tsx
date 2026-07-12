import React, { useEffect, useState } from 'react';
import { FiCalendar, FiClock, FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import type { Savings } from '../../../services/savings_service';
import { savingsService } from '../../../services/savings_service';

const SavingsListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  const [savingsList, setSavingsList] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavings();
  }, []);

  const loadSavings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await savingsService.getAllSavings();
      setSavingsList(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load savings');
    } finally {
      setLoading(false);
    }
  };

  // const handleRefresh = async () => {
  //   await loadSavings();
  // };

  const navigateToCreate = () => {
    navigate('/savings/create');
  };

  // const navigateToDetails = (savings: Savings) => {
  //   navigate(`/savings/${savings.id}`);
  // };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' }; // successColor
      case 'paused':
        return { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c' }; // warningColor
      case 'completed':
        return { bg: `${tenant.branding.primary_color}1A`, text: tenant.branding.primary_color };
      default:
        return { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '▶';
      case 'paused':
        return '⏸';
      case 'completed':
        return '✓';
      default:
        return '?';
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '₦0.00';
    }
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const parseColor = (colorString: string) => {
    try {
      return colorString.startsWith('#') ? colorString : `#${colorString}`;
    } catch (e) {
      console.error(e);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar - matching mobile */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Savings</h1>
          <button
            onClick={navigateToCreate}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Create New Savings"
          >
            <FiPlus className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Error loading savings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">{error}</p>
          <button
            onClick={loadSavings}
            className="px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : savingsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">💰</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Savings Plans Yet</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Start building your financial future</p>
          <button
            onClick={navigateToCreate}
            className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span>Create Savings Plan</span>
          </button>
        </div>
      ) : (
        <div className="px-4 py-4" onScroll={(e) => {
          // Simple pull-to-refresh simulation
          const target = e.currentTarget;
          if (target.scrollTop === 0) {
            // Could add pull-to-refresh here if needed
          }
        }}>
          <div className="space-y-4">
            {savingsList.map((savings) => {
              const statusColor = getStatusColor(savings.status);
              return (
                <div
                  key={savings.id}
                  // onClick={() => navigateToDetails(savings)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all "
                  style={{ marginBottom: '16px' }}
                >
                  {/* Header with name and status - matching mobile */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1 truncate mr-2">
                      {savings.name}
                    </h3>
                    <div
                      className="px-3 py-1.5 rounded-full flex items-center space-x-1 flex-shrink-0"
                      style={{
                        backgroundColor: statusColor.bg,
                        color: parseColor(statusColor.text),
                      }}
                    >
                      <span className="text-xs">{getStatusIcon(savings.status)}</span>
                      <span className="text-xs font-semibold">{savings.status.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Progress bar - matching mobile */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(savings.currentAmount)}
                      </span>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {Math.round(savings.progress * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${savings.progress * 100}%`,
                          backgroundColor: parseColor(statusColor.text),
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Goal: {formatCurrency(savings.targetAmount)}
                    </p>
                  </div>

                  {/* Contribution info - matching mobile */}
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FiCalendar className="w-3.5 h-3.5" />
                      <span>{formatCurrency(savings.contributionAmount)} / {savings.frequency}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FiClock className="w-3.5 h-3.5" />
                      <span>Started {new Date(savings.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Action Button - matching mobile */}
      <button
        onClick={navigateToCreate}
        className="fixed bottom-6 right-6 flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-full shadow-lg transition-colors z-10"
      >
        <FiPlus className="w-5 h-5" />
        <span>New Savings</span>
      </button>
    </div>
  );
};

export default SavingsListScreen;

