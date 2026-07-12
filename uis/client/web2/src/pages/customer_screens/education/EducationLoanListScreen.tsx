import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiBook, FiCalendar, FiClock, FiDollarSign, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { EducationLoan } from '../../../models/education_loan';
import { educationLoanService } from '../../../services/education_loan_service';

const EducationLoanListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<EducationLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await educationLoanService.getEducationLoans();
      setLoans(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load education loans');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'approved':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      case 'rejected':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'completed':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
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
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-700 dark:to-blue-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Education Loans</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadLoans}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiRefreshCw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => navigate('/education-loans/apply')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span className="hidden sm:inline">Apply</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Loans</p>
              <p className="text-2xl font-bold text-white">{loans.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(loans.reduce((sum, l) => sum + l.totalAmount, 0))}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Active</p>
              <p className="text-2xl font-bold text-white">
                {loans.filter(l => l.status.toLowerCase() === 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="shrink-0">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-700 dark:text-red-400 font-medium">Error loading education loans</p>
                <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
              </div>
              <button
                onClick={loadLoans}
                className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <FiBook className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Education Loans Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">Apply for an education loan to fund your studies</p>
            <button
              onClick={() => navigate('/education-loans/apply')}
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Apply for Education Loan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loans.map((loan) => (
              <div
                key={loan.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                onClick={() => navigate(`/education-loan-details/${loan.id}`)}
              >
                {/* Header with gradient */}
                <div className="h-32 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center relative">
                  <FiBook className="w-12 h-12 text-white/50" />
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {/* Institution & Course */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {loan.institution}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{loan.courseOfStudy}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">{loan.studyLevel}</p>

                  {/* Financial Breakdown */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tuition Fees</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(loan.tuitionFees)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Living Expenses</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(loan.livingExpenses)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Books & Materials</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(loan.booksMaterials)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Amount</span>
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(loan.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Loan Terms */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                        <FiClock className="w-4 h-4" />
                        <span>{loan.loanTerm} years</span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                        <FiDollarSign className="w-4 h-4" />
                        <span>{loan.interestRate}% APR</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                      <div className="flex items-center space-x-1">
                        <FiCalendar className="w-3 h-3" />
                        <span>Start: {formatDate(loan.courseStartDate)}</span>
                      </div>
                      <span>End: {formatDate(loan.courseEndDate)}</span>
                    </div>
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

export default EducationLoanListScreen;
