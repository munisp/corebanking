import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { tenantService, type Tenant, type TenantBranding } from '../services/tenant';

interface TenantBrandingContextType {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  domain: string | null;
  isLoading: boolean;
}

const TenantBrandingContext = createContext<TenantBrandingContextType | undefined>(undefined);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // COMMENTED OUT: User role state
  // const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    // Apply config to React state + DOM (reads from localStorage cache).
    const applyConfig = (config: Tenant | null) => {
      setTenant(config);
      setIsLoading(false);
      if (!config?.branding) return;
      const root = document.documentElement;
      root.style.setProperty('--tenant-primary-color', config.branding.primary_color || '#3b82f6');
      root.style.setProperty('--tenant-secondary-color', config.branding.secondary_color || '#8b5cf6');
      if (config.branding.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = config.branding.favicon_url;
        } else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = config.branding.favicon_url;
          document.head.appendChild(newLink);
        }
      }
      if (config.name) document.title = `${config.name} - Admin Portal`;
    };

    // Show cached data immediately (no flash of loading state on revisit).
    applyConfig(tenantService.getTenantConfig());

    // Fetch fresh config from the API in the background so feature flags,
    // branding, and plan changes are picked up without a re-login.
    // setTenantConfig() dispatches "tenant_config_updated" on the same tab,
    // which is caught below, so applyConfig() runs again with fresh data.
    tenantService.refreshTenantConfig();

    // Re-apply whenever the config is written (same-tab via custom event,
    // or cross-tab via the native storage event).
    const handleUpdate = () => applyConfig(tenantService.getTenantConfig());
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tenant_config') handleUpdate();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tenant_config_updated', handleUpdate);

    // Background refresh every 5 minutes so newly-enabled features appear
    // in the sidebar without requiring a logout / page reload.
    const interval = setInterval(() => tenantService.refreshTenantConfig(), 5 * 60 * 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tenant_config_updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Use tenant branding from config (no role-based overrides)
  const branding = tenant?.branding || null;
  const name = tenant?.name || '54link-dev';
  const logoUrl = branding?.logo_url || null;
  const faviconUrl = branding?.favicon_url || null;
  const primaryColor = branding?.primary_color || '#3b82f6';
  const secondaryColor = branding?.secondary_color || '#8b5cf6';
  const domain = branding?.domain || null;

  return (
    <TenantBrandingContext.Provider
      value={{
        tenant,
        branding,
        name,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        domain,
        isLoading,
      }}
    >
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding() {
  const context = useContext(TenantBrandingContext);
  if (context === undefined) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return context;
}

