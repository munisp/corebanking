import React, { useEffect, useState } from 'react';
import {
  FiBell,
  FiChevronRight,
  FiCreditCard,
  FiPieChart,
  FiSend,
  FiSettings,
  FiTrendingUp,
  FiZap
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
// import { QuickAction } from '../../../components/QuickAction';
import { AppConfig } from '../../../config/app_config';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { Transaction } from '../../../models/transaction';
import { apiService } from '../../../services/api_service';
import type { User } from '../../../services/user_service';
import { UserService } from '../../../services/user_service';
import { WalletService } from '../../../services/wallet_service';

const walletService = new WalletService();
const userService = new UserService();

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  usePageTitle('Dashboard');
  const [detailsVisible, setDetailsVisible] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Load account data from localStorage
  const loadAccountFromStorage = () => {
    try {
      const accountJson = localStorage.getItem('account');
      if (accountJson) {
        const account = JSON.parse(accountJson);
        setAccountData(account);
        setBalance(account.balance);
        setAccountNumber(account.account_number || account.accountNumber);
        setAccountId(account.id ? account.id.toString() : localStorage.getItem('account_id'));
        setLoading(false);
        console.log('[Dashboard] Loaded account from storage:', account.id);
      } else {
        // Try to get account_id from localStorage directly
        const storedAccountId = localStorage.getItem('account_id');
        if (storedAccountId) {
          setAccountId(storedAccountId);
        }
        setLoading(false);
        console.log('[Dashboard] No account found in storage');
      }
    } catch (e) {
      console.error('[Dashboard] Failed to load account from storage:', e);
      setLoading(false);
    }
  };

  // Fetch account from account endpoint and update localStorage
  const fetchAndStoreAccount = async () => {
    try {
      console.log('[Dashboard] Fetching account from account endpoint...');
      
      const keycloakId = localStorage.getItem('keycloak_id');
      if (!keycloakId) {
        console.log('[Dashboard] No keycloak_id found in storage, skipping account fetch');
        return;
      }
      
      console.log('[Dashboard] Calling account endpoint with keycloak_id:', keycloakId);
      
      const response = await apiService.get(`${AppConfig.accountEndpoint}/account/keycloak/${keycloakId}`);
      console.log('[Dashboard] Account endpoint response:', response.data);
      
      const data = response.data as any;
      if ((data && data.success === true) || response.status === 200) {
        const account = data.account;
        if (account) {
          console.log('[Dashboard] Account data received, storing to localStorage...');
          localStorage.setItem('account', JSON.stringify(account));
          if (account.id) {
            localStorage.setItem('account_id', account.id.toString());
            localStorage.setItem('user', JSON.stringify({ account_id: account.id }));
          }
          setAccountData(account);
          setBalance(account.balance);
          setAccountNumber(account.account_number || account.accountNumber);
          setAccountId(account.id ? account.id.toString() : null);
          setLoading(false);
          console.log('[Dashboard] Account stored to localStorage:', account.id);
        } else {
          console.log('[Dashboard] No account data in response');
        }
      } else {
        console.log('[Dashboard] Account endpoint returned unsuccessful response');
      }
    } catch (e) {
      console.error('[Dashboard] Failed to fetch account on dashboard load:', e);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    
    // Load account from storage first
    loadAccountFromStorage();
    
    try {
      // Get keycloak_id using utility function
      const { getKeycloakIdOrThrow } = await import('../../../utils/auth_utils');
      let keycloakId: string | null = null;
      
      try {
        keycloakId = getKeycloakIdOrThrow();
      } catch (e) {
        console.warn('Could not get keycloak_id, trying alternative methods:', e);
      }

      // Fetch account endpoint first - this updates localStorage with account and account_id
      await fetchAndStoreAccount();

      // Load user data - try multiple methods
      let userData: User | null = null;
      
      if (keycloakId) {
        try {
          // Primary: Get user profile using keycloak_id from user endpoint
          userData = await userService.getUserProfile(keycloakId);
        } catch (profileError) {
          console.warn('Failed to get user profile, trying getCurrentUser:', profileError);
          try {
            // Fallback: Try getCurrentUser with keycloak_id
            userData = await userService.getCurrentUser(keycloakId);
          } catch (currentUserError) {
            console.warn('Failed to get user from getCurrentUser:', currentUserError);
            // Final fallback: Try to get from storage
            userData = await userService.getStoredUser();
          }
        }
      } else {
        // If no keycloak_id, try to get from storage first, then try to extract keycloak_id from token
        userData = await userService.getStoredUser();
        
        // If still no user data, try to get keycloak_id from token and retry
        if (!userData) {
          try {
            const token = localStorage.getItem('access_token');
            if (token) {
              const tokenParts = token.split('.');
              if (tokenParts.length === 3) {
                let payloadBase64 = tokenParts[1];
                while (payloadBase64.length % 4) {
                  payloadBase64 += '=';
                }
                const payload = JSON.parse(atob(payloadBase64));
                const extractedKeycloakId = payload.sub || payload.keycloak_id;
                if (extractedKeycloakId) {
                  localStorage.setItem('keycloak_id', extractedKeycloakId);
                  // Retry with extracted keycloak_id
                  userData = await userService.getUserProfile(extractedKeycloakId);
                }
              }
            }
          } catch (tokenError) {
            console.warn('Failed to extract keycloak_id from token:', tokenError);
          }
        }
      }

      // Set user data if available and save to localStorage
      if (userData) {
        setUser(userData);
        // Explicitly save user data to localStorage
        localStorage.setItem(AppConfig.userDataKey, JSON.stringify(userData));
        // Ensure keycloak_id is also stored
        if (userData.keycloakId) {
          localStorage.setItem('keycloak_id', userData.keycloakId);
        }
      }

      // Load wallet and transactions in parallel
      const [walletData, transactionsData] = await Promise.all([
        walletService.getMyWallet().catch(err => {
          console.error('Error loading wallet:', err);
          return null;
        }),
        walletService.getTransactions({ page: 1, limit: 5 }).catch(err => {
          console.error('Error loading transactions:', err);
          return [];
        })
      ]);

      // Use account data from localStorage if available, otherwise use wallet data
      if (!accountData && walletData) {
        setBalance(walletData.balance);
        setAccountNumber(walletData.accountNumber || '**********');
      }
      
      // Ensure account ID is loaded from localStorage if not already set
      if (!accountId) {
        const storedAccountId = localStorage.getItem('account_id');
        if (storedAccountId) {
          setAccountId(storedAccountId);
        }
      }
      
      console.log('Raw transactions data:', transactionsData);
      
      // Convert API response to Transaction model format
      const transactions = transactionsData.map(tx => {
        // const isCredit = tx.payer === 'MINT_ACCOUNT' || tx.type === 'credit';

        // Always use camelCase for Transaction model, fallback to snake_case for API data
        return Transaction.fromJson({
          id: tx.id,
          walletId: tx.walletId,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          currency: tx.currency,
          status: (tx.status as import('../../../models/transaction').TransactionStatus) ?? undefined,
          reference: tx.reference,
          description: tx.description,
          recipientName: tx.recipientName,
          recipientAccount: tx.recipientAccount ?? '',
          metadata: tx.metadata,
          createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : (typeof tx.createdAt === 'string' ? tx.createdAt : undefined),
          updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : (typeof tx.updatedAt === 'string' ? tx.updatedAt : undefined),
        });
      });
      
      console.log('Mapped transactions:', transactions);
      setTransactions(transactions);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Try to load user from storage as last resort
      try {
        const storedUser = await userService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      } catch (storageError) {
        console.error('Error loading stored user:', storageError);
      }
    } finally {
      setLoading(false);
    }
  };

  // const handleRefresh = async () => {
  //   setLoading(true);
    
  //   // Fetch account endpoint first - this updates localStorage with account and account_id
  //   await fetchAndStoreAccount();
    
  //   // Refresh wallet and transactions
  //   try {
  //     const [walletData, transactionsData] = await Promise.all([
  //       walletService.getMyWallet().catch(err => {
  //         console.error('Error loading wallet:', err);
  //         return null;
  //       }),
  //       walletService.getTransactions({ page: 1, limit: 5 }).catch(err => {
  //         console.error('Error loading transactions:', err);
  //         return [];
  //       })
  //     ]);

  //     // Use account data from localStorage if available, otherwise use wallet data
  //     if (!accountData && walletData) {
  //       setBalance(walletData.balance);
  //       setAccountNumber(walletData.accountNumber || '**********');
  //     }
      
  //     const transactions = transactionsData.map((tx: any) => {
  //       const isCredit = tx.payer === 'MINT_ACCOUNT' || tx.type === 'credit';
        
  //       let createdAtDate: Date;
  //       try {
  //         createdAtDate = new Date(tx.created_at || tx.createdAt);
  //         if (isNaN(createdAtDate.getTime())) {
  //           createdAtDate = new Date();
  //         }
  //       } catch (e) {
  //         createdAtDate = new Date();
  //       }
        
  //       return Transaction.fromJson({
  //         transaction_id: tx.transaction_id || tx.id,
  //         created_at: createdAtDate.toISOString(),
  //         balance_after: tx.balance_after ?? tx.balanceAfter ?? 0,
  //         balance_before: tx.balance_before ?? tx.balanceBefore ?? 0,
  //         recipient_name: tx.recipient_name ?? tx.recipientName ?? (isCredit ? tx.payer : tx.payee),
  //         recipient_account: tx.recipient_account ?? tx.recipientAccount ?? undefined,
  //         amount: parseFloat(tx.amount?.toString() || '0'),
  //         type: tx.type ?? (isCredit ? 'credit' : 'debit'),
  //         category: tx.category ?? (tx.note || 'Transaction'),
  //         description: tx.description ?? tx.note ?? 'Transaction',
  //         status: (tx.status === 'success' || tx.status === 'completed') 
  //           ? 'completed' 
  //           : (tx.status === 'pending' || tx.status === 'failed') 
  //             ? tx.status 
  //             : 'pending',
  //         reference: tx.reference ?? tx.transaction_id ?? tx.id,
  //         currency: tx.currency ?? 'NGN',
  //       });
  //     });
      
  //     setTransactions(transactions);
      
  //     // Refresh user profile
  //     const { getKeycloakIdOrThrow } = await import('../../../utils/auth_utils');
  //     try {
  //       const keycloakId = getKeycloakIdOrThrow();
  //       const userData = await userService.getUserProfile(keycloakId);
  //       if (userData) {
  //         setUser(userData);
  //       }
  //     } catch (e) {
  //       console.warn('Failed to refresh user profile:', e);
  //     }
  //   } catch (error) {
  //     console.error('Error refreshing dashboard:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 17) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '₦0.00';
    
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(balance);
    } catch (e) {
      console.error('[Dashboard] Error formatting balance:', e);
      return '₦0.00';
    }
  };

  const formatDate = (date: Date | string) => {
    const txDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return txDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // const parseColor = (colorString: string) => {
  //   try {
  //     return colorString.startsWith('#') ? colorString : `#${colorString}`;
  //   } catch (e) {
  //     return '#3B82F6'; // Default blue
  //   }
  // };

  // Show full-page loader while initial data is loading
  if (loading && balance === null && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: tenant.branding.primary_color }}
          ></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top bar - matching mobile exactly */}
      <div className="bg-white dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-2">
          <div className="flex items-center">
            {/* Logo */}
            {/* {tenant.logo ? (
              <img 
                src={tenant.logo} 
                alt={tenant.displayName} 
                className="h-10 w-10 object-contain flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tenant.branding.primary_color }}>
                <span className="text-white text-sm font-bold">
                  {tenant.name?.substring(0, 2).toUpperCase() || 'LO'}
                </span>
              </div>
            )} */}
            {/* CircleAvatar */}
            <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0 ml-3">
              <svg className="w-7 h-7 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              {/* User greeting */}
              <div className="flex flex-row align-middle gap-2">
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{getGreeting()} </p>
              {/* <p>{" "}</p> */}
              <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {user ? `${(user.firstName).toLocaleUpperCase()} ${(user.lastName).toLocaleUpperCase()}` : 'User'}
              </p>
              </div>
            </div>
            <div className="ml-2 flex items-center space-x-2">
              {/* Notification button */}
              <button
                className="p-2 rounded-xl transition-colors"
                style={{ backgroundColor: `${tenant.branding.primary_color}` }}
                onClick={() => navigate('/notifications')}
                aria-label="Notifications"
              >
                <FiBell 
                  size={22} 
                  className="text-white"
                />
              </button>
              {/* Settings button */}
              <button
                className="p-2 rounded-xl transition-colors"
                style={{ backgroundColor: `${tenant.branding.primary_color}` }}
                onClick={() => navigate('/settings')}
                aria-label="Settings"
              >
                <FiSettings 
                  size={22} 
                  className="text-white"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Balance card - matching mobile exactly */}
      <div className="px-4 pt-6">
        <div 
          className="w-full rounded-2xl p-6 shadow-lg relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tenant.branding.primary_color} 0%, ${tenant.branding.secondary_color} 100%)`,
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Dark overlay for better text contrast in light mode */}
          <div 
            className="absolute inset-0 bg-black/20 dark:bg-black/0 rounded-2xl pointer-events-none"
          ></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-3">
              <p className="text-white text-sm font-medium" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>Available Balance</p>
              <button
                onClick={() => setDetailsVisible(!detailsVisible)}
                className="px-2 py-1 rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                aria-label={detailsVisible ? 'Hide balance' : 'Show balance'}
              >
                <span className="text-white text-xs font-semibold" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                  {detailsVisible ? 'Hide' : 'Show'}
                </span>
              </button>
            </div>
            <p className="text-white text-4xl font-bold mb-5 tracking-wide" style={{ letterSpacing: '1.2px', textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)' }}>
              {loading ? '...' : (detailsVisible ? formatBalance(balance) : '₦****.**')}
            </p>
            <div className="space-y-2">
              <div 
                className="inline-flex items-center px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <FiCreditCard className="text-white mr-2" size={16} style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }} />
                <span className="text-white text-sm font-semibold tracking-wider" style={{ letterSpacing: '1px', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                  {detailsVisible ? (accountNumber || '**********') : '**********'} * {detailsVisible ? accountId : '****'}
                </span>
              </div>
              {/* {accountId && (
                <div 
                  className="inline-flex items-center px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <span className="text-white text-xs font-medium mr-2" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                    .
                  </span>
                  <span className="text-white text-sm font-semibold tracking-wider" style={{ letterSpacing: '1px', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
                    
                  </span>
                </div>
              )} */}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - matching mobile exactly */}
      <div className="px-4 pt-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/transfer')}
            className="flex flex-col items-center justify-center p-3 rounded-xl transition-colors"
            style={{ backgroundColor: `${tenant.branding.primary_color}1A` }}
          >
            <FiSend 
              size={28} 
              style={{ color: tenant.branding.primary_color }}
              className="mb-2"
            />
            <span className="text-xs font-medium text-center text-gray-900 dark:text-white">
              Transfer
            </span>
          </button>
          <button
            onClick={() => navigate('/active-loans')}
            className="flex flex-col items-center justify-center p-3 rounded-xl transition-colors"
            style={{ backgroundColor: `${tenant.branding.primary_color}1A` }}
          >
            <FiTrendingUp 
              size={28} 
              style={{ color: tenant.branding.primary_color }}
              className="mb-2"
            />
            <span className="text-xs font-medium text-center text-gray-900 dark:text-white">
              Loans
            </span>
          </button>
          <button
            onClick={() => navigate('/savings')}
            className="flex flex-col items-center justify-center p-3 rounded-xl transition-colors"
            style={{ backgroundColor: `${tenant.branding.primary_color}1A` }}
          >
            <FiPieChart 
              size={28} 
              style={{ color: tenant.branding.primary_color }}
              className="mb-2"
            />
            <span className="text-xs font-medium text-center text-gray-900 dark:text-white">
              Savings
            </span>
          </button>
          <button
            onClick={() => navigate('/more-actions')}
            className="flex flex-col items-center justify-center p-3 rounded-xl transition-colors"
            style={{ backgroundColor: `${tenant.branding.primary_color}1A` }}
          >
            <FiZap 
              size={28} 
              style={{ color: tenant.branding.primary_color }}
              className="mb-2"
            />
            <span className="text-xs font-medium text-center text-gray-900 dark:text-white">
              More
            </span>
          </button>
        </div>
      </div>

      {/* Recent Transactions - matching mobile exactly */}
      <div className="px-4 pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Transactions</h2>
          <button
            className="flex items-center text-sm font-semibold transition-colors"
            style={{ color: tenant.branding.primary_color }}
            onClick={() => navigate('/transaction-history')}
          >
            See All <FiChevronRight className="ml-1" size={16} />
          </button>
        </div>
        {loading && transactions.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: tenant.branding.primary_color }}></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 flex flex-col items-center bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <svg className="w-20 h-20 text-gray-400 dark:text-gray-500 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">No transactions yet</p>
            <p className="text-sm mt-1 text-gray-500 dark:text-gray-500">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => (
              <div 
                key={tx.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      backgroundColor: tx.isCredit 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)' 
                    }}
                  >
                    {tx.isCredit ? (
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {tx.displayTitle || tx.description || 'Transaction'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {tx.category || formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="ml-3 text-right">
                    <p 
                      className="text-base font-bold"
                      style={{ 
                        color: tx.isCredit 
                          ? '#22c55e' 
                          : '#ef4444' 
                      }}
                    >
                      {tx.formattedAmount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-24"></div>
    </div>
  );
};

export default Dashboard;