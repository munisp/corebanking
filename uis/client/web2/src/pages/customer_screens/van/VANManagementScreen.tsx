import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiCopy, FiCreditCard, FiDollarSign, FiPlus, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { CreateVANRequest, VANPayment, VirtualAccount } from '../../../models/van';
import { vanService } from '../../../services/van_service';

type TabType = 'accounts' | 'payments' | 'create';

const VANManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [payments, setPayments] = useState<VANPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Create form state
  const [formData, setFormData] = useState<CreateVANRequest>({
    purpose: 'collections',
    label: '',
    isSingleUse: false,
  });
  const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [accountsData, paymentsData] = await Promise.all([
        vanService.getVirtualAccounts(),
        vanService.getPayments(),
      ]);
      setAccounts(accountsData);
      setPayments(paymentsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load VAN data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.label.trim()) {
      alert('Please enter a label for the virtual account');
      return;
    }

    try {
      setCreatingAccount(true);
      const expiresAt = expiryDays
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
        : undefined;
      const result = await vanService.createVirtualAccount({ ...formData, expiresAt });
      
      if (result.success) {
        alert(result.message);
        setFormData({ purpose: 'collections', label: '', isSingleUse: false });
        setExpiryDays(undefined);
        setActiveTab('accounts');
        loadData();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Failed to create virtual account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCopyAccountNumber = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    alert('Account number copied to clipboard');
  };

  const handleToggleStatus = async (account: VirtualAccount) => {
    try {
      const result = account.status === 'active'
        ? await vanService.deactivateAccount(account.id)
        : await vanService.activateAccount(account.id);
      
      if (result.success) {
        alert(result.message);
        loadData();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Failed to update account status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
      case 'expired':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'failed':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
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

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-700 dark:to-blue-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Virtual Account Numbers</h1>
            </div>
            <button
              onClick={loadData}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiRefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-xs mb-1">Total Accounts</p>
              <p className="text-2xl font-bold text-white">{accounts.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-xs mb-1">Active</p>
              <p className="text-2xl font-bold text-white">
                {accounts.filter(a => a.status === 'active').length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-xs mb-1">Total Received</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(accounts.reduce((sum, a) => sum + a.totalReceived, 0))}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-xs mb-1">Total Balance</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'accounts'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Accounts ({accounts.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'payments'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Payments ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FiPlus className="w-4 h-4" />
                <span>Create New</span>
              </div>
            </button>
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
                <p className="text-red-700 dark:text-red-400 font-medium">Error loading data</p>
                <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <>
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 bg-cyan-50 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-6">
                  <FiCreditCard className="w-12 h-12 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Virtual Accounts</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">Create a virtual account to start receiving payments</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  <span>Create Virtual Account</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(account.status)}`}>
                          {account.status}
                        </span>
                        {account.isSingleUse && (
                          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
                            Single Use
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <FiCreditCard className="w-5 h-5" />
                        <p className="text-sm font-medium">{account.label}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold tracking-wider">{account.accountNumber}</p>
                        <button
                          onClick={() => handleCopyAccountNumber(account.accountNumber)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <FiCopy className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Balances */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Balance</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Received</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(account.totalReceived)}
                          </p>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Purpose</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                          {account.purpose.replace('_', ' ')}
                        </p>
                      </div>

                      {/* Dates */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 mb-2">
                          <div className="flex items-center space-x-1">
                            <FiCalendar className="w-3 h-3" />
                            <span>Created {formatDate(account.createdAt)}</span>
                          </div>
                        </div>
                        {account.expiresAt && (
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            Expires {formatDate(account.expiresAt)}
                          </p>
                        )}
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggleStatus(account)}
                        className={`w-full mt-4 px-4 py-2 rounded-lg transition-colors ${
                          account.status === 'active'
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40'
                            : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                        }`}
                      >
                        {account.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <>
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 bg-cyan-50 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-6">
                  <FiDollarSign className="w-12 h-12 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Payments Yet</h2>
                <p className="text-gray-600 dark:text-gray-400 text-center">Payments received to your virtual accounts will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 dark:bg-green-900/20' 
                              : payment.status === 'pending'
                              ? 'bg-orange-100 dark:bg-orange-900/20'
                              : 'bg-red-100 dark:bg-red-900/20'
                          }`}>
                            {payment.status === 'completed' ? (
                              <FiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <FiXCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {payment.senderName || 'Unknown Sender'}
                            </p>
                          </div>
                        </div>
                        <div className="ml-14 space-y-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Account: {payment.vanId}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Reference: {payment.reference}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Sender Bank: {payment.senderBank}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          {formatDateTime(payment.receivedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Create Virtual Account</h2>
              
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Label
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Rent Collection, Invoice Payments"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Purpose
                  </label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value as CreateVANRequest['purpose'] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="collections">Collections</option>
                    <option value="payroll">Payroll</option>
                    <option value="subscriptions">Subscriptions</option>
                    <option value="invoices">Invoices</option>
                    <option value="donations">Donations</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.isSingleUse}
                      onChange={(e) => setFormData({ ...formData, isSingleUse: e.target.checked })}
                      className="w-5 h-5 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Single use (deactivate after first payment)
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expiry (Days) - Optional
                  </label>
                  <input
                    type="number"
                    value={expiryDays || ''}
                    onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Leave empty for no expiry"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="w-full px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingAccount ? 'Creating...' : 'Create Virtual Account'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VANManagementScreen;
