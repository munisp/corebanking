import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../../services/agriculture_service';

const TABS = [
  'Overview',
  'Devices',
  'Orders',
  'Installations',
  'Readings',
  'Reports',
];

const AgTechScreen: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [overview, setOverview] = useState<any>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setSelectedInstallation] = useState<any>(null);
  const [loadingReadings, setLoadingReadings] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // These methods should exist in your service, adapt as needed
      const [overviewData, devicesData, ordersData, installationsData] = await Promise.all([
        agricultureService.getAgTechData?.() || {},
        agricultureService.getAgTechDevices(),
        agricultureService.getDeviceOrders(),
        agricultureService.getDeviceInstallations(),
      ]);
      setOverview(overviewData);
      setDevices(devicesData);
      setOrders(ordersData);
      setInstallations(installationsData);
      setReports(ordersData); // Placeholder for reports
      setReadings([]);
      setSelectedInstallation(null);
    } catch (e) {
      setError((e as Error).message || 'Failed to load AgTech data');
    } finally {
      setLoading(false);
    }
  };

  const loadReadingsForInstallation = async (installationId: string) => {
    setLoadingReadings(true);
    setSelectedInstallation(installationId);
    try {
      const allReadings = await agricultureService.getDeviceReadings?.() || [];
      setReadings(allReadings.filter((r: any) => r.installation_id === installationId));
    } catch {
      setReadings([]);
    } finally {
      setLoadingReadings(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-xl font-bold mb-4">AgTech Integration</h1>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`px-4 py-2 rounded ${tab === i ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border'}`}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>
        {loading && <div className="py-8 text-center">Loading...</div>}
        {error && <div className="py-8 text-center text-red-600">{error}</div>}
        {!loading && !error && (
          <div>
            {tab === 0 && (
              <div className="space-y-2">
                <div className="font-semibold">AgTech Overview</div>
                <div>Total Devices: {overview.TotalDevices || 0}</div>
                <div>Active Devices: {overview.ActiveDevices || 0}</div>
                <div>Total Orders: {overview.TotalOrders || 0}</div>
                <div>Pending Orders: {overview.PendingOrders || 0}</div>
                <div>Total Installations: {overview.TotalInstallations || 0}</div>
                <div>Farms With Tech: {overview.FarmsWithTech || 0}</div>
                <div>Total Readings: {overview.TotalReadings || 0}</div>
                <div>Reports Generated: {overview.ReportsGenerated || 0}</div>
              </div>
            )}
            {tab === 1 && (
              <div>
                <div className="font-semibold mb-2">Devices</div>
                {devices.length === 0 ? <div>No devices found.</div> : (
                  <ul className="space-y-2">
                    {devices.map((d, i) => (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded p-3 shadow flex gap-4">
                        {d.image_url && (
                          <img src={d.image_url} alt={d.name} className="w-16 h-16 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-lg">{d.name}</div>
                          <div className="text-xs text-gray-500 mb-1">Type: {d.type}</div>
                          <div className="text-xs text-gray-500 mb-1">Category: {d.category}</div>
                          <div className="text-xs text-gray-500 mb-1">Status: {d.status}</div>
                          <div className="text-xs text-gray-500 mb-1">Manufacturer: {d.manufacturer}</div>
                          <div className="text-xs text-gray-500 mb-1">Price: ₦{d.price}</div>
                          <div className="text-xs text-gray-500 mb-1">Rental Price: ₦{d.rental_price}</div>
                          <div className="text-xs text-gray-500 mb-1">Stock: {d.stock_quantity}</div>
                          <div className="text-xs text-gray-500 mb-1">Description: {d.description}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === 2 && (
              <div>
                <div className="font-semibold mb-2">Orders</div>
                {orders.length === 0 ? <div>No orders found.</div> : (
                  <ul className="space-y-2">
                    {orders.map((o, i) => (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded p-3 shadow">
                        <div className="font-bold">Order ID: {o.id}</div>
                        <div className="text-xs text-gray-500">Status: {o.status}</div>
                        <div className="text-xs text-gray-500">Device: {o.deviceId}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === 3 && (
              <div>
                <div className="font-semibold mb-2">Installations</div>
                {installations.length === 0 ? <div>No installations found.</div> : (
                  <ul className="space-y-2">
                    {installations.map((inst, i) => (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded p-3 shadow flex justify-between items-center">
                        <div>
                          <div className="font-bold">Installation ID: {inst.id || inst.installation_id}</div>
                          <div className="text-xs text-gray-500">Status: {inst.status}</div>
                        </div>
                        <button className="text-green-700 underline text-xs" onClick={() => loadReadingsForInstallation(inst.id || inst.installation_id)}>
                          View Readings
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === 4 && (
              <div>
                <div className="font-semibold mb-2">Readings</div>
                {loadingReadings && <div>Loading readings...</div>}
                {!loadingReadings && readings.length === 0 && <div>No readings found.</div>}
                {!loadingReadings && readings.length > 0 && (
                  <ul className="space-y-2">
                    {readings.map((r, i) => (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded p-3 shadow">
                        <div className="font-bold">Reading ID: {r.id || r.reading_id}</div>
                        <div className="text-xs text-gray-500">Value: {r.value}</div>
                        <div className="text-xs text-gray-500">Timestamp: {r.timestamp}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === 5 && (
              <div>
                <div className="font-semibold mb-2">Reports</div>
                {reports.length === 0 ? <div>No reports found.</div> : (
                  <ul className="space-y-2">
                    {reports.map((r, i) => (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded p-3 shadow">
                        <div className="font-bold">Order ID: {r.id}</div>
                        <div className="text-xs text-gray-500">Status: {r.status}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgTechScreen;
