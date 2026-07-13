import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../../services/agriculture_service';

interface Farmer {
  id: string;
  name: string;
  phoneNumber: string;
  location: string;
  status: string;
  farmSize?: number;
  experience?: string;
}

const statusLabels = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
];

const FarmersScreen: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  useEffect(() => {
    loadFarmers();
    // eslint-disable-next-line
  }, [status]);

  const loadFarmers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agricultureService.getFarmers({ status: status || undefined });
      setFarmers(data);
    } catch (e) {
      setError((e as Error).message || 'Failed to load farmers');
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = farmers.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.id.toLowerCase().includes(search.toLowerCase()) ||
    (f.phoneNumber && f.phoneNumber.includes(search))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-xl font-bold mb-4">Farmers</h1>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="Search farmers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {statusLabels.map(s => (
            <button
              key={s.value}
              className={`px-3 py-1 rounded-full border ${status === s.value ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {loading && <div className="py-8 text-center">Loading...</div>}
        {error && <div className="py-8 text-center text-red-600">{error}</div>}
        {!loading && !error && filteredFarmers.length === 0 && (
          <div className="py-8 text-center text-gray-500">No farmers found</div>
        )}
        <div className="space-y-4">
          {filteredFarmers.map(farmer => (
            <div
              key={farmer.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border border-green-100 hover:border-green-400"
              onClick={() => setSelectedFarmer(farmer)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-lg">{farmer.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${farmer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{farmer.status.toUpperCase()}</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">ID: {farmer.id}</div>
              <div className="text-xs text-gray-500">Phone: {farmer.phoneNumber || '-'}</div>
            </div>
          ))}
        </div>
        {selectedFarmer && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-gray-500" onClick={() => setSelectedFarmer(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><span>Farmer Details</span></h2>
              <div className="space-y-2">
                <div><span className="font-semibold">Farmer ID:</span> {selectedFarmer.id}</div>
                <div><span className="font-semibold">Full Name:</span> {selectedFarmer.name}</div>
                <div><span className="font-semibold">Phone:</span> {selectedFarmer.phoneNumber || '-'}</div>
                <div><span className="font-semibold">Status:</span> {selectedFarmer.status}</div>
                <div><span className="font-semibold">Farm Size:</span> {selectedFarmer.farmSize || '-'}</div>
                <div><span className="font-semibold">Location:</span> {selectedFarmer.location || '-'}</div>
                <div><span className="font-semibold">Experience:</span> {selectedFarmer.experience || '-'}</div>
              </div>
              <div className="mt-6 text-right">
                <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={() => setSelectedFarmer(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmersScreen;
