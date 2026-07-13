import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../services/agriculture_service';

const SoilAnalysisScreen: React.FC = () => {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ farmId: '', sampleDate: '', soilType: 'loamy', lab: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([agricultureService.getSoilAnalysisReports(), agricultureService.getSoilAnalysisStats()]);
      setRecords(r); setStats(s);
    } catch { /* use empty state */ }
    finally { setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await agricultureService.createSoilAnalysisReport(form); setShowForm(false); load(); }
    catch { /* ignore */ }
  };

  const fertilityColor = (fi: string) => ({ 'high': 'bg-green-100 text-green-700', 'medium': 'bg-yellow-100 text-yellow-700', 'low': 'bg-red-100 text-red-700' }[fi] || 'bg-gray-100 text-gray-700');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-green-800 dark:text-green-300">Soil Analysis</h1>
            <p className="text-xs text-gray-500 mt-1">NPK, pH, organic matter & fertility index from certified labs</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">+ Submit Sample</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Samples', value: String(stats.totalSamples ?? '-') },
            { label: 'Avg pH', value: String(stats.avgPH ?? '-') },
            { label: 'High Fertility', value: `${stats.highFertility ?? '-'}%` },
            { label: 'Labs Partnered', value: String(stats.labsPartnered ?? '-') },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow text-center">
              <div className="text-lg font-bold text-green-700">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {loading && <div className="py-8 text-center text-gray-500">Loading...</div>}

        <div className="space-y-3">
          {records.map((rec, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border border-green-50 hover:border-green-300" onClick={() => setSelected(rec)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold">{String(rec.farmId)}</div>
                  <div className="text-sm text-gray-500">Sampled {String(rec.sampleDate)} · {String(rec.lab)} · {String(rec.soilType)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${fertilityColor(String(rec.fertilityIndex))}`}>
                  {String(rec.fertilityIndex).toUpperCase()} FERTILITY
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div className="bg-gray-50 rounded p-2 text-center"><div className="font-bold text-blue-700">{String(rec.ph)}</div><div className="text-gray-400">pH</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="font-bold text-green-700">{String(rec.nitrogen)}</div><div className="text-gray-400">N (ppm)</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="font-bold text-orange-700">{String(rec.phosphorus)}</div><div className="text-gray-400">P (ppm)</div></div>
                <div className="bg-gray-50 rounded p-2 text-center"><div className="font-bold text-purple-700">{String(rec.potassium)}</div><div className="text-gray-400">K (ppm)</div></div>
              </div>
              {!!rec.recommendation && (
                <div className="text-xs bg-amber-50 text-amber-800 rounded p-2 border border-amber-200">{String(rec.recommendation)}</div>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400" onClick={() => setSelected(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Soil Analysis Report</h2>
              <div className="space-y-2 text-sm">
                {Object.entries(selected).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-1">
                    <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full py-2 bg-green-600 text-white rounded-lg" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400" onClick={() => setShowForm(false)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Submit Soil Sample</h2>
              <form onSubmit={submit} className="space-y-3">
                <input required placeholder="Farm ID" value={form.farmId} onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <input required type="date" value={form.sampleDate} onChange={e => setForm(p => ({ ...p, sampleDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <select value={form.soilType} onChange={e => setForm(p => ({ ...p, soilType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  {['loamy', 'clay', 'sandy', 'silt', 'peaty'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input required placeholder="Lab Name (e.g. NASC Kaduna)" value={form.lab} onChange={e => setForm(p => ({ ...p, lab: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold">Submit Sample</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoilAnalysisScreen;
