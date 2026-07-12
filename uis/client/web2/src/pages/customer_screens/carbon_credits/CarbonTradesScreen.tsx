import React, { useEffect, useState } from 'react';
import { FiArrowDown, FiArrowLeft, FiArrowUp, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';

interface CarbonTrade {
  id: string;
  project_id?: string;
  project_name?: string;
  trade_type: 'purchase' | 'sale' | 'transfer';
  quantity: number;
  price_per_credit?: number;
  total_amount?: number;
  status: string;
  created_at?: string;
  transaction_date?: string;
}

const statusColor = (s: string) => {
  if (s === 'completed' || s === 'settled') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'failed' || s === 'cancelled') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const CarbonTradesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<CarbonTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.get('/carbon/api/v1/carbon/trades');
      const data = res.data as Record<string, unknown> | unknown[];
      const list = Array.isArray(data) ? data : ((data as Record<string, unknown>).trades || (data as Record<string, unknown>).data || []) as unknown[];
      setTrades(list as CarbonTrade[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const totalPurchased = trades.filter(t => t.trade_type === 'purchase').reduce((s, t) => s + t.quantity, 0);
  const totalSold = trades.filter(t => t.trade_type === 'sale').reduce((s, t) => s + t.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-teal-700 to-green-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/carbon-credits')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Carbon Trades</h1>
                <p className="text-white/70 text-sm">Your credit transaction history</p>
              </div>
            </div>
            <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Credits Purchased</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : totalPurchased.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Credits Sold</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : totalSold.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full"></div></div>
        ) : trades.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Trades Yet</p>
            <p>Your carbon credit transactions will appear here</p>
            <button onClick={() => navigate('/carbon-credits/projects')} className="mt-4 px-6 py-2 bg-teal-700 text-white rounded-lg font-semibold">
              Browse Projects
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(trade => (
              <div key={trade.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trade.trade_type === 'purchase' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                    {trade.trade_type === 'purchase'
                      ? <FiArrowDown className="w-5 h-5 text-green-600 dark:text-green-400" />
                      : <FiArrowUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm capitalize">{trade.trade_type}</p>
                    {trade.project_name && <p className="text-xs text-gray-500 dark:text-gray-400">{trade.project_name}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {(trade.created_at || trade.transaction_date) ? new Date(trade.created_at || trade.transaction_date || '').toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${trade.trade_type === 'purchase' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {trade.trade_type === 'purchase' ? '+' : '-'}{trade.quantity} credits
                  </p>
                  {(trade.total_amount != null) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">₦{trade.total_amount.toLocaleString()}</p>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor(trade.status)}`}>{trade.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CarbonTradesScreen;
