import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { IslamicProduct } from '../../../services/islamic_banking_service';
import { islamicBankingService } from '../../../services/islamic_banking_service';

const MusharakaScreen: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IslamicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [customerContribution, setCustomerContribution] = useState('');
  const [bankContribution, setBankContribution] = useState('');
  const [customerProfitShare, setCustomerProfitShare] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await islamicBankingService.getMushараkaList());
    } catch { setError('Failed to load Musharaka partnerships'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await islamicBankingService.applyMusharaka({
        business_name: businessName,
        customer_contribution: parseFloat(customerContribution),
        bank_contribution: parseFloat(bankContribution),
        customer_profit_share: parseFloat(customerProfitShare),
      });
      setShowForm(false);
      setBusinessName(''); setCustomerContribution(''); setBankContribution(''); setCustomerProfitShare('');
      load();
    } catch { alert('Failed to submit Musharaka application'); }
    finally { setSubmitting(false); }
  };

  const totalCapital = customerContribution && bankContribution
    ? parseFloat(customerContribution) + parseFloat(bankContribution)
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
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/islamic-banking')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Musharaka</h1>
                <p className="text-white/70 text-sm">Partnership Financing</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FiRefreshCw className="w-5 h-5 text-white" />
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-gray-100 font-semibold text-sm">
                <FiPlus className="w-4 h-4" /><span>Apply</span>
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
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">🤝</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Musharaka Partnerships</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start a joint venture with Shariah-compliant partnership financing</p>
            <button onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <FiPlus className="w-4 h-4" /><span>Apply Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{String(item.business_name || '—')}</h3>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(item.status)}`}>{item.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Your Contribution</p>
                    <p className="font-semibold text-gray-900 dark:text-white">₦{Number(item.customer_contribution || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Bank Contribution</p>
                    <p className="font-semibold text-gray-900 dark:text-white">₦{Number(item.bank_contribution || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Total Capital</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">₦{Number(item.total_capital || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Your Profit Share</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{Number(item.customer_profit_share || 0)}%</p>
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

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Apply for Musharaka</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: 'Business Name', value: businessName, setter: setBusinessName, type: 'text', placeholder: 'e.g. Halal Supermarket' },
                { label: 'Your Contribution (₦)', value: customerContribution, setter: setCustomerContribution, type: 'number', placeholder: '0.00' },
                { label: 'Bank Contribution (₦)', value: bankContribution, setter: setBankContribution, type: 'number', placeholder: '0.00' },
                { label: 'Your Profit Share (%)', value: customerProfitShare, setter: setCustomerProfitShare, type: 'number', placeholder: 'e.g. 50' },
              ].map(({ label, value, setter, type, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                  <input type={type} value={value} onChange={e => setter(e.target.value)} required placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              {totalCapital && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">Total Capital: <strong>₦{totalCapital.toLocaleString()}</strong></p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold">
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

export default MusharakaScreen;
