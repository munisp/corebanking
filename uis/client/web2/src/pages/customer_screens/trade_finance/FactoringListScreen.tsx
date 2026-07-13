import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiList, FiPlus, FiChevronRight, FiRefreshCw, FiAlertCircle, FiFileText } from 'react-icons/fi';
import { tradeFinanceService } from '../../../services/trade_finance_service';
import type { FactoringApplication } from '../../../models/trade_finance';

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved':  return '#22C55E';
    case 'pending':   return '#F97316';
    case 'rejected':  return '#EF4444';
    case 'disbursed': return '#3B82F6';
    default:          return '#9CA3AF';
  }
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

const FactoringListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [apps, setApps] = useState<FactoringApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tradeFinanceService.getFactoringApplications();
      setApps(data);
    } catch {
      setError('Failed to load factoring applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Export Factoring</h1>
          </div>
          <button
            onClick={() => navigate('/trade-finance/factoring/apply')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#7C3AED14', color: '#7C3AED', border: '1px solid #7C3AED33' }}
          >
            <FiPlus size={16} />
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8 text-center">
          <FiAlertCircle size={64} className="text-red-500" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">Error loading data</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={fetchApps}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <FiRefreshCw size={16} /> Retry
          </button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-12 text-center">
          <div className="p-7 rounded-full" style={{ backgroundColor: '#7C3AED14' }}>
            <FiList size={72} color="#7C3AED" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">No Factoring Applications</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Convert your export invoices into immediate cash
          </p>
          <button
            onClick={() => navigate('/trade-finance/factoring/apply')}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <FiPlus size={18} /> Apply for Factoring
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {apps.map((app) => {
            const color = statusColor(app.status);
            return (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-[18px]"
                style={{ border: `1.5px solid ${color}26`, boxShadow: `0 8px 20px ${color}12, 0 3px 10px rgba(0,0,0,0.05)` }}
              >
                {/* Header */}
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-2xl flex-shrink-0" style={{ backgroundColor: '#7C3AED1F' }}>
                    <FiList size={24} color="#7C3AED" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">
                      {app.debtorName || 'Factoring Application'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      {app.applicationRef || `Ref #${app.id.slice(-8)}`}
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide flex-shrink-0"
                    style={{ backgroundColor: `${color}1F`, color, border: `1px solid ${color}4D` }}
                  >
                    {app.status.toUpperCase()}
                  </span>
                </div>

                {/* Info row */}
                <div
                  className="mt-3.5 p-3 rounded-xl grid grid-cols-3 gap-2"
                  style={{ backgroundColor: '#1A73E80A', border: '1px solid #1A73E814' }}
                >
                  <InfoCell label="Invoice Total" value={formatAmount(app.invoiceTotal, app.currency)} />
                  <InfoCell label="Factoring Amount" value={formatAmount(app.factoringAmount, app.currency)} />
                  {app.discountRate > 0 && <InfoCell label="Discount Rate" value={`${app.discountRate.toFixed(2)}%`} />}
                </div>

                {/* Invoice count */}
                {app.invoiceCount > 0 && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <FiFileText size={14} className="text-gray-400 dark:text-gray-500" />
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">
                      {app.invoiceCount} invoice{app.invoiceCount > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
    <p className="text-[12px] font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
  </div>
);

export default FactoringListScreen;
