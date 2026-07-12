import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiFileText, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { lpoService } from '../../../services/lpo_service';

const LPOListScreen: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lpos, setLpos] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLPOs();
  }, []);

  const loadLPOs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await lpoService.getAllLPOs();
      setLpos(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load LPOs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-orange-600 bg-orange-50';
      case 'disbursed':
        return 'text-[var(--primary-color)] bg-blue-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'completed':
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">LPO Financing</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadLPOs}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FiRefreshCw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => navigate('/lpo-application')}
              className="flex items-center space-x-2 px-4 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span className="hidden sm:inline">Apply for LPO</span>
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
                <p className="text-red-700 font-medium">Error loading LPOs</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button
                onClick={loadLPOs}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {lpos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-6">
              <FiFileText className="w-12 h-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No LPO Applications</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Apply for LPO financing to get started</p>
            <button
              onClick={() => navigate('/lpo-application')}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              <span>Apply for LPO</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lpos.map((lpo) => (
              <div
                key={lpo.id || lpo.lpo_id}
                onClick={() => navigate(`/lpo-details/${lpo.lpo_id || lpo.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {lpo.lpo_number || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                        {lpo.issuing_organization || 'N/A'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(lpo.status)}`}>
                      {lpo.status || 'N/A'}
                    </span>
                  </div>

                  {/* Amount Details */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">LPO Amount</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(lpo.lpo_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Financing</span>
                      <span className="text-sm font-semibold text-purple-600">
                        {formatCurrency(lpo.financing_amount)}
                      </span>
                    </div>
                    {lpo.repayment_days && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Repayment Period</span>
                        <span className="text-sm font-semibold text-[var(--primary-color)]">
                          {lpo.repayment_days} days
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Supplier Info */}
                  {lpo.supplier_name && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Supplier</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                        {lpo.supplier_name}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <FiCalendar className="w-3 h-3 mr-1" />
                    <span>Created: {formatDate(lpo.created_at)}</span>
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

export default LPOListScreen;
