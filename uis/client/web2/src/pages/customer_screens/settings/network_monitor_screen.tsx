import { useEffect, useState } from 'react';

interface NetworkStats {
  online: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

const NetworkMonitorScreen = () => {
  const [stats, setStats] = useState<NetworkStats>({
    online: navigator.onLine,
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
  });
  const [history, setHistory] = useState<Array<{ time: string; online: boolean }>>([]);

  useEffect(() => {
    // Update network status
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      setStats({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0,
      });
    };

    // Event listeners
    const handleOnline = () => {
      updateNetworkInfo();
      setHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), online: true }]);
    };

    const handleOffline = () => {
      updateNetworkInfo();
      setHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), online: false }]);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updateNetworkInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Network Monitor</h1>

        {/* Status Card */}
        <div className={`rounded-2xl p-6 shadow-lg mb-6 ${stats.online ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-sm opacity-90 mb-1">Network Status</p>
              <p className="text-3xl font-bold">{stats.online ? 'Online' : 'Offline'}</p>
            </div>
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              {stats.online ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Network Details */}
        {stats.online && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Connection Details</h2>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Connection Type</span>
                <span className="font-semibold text-gray-800 uppercase">{stats.effectiveType}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Downlink Speed</span>
                <span className="font-semibold text-gray-800">{stats.downlink} Mbps</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Round Trip Time</span>
                <span className="font-semibold text-gray-800">{stats.rtt} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Connection History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Connection History</h2>
            <div className="space-y-2">
              {history.slice(-10).reverse().map((event, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${event.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">{event.time}</span>
                  </div>
                  <span className={`text-sm font-semibold ${event.online ? 'text-green-600' : 'text-red-600'}`}>
                    {event.online ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-[var(--primary-color)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--primary-color)] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-[var(--primary-color)]">
              <p className="font-semibold mb-1">Network Monitor</p>
              <p>This tool helps you monitor your network connection status. The app works offline and will sync when connection is restored.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitorScreen;
