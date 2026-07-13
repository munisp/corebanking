import { useEffect, useState } from 'react';
import { FiArrowLeft, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTenantConfig } from '../../../hooks/useTenantConfig';

interface CarbonCredit {
  id: string;
  quantity: number;
  status: string;
  price_per_credit?: number;
  total_amount?: number;
}

interface CarbonTrade {
  id: string;
  trade_type: 'purchase' | 'sale' | 'transfer';
  quantity: number;
  status: string;
}

const QUICK_ACTIONS = [
  { label: 'Footprint', emoji: '📊', path: '/carbon-credits/footprints' },
  { label: 'Projects', emoji: '🌿', path: '/carbon-credits/projects' },
  { label: 'My Trades', emoji: '📈', path: '/carbon-credits/trades' },
];

const CarbonCreditsScreen = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useTenantConfig();
  const [credits, setCredits] = useState<CarbonCredit[]>([]);
  const [trades, setTrades] = useState<CarbonTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [creditsRes, tradesRes] = await Promise.all([
        apiService.get('/carbon/api/v1/carbon/credits'),
        apiService.get('/carbon/api/v1/carbon/trades'),
      ]);
      const extractList = (data: unknown): unknown[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
          const d = data as Record<string, unknown>;
          return (Array.isArray(d.credits) ? d.credits : Array.isArray(d.trades) ? d.trades : Array.isArray(d.data) ? d.data : []);
        }
        return [];
      };
      setCredits(extractList(creditsRes.data) as CarbonCredit[]);
      setTrades(extractList(tradesRes.data) as CarbonTrade[]);
    } catch {
      // non-fatal: show zeros
    } finally {
      setLoading(false);
    }
  };

  const totalCredits = credits.filter(c => c.status !== 'retired').reduce((s, c) => s + (c.quantity || 0), 0);
  const purchasedTons = trades
    .filter(t => t.trade_type === 'purchase' && t.status === 'completed')
    .reduce((s, t) => s + (t.quantity || 0), 0);
  const co2Offset = parseFloat((purchasedTons * 0.5).toFixed(2));

  if (!isFeatureEnabled('carbon_credits')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🌿</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Carbon Credits Not Available</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">The carbon credits feature is not enabled for your account. Contact support to enable this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-teal-500 pt-4 pb-8">
        <div className="px-4 flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-gray-200"
          >
            <FiArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Carbon Credits</h1>
            <p className="text-sm text-green-100">Offset your carbon footprint</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-white hover:text-gray-200">
              <FiRefreshCw size={20} />
            </button>
            <span className="text-3xl">🌍</span>
          </div>
        </div>

        {/* Stats Card */}
        <div className="px-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/80 text-sm mb-1">Your Credits</p>
                <p className="text-white text-3xl font-bold">
                  {loading ? '—' : totalCredits.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-white/80 text-sm mb-1">CO₂ Offset</p>
                <p className="text-white text-3xl font-bold">
                  {loading ? '—' : `${co2Offset}t`}
                </p>
              </div>
            </div>
            {!loading && totalCredits > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <FiCheckCircle size={16} />
                  <span>You're making a difference! 🌱</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-4 mb-6 grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl block mb-1">{action.emoji}</span>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{action.label}</p>
          </button>
        ))}
      </div>

      {/* What are Carbon Credits */}
      <div className="px-4 mb-6">
        <div className="bg-blue-50 dark:bg-gray-800 rounded-xl p-4 border border-blue-100 dark:border-gray-700 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">What are Carbon Credits?</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Carbon credits represent a reduction of one ton of CO₂ emissions. By purchasing
            credits, you support verified environmental projects that reduce greenhouse gases.
          </p>
        </div>
      </div>

      {/* Environmental Impact */}
      {co2Offset > 0 && (
        <div className="px-4 py-2">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-5 border border-green-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Your Environmental Impact</h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 shrink-0" size={16} />
                <span>Equivalent to planting {Math.round(co2Offset * 50)} trees</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 shrink-0" size={16} />
                <span>Saves energy for {Math.round(co2Offset * 10)} homes/year</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600 shrink-0" size={16} />
                <span>Prevents {Math.round(co2Offset * 2700)} kg of waste</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA to browse projects */}
      <div className="px-4 mt-6">
        <button
          onClick={() => navigate('/carbon-credits/projects')}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold transition-colors"
        >
          Browse Carbon Projects
        </button>
      </div>
    </div>
  );
};

export default CarbonCreditsScreen;
