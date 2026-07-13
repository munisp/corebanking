import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { InsuranceTemplate } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const typeIcon: Record<string, string> = {
  crop_weather: '🌾', flight_delay: '✈️', health: '🏥',
  life: '❤️', auto: '🚗', travel: '🧳',
};

const statusColor = (s: string) => {
  if (s === 'active') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'expired') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const FILTERS = ['all', 'health', 'life', 'auto', 'travel', 'crop_weather', 'flight_delay'];

const AllPoliciesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<InsuranceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setPolicies(await insuranceService.getAllPolicyTemplates()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load policies'); }
    finally { setLoading(false); }
  };

  const filtered = filter === 'all' ? policies : policies.filter(p => p.insurance_type.toLowerCase().includes(filter));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/insurance')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Policy Templates</h1>
            </div>
            <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-white text-blue-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">No policies found for this filter.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(policy => (
              <div key={policy.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{typeIcon[policy.insurance_type] || '📄'}</div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(policy.status)}`}>{policy.status}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">{policy.display_name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 capitalize">{policy.insurance_type.replace('_', ' ')}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                    <div><p className="text-gray-400 dark:text-gray-500">Coverage</p><p className="font-semibold text-gray-900 dark:text-white">₦{policy.coverage_amount.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 dark:text-gray-500">Premium</p><p className="font-semibold text-gray-900 dark:text-white">₦{policy.premium_amount.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 dark:text-gray-500">Duration</p><p className="font-semibold text-gray-900 dark:text-white">{policy.duration_months}mo</p></div>
                  </div>
                  {Object.keys(policy.trigger_conditions || {}).length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs">
                      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Trigger Conditions:</p>
                      {Object.entries(policy.trigger_conditions).map(([k, v]) => (
                        <p key={k} className="text-gray-500 dark:text-gray-400">• {k}: {v}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => navigate('/insurance/apply', { state: { template: policy } })}
                    className="w-full py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 font-semibold text-sm transition-opacity">
                    Apply for this Policy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllPoliciesScreen;
