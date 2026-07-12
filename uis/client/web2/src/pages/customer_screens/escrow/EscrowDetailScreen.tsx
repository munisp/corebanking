import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMail, FiCreditCard, FiCalendar, FiTag, FiAlertCircle, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import type { Escrow } from '../../../models/escrow';
import { escrowService } from '../../../services/escrow_service';

const EscrowDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [showFundDialog, setShowFundDialog] = useState(false);

  useEffect(() => {
    if (id) loadEscrow();
  }, [id]);

  const loadEscrow = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await escrowService.getEscrowById(id);
      setEscrow(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load escrow');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!escrow) return;
    setActionLoading(true);
    const result = await escrowService.releaseEscrow(escrow.id);
    setActionLoading(false);
    if (result.success) {
      await loadEscrow();
    } else {
      alert(result.message);
    }
  };

  const handleCancel = async () => {
    if (!escrow) return;
    if (!window.confirm('Are you sure you want to cancel this escrow?')) return;
    setActionLoading(true);
    const result = await escrowService.cancelEscrow(escrow.id);
    setActionLoading(false);
    if (result.success) {
      await loadEscrow();
    } else {
      alert(result.message);
    }
  };

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (!escrow || isNaN(amount) || amount <= 0) return;
    setActionLoading(true);
    try {
      await escrowService.fundEscrow(escrow.id, amount);
      setShowFundDialog(false);
      setFundAmount('');
      await loadEscrow();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to fund escrow');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'funded': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'disputed': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'funded': return <FiCreditCard className="w-4 h-4" />;
      case 'completed': return <FiCheckCircle className="w-4 h-4" />;
      case 'cancelled': return <FiXCircle className="w-4 h-4" />;
      default: return <FiClock className="w-4 h-4" />;
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: Date | undefined) =>
    d ? new Intl.DateTimeFormat('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)) : 'N/A';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading escrow...</span>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 gap-4">
        <FiAlertCircle className="w-16 h-16 text-red-400" />
        <p className="text-red-600 dark:text-red-400">{error ?? 'Escrow not found'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Go Back</button>
      </div>
    );
  }

  const canFund = ['pending', 'created'].includes(escrow.status.toLowerCase());
  const canRelease = escrow.status.toLowerCase() === 'funded';
  const canCancel = !['completed', 'cancelled'].includes(escrow.status.toLowerCase());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-[var(--primary-color)] text-white p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm">
          <FiArrowLeft /> Back
        </button>
        <h1 className="text-2xl font-bold">{escrow.title}</h1>
        <p className="text-white/80 mt-1">{escrow.type}</p>
        <div className="mt-4">
          <p className="text-white/70 text-sm">Total Amount</p>
          <p className="text-4xl font-bold">{formatCurrency(escrow.amount)}</p>
        </div>
        <div className="mt-4">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(escrow.status)}`}>
            {getStatusIcon(escrow.status)}
            {escrow.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Parties */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Parties</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Buyer</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <FiUser className="text-gray-400 w-4 h-4 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white">{escrow.buyerName || 'N/A'}</span>
                </div>
                {escrow.buyerEmail && (
                  <div className="flex items-center gap-3">
                    <FiMail className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300 text-sm">{escrow.buyerEmail}</span>
                  </div>
                )}
              </div>
            </div>
            <hr className="border-gray-100 dark:border-gray-700" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Seller</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <FiUser className="text-gray-400 w-4 h-4 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white">{escrow.sellerName || 'N/A'}</span>
                </div>
                {escrow.sellerEmail && (
                  <div className="flex items-center gap-3">
                    <FiMail className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300 text-sm">{escrow.sellerEmail}</span>
                  </div>
                )}
                {escrow.sellerAccountNumber && (
                  <div className="flex items-center gap-3">
                    <FiCreditCard className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                      {escrow.sellerAccountNumber} {escrow.sellerBank ? `(${escrow.sellerBank})` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {escrow.agentName && (
              <>
                <hr className="border-gray-100 dark:border-gray-700" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Agent</p>
                  <div className="flex items-center gap-3">
                    <FiUser className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white">{escrow.agentName}</span>
                  </div>
                  {escrow.agentEmail && (
                    <div className="flex items-center gap-3 mt-2">
                      <FiMail className="text-gray-400 w-4 h-4 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{escrow.agentEmail}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><FiTag className="w-4 h-4" /> Type</span>
              <span className="font-medium text-gray-900 dark:text-white">{escrow.type || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><FiCalendar className="w-4 h-4" /> Created</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatDate(escrow.createdAt)}</span>
            </div>
            {escrow.releaseDate && (
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><FiCalendar className="w-4 h-4" /> Release Date</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDate(escrow.releaseDate)}</span>
              </div>
            )}
            {escrow.releaseConditions && (
              <div className="py-2">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Release Conditions</p>
                <p className="text-gray-900 dark:text-white text-sm">{escrow.releaseConditions}</p>
              </div>
            )}
            {escrow.description && (
              <div className="py-2">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Description</p>
                <p className="text-gray-900 dark:text-white text-sm">{escrow.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Actions</h2>
          {canFund && (
            <button
              onClick={() => setShowFundDialog(true)}
              disabled={actionLoading}
              className="w-full py-3 bg-[var(--primary-color)] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Add Funds
            </button>
          )}
          {canRelease && (
            <button
              onClick={handleRelease}
              disabled={actionLoading}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Release Funds to Seller'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="w-full py-3 border border-red-300 text-red-600 dark:border-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              Cancel Escrow
            </button>
          )}
        </div>
      </div>

      {/* Fund Dialog */}
      {showFundDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Funds</h3>
            <input
              type="number"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="Amount (NGN)"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowFundDialog(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-700 dark:text-gray-200 font-medium">Cancel</button>
              <button
                onClick={handleFund}
                disabled={actionLoading || !fundAmount}
                className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscrowDetailScreen;
