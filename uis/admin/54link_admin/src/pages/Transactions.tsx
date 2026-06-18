import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { Activity, ArrowDownRight, ArrowUpRight, Download, FileText, Search, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTenantBranding } from '../contexts/TenantBrandingContext';
import apiClient from '../services/api';

interface Transaction {
  id: string;
  amount: string;
  ledger_id: string;
  status: string;
  transaction_id: string;
  created_at: string;
  completed_at: string | null;
  currency: string;
  deleted_at: string | null;
  note: string;
  payer: string;
  tag: string;
  payee: string;
  tenant_id: string;
  updated_at: string;
}

interface TransactionStats {
  total: number;
  total_amount_kobo: number;
  successful: number;
  failed: number;
  pending: number;
  success_rate: string;
}

interface DailyVolume {
  date: string;
  amount: number;
}

const PAGE_SIZE = 50;

export default function Transactions() {
  const { primaryColor, secondaryColor } = useTenantBranding();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0,
    total_amount_kobo: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    success_rate: '0.0',
  });
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);

  const fetchTransactions = useCallback(() => {
    setTransactionsLoading(true);
    const params: Record<string, string | number> = {
      page,
      limit: PAGE_SIZE,
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all') params.type = typeFilter;

    apiClient.get('/v1/transactions', { params })
      .then((res) => {
        const data = res.data;
        setTransactions(data.items ?? data.transactions ?? []);
        setTransactionsTotal(data.total ?? 0);
        setTransactionsLoading(false);
      })
      .catch(() => {
        setTransactions([]);
        setTransactionsLoading(false);
      });
  }, [page, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Fetch stats and daily volume from reporting endpoint
  useEffect(() => {
    apiClient.get('/v1/reports/transaction-stats')
      .then((res) => {
        const d = res.data;
        setStats({
          total: d.total ?? 0,
          total_amount_kobo: d.total_amount_kobo ?? 0,
          successful: d.successful ?? 0,
          failed: d.failed ?? 0,
          pending: d.pending ?? 0,
          success_rate: d.success_rate ?? '0.0',
        });
        setDailyVolume(d.daily_volume ?? []);
      })
      .catch(() => {});
  }, []);

  const typeDistribution = useMemo(() => {
    const typeMap = new Map<string, number>();
    transactions.forEach((txn) => {
      const type = txn.payer === 'MINT_ACCOUNT' ? 'deposit'
        : txn.payee === 'MINT_ACCOUNT' ? 'withdrawal'
        : 'transfer';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899'];
    return Array.from(typeMap.entries()).map(([name, value], idx) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[idx % colors.length],
    }));
  }, [transactions]);

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'success' || s === 'completed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (s === 'failed' || s === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    if (s === 'pending' || s === 'processing') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  };

  const getTypeIcon = (payer: string, payee: string) => {
    if (payer === 'MINT_ACCOUNT') return <ArrowDownRight className="w-4 h-4 text-green-600" />;
    if (payee === 'MINT_ACCOUNT') return <ArrowUpRight className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-blue-600" />;
  };

  const handleExportExcel = () => {
    const data = transactions.map((txn) => {
      const type = txn.payer === 'MINT_ACCOUNT' ? 'deposit'
        : txn.payee === 'MINT_ACCOUNT' ? 'withdrawal'
        : 'transfer';
      return {
        'Transaction ID': txn.transaction_id,
        Note: txn.note || 'N/A',
        Type: type,
        Amount: `${txn.currency} ${parseFloat(txn.amount || '0').toLocaleString()}`,
        Status: txn.status,
        Payer: txn.payer || 'N/A',
        Payee: txn.payee || 'N/A',
        Created: txn.created_at,
        Completed: txn.completed_at || 'N/A',
      };
    });
    exportToExcel(data, 'transactions');
  };

  const handleExportPDF = () => {
    const data = transactions.map((txn) => {
      const type = txn.payer === 'MINT_ACCOUNT' ? 'deposit'
        : txn.payee === 'MINT_ACCOUNT' ? 'withdrawal'
        : 'transfer';
      return {
        'Transaction ID': txn.transaction_id,
        Note: txn.note || 'N/A',
        Type: type,
        Amount: `${txn.currency} ${parseFloat(txn.amount || '0').toLocaleString()}`,
        Status: txn.status,
        Created: txn.created_at,
      };
    });
    exportToPDF(data, ['Transaction ID', 'Note', 'Type', 'Amount', 'Status', 'Created'], 'transactions-report', 'Transactions Report');
  };

  const totalPages = Math.ceil(transactionsTotal / PAGE_SIZE);
  const totalAmountNaira = (stats.total_amount_kobo / 100_000_000).toFixed(1);

  return (
    <div
      className="min-h-screen"
      style={{ background: `linear-gradient(to bottom right, ${primaryColor}15, ${secondaryColor}15)` }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <TrendingUp className="w-8 h-8" style={{ color: primaryColor }} />
                Transactions
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Real-time transaction ledger — {transactionsTotal.toLocaleString()} records
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportExcel} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2" disabled={transactionsLoading}>
                <Download className="w-5 h-5" /> Excel
              </button>
              <button onClick={handleExportPDF} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2" disabled={transactionsLoading}>
                <Download className="w-5 h-5" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Transactions</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Volume</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">₦{totalAmountNaira}B</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{stats.successful.toLocaleString()} successful</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Success Rate</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.success_rate}%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{stats.failed.toLocaleString()} failed</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Pending</div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending.toLocaleString()}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">awaiting processing</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {dailyVolume.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Daily Transaction Volume</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} formatter={(value: number | undefined) => value != null ? `₦${value.toFixed(1)}K` : ''} />
                  <Area type="monotone" dataKey="amount" stroke={primaryColor} fill={primaryColor} fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {typeDistribution.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Transaction Types</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={typeDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, reference, note..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2"
              />
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2">
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2">
              <option value="all">All Types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Transaction List ({transactionsTotal.toLocaleString()})
            </h3>
          </div>

          {transactionsLoading ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Transaction ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Reference</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">From</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">To</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {transactions.map((txn) => {
                    const type = txn.payer === 'MINT_ACCOUNT' ? 'deposit'
                      : txn.payee === 'MINT_ACCOUNT' ? 'withdrawal'
                      : 'transfer';
                    return (
                      <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-slate-900 dark:text-white truncate max-w-[160px]">{txn.transaction_id}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{txn.note || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(txn.payer, txn.payee)}
                            <span className="capitalize">{type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          {txn.currency} {parseFloat(txn.amount || '0').toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(txn.status || '')}`}>
                            {txn.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{txn.payer || '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{txn.payee || '-'}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(txn.created_at.replace(' ', 'T')).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages} — {transactionsTotal.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || transactionsLoading}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || transactionsLoading}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
