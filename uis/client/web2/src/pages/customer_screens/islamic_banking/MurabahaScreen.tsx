import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { IslamicProduct } from '../../../services/islamic_banking_service';
import { islamicBankingService } from '../../../services/islamic_banking_service';

const MurabahaScreen: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IslamicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [assetName, setAssetName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [profitMargin, setProfitMargin] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await islamicBankingService.getMurabahaList());
    } catch { setError('Failed to load Murabaha contracts'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await islamicBankingService.applyMurabaha({
        asset_name: assetName,
        cost_price: parseFloat(costPrice),
        profit_margin: parseFloat(profitMargin),
        tenure_months: parseInt(tenureMonths),
      });
      setShowForm(false);
      setAssetName(''); setCostPrice(''); setProfitMargin(''); setTenureMonths('');
      load();
    } catch { alert('Failed to submit Murabaha application'); }
    finally { setSubmitting(false); }
  };

  const sellingPrice = costPrice && profitMargin
    ? parseFloat(costPrice) * (1 + parseFloat(profitMargin) / 100)
    : null;

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'pending') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'completed') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    if (s === 'cancelled') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/islamic-banking')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Murabaha</h1>
                <p className="text-white/70 text-sm">Cost-Plus Financing</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FiRefreshCw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-emerald-700 rounded-lg hover:bg-gray-100 font-semibold text-sm"
              >
                <FiPlus className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error} <button onClick={load} className="underline ml-2">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">🏪</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Murabaha Contracts</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">Apply for cost-plus asset financing</p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <FiPlus className="w-4 h-4" />
              <span>Apply Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{String(item.asset_name || '—')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ref: {item.reference_number ? String(item.reference_number) : item.id}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Cost Price</p>
                    <p className="font-semibold text-gray-900 dark:text-white">₦{Number(item.cost_price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Selling Price</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">₦{Number(item.selling_price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Profit Margin</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{String(item.profit_margin)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Tenure</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{String(item.tenure_months)} months</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 dark:text-gray-400">Monthly Instalment</p>
                    <p className="font-bold text-gray-900 dark:text-white text-lg">₦{Number(item.monthly_installment || 0).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  Applied: {new Date(item.application_date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Apply for Murabaha</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name</label>
                <input value={assetName} onChange={e => setAssetName(e.target.value)} required placeholder="e.g. Commercial Vehicle"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price (₦)</label>
                <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} required min="0" step="0.01" placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profit Margin (%)</label>
                <input type="number" value={profitMargin} onChange={e => setProfitMargin(e.target.value)} required min="0" max="100" step="0.1" placeholder="e.g. 15"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              {sellingPrice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">Selling Price: <strong>₦{sellingPrice.toLocaleString()}</strong></p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tenure (months)</label>
                <input type="number" value={tenureMonths} onChange={e => setTenureMonths(e.target.value)} required min="1" max="120" placeholder="e.g. 24"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MurabahaScreen;
