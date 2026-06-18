// import { useTenantConfig } from '../hooks/useTenantConfig';

/**
 * TenantIndicator - Small badge showing current tenant
 * Press Ctrl+Shift+T to open tenant switcher
 */
const TenantIndicator = () => {
  // ...existing code...

  // ...existing code...

  return (
    <div className="fixed top-4 right-4 z-40">
      {/* <div 
        className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-md border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs"
        onMouseEnter={() => setShowHint(true)}
        onMouseLeave={() => setShowHint(false)}
      >
        <div 
          className="w-2 h-2 rounded-full" 
          style={{ backgroundColor: tenant.branding.primary_color }}
        />
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {tenant.displayName}
        </span>
      </div>
      
      {showHint && (
        <div className="absolute top-full right-0 mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap animate-fadeIn">
          <div className="font-semibold mb-0.5">🎨 Switch Tenant</div>
          <div className="text-gray-300">Press <kbd className="px-1 bg-gray-700 rounded">Ctrl+Shift+T</kbd></div>
        </div>
      )} */}
    </div>
  );
};

export default TenantIndicator;
