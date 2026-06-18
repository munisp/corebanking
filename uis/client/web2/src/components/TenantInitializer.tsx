import { useEffect, useState } from 'react';
import { AppConfig } from '../config/app_config';
import { useTenant } from '../contexts/TenantContext';
import { TenantService } from '../services/tenant_service';

/**
 * TenantInitializer component
 * Handles tenant configuration loading on app startup
 * Checks URL params -> localStorage -> defaults to '54link-dev'
 */
export const TenantInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loadTenant, tenant } = useTenant();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeTenant = async () => {
      try {
        // Priority 1: Check URL for tenant parameter
        const urlTenantId = TenantService.getTenantIdFromURL();

        // Priority 2: Use configured default (env var) — this is the canonical tenant for this deployment
        const defaultTenantId = AppConfig.DEFAULT_TENANT_ID || '54link-dev';

        // Priority 3: Saved tenant from localStorage (only used when no explicit default is configured)
        const savedTenantId = TenantService.getTenantId();

        // If cached tenant doesn't match the configured default, clear stale cache
        if (!urlTenantId && savedTenantId && savedTenantId !== defaultTenantId) {
          TenantService.clearTenantConfig();
        }

        const tenantId = urlTenantId || defaultTenantId;

        console.log(`Loading tenant: ${tenantId}`);
        await loadTenant(tenantId);
      } catch (error) {
        console.error('Failed to initialize tenant:', error);
        // Continue with default tenant on error
      } finally {
        setIsInitialized(true);
      }
    };

    initializeTenant();
  }, [loadTenant]);

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        style={{
          background: `linear-gradient(135deg, ${tenant.branding.primary_color} 0%, ${tenant.branding.secondary_color} 100%)`
        }}
      >
        <div className="text-center">
          {/* Logo */}
          <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center shadow-2xl mx-auto mb-6">
            {tenant.logo ? (
              <img src={tenant.logo} alt={tenant.displayName} className="w-16 h-16 object-contain" />
            ) : (
              <span className="text-4xl font-bold" style={{ color: tenant.branding.primary_color }}>
                {tenant.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          
          {/* App Name */}
          <h1 className="text-3xl font-bold text-white mb-6">{tenant.displayName}</h1>
          
          {/* Spinner */}
          <div 
            className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"
            style={{ borderTopColor: 'transparent' }}
          ></div>
          <p className="text-white text-opacity-90">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
