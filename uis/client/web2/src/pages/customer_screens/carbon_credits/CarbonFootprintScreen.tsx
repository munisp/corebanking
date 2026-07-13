import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';

interface CarbonFootprint {
  id: string;
  category: string;
  activity: string;
  emissions: number;
  unit: string;
  date: string;
  notes?: string;
  created_at?: string;
}

const categoryIcon: Record<string, string> = {
  transport: '🚗', energy: '⚡', food: '🍽️', shopping: '🛍️', travel: '✈️', other: '🌍',
};

const CarbonFootprintScreen: React.FC = () => {
  const navigate = useNavigate();
  const [footprints, setFootprints] = useState<CarbonFootprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: 'transport', activity: '', emissions: '', unit: 'kg CO₂', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.get('/carbon/api/v1/carbon/footprints');
      const data = res.data as Record<string, unknown> | unknown[];
      const list = Array.isArray(data) ? data : ((data as Record<string, unknown>).footprints || (data as Record<string, unknown>).data || []) as unknown[];
      setFootprints(list as CarbonFootprint[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load footprints');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiService.post('/carbon/api/v1/carbon/footprints', {
        category: form.category,
        activity: form.activity,
        emissions: parseFloat(form.emissions),
        unit: form.unit,
        date: form.date,
        notes: form.notes,
      });
      setShowForm(false);
      setForm({ category: 'transport', activity: '', emissions: '', unit: 'kg CO₂', date: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const totalEmissions = footprints.reduce((s, f) => s + (f.emissions || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-green-700 to-teal-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/carbon-credits')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Carbon Footprint</h1>
                <p className="text-white/70 text-sm">Track your emissions</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
              <button onClick={() => setShowForm(true)} className="flex items-center space-x-1 px-3 py-2 bg-white text-green-700 rounded-lg text-sm font-semibold hover:bg-gray-100">
                <FiPlus className="w-4 h-4" /><span>Add</span>
              </button>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/70 text-sm">Total Emissions Tracked</p>
            <p className="text-3xl font-bold text-white">{loading ? '—' : `${totalEmissions.toFixed(2)} kg CO₂`}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full"></div></div>
        ) : footprints.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🌍</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Footprints Logged</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start tracking your carbon emissions</p>
            <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-green-700 text-white rounded-xl font-semibold">
              <FiPlus className="w-4 h-4 inline mr-2" />Log Footprint
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {footprints.map(fp => (
              <div key={fp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl">
                    {categoryIcon[fp.category?.toLowerCase()] || '🌍'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{fp.activity}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{fp.category} · {fp.date ? new Date(fp.date).toLocaleDateString() : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700 dark:text-green-400">{fp.emissions} {fp.unit || 'kg CO₂'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Footprint Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Log Carbon Footprint</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500">
                  {Object.keys(categoryIcon).map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity</label>
                <input value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} required
                  placeholder="e.g. Driving to work"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emissions</label>
                  <input type="number" value={form.emissions} onChange={e => setForm(f => ({ ...f, emissions: e.target.value }))} required min="0" step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>kg CO₂</option><option>tons CO₂</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarbonFootprintScreen;
