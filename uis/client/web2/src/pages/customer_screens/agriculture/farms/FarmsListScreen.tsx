import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../../services/agriculture_service';

interface Farm {
  id: string;
  farmerId: string;
  location: string;
  size: number;
  soilType?: string;
  irrigationType?: string;
  landTitleNumber?: string;
  currentCrop?: string;
}

const FarmsListScreen: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agricultureService.getFarms();
      setFarms(data);
    } catch (e) {
      setError((e as Error).message || 'Failed to load farms');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-xl font-bold mb-4">Farms List</h1>
        {loading && <div className="py-8 text-center">Loading...</div>}
        {error && <div className="py-8 text-center text-red-600">{error}</div>}
        {!loading && !error && farms.length === 0 && (
          <div className="py-8 text-center text-gray-500">No farms found.</div>
        )}
        <div className="space-y-4">
          {farms.map(farm => (
            <div
              key={farm.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border border-green-100 hover:border-green-400"
              onClick={() => setSelectedFarm(farm)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-lg">{farm.location || 'Unknown Location'}</span>
                <span className="text-xs text-gray-500">{farm.farmerId}</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">Size: {farm.size} hectares</div>
              <div className="text-xs text-gray-500">Current Crop: {farm.currentCrop || '-'}</div>
            </div>
          ))}
        </div>
        {selectedFarm && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-gray-500" onClick={() => setSelectedFarm(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><span>Farm Details</span></h2>
              <div className="space-y-2">
                <div><span className="font-semibold">Farmer ID:</span> {selectedFarm.farmerId}</div>
                <div><span className="font-semibold">Location:</span> {selectedFarm.location}</div>
                <div><span className="font-semibold">Size:</span> {selectedFarm.size} hectares</div>
                <div><span className="font-semibold">Soil Type:</span> {selectedFarm.soilType || '-'}</div>
                <div><span className="font-semibold">Irrigation Type:</span> {selectedFarm.irrigationType || '-'}</div>
                <div><span className="font-semibold">Land Title Number:</span> {selectedFarm.landTitleNumber || '-'}</div>
                <div><span className="font-semibold">Current Crop:</span> {selectedFarm.currentCrop || '-'}</div>
              </div>
              <div className="mt-6 text-right">
                <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={() => setSelectedFarm(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmsListScreen;
