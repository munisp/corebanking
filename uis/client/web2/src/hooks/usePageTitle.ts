import { useEffect } from 'react';
import { useTenantConfig } from './useTenantConfig';

/**
 * Hook to set page title with tenant name
 * Usage: usePageTitle('Dashboard') sets title to "Dashboard - Tenant Name"
 */
export const usePageTitle = (pageName: string) => {
  const { tenant } = useTenantConfig();

  useEffect(() => {
    // Get tenant name - try displayName first, then name as fallback
    const tenantName = tenant?.displayName || tenant?.name || '';
    
    if (pageName && tenantName) {
      document.title = `${pageName} - ${tenantName}`;
    } else if (tenantName) {
      document.title = tenantName;
    } else if (pageName) {
      // If tenant not loaded yet, just use page name temporarily
      document.title = pageName;
    }

    // Cleanup: restore default title when component unmounts
    return () => {
      const fallbackName = tenant?.displayName || tenant?.name || '';
      if (fallbackName) {
        document.title = fallbackName;
      }
    };
  }, [pageName, tenant?.displayName, tenant?.name]);
};

