import { useLocation, useNavigate } from 'react-router-dom';

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
  tag?: string;
  deleted_at: string | null;
  updated_at: string;
}

const ReceiptScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const transaction = (location.state as { transaction?: Transaction })?.transaction;

  // If no transaction data, redirect back
  if (!transaction) {
    navigate('/transaction-history');
    return null;
  }

  // Determine transaction type
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const myAccountId = user?.account_id?.toString() || localStorage.getItem('account_id') || '';
  const isCredit = transaction.payee === myAccountId || transaction.payee === myAccountId.toString();
  // ...existing code...

  // Get the other party
  const getOtherParty = () => {
    if (isCredit) {
      return transaction.payer === 'MINT_ACCOUNT' ? 'Mint Account' : `Account ${transaction.payer}`;
    } else {
      return transaction.payee === 'MINT_ACCOUNT' ? 'Mint Account' : `Account ${transaction.payee}`;
    }
  };

  // Get transaction description
  const getTransactionDescription = () => {
    if (transaction.note) return transaction.note;
    return isCredit ? 'Money Received' : 'Money Sent';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format status
  const getStatusDisplay = () => {
    if (transaction.status === 'success' || transaction.status === 'completed') {
      return { text: 'Success', color: 'text-green-600 dark:text-green-400' };
    } else if (transaction.status === 'pending') {
      return { text: 'Pending', color: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { text: 'Failed', color: 'text-red-600 dark:text-red-400' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const amount = parseFloat(transaction.amount);

  const handleShare = () => {
    alert('Receipt sharing - API integration needed');
  };

  const handleDownload = () => {
    alert('Receipt download - API integration needed');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-400 mb-6">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Status Icon */}
        <div className="text-center mb-8">
          <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
            transaction.status === 'success' || transaction.status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30'
              : transaction.status === 'pending'
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {transaction.status === 'success' || transaction.status === 'completed' ? (
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : transaction.status === 'pending' ? (
              <svg className="w-10 h-10 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {transaction.status === 'success' || transaction.status === 'completed'
              ? 'Transaction Successful!'
              : transaction.status === 'pending'
              ? 'Transaction Pending'
              : 'Transaction Failed'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {transaction.status === 'success' || transaction.status === 'completed'
              ? 'Your transaction has been processed'
              : transaction.status === 'pending'
              ? 'Your transaction is being processed'
              : 'Your transaction could not be completed'}
          </p>
        </div>

        {/* Receipt Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center border-b border-gray-200 dark:border-gray-700 pb-3">
            Payment Receipt
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Transaction ID</span>
              <span className="font-semibold text-gray-800 dark:text-white font-mono text-sm">{transaction.transaction_id || transaction.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Description</span>
              <span className="font-semibold text-gray-800 dark:text-white text-right">{getTransactionDescription()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">{isCredit ? 'From' : 'To'}</span>
              <span className="font-semibold text-gray-800 dark:text-white">{getOtherParty()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <span className={`font-semibold text-lg ${
                isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isCredit ? '+' : '-'}₦{amount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Currency</span>
              <span className="font-semibold text-gray-800 dark:text-white">{transaction.currency || 'NGN'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Date</span>
              <span className="font-semibold text-gray-800 dark:text-white">{formatDate(transaction.created_at)}</span>
            </div>
            {transaction.completed_at && (
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Completed</span>
                <span className="font-semibold text-gray-800 dark:text-white">{formatDate(transaction.completed_at)}</span>
              </div>
            )}
            {transaction.tag && (
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Category</span>
                <span className="font-semibold text-gray-800 dark:text-white">{transaction.tag}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Status</span>
              <span className={`font-semibold flex items-center gap-1 ${statusDisplay.color}`}>
                {transaction.status === 'success' || transaction.status === 'completed' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : transaction.status === 'pending' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {statusDisplay.text}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleShare}
            className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Receipt
          </button>

          <button
            onClick={handleDownload}
            className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full text-primary hover:underline py-2"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScreen;
