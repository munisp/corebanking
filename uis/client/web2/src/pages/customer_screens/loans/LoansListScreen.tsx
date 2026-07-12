import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiClock, FiDollarSign, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { loanService } from '../../../services/loan_service';

const LoansListScreen: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loans, setLoans] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loanService.getAllLoans();
      setLoans(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'pending approval':
      case 'pending':
        return 'text-orange-600 bg-orange-50';
      case 'disbursed':
        return 'text-[var(--primary-color)] bg-blue-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'closed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Active Loans</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadLoans}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FiRefreshCw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => navigate('/loan-application')}
              className="flex items-center space-x-2 px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span className="hidden sm:inline">Apply for Loan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-700 font-medium">Error loading loans</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button
                onClick={loadLoans}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-blue-50 dark:bg-[var(--primary-color)]/30 rounded-full flex items-center justify-center mb-6">
              <FiDollarSign className="w-12 h-12 text-[var(--primary-color)] dark:text-[var(--primary-color)]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Active Loans</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Apply for a loan to get started</p>
            <button
              onClick={() => navigate('/loan-application')}
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Apply for Loan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loans.map((loan) => (
              <div
                key={loan.id || loan.loan_application_id}
                onClick={() => navigate(`/loan-details/${loan.loan_application_id || loan.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {loan.loan_purpose || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {loan.duration_months} months @ {loan.LoanInterestRatePercent}% p.a.
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(loan.status)}`}>
                      {loan.status || 'N/A'}
                    </span>
                  </div>

                  {/* Amount Details */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(loan.loan_amount)}
                      </span>
                    </div>
                    {loan.status?.toLowerCase() === 'active' && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Outstanding</span>
                          <span className="text-sm font-semibold text-orange-600">
                            {formatCurrency(loan.outstanding_balance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</span>
                          <span className="text-sm font-semibold text-[var(--primary-color)]">
                            {formatCurrency(loan.monthly_payment)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FiCalendar className="w-3 h-3" />
                      <span>Approved at: {formatDate(loan.LoanStartedAt)}</span>
                    </div>
                    {loan.status?.toLowerCase() === 'active' && loan.next_payment_date && (
                      <div className="flex items-center space-x-1">
                        <FiClock className="w-3 h-3" />
                        <span>Next: {formatDate(loan.next_payment_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoansListScreen;
