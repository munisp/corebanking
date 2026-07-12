import React, { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiCreditCard, FiDollarSign, FiLock, FiPlus, FiUnlock, FiX } from 'react-icons/fi';
import '../../../App.css';
import { useAuth } from '../../../contexts/AuthContext';
// import { useTheme } from '../../../contexts/ThemeContext';
import { type Account, accountService } from '../../../services/account_service';

const AccountsScreen: React.FC = () => {
  const { user } = useAuth();
  // const { isDark } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Create form state
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['accountType']>('savings');
  const [currency, setCurrency] = useState('NGN');

  const loadAccounts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      // const accountsData = await accountService.getUserAccounts(user.id);
      const accountsData: Account[] = [];
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setCreateLoading(true);
      const result = await accountService.createAccount({
        userId: user.id,
        accountName,
        accountType,
        currency,
      });

      if (result.success) {
        alert(result.message);
        setShowCreateModal(false);
        loadAccounts();
        // Reset form
        setAccountName('');
        setAccountType('savings');
        setCurrency('NGN');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Error creating account' + (error ? ': ' + error : ''));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      const result = await accountService.setPrimaryAccount(accountId);
      alert(result.message);
      if (result.success) {
        loadAccounts();
      }
    } catch (error) {
      console.error(error);
      alert('Error setting primary account');
    }
  };

  const handleFreezeAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to freeze this account?')) return;

    try {
      const result = await accountService.freezeAccount(accountId);
      alert(result.message);
      if (result.success) {
        loadAccounts();
      }
    } catch (error) {
      alert('Error freezing account');
    }
  };

  const handleUnfreezeAccount = async (accountId: string) => {
    try {
      const result = await accountService.unfreezeAccount(accountId);
      alert(result.message);
      if (result.success) {
        loadAccounts();
      }
    } catch (error) {
            console.error(error);

      alert('Error unfreezing account');
    }
  };

  // const getStatusColor = (status: Account['status']) => {
  //   switch (status) {
  //     case 'active':
  //       return '#4CAF50';
  //     case 'inactive':
  //       return '#9E9E9E';
  //     case 'frozen':
  //       return '#F44336';
  //     default:
  //       return '#757575';
  //   }
  // };

  const getAccountTypeColor = (type: Account['accountType']) => {
    switch (type) {
      case 'savings':
        return 'bg-blue-500';
      case 'current':
        return 'bg-orange-500';
      case 'fixed_deposit':
        return 'bg-green-500';
      case 'domiciliary':
        return 'bg-purple-500';
      case 'mint':
        return 'bg-indigo-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getAccountTypeIcon = (type: Account['accountType']) => {
    switch (type) {
      case 'savings':
        return <FiDollarSign size={20} />;
      case 'current':
        return <FiCreditCard size={20} />;
      case 'mint':
        return <FiDollarSign size={20} />;
      default:
        return <FiCreditCard size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Accounts</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your bank accounts</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <FiPlus size={20} />
            Create Account
          </button>
        </div>

        {/* Accounts Grid */}
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <FiCreditCard size={64} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No accounts yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first account to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <FiPlus size={20} />
              Create Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden ${
                  account.isPrimary ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-6 text-white relative">
                  {account.isPrimary && (
                    <div className="absolute top-4 right-4 bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <FiCheck size={12} />
                      PRIMARY
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`${getAccountTypeColor(account.accountType)} p-3 rounded-lg`}>
                      {getAccountTypeIcon(account.accountType)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{account.accountName}</h3>
                      <p className="text-blue-100 text-sm">{account.accountType.replace('_', ' ').toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-blue-100 text-xs mb-1">Account Number</p>
                    <p className="text-xl font-mono font-semibold tracking-wider">{account.accountNumber}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="mb-6">
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Available Balance</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {account.currency} {account.balance.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                        account.status === 'active'
                          ? 'bg-green-500'
                          : account.status === 'frozen'
                          ? 'bg-red-500'
                          : 'bg-gray-500'
                      }`}
                    >
                      {account.status.toUpperCase()}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      Created {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {!account.isPrimary && account.status === 'active' && (
                      <button
                        onClick={() => handleSetPrimary(account.id)}
                        className="btn-primary w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                      >
                        <FiCheck size={16} />
                        Set as Primary
                      </button>
                    )}
                    {account.status === 'active' && (
                      <button
                        onClick={() => handleFreezeAccount(account.id)}
                        className="bg-orange-500 hover:bg-orange-600 text-white w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiLock size={16} />
                        Freeze Account
                      </button>
                    )}
                    {account.status === 'frozen' && (
                      <button
                        onClick={() => handleUnfreezeAccount(account.id)}
                        className="bg-green-500 hover:bg-green-600 text-white w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiUnlock size={16} />
                        Unfreeze Account
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Account Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Account</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateAccount} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g., My Savings Account"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as Account['accountType'])}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="savings">Savings Account</option>
                    <option value="current">Current Account</option>
                    <option value="fixed_deposit">Fixed Deposit</option>
                    <option value="domiciliary">Domiciliary Account</option>
                    <option value="mint">Mint Account</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {accountType === 'savings' && 'For personal savings with interest'}
                    {accountType === 'current' && 'For daily business transactions'}
                    {accountType === 'fixed_deposit' && 'Lock funds for higher returns'}
                    {accountType === 'domiciliary' && 'Foreign currency account'}
                    {accountType === 'mint' && 'Special digital mint account'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="NGN">🇳🇬 NGN - Nigerian Naira</option>
                    <option value="USD">🇺🇸 USD - US Dollar</option>
                    <option value="EUR">🇪🇺 EUR - Euro</option>
                    <option value="GBP">🇬🇧 GBP - British Pound</option>
                  </select>
                </div>

                {/* Modal Footer */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 btn-primary py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {createLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FiPlus size={20} />
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountsScreen;
