import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiClock, FiDollarSign, FiHome, FiMapPin, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { Mortgage } from '../../../models/mortgage';
import { mortgageService } from '../../../services/mortgage_service';

const MortgageListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMortgages();
  }, []);

  const loadMortgages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mortgageService.getMortgages();
      setMortgages(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mortgages');
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">My Mortgages</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadMortgages}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiRefreshCw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => navigate('/mortgage/calculator')}
                className="px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm font-semibold"
              >
                Calculator
              </button>
              <button
                onClick={() => navigate('/mortgage/apply')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span className="hidden sm:inline">Apply</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Mortgages</p>
              <p className="text-2xl font-bold text-white">{mortgages.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Loan Amount</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(mortgages.reduce((sum, m) => sum + m.loanAmount, 0))}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Active</p>
              <p className="text-2xl font-bold text-white">
                {mortgages.filter(m => m.status.toLowerCase() === 'active').length}
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
                <p className="text-red-700 dark:text-red-400 font-medium">Error loading mortgages</p>
                <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
              </div>
              <button
                onClick={loadMortgages}
                className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {mortgages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
              <FiHome className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Mortgages Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">Apply for a mortgage to own your dream home</p>
            <button
              onClick={() => navigate('/mortgage-application')}
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Apply for Mortgage</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mortgages.map((mortgage) => (
              <div
                key={mortgage.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                onClick={() => navigate(`/mortgage-details/${mortgage.id}`)}
              >
                {/* Property Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <FiHome className="w-16 h-16 text-white/50" />
                </div>

                <div className="p-6">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(mortgage.status)}`}>
                      {mortgage.status}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{mortgage.propertyType}</span>
                  </div>

                  {/* Property Address */}
                  <div className="flex items-start space-x-2 mb-4">
                    <FiMapPin className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {mortgage.propertyAddress}
                    </h3>
                  </div>

                  {/* Financial Details */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Property Value</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(mortgage.propertyValue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(mortgage.loanAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(mortgage.monthlyPayment)}
                      </span>
                    </div>
                  </div>

                  {/* Loan Details */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                        <FiClock className="w-4 h-4" />
                        <span>{mortgage.loanTerm} years</span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                        <FiDollarSign className="w-4 h-4" />
                        <span>{mortgage.interestRate}% APR</span>
                      </div>
                    </div>
                    {mortgage.applicationDate && (
                      <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-500 text-xs mt-2">
                        <FiCalendar className="w-3 h-3" />
                        <span>Applied {formatDate(mortgage.applicationDate)}</span>
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

export default MortgageListScreen;
