
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';

// Types for stats (should match backend/mobile)
interface AgricultureStats {
  totalFarmers: number;
  totalFarms: number;
  totalDevices: number;
  totalOrders: number;
  installations: number;
  reports: number;
}

const AgricultureDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AgricultureStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API calls as in mobile app
      const [devices, orders, installs, farmsCount, farmersCount] = await Promise.all([
        agricultureService.getAgTechDevices(),
        agricultureService.getDeviceOrders(),
        agricultureService.getDeviceInstallations(),
        agricultureService.getFarmsCount(),
        agricultureService.getFarmersCount(),
      ]);
      setStats({
        totalFarmers: farmersCount,
        totalFarms: farmsCount,
        totalDevices: devices.length,
        totalOrders: orders.length,
        installations: installs.length,
        reports: orders.length, // No getDeviceReports, use orders as placeholder
      });
    } catch (e) {
      setError((e as Error).message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Farmers', route: '/agriculture/farmers', emoji: '👨‍🌾' },
    { label: 'Farms', route: '/agriculture/farms', emoji: '🌿' },
    { label: 'Loans', route: '/agriculture/loans', emoji: '💰' },
    { label: 'AgTech', route: '/agriculture/agtech', emoji: '📡' },
    { label: 'Weather & Prices', route: '/agriculture/weather', emoji: '🌦️' },
    { label: 'Farmer Products', route: '/agriculture/products', emoji: '🎫' },
    { label: 'Insurance', route: '/agriculture/insurance', emoji: '🛡️' },
    { label: 'Gov. Programs', route: '/agriculture/programs', emoji: '🏛️' },
    { label: 'My Impact', route: '/agriculture/impact', emoji: '🏆' },
    { label: 'Risk Alerts', route: '/agriculture/risk-alerts', emoji: '⚠️' },
    { label: 'Value Chain', route: '/agriculture/value-chain', emoji: '🔗' },
    { label: 'Proactive Risk', route: '/agriculture/proactive-risk', emoji: '🔮' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Agriculture Portfolio</h1>
          <button
            className="text-sm px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            onClick={loadStats}
            disabled={loading}
          >
            Export
          </button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-6">
            <div className="mb-2 font-semibold">{error}</div>
            <button className="text-green-700 underline" onClick={loadStats}>Retry</button>
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <MetricCard label="Total Farmers" value={stats.totalFarmers} />
            <MetricCard label="Total Farms" value={stats.totalFarms} />
            <MetricCard label="Total Devices" value={stats.totalDevices} />
            <MetricCard label="Total Orders" value={stats.totalOrders} />
            <MetricCard label="Installations" value={stats.installations} />
            <MetricCard label="Reports" value={stats.reports} />
          </div>
        )}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-green-700">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <div
                key={action.label}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col items-center cursor-pointer hover:bg-green-50 dark:hover:bg-green-900"
                onClick={() => navigate(action.route)}
              >
                <span className="text-2xl mb-2">{action.emoji}</span>
                <span className="text-sm font-medium text-green-700 text-center">{action.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col items-start">
    <span className="text-xs text-gray-500 mb-2 uppercase">{label}</span>
    <span className="text-2xl font-bold text-green-700">{value}</span>
  </div>
);

export default AgricultureDashboardScreen;
