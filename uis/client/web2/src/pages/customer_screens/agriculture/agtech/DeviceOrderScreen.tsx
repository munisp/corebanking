import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiMinus, FiPlus, FiShoppingCart } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { agricultureService, type AgTechDevice } from '../../../../services/agriculture_service';

const DeviceOrderScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preselected = location.state?.device as AgTechDevice | undefined;

  const [devices, setDevices] = useState<AgTechDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(!preselected);
  const [selectedDevice, setSelectedDevice] = useState<AgTechDevice | null>(preselected ?? null);
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preselected) {
      agricultureService.getAgTechDevices()
        .then(data => setDevices(data.filter(d => d.status === 'available')))
        .catch(() => {/* non-fatal */})
        .finally(() => setLoadingDevices(false));
    }
  }, [preselected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedDevice) { setError('Please select a device'); return; }
    if (!deliveryAddress.trim()) { setError('Delivery address is required'); return; }

    setSubmitting(true);
    try {
      await agricultureService.createDeviceOrder({
        deviceId: selectedDevice.id,
        quantity,
        totalPrice: selectedDevice.price * quantity,
      });
      navigate('/agriculture/agtech');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-lime-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/agriculture/agtech')} className="p-2 hover:bg-white/10 rounded-full">
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Order Device</h1>
              <p className="text-white/70 text-sm">Agricultural IoT equipment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Device Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Select Device</h2>
            {loadingDevices ? (
              <div className="text-sm text-gray-400 dark:text-gray-500">Loading devices...</div>
            ) : preselected ? (
              <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-xl">
                <span className="text-2xl">📡</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{preselected.deviceName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{preselected.manufacturer} · {preselected.model}</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">₦{preselected.price.toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No devices available</p>
                ) : devices.map(device => (
                  <button key={device.id} type="button" onClick={() => setSelectedDevice(device)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl border-2 transition-colors text-left ${selectedDevice?.id === device.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                    <span className="text-2xl">📡</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{device.deviceName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{device.manufacturer} · {device.deviceType}</p>
                    </div>
                    <p className="font-bold text-green-700 dark:text-green-400 text-sm">₦{device.price.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Quantity</h2>
            <div className="flex items-center space-x-4">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600">
                <FiMinus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
              <span className="text-2xl font-bold text-gray-900 dark:text-white w-12 text-center">{quantity}</span>
              <button type="button" onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600">
                <FiPlus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Delivery Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Address</label>
              <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} required rows={2}
                placeholder="Enter full delivery address..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special instructions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
          </div>

          {/* Order Summary */}
          {selectedDevice && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Order Summary</h3>
              <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                <p>Device: <strong>{selectedDevice.deviceName}</strong></p>
                <p>Quantity: <strong>{quantity}</strong></p>
                <p>Unit Price: <strong>₦{selectedDevice.price.toLocaleString()}</strong></p>
                <div className="border-t border-green-200 dark:border-green-700 pt-2 mt-2">
                  <p className="text-base font-bold">Total: <strong>₦{(selectedDevice.price * quantity).toLocaleString()}</strong></p>
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting || !selectedDevice}
            className="w-full py-4 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-lg disabled:opacity-50 transition-colors">
            <FiShoppingCart className="w-5 h-5 inline mr-2" />
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DeviceOrderScreen;
