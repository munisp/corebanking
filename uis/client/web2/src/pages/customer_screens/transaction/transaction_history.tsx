import { useEffect, useState } from "react";
import { FiArrowDownLeft, FiArrowLeft, FiArrowUpRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { AppConfig } from "../../../config/app_config";
import { apiService } from "../../../services/api_service";

// Updated Transaction interface to match API response
interface Transaction {
  id: string;
  transaction_id: string;
  amount: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  currency: string;
  note: string;
  payer: string;
  payee: string;
  ledger_id: string;
  tenant_id: string;
  tag: string;
  deleted_at: string | null;
  updated_at: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endReached, setEndReached] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async (loadMore = false) => {
    if (loadMore && endReached) return;

    if (!loadMore) setLoading(true);

    try {
      // Use apiService which already handles all the headers and base URL
      const response = await apiService.get<{ transactions: Transaction[] }>(
        `${AppConfig.transactionEndpoint}/account/${localStorage.getItem('account_id')}`,
        {
          page,
          limit: 20,
        }
      );

      const data: Transaction[] = response.data.transactions || [];

      if (data.length === 0) {
        setEndReached(true);
        setLoading(false);
        return;
      }

      setTransactions((prev) =>
        loadMore ? [...prev, ...data] : data
      );

      setLoading(false);
      setLoadingMore(false);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.message || "Error loading transactions");
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: any) => {
    const bottom =
      e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;

    if (bottom && !loadingMore && !endReached) {
      setLoadingMore(true);
      setPage((p) => p + 1);
      loadTransactions(true);
    }
  };

  // Helper function to determine if transaction is credit or debit
  const getTransactionType = (tx: Transaction): 'credit' | 'debit' => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const myAccountId = user?.account_id?.toString() || '11';
    
    // If I'm the payee, it's a credit (money coming in)
    // If I'm the payer, it's a debit (money going out)
    return tx.payee === myAccountId ? 'credit' : 'debit';
  };

  // Format date to readable format
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get transaction description
  const getTransactionDescription = (tx: Transaction): string => {
    if (tx.note) return tx.note;
    const type = getTransactionType(tx);
    return type === 'credit' ? 'Money Received' : 'Money Sent';
  };

  // Get the other party name
  const getOtherParty = (tx: Transaction): string => {
    const type = getTransactionType(tx);
    if (type === 'credit') {
      return tx.payer === 'MINT_ACCOUNT' ? 'Mint Account' : `Account ${tx.payer}`;
    } else {
      return tx.payee === 'MINT_ACCOUNT' ? 'Mint Account' : `Account ${tx.payee}`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-10 w-10 border-4 border-(--primary-color) border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500 font-semibold mb-4">{error}</div>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadTransactions();
          }}
          className="px-4 py-2 bg-(--primary-color) text-white rounded-lg hover:bg-(--primary-color)"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen px-4 py-6 md:px-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto"
      onScroll={handleScroll}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-900 dark:text-white"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Transaction History</h1>
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const type = getTransactionType(tx);
            const isCredit = type === 'credit';
            
            return (
              <div
                key={tx.id}
                onClick={() => navigate('/receipt', { state: { transaction: tx } })}
                className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCredit
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}
                    >
                      {isCredit ? (
                        <FiArrowDownLeft
                          size={20}
                          className="text-green-600 dark:text-green-400"
                        />
                      ) : (
                        <FiArrowUpRight
                          size={20}
                          className="text-red-600 dark:text-red-400"
                        />
                      )}
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {getTransactionDescription(tx)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {getOtherParty(tx)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(tx.created_at)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            tx.status === 'success'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : tx.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      {tx.transaction_id && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                          ID: {tx.transaction_id}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right ml-4">
                    <div
                      className={`text-lg font-bold ${
                        isCredit
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₦
                      {parseFloat(tx.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {tx.currency}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {loadingMore && (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-4 border-(--primary-color) dark:border-(--primary-color) border-t-transparent rounded-full"></div>
          </div>
        )}

        {endReached && transactions.length > 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-4">
            No more transactions
          </p>
        )}
      </div>
    </div>
  );
}