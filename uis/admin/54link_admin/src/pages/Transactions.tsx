import { TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTenantBranding } from '../contexts/TenantBrandingContext';
import apiClient from '../services/api';

interface TransactionStats {
  total_count: number;
  total_volume: number;
}

export default function Transactions() {
  const { primaryColor, secondaryColor } = useTenantBranding();

  const [stats, setStats] = useState<TransactionStats>({
    total_count: 0,
    total_volume: 0,
  });

  // Only aggregate metrics are shown here — per-transaction detail (payer,
  // payee, notes, amounts) is not fetched into the admin UI for data protection.
  useEffect(() => {
    apiClient.get('/ledger/txn/metrics')
      .then((res) => {
        const metrics = res.data.metrics ?? {};
        setStats({
          total_count: metrics.total_count ?? 0,
          total_volume: metrics.total_volume ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: `linear-gradient(to bottom right, ${primaryColor}15, ${secondaryColor}15)` }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8" style={{ color: primaryColor }} />
            Transactions
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Summary only — per-transaction detail is restricted for data protection
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Transactions</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_count.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Volume (successful)</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">₦{stats.total_volume.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
