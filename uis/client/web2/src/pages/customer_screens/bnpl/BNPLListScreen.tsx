import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCreditCard, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { BNPLApplication } from '../../../models/bnpl';
import { bnplService } from '../../../services/bnpl_service';

const BNPLListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<BNPLApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await bnplService.getApplications();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load BNPL applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'declined':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'active':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      case 'completed':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const totalAmount = applications.reduce((sum, a) => sum + a.purchaseAmount, 0);
  const activeCount = applications.filter((a) => ['approved', 'active'].includes(a.status.toLowerCase())).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-700 dark:to-purple-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Buy Now Pay Later</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadApplications}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiRefreshCw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => navigate('/bnpl/apply')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-violet-600 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                <FiPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Apply</span>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Applications</p>
              <p className="text-2xl font-bold text-white">{applications.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Value</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Active</p>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            <button onClick={loadApplications} className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline">
              Retry
            </button>
          </div>
        )}

        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-violet-50 dark:bg-violet-900/30 rounded-full flex items-center justify-center mb-6">
              <FiCreditCard className="w-12 h-12 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No BNPL Applications</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
              Shop now and pay in easy monthly instalments
            </p>
            <button
              onClick={() => navigate('/bnpl/apply')}
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Apply for BNPL</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app) => (
              <div
                key={app.applicationId}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card header */}
                <div className="h-24 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center relative px-4">
                  <FiCreditCard className="w-10 h-10 text-white/40 absolute" />
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(app.status)}`}>
                      {app.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white font-bold text-sm truncate max-w-[180px]">
                      {app.productDescription || 'BNPL Purchase'}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  {/* Amounts grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Purchase Amount</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(app.purchaseAmount)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Per Instalment</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(app.installmentAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Instalment & rate */}
                  <div className="flex justify-between items-center text-sm mb-3">
                    <span className="text-gray-600 dark:text-gray-400">
                      {app.installmentCount} instalments
                    </span>
                    <span className="text-violet-600 dark:text-violet-400 font-semibold">
                      {app.interestRate.toFixed(1)}% interest
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatDate(app.createdAt)}</span>
                    {app.merchantId && (
                      <span className="truncate max-w-[100px]">{app.merchantId}</span>
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

export default BNPLListScreen;
