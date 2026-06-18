import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService, type InsurancePolicy } from '../../../services/agriculture_service';

interface InsuranceProduct {
  product_id: string;
  name: string;
  type: string;
  coverage_amount: number;
  premium_rate: number;
  eligible_crops: string[];
  is_active: boolean;
  description?: string;
}

interface QuoteResult {
  premium: number;
  coverage_amount: number;
  start_date: string;
  end_date: string;
  terms?: string;
}

type ActiveTab = 'products' | 'quote' | 'policies';

const AgricultureInsuranceClientScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  const [quoteForm, setQuoteForm] = useState({
    farmer_id: '', farm_id: '', crop_type: '', coverage_amount: '', season: '',
  });
  const [purchaseProductId, setPurchaseProductId] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'policies') fetchPolicies();
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await agricultureService.getInsuranceProducts();
      setProducts(data as unknown as InsuranceProduct[]);
    } catch {
      setError('Failed to load insurance products');
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const data = await agricultureService.getInsurancePolicies();
      setPolicies(data);
    } catch {
      setError('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleGetQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.farmer_id || !quoteForm.coverage_amount) { setError('Farmer ID and coverage amount are required'); return; }
    setSubmitting(true);
    setError('');
    setQuoteResult(null);
    try {
      const result = await agricultureService.getInsuranceQuote({
        farmer_id: quoteForm.farmer_id,
        farm_id: quoteForm.farm_id,
        crop_type: quoteForm.crop_type,
        coverage_amount: Number(quoteForm.coverage_amount),
        season: quoteForm.season,
      });
      setQuoteResult(result as unknown as QuoteResult);
    } catch {
      setError('Failed to get insurance quote');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchase = async () => {
    if (!quoteResult || !quoteForm.farmer_id) { setError('Get a quote first'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.purchaseInsurance({
        farmer_id: quoteForm.farmer_id,
        farm_id: quoteForm.farm_id,
        crop_type: quoteForm.crop_type,
        coverage_amount: Number(quoteForm.coverage_amount),
        product_id: purchaseProductId,
        premium: quoteResult.premium,
      });
      setSuccess('Insurance policy purchased successfully!');
      setQuoteResult(null);
      setQuoteForm({ farmer_id: '', farm_id: '', crop_type: '', coverage_amount: '', season: '' });
    } catch {
      setError('Failed to purchase insurance');
    } finally {
      setSubmitting(false);
    }
  };

  const getPolicyStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'claimed') return 'bg-blue-100 text-blue-700';
    if (status === 'expired') return 'bg-gray-100 text-gray-600';
    return 'bg-yellow-100 text-yellow-700';
  };

  const tabs = [
    { key: 'products' as ActiveTab, label: 'Products', emoji: '🛡️' },
    { key: 'quote' as ActiveTab, label: 'Get Quote', emoji: '📋' },
    { key: 'policies' as ActiveTab, label: 'My Policies', emoji: '📄' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/agriculture')} className="text-gray-500 hover:text-gray-700 mr-2">←</button>
          <h1 className="text-xl font-bold">Agriculture Insurance</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-green-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm flex items-center gap-2">
            ✅ {success}
            <button className="ml-auto" onClick={() => setSuccess('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-center gap-2">
            ❌ {error}
            <button className="ml-auto" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Products */}
        {!loading && activeTab === 'products' && (
          <div className="space-y-3">
            {products.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-4xl mb-3">🛡️</p>
                <p>No insurance products available</p>
              </div>
            ) : (
              products.map((p, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-white">{p.name}</h3>
                      <span className="text-xs capitalize bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{p.type?.replace(/_/g, ' ')}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 mb-3">{p.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Max Coverage</p>
                      <p className="font-semibold text-gray-800 dark:text-white">₦{p.coverage_amount?.toLocaleString() || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Premium Rate</p>
                      <p className="font-semibold text-gray-800 dark:text-white">{p.premium_rate != null ? `${p.premium_rate}%` : '—'}</p>
                    </div>
                  </div>
                  {p.eligible_crops?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.eligible_crops.map((c, j) => (
                        <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{c}</span>
                      ))}
                    </div>
                  )}
                  {p.is_active && (
                    <button
                      onClick={() => { setPurchaseProductId(p.product_id); setActiveTab('quote'); }}
                      className="mt-3 w-full py-2 border border-green-600 text-green-600 rounded-lg text-sm font-medium hover:bg-green-50"
                    >
                      Get Quote →
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Quote */}
        {!loading && activeTab === 'quote' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Insurance Quote</h3>
              <form onSubmit={handleGetQuote} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Farmer ID *</label>
                    <input
                      type="text" value={quoteForm.farmer_id}
                      onChange={(e) => setQuoteForm({ ...quoteForm, farmer_id: e.target.value })}
                      placeholder="Your farmer ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Farm ID</label>
                    <input
                      type="text" value={quoteForm.farm_id}
                      onChange={(e) => setQuoteForm({ ...quoteForm, farm_id: e.target.value })}
                      placeholder="Farm ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Crop Type</label>
                    <select
                      value={quoteForm.crop_type}
                      onChange={(e) => setQuoteForm({ ...quoteForm, crop_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select crop</option>
                      {['Maize', 'Rice', 'Wheat', 'Sorghum', 'Cassava', 'Groundnut', 'Soybean', 'Cocoa'].map((c) => (
                        <option key={c} value={c.toLowerCase()}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Season</label>
                    <select
                      value={quoteForm.season}
                      onChange={(e) => setQuoteForm({ ...quoteForm, season: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select season</option>
                      <option value="wet_1">Wet Season 1</option>
                      <option value="wet_2">Wet Season 2</option>
                      <option value="dry">Dry Season</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Coverage Amount (₦) *</label>
                  <input
                    type="number" value={quoteForm.coverage_amount}
                    onChange={(e) => setQuoteForm({ ...quoteForm, coverage_amount: e.target.value })}
                    placeholder="e.g. 1000000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <button
                  type="submit" disabled={submitting}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Getting Quote...' : 'Get Quote'}
                </button>
              </form>
            </div>

            {quoteResult && (
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-5 shadow">
                <h4 className="font-bold text-lg mb-4">Your Quote</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-green-200 text-xs">Annual Premium</p>
                    <p className="text-2xl font-bold">₦{quoteResult.premium?.toLocaleString() || '—'}</p>
                  </div>
                  <div>
                    <p className="text-green-200 text-xs">Coverage Amount</p>
                    <p className="text-2xl font-bold">₦{quoteResult.coverage_amount?.toLocaleString() || '—'}</p>
                  </div>
                </div>
                {quoteResult.terms && <p className="text-green-100 text-xs mb-4">{quoteResult.terms}</p>}
                <button
                  onClick={handlePurchase}
                  disabled={submitting}
                  className="w-full py-3 bg-white text-green-700 rounded-lg font-bold hover:bg-green-50 disabled:opacity-50"
                >
                  {submitting ? 'Purchasing...' : '🛡️ Purchase Policy'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Policies */}
        {!loading && activeTab === 'policies' && (
          <div className="space-y-3">
            {policies.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-4xl mb-3">📄</p>
                <p>No insurance policies yet</p>
                <button
                  onClick={() => setActiveTab('quote')}
                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                >
                  Get a Quote
                </button>
              </div>
            ) : (
              policies.map((p, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{p.policyNumber}</p>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getPolicyStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Crop</p>
                      <p className="font-medium capitalize">{p.cropType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Coverage</p>
                      <p className="font-medium">₦{p.coverageAmount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Premium</p>
                      <p className="font-medium">₦{p.premium?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expires</p>
                      <p className="font-medium">{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgricultureInsuranceClientScreen;
