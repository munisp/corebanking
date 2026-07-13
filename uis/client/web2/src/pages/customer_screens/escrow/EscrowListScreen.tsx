import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiDollarSign, FiHome, FiPlus, FiTool } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { Escrow } from '../../../models/escrow';
import { escrowService } from '../../../services/escrow_service';

const EscrowListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEscrows();
  }, []);

  const loadEscrows = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await escrowService.getEscrows();
      setEscrows(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load escrows');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'released':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'property transaction':
        return <FiHome className="text-xl" />;
      case 'service payment':
        return <FiTool className="text-xl" />;
      default:
        return <FiDollarSign className="text-xl" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-color)] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading escrows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Escrow</h1>
            </div>
            <button
              onClick={() => navigate('/escrow/create')}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <FiPlus size={20} />
              <span className="hidden sm:inline">Create</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)] text-white p-6 rounded-xl mb-6">
          <h2 className="text-xl font-bold mb-2">Secure Third-Party Transactions</h2>
          <p className="text-white/90">Protect your payments with escrow services for property, services, and contracts</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Escrow List */}
        {escrows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
            <FiDollarSign size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Escrows Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Start by creating your first escrow transaction</p>
            <button
              onClick={() => navigate('/escrow/create')}
              className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Create Escrow
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {escrows.map((escrow) => (
              <div
                key={escrow.id}
                onClick={() => navigate(`/escrow/${escrow.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[var(--primary-color)]/10 rounded-lg">
                      {getTypeIcon(escrow.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{escrow.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{escrow.type}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(escrow.status)}`}>
                    {escrow.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Amount</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(escrow.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Created</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(escrow.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Buyer: {escrow.buyerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Seller: {escrow.sellerName}</span>
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

export default EscrowListScreen;
