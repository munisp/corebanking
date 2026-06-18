import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiPauseCircle, FiPlus, FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { disputeService, type Dispute } from '../../../services/dispute_service';

const DisputesListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [filteredDisputes, setFilteredDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'under_review' | 'resolved'>('all');

  useEffect(() => {
    loadDisputes();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      setFilteredDisputes(disputes);
    } else {
      // Map 'open' status to 'pending' for filtering
      setFilteredDisputes(disputes.filter(d => {
        const status = d.status.toLowerCase();
        if (activeTab === 'pending') {
          return status === 'pending' || status === 'open';
        }
        return d.status === activeTab;
      }));
    }
  }, [activeTab, disputes]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await disputeService.getAllDisputes();
      setDisputes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'open':
        return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30';
      case 'under_review':
        return 'text-[var(--primary-color)] bg-blue-50 dark:bg-blue-900/30';
      case 'resolved':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
      case 'rejected':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
      case 'escalated':
        return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30';
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'open':
        return <FiClock className="w-4 h-4" />;
      case 'under_review':
        return <FiSearch className="w-4 h-4" />;
      case 'resolved':
        return <FiCheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <FiXCircle className="w-4 h-4" />;
      case 'escalated':
        return <FiPauseCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getCategoryDisplay = (category: string) => {
    const categoryMap: Record<string, string> = {
      unauthorized_transaction: 'Unauthorized Transaction',
      incorrect_amount: 'Incorrect Amount',
      service_not_received: 'Service Not Received',
      duplicate_charge: 'Duplicate Charge',
      other: 'Other',
      // Handle API dispute_type values
      'UNAUTHORIZED': 'Unauthorized Transaction',
      'INSURANCE': 'Insurance',
      'INCORRECT_AMOUNT': 'Incorrect Amount',
      'SERVICE_NOT_RECEIVED': 'Service Not Received',
      'DUPLICATE': 'Duplicate Charge',
      'OTHER': 'Other',
    };
    return categoryMap[category] || category;
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      open: 'Open',
      under_review: 'Under Review',
      resolved: 'Resolved',
      rejected: 'Rejected',
      escalated: 'Escalated',
    };
    return statusMap[status.toLowerCase()] || status;
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTabCount = (tab: string) => {
    if (tab === 'all') return disputes.length;
    return disputes.filter(d => d.status === tab).length;
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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Disputes</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadDisputes}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <FiRefreshCw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() => navigate('/create-dispute')}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span className="hidden sm:inline">New Dispute</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'under_review', label: 'Under Review' },
              { key: 'resolved', label: 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tab.label} ({getTabCount(tab.key)})
              </button>
            ))}
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
                <p className="text-red-700 font-medium">Error loading disputes</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button
                onClick={loadDisputes}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {filteredDisputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
              <FiXCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Disputes</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {activeTab === 'all' ? 'No disputes found' : `No ${getStatusDisplay(activeTab).toLowerCase()} disputes`}
            </p>
            {activeTab === 'all' && (
              <button
                onClick={() => navigate('/create-dispute')}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <FiPlus className="w-5 h-5" />
                <span>Create Dispute</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDisputes.map((dispute) => (
              <div
                key={dispute.id}
                onClick={() => navigate(`/disputes/${dispute.id}`, { state: { dispute } })}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-shadow overflow-hidden cursor-pointer hover:shadow-md"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 flex-1 mr-2">
                      {dispute.subject}
                    </h3>
                    <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(dispute.status)}`}>
                      {getStatusIcon(dispute.status)}
                      <span>{getStatusDisplay(dispute.status).toUpperCase()}</span>
                    </span>
                  </div>

                  {/* Category Badge */}
                  <div className="mb-3">
                    <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg">
                      {getCategoryDisplay(dispute.category)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {dispute.description}
                  </p>

                  {/* Amount */}
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Disputed Amount</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(dispute.disputedAmount)}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FiCalendar className="w-3 h-3" />
                      <span>{formatDate(dispute.createdAt)}</span>
                    </div>
                    {dispute.attachments.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span>{dispute.attachments.length} file{dispute.attachments.length !== 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/create-dispute')}
        className="fixed bottom-8 right-8 flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
      >
        <FiPlus className="w-5 h-5" />
        <span className="font-semibold">New Dispute</span>
      </button>
    </div>
  );
};

export default DisputesListScreen;
