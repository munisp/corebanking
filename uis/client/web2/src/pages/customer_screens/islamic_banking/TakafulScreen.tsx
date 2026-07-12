import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { IslamicProduct } from '../../../services/islamic_banking_service';
import { islamicBankingService } from '../../../services/islamic_banking_service';

const TakafulScreen: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IslamicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [policyType, setPolicyType] = useState('family');
  const [policyName, setPolicyName] = useState('');
  const [coverageAmount, setCoverageAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setItems(await islamicBankingService.getTakafulList()); }
    catch { setError('Failed to load Takaful policies'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await islamicBankingService.applyTakaful({ policy_type: policyType, policy_name: policyName, coverage_amount: parseFloat(coverageAmount), frequency });
      setShowForm(false); setPolicyType('family'); setPolicyName(''); setCoverageAmount(''); setFrequency('monthly');
      load();
    } catch { alert('Failed to submit Takaful application'); }
    finally { setSubmitting(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'pending') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (s === 'expired') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    if (s === 'cancelled') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/islamic-banking')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Takaful</h1>
                <p className="text-white/70 text-sm">Islamic Insurance</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
              <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-4 py-2 bg-white text-orange-700 rounded-lg hover:bg-gray-100 font-semibold text-sm">
                <FiPlus className="w-4 h-4" /><span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">🛡️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Takaful Policies</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Get protected with mutual Shariah-compliant insurance</p>
            <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              <FiPlus className="w-4 h-4" /><span>Apply Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{String(item.policy_name || '—')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{String(item.policy_type || '')} Takaful</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(item.status)}`}>{item.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-gray-500 dark:text-gray-400">Coverage</p><p className="font-semibold text-orange-600 dark:text-orange-400">₦{Number(item.coverage_amount || 0).toLocaleString()}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Contribution</p><p className="font-semibold text-gray-900 dark:text-white">₦{Number(item.contribution_amount || 0).toLocaleString()}</p></div>
                  <div className="col-span-2"><p className="text-gray-500 dark:text-gray-400">Frequency</p><p className="font-semibold text-gray-900 dark:text-white capitalize">{String(item.frequency || '—')}</p></div>
                </div>
                {Boolean(item.policy_start_date) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                    Active: {new Date(String(item.policy_start_date)).toLocaleDateString()} — {item.policy_end_date ? new Date(String(item.policy_end_date)).toLocaleDateString() : 'Ongoing'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Apply for Takaful</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Type</label>
                <select value={policyType} onChange={e => setPolicyType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="family">Family Takaful</option>
                  <option value="general">General Takaful</option>
                  <option value="health">Health Takaful</option>
                  <option value="motor">Motor Takaful</option>
                  <option value="property">Property Takaful</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Name</label>
                <input value={policyName} onChange={e => setPolicyName(e.target.value)} required placeholder="e.g. Family Comprehensive Plan"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coverage Amount (₦)</label>
                <input type="number" value={coverageAmount} onChange={e => setCoverageAmount(e.target.value)} required min="0" step="0.01" placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contribution Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value as typeof frequency)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold">{submitting ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakafulScreen;
