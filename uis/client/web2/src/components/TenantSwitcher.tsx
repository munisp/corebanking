import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { useTenant } from '../contexts/TenantContext';

/**
 * TenantSwitcher Component
 * Demo component for switching between different tenant configurations
 * Accessible via Ctrl+Shift+T keyboard shortcut or button
 */
const TenantSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { tenant, loadTenant } = useTenant();

  // Keyboard shortcut: Ctrl+Shift+T to toggle switcher visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsVisible(prev => !prev);
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show hint on first load
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('tenant-switcher-hint-seen');
    if (!hasSeenHint) {
      console.log('%c🎨 Tenant Switcher Available!', 'font-size: 16px; font-weight: bold; color: #3B82F6;');
      console.log('%cPress Ctrl+Shift+T to toggle tenant switcher', 'font-size: 14px; color: #10B981;');
      console.log('%cOr use: window.switchTenant("lilia") or window.switchTenant("54link-dev")', 'font-size: 12px; color: #6B7280;');
      localStorage.setItem('tenant-switcher-hint-seen', 'true');
    }
  }, []);

  const tenants = [
    { id: 'lilia', name: 'LILIA', theme: 'Red/Green', icon: '🔴' },
    { id: '54link-dev', name: '54link-dev', theme: 'Blue', icon: '🔵' },
  ];

  const handleSwitch = async (tenantId: string) => {
    await loadTenant(tenantId);
    setIsOpen(false);
    // Reload page to apply all changes
    window.location.reload();
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-white">Switch Tenant (Demo)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current: {tenant.displayName}</p>
          </div>
          <div className="p-2 max-h-64 overflow-y-auto">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSwitch(t.id)}
                className={`w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-1 ${
                  tenant.id === t.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800 dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.theme} Theme</p>
                  </div>
                  {tenant.id === t.id && (
                    <span className="text-green-500 text-xs">✓ Active</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-white font-semibold animate-bounce"
        style={{ backgroundColor: 'var(--primary-color)' }}
        title="Switch Tenant (Ctrl+Shift+T to hide)"
      >
        <FiRefreshCw size={20} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        <span className="hidden sm:inline">Tenant</span>
      </button>
      
      {/* Keyboard shortcut hint */}
      <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs px-3 py-1 rounded shadow-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        Press Ctrl+Shift+T to hide
      </div>
    </div>
  );
};

export default TenantSwitcher;
