import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../services/agriculture_service';

const FisheriesAquacultureScreen: React.FC = () => {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ facilityName: '', ownerId: '', species: 'catfish', pondCount: '', loanAmount: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([agricultureService.getFisheriesAquacultureFacilities(), agricultureService.getFisheriesAquacultureStats()]);
      setRecords(r); setStats(s);
    } catch { /* use empty state */ }
    finally { setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await agricultureService.createFisheriesAquacultureFacility({ ...form, pondCount: parseInt(form.pondCount), loanAmount: parseFloat(form.loanAmount) }); setShowForm(false); load(); }
    catch { /* ignore */ }
  };

  const statusColor = (s: string) => ({ 'active': 'bg-green-100 text-green-700', 'pending_review': 'bg-yellow-100 text-yellow-700', 'initiated': 'bg-blue-100 text-blue-700' }[s] || 'bg-gray-100 text-gray-700');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-green-800 dark:text-green-300">Fisheries & Aquaculture</h1>
            <p className="text-xs text-gray-500 mt-1">Fish farm financing, pond management & production tracking</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">+ Register Facility</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Facilities', value: String(stats.totalFacilities ?? '-') },
            { label: 'Active Facilities', value: String(stats.activeFacilities ?? '-') },
            { label: 'Repayment Rate', value: `${stats.repaymentRate ?? '-'}%` },
            { label: 'Species Covered', value: String(stats.speciesCovered ?? '-') },
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
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{String(rec.facilityName || rec.id)}</div>
                  <div className="text-sm text-gray-500">{String(rec.species).toUpperCase()} · Owner: {String(rec.ownerId)}</div>
                  <div className="text-xs text-gray-400 mt-1">{String(rec.pondCount ?? '-')} ponds · Density: {String(rec.stockingDensity ?? '-')} fish/m²</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor(String(rec.status))}`}>{String(rec.status).replace(/_/g, ' ').toUpperCase()}</span>
                  <div className="text-sm font-semibold text-green-700 mt-1">₦{Number(rec.loanAmount ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md relative">
              <button className="absolute top-3 right-3 text-gray-400" onClick={() => setSelected(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 text-green-800">Facility Details</h2>
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
              <h2 className="text-lg font-bold mb-4 text-green-800">Register Fish Farm</h2>
              <form onSubmit={submit} className="space-y-3">
                <input required placeholder="Facility Name" value={form.facilityName} onChange={e => setForm(p => ({ ...p, facilityName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <input required placeholder="Owner / Cooperative ID" value={form.ownerId} onChange={e => setForm(p => ({ ...p, ownerId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <select value={form.species} onChange={e => setForm(p => ({ ...p, species: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  {['catfish', 'tilapia', 'carp', 'salmon', 'shrimp', 'prawn'].map(s => <option key={s}>{s}</option>)}
                </select>
                <input required type="number" placeholder="Number of Ponds" value={form.pondCount} onChange={e => setForm(p => ({ ...p, pondCount: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <input required type="number" placeholder="Loan Amount (₦)" value={form.loanAmount} onChange={e => setForm(p => ({ ...p, loanAmount: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold">Register</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FisheriesAquacultureScreen;
