import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../services/agriculture_service';

const AnimalTraceabilityScreen: React.FC = () => {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ animalId: '', species: 'cattle', breed: '', ownerId: '', location: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        agricultureService.getAnimalTraceabilityRecords(),
        agricultureService.getAnimalTraceabilityStats(),
      ]);
      setRecords(r);
      setStats(s);
    } catch { setError('Failed to load animal traceability data'); }
    finally { setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await agricultureService.createAnimalTraceabilityRecord(form);
      setShowForm(false);
      setForm({ animalId: '', species: 'cattle', breed: '', ownerId: '', location: '' });
      load();
    } catch { setError('Failed to register animal'); }
  };

  const healthColor = (s: string) => s === 'healthy' ? 'bg-green-100 text-green-700' : s === 'under_observation' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-green-800 dark:text-green-300">Animal ID Traceability</h1>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">+ Register Animal</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Animals', value: String(stats.totalAnimals ?? '-') },
            { label: 'Cattle', value: String(stats.cattle ?? '-') },
            { label: 'Healthy %', value: `${stats.healthyPercent ?? '-'}%` },
            { label: 'Vaccinated %', value: `${stats.vaccinationCurrent ?? '-'}%` },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow text-center">
              <div className="text-lg font-bold text-green-700">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {loading && <div className="py-8 text-center text-gray-500">Loading...</div>}
        {error && <div className="py-4 text-center text-red-600">{error}</div>}

        <div className="space-y-3">
          {records.map((rec, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border border-green-50 hover:border-green-300" onClick={() => setSelected(rec)}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{String(rec.animalId || rec.id)}</div>
                  <div className="text-sm text-gray-500">{String(rec.species)} — {String(rec.breed)}</div>
                  <div className="text-xs text-gray-400 mt-1">{String(rec.location)} · Owner: {String(rec.ownerId)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${healthColor(String(rec.healthStatus))}`}>
                  {String(rec.healthStatus).replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>Weight: {String(rec.weight ?? '-')} kg</span>
                <span>Vaccination: {String(rec.vaccinationStatus)}</span>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-700" onClick={() => setSelected(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Animal Details</h2>
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
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-700" onClick={() => setShowForm(false)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Register Animal</h2>
              <form onSubmit={submit} className="space-y-3">
                <input required placeholder="Animal Tag / ID" value={form.animalId} onChange={e => setForm(p => ({ ...p, animalId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <select value={form.species} onChange={e => setForm(p => ({ ...p, species: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  {['cattle', 'goats', 'sheep', 'pigs', 'poultry', 'camels'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input required placeholder="Breed" value={form.breed} onChange={e => setForm(p => ({ ...p, breed: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <input required placeholder="Owner ID / Farmer ID" value={form.ownerId} onChange={e => setForm(p => ({ ...p, ownerId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <input required placeholder="Location / State" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold">Register</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalTraceabilityScreen;
