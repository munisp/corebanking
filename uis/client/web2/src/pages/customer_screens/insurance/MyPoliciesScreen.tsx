import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiPlus, FiRefreshCw, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { InsurancePolicy } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const typeIcon: Record<string, string> = { health: '🏥', life: '❤️', auto: '🚗', travel: '🧳', crop: '🌾', flight: '🛫' };

const statusColor = (s: string) => {
  if (s === 'active') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'expired') return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const MyPoliciesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setPolicies(await insuranceService.getMyPolicies()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load your policies'); }
    finally { setLoading(false); }
  };

  const active = policies.filter(p => p.status === 'active').length;
  const totalCoverage = policies.reduce((s, p) => s + p.coverage_amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/insurance')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">My Policies</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
              <button onClick={() => navigate('/insurance/all-policies')} className="flex items-center space-x-2 px-4 py-2 bg-white text-indigo-700 rounded-lg hover:bg-gray-100 font-semibold text-sm">
                <FiPlus className="w-4 h-4" /><span>Browse</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Active Policies</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : active}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Total Coverage</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : `₦${(totalCoverage / 1000000).toFixed(1)}M`}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
        ) : policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
              <FiShield className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Policies Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Browse available policies and get covered</p>
            <button onClick={() => navigate('/insurance/all-policies')} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">Browse Policies</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {policies.map(policy => (
              <div key={policy.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1.5 ${policy.status === 'active' ? 'bg-green-500' : policy.status === 'pending' ? 'bg-orange-500' : 'bg-gray-400'}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{typeIcon[policy.policy_type] || '📄'}</div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{policy.display_name || policy.policy_type}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{policy.policy_type}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(policy.status)}`}>{policy.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div><p className="text-gray-400 dark:text-gray-500 text-xs">Coverage</p><p className="font-bold text-indigo-600 dark:text-indigo-400">₦{policy.coverage_amount.toLocaleString()}</p></div>
                    <div><p className="text-gray-400 dark:text-gray-500 text-xs">Premium</p><p className="font-semibold text-gray-900 dark:text-white">₦{policy.premium.toLocaleString()}/mo</p></div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FiCalendar className="w-3 h-3" />
                      <span>Expires: {new Date(policy.expiry_date).toLocaleDateString()}</span>
                    </div>
                    {policy.next_payment_date && (
                      <div className="flex items-center space-x-1">
                        <FiCalendar className="w-3 h-3" />
                        <span>Next payment: {new Date(policy.next_payment_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPoliciesScreen;
