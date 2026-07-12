import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiPlus, FiChevronRight, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { tradeFinanceService } from '../../../services/trade_finance_service';
import type { BankGuarantee } from '../../../models/trade_finance';

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'issued':   return '#3B82F6';
    case 'extended': return '#A855F7';
    case 'draft':    return '#F97316';
    case 'cancelled':
    case 'expired':  return '#EF4444';
    default:         return '#9CA3AF';
  }
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const BankGuaranteeListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [guarantees, setGuarantees] = useState<BankGuarantee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuarantees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tradeFinanceService.getBankGuarantees();
      setGuarantees(data);
    } catch {
      setError('Failed to load bank guarantees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuarantees(); }, [fetchGuarantees]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bank Guarantees</h1>
          </div>
          <button
            onClick={() => navigate('/trade-finance/bank-guarantees/apply')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#0369A114', color: '#0369A1', border: '1px solid #0369A133' }}
          >
            <FiPlus size={16} />
            Request
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-[#0369A1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8 text-center">
          <FiAlertCircle size={64} className="text-red-500" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">Error loading data</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={fetchGuarantees}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold"
            style={{ backgroundColor: '#0369A1' }}
          >
            <FiRefreshCw size={16} /> Retry
          </button>
        </div>
      ) : guarantees.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-12 text-center">
          <div className="p-7 rounded-full" style={{ backgroundColor: '#0369A114' }}>
            <FiShield size={72} color="#0369A1" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">No Bank Guarantees</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Request a guarantee to secure your trade transactions
          </p>
          <button
            onClick={() => navigate('/trade-finance/bank-guarantees/apply')}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold"
            style={{ backgroundColor: '#0369A1' }}
          >
            <FiPlus size={18} /> Request Guarantee
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {guarantees.map((bg) => {
            const color = statusColor(bg.status);
            return (
              <div
                key={bg.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-[18px]"
                style={{ border: `1.5px solid ${color}26`, boxShadow: `0 8px 20px ${color}12, 0 3px 10px rgba(0,0,0,0.05)` }}
              >
                {/* Header */}
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-2xl flex-shrink-0" style={{ backgroundColor: '#0369A11F' }}>
                    <FiShield size={24} color="#0369A1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">
                      {bg.beneficiaryName || 'Bank Guarantee'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      {bg.guaranteeRef || `BG #${bg.id.slice(-8)}`}
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide flex-shrink-0"
                    style={{ backgroundColor: `${color}1F`, color, border: `1px solid ${color}4D` }}
                  >
                    {bg.status.toUpperCase()}
                  </span>
                </div>

                {/* Info row */}
                <div
                  className="mt-3.5 p-3 rounded-xl grid grid-cols-3 gap-2"
                  style={{ backgroundColor: '#1A73E80A', border: '1px solid #1A73E814' }}
                >
                  <InfoCell label="Amount" value={formatAmount(bg.amount, bg.currency)} />
                  <InfoCell label="Type" value={titleCase(bg.type)} />
                  {bg.expiryDate && <InfoCell label="Expiry" value={bg.expiryDate.substring(0, 10)} />}
                </div>

                {/* Purpose */}
                {bg.purpose && (
                  <p className="mt-2.5 text-[12px] text-gray-400 dark:text-gray-500 line-clamp-2">{bg.purpose}</p>
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

export default BankGuaranteeListScreen;
