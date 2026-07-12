import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { IslamicProduct } from '../../../services/islamic_banking_service';
import { islamicBankingService } from '../../../services/islamic_banking_service';

const SukukScreen: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IslamicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sukukType, setSukukType] = useState('ijara');
  const [sukukName, setSukukName] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setItems(await islamicBankingService.getSukukList()); }
    catch { setError('Failed to load Sukuk investments'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await islamicBankingService.applySukuk({ sukuk_type: sukukType, sukuk_name: sukukName, investment_amount: parseFloat(investmentAmount), tenure_months: parseInt(tenureMonths) });
      setShowForm(false); setSukukType('ijara'); setSukukName(''); setInvestmentAmount(''); setTenureMonths('');
      load();
    } catch { alert('Failed to submit Sukuk application'); }
    finally { setSubmitting(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'pending') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'matured') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (s === 'cancelled') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600';
  };

  const totalPortfolio = items.reduce((sum, i) => sum + Number(i.investment_amount || 0), 0);
  const totalExpected = items.reduce((sum, i) => sum + Number(i.expected_return || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-rose-500 to-pink-600">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/islamic-banking')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Sukuk</h1>
                <p className="text-white/70 text-sm">Islamic Bonds</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
              <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-4 py-2 bg-white text-rose-700 rounded-lg hover:bg-gray-100 font-semibold text-sm">
                <FiPlus className="w-4 h-4" /><span>Invest</span>
              </button>
            </div>
          </div>
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-white/70 text-sm">Total Invested</p>
                <p className="text-2xl font-bold text-white">₦{totalPortfolio.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-white/70 text-sm">Expected Return</p>
                <p className="text-2xl font-bold text-white">₦{totalExpected.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-rose-500 border-t-transparent rounded-full"></div></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Sukuk Investments</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Earn returns through asset-backed Islamic bonds</p>
            <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
              <FiPlus className="w-4 h-4" /><span>Invest Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{String(item.sukuk_name || '—')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">{String(item.sukuk_type || '')} Sukuk</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(item.status)}`}>{item.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-gray-500 dark:text-gray-400">Invested</p><p className="font-semibold text-gray-900 dark:text-white">₦{Number(item.investment_amount || 0).toLocaleString()}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Expected Return</p><p className="font-semibold text-rose-600 dark:text-rose-400">₦{Number(item.expected_return || 0).toLocaleString()}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Tenure</p><p className="font-semibold text-gray-900 dark:text-white">{Number(item.tenure_months || 0)} months</p></div>
                  {Boolean(item.maturity_date) && (
                    <div><p className="text-gray-500 dark:text-gray-400">Maturity</p><p className="font-semibold text-gray-900 dark:text-white">{new Date(String(item.maturity_date)).toLocaleDateString()}</p></div>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Applied: {new Date(item.application_date).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Invest in Sukuk</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sukuk Type</label>
                <select value={sukukType} onChange={e => setSukukType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500">
                  <option value="ijara">Ijara Sukuk</option>
                  <option value="murabaha">Murabaha Sukuk</option>
                  <option value="musharaka">Musharaka Sukuk</option>
                  <option value="sovereign">Sovereign Sukuk</option>
                  <option value="corporate">Corporate Sukuk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sukuk Name</label>
                <input value={sukukName} onChange={e => setSukukName(e.target.value)} required placeholder="e.g. Federal Government Sukuk 2025"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Investment Amount (₦)</label>
                <input type="number" value={investmentAmount} onChange={e => setInvestmentAmount(e.target.value)} required min="0" step="0.01" placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tenure (months)</label>
                <input type="number" value={tenureMonths} onChange={e => setTenureMonths(e.target.value)} required min="1" max="360" placeholder="e.g. 60"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-semibold">{submitting ? 'Submitting...' : 'Invest'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SukukScreen;
