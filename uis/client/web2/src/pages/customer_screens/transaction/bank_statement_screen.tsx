import { useEffect, useState } from 'react';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { Transaction } from '../../../models/transaction';
import { WalletService } from '../../../services/wallet_service';

const walletService = new WalletService();

const BankStatementScreen = () => {
  usePageTitle('Bank Statement');
  const { tenant } = useTenantConfig();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatementData();
  }, []);

  const loadStatementData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Calculate date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Fetch wallet balance and transactions in parallel
      const [walletData, transactionsData] = await Promise.all([
        walletService.getMyWallet().catch(err => {
          console.error('Error loading wallet:', err);
          return null;
        }),
        walletService.getTransactions({ 
          page: 1, 
          limit: 100, // Get more transactions for statement
          startDate,
          endDate
        }).catch(err => {
          console.error('Error loading transactions:', err);
          return [];
        })
      ]);

      // Set balance
      if (walletData) {
        setBalance(walletData.balance);
      } else {
        // Try to get balance from localStorage account data
        try {
          const accountJson = localStorage.getItem('account');
          if (accountJson) {
            const account = JSON.parse(accountJson);
            setBalance(account.balance);
          }
        } catch (e) {
          console.error('Failed to load balance from storage:', e);
        }
      }

      // Convert API response to Transaction model format
      const mappedTransactions = transactionsData.map((tx: any) => {
        const isCredit = tx.payer === 'MINT_ACCOUNT' || tx.type === 'credit';
        
        let createdAtDate: Date;
        try {
          createdAtDate = new Date(tx.created_at || tx.createdAt);
          if (isNaN(createdAtDate.getTime())) {
            createdAtDate = new Date();
          }
        } catch (e) {
          createdAtDate = new Date();
        }
        
        return Transaction.fromJson({
          transaction_id: tx.transaction_id || tx.id,
          created_at: createdAtDate.toISOString(),
          balance_after: tx.balance_after ?? tx.balanceAfter ?? 0,
          balance_before: tx.balance_before ?? tx.balanceBefore ?? 0,
          recipient_name: tx.recipient_name ?? tx.recipientName ?? (isCredit ? tx.payer : tx.payee),
          recipient_account: tx.recipient_account ?? tx.recipientAccount ?? undefined,
          amount: parseFloat(tx.amount?.toString() || '0'),
          type: tx.type ?? (isCredit ? 'credit' : 'debit'),
          category: tx.category ?? (tx.note || 'Transaction'),
          description: tx.description ?? tx.note ?? 'Transaction',
          status: (tx.status === 'success' || tx.status === 'completed') 
            ? 'completed' 
            : (tx.status === 'pending' || tx.status === 'failed') 
              ? tx.status 
              : 'pending',
          reference: tx.reference ?? tx.transaction_id ?? tx.id,
          currency: tx.currency ?? 'NGN',
        });
      });

      // Sort transactions by date (newest first)
      mappedTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setTransactions(mappedTransactions);
    } catch (err: any) {
      console.error('Error loading statement data:', err);
      setError(err.message || 'Failed to load bank statement');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const txDate = typeof date === 'string' ? new Date(date) : date;
    return txDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return '₦0.00';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance);
  };

  const parseColor = (colorString: string) => {
    try {
      return colorString.startsWith('#') ? colorString : `#${colorString}`;
    } catch (e) {
      return '#3B82F6'; // Default blue
    }
  };

  const handleExport = () => {
    alert('Statement export - API integration needed');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Bank Statement</h1>

        {/* Summary Card */}
        <div 
          className="rounded-2xl p-6 shadow-lg mb-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${parseColor(tenant.branding.primary_color)} 0%, ${parseColor(tenant.branding.secondary_color)} 100%)`
          }}
        >
          <p className="text-sm opacity-90 mb-1">Current Balance</p>
          <p className="text-4xl font-bold mb-4">{formatBalance(balance)}</p>
          <p className="text-sm opacity-90">Statement Period: Last 30 Days</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center items-center">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: parseColor(tenant.branding.primary_color) }}
              ></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transactions...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={loadStatementData}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Transactions List */}
        {!loading && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-6 border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-white">Transaction History</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No transactions found for the last 30 days</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {transaction.displayTitle || transaction.description || 'Transaction'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(transaction.createdAt)}
                        </p>
                        {transaction.reference && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Ref: {transaction.reference}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            transaction.isCredit 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {transaction.formattedAmount}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.status === 'completed' ? 'Completed' : 
                           transaction.status === 'pending' ? 'Pending' : 
                           transaction.status === 'failed' ? 'Failed' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export Button */}
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full btn-primary py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF Statement
          </button>

          <button
            onClick={handleExport}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel Statement
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 dark:bg-[var(--primary-color)]/30 border border-[var(--primary-color)] dark:border-[var(--primary-color)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--primary-color)] dark:text-[var(--primary-color)] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)]">
              <p className="font-semibold mb-1">Statement Information</p>
              <p>Your statement includes all transactions for the selected period. You can export it as PDF or Excel for record keeping.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementScreen;
