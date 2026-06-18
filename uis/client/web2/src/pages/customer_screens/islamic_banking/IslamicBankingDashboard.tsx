import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import type { IslamicProduct } from '../../../services/islamic_banking_service';
import { islamicBankingService } from '../../../services/islamic_banking_service';

interface Summary {
  murabaha: IslamicProduct[];
  musharaka: IslamicProduct[];
  ijara: IslamicProduct[];
  takaful: IslamicProduct[];
  sukuk: IslamicProduct[];
}

const products = [
  {
    key: 'murabaha',
    title: 'Murabaha',
    subtitle: 'Cost-Plus Financing',
    description: 'Purchase assets with transparent profit margin',
    icon: '🏪',
    color: 'from-emerald-500 to-teal-600',
    path: '/islamic-banking/murabaha',
  },
  {
    key: 'musharaka',
    title: 'Musharaka',
    subtitle: 'Partnership Financing',
    description: 'Share profits and losses in a joint venture',
    icon: '🤝',
    color: 'from-blue-500 to-indigo-600',
    path: '/islamic-banking/musharaka',
  },
  {
    key: 'ijara',
    title: 'Ijara',
    subtitle: 'Islamic Leasing',
    description: 'Lease assets under Shariah-compliant terms',
    icon: '🏗️',
    color: 'from-violet-500 to-purple-600',
    path: '/islamic-banking/ijara',
  },
  {
    key: 'takaful',
    title: 'Takaful',
    subtitle: 'Islamic Insurance',
    description: 'Mutual protection based on shared responsibility',
    icon: '🛡️',
    color: 'from-orange-500 to-amber-600',
    path: '/islamic-banking/takaful',
  },
  {
    key: 'sukuk',
    title: 'Sukuk',
    subtitle: 'Islamic Bonds',
    description: 'Earn returns through asset-backed investments',
    icon: '📈',
    color: 'from-rose-500 to-pink-600',
    path: '/islamic-banking/sukuk',
  },
];

const IslamicBankingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadSummary(); }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await islamicBankingService.getAllProducts();
      setSummary(data);
    } catch {
      setError('Failed to load Islamic banking products');
    } finally {
      setLoading(false);
    }
  };

  const totalActive = summary
    ? Object.values(summary).flat().filter(p => p.status === 'active').length
    : 0;

  const totalProducts = summary
    ? Object.values(summary).flat().length
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Islamic Banking</h1>
                <p className="text-white/70 text-sm">Shariah-compliant financial products</p>
              </div>
            </div>
            <button onClick={loadSummary} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <FiRefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Total Products</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : totalProducts}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Active</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : totalActive}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const count = summary ? (summary[product.key as keyof Summary] || []).length : 0;
            const activeCount = summary
              ? (summary[product.key as keyof Summary] || []).filter(p => p.status === 'active').length
              : 0;

            return (
              <button
                key={product.key}
                onClick={() => navigate(product.path)}
                className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden group"
              >
                <div className={`h-2 bg-gradient-to-r ${product.color}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{product.icon}</div>
                    {!loading && count > 0 && (
                      <span className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium">
                        {activeCount} active
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{product.title}</h3>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">{product.subtitle}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IslamicBankingDashboard;
