import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../services/agriculture_service';

const SatelliteCropMonitorScreen: React.FC = () => {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ farmId: '', cropType: 'maize' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([agricultureService.getSatelliteCropMonitorReadings(), agricultureService.getSatelliteCropMonitorStats()]);
      setRecords(r); setStats(s);
    } catch { /* use empty state */ }
    finally { setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await agricultureService.createSatelliteCropMonitorScan(form); setShowForm(false); load(); }
    catch { /* ignore */ }
  };

  const ndviBar = (n: number) => {
    const pct = Math.round(n * 100);
    const color = n >= 0.7 ? 'bg-green-500' : n >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono text-gray-600">{n}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-green-800 dark:text-green-300">Satellite Crop Monitor</h1>
            <p className="text-xs text-gray-500 mt-1">Real-time NDVI & crop health from Sentinel-2 & Planet Labs</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">+ Request Scan</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Farms Monitored', value: String(stats.totalFarmsMonitored ?? '-') },
            { label: 'Avg NDVI', value: String(stats.avgNDVI ?? '-') },
            { label: 'Health Alerts', value: String(stats.healthAlerts ?? '-') },
            { label: 'Critical Alerts', value: String(stats.criticalAlerts ?? '-') },
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
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{String(rec.farmId)}</div>
                  <div className="text-sm text-gray-500">{String(rec.cropType).toUpperCase()} · {String(rec.growthStage)} · {String(rec.monitorDate)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-700">{String(rec.healthScore)}<span className="text-xs">/100</span></div>
                  <div className="text-xs text-gray-400">{String(rec.satelliteSource)}</div>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-1">NDVI Health Index</div>
                {ndviBar(Number(rec.ndvi ?? 0))}
              </div>
              {Array.isArray(rec.stressIndicators) && rec.stressIndicators.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(rec.stressIndicators as string[]).map((s, j) => (
                    <span key={j} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{s.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
              {!!rec.recommendation && (
                <div className="mt-2 text-xs bg-blue-50 text-blue-700 rounded p-2">{String(rec.recommendation)}</div>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400" onClick={() => setSelected(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Satellite Scan Details</h2>
              <div className="space-y-2 text-sm">
                {Object.entries(selected).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-1">
                    <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-medium">{Array.isArray(v) ? (v as string[]).join(', ') || 'None' : String(v)}</span>
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
              <h2 className="text-lg font-bold mb-4 text-green-800">Request Satellite Scan</h2>
              <form onSubmit={submit} className="space-y-3">
                <input required placeholder="Farm ID" value={form.farmId} onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <select value={form.cropType} onChange={e => setForm(p => ({ ...p, cropType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  {['maize', 'rice', 'soybeans', 'sorghum', 'wheat', 'cassava', 'yam'].map(c => <option key={c}>{c}</option>)}
                </select>
                <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold">Request Scan</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SatelliteCropMonitorScreen;
