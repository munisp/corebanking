import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowDownLeft, FiArrowUpRight, FiCopy, FiRefreshCw } from 'react-icons/fi';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AppConfig } from '../../../config/app_config';
import { apiService } from '../../../services/api_service';

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

const statusColor = (s: string) => {
  if (s === 'completed' || s === 'success') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'failed') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const TransactionDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [tx, setTx] = useState<Transaction | null>((location.state as { transaction?: Transaction })?.transaction ?? null);
  const [loading, setLoading] = useState(!tx);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tx && id) load(id);
  }, [id]);

  const load = async (txId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.get(`${AppConfig.transactionEndpoint}/${txId}`);
      const data = res.data as Record<string, unknown>;
      setTx((data.transaction || data.data || data) as Transaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const accountId = localStorage.getItem('account_id') || '';
  const isCredit = tx ? tx.payee === accountId : false;
  const amount = tx ? parseFloat(tx.amount) : 0;

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full" />
    </div>
  );

  if (error || !tx) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <p className="text-red-500 mb-4">{error || 'Transaction not found'}</p>
      <button onClick={() => id && load(id)} className="flex items-center space-x-2 px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg">
        <FiRefreshCw className="w-4 h-4" /><span>Retry</span>
      </button>
    </div>
  );

  const rows: { label: string; value: string; copyable?: boolean }[] = [
    { label: 'Transaction ID', value: tx.transaction_id || tx.id, copyable: true },
    { label: 'Status', value: tx.status },
    { label: 'Date', value: new Date(tx.created_at).toLocaleString() },
    { label: 'Currency', value: tx.currency || 'NGN' },
    { label: 'From', value: tx.payer || '—' },
    { label: 'To', value: tx.payee || '—' },
    { label: 'Note', value: tx.note || '—' },
    { label: 'Tag', value: tx.tag || '—' },
    ...(tx.completed_at ? [{ label: 'Completed', value: new Date(tx.completed_at).toLocaleString() }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className={`bg-gradient-to-r ${isCredit ? 'from-green-600 to-teal-600' : 'from-gray-700 to-gray-800'}`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full mb-4">
            <FiArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isCredit ? 'bg-green-500/30' : 'bg-white/20'}`}>
              {isCredit
                ? <FiArrowDownLeft className="w-8 h-8 text-white" />
                : <FiArrowUpRight className="w-8 h-8 text-white" />}
            </div>
            <p className="text-white/80 text-sm mb-1">{isCredit ? 'Money Received' : 'Money Sent'}</p>
            <p className="text-4xl font-bold text-white mb-2">
              {isCredit ? '+' : '-'}₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(tx.status)}`}>
              {tx.status}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {rows.map((row, i) => (
            <div key={row.label} className={`flex items-center justify-between px-5 py-4 ${i < rows.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
              <div className="flex items-center space-x-2 max-w-[60%]">
                {row.label === 'Status' ? (
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(tx.status)}`}>{tx.status}</span>
                ) : (
                  <span className="text-sm font-medium text-gray-900 dark:text-white text-right truncate">{row.value}</span>
                )}
                {row.copyable && (
                  <button onClick={() => copy(row.value)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FiCopy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {copied && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center text-sm text-green-700 dark:text-green-400">
            Copied to clipboard
          </div>
        )}

        <button
          onClick={() => navigate('/receipt', { state: { transaction: tx } })}
          className="mt-6 w-full py-3 border-2 border-[var(--primary-color)] text-[var(--primary-color)] rounded-xl font-semibold hover:bg-[var(--primary-color)] hover:text-white transition-colors"
        >
          View Receipt
        </button>
      </div>
    </div>
  );
};

export default TransactionDetailScreen;
