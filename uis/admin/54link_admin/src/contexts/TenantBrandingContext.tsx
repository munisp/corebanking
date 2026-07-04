import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { tenantService, type Tenant, type TenantBranding } from '../services/tenant';
import { getTenantHeaders } from '../services/tenant/getTenantHeaders';
// COMMENTED OUT: UserRole removed - app is only for 54link
// import { tenantService, type Tenant, type TenantBranding, type UserRole } from '../services/tenant';

interface TenantBrandingContextType {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  domain: string | null;
  headers: Record<string, string>;
  isLoading: boolean;
}

// This is the platform (54link) admin, not a tenant admin — its branding is
// fixed and must never be overridden by whatever tenant config happens to load
// (that config is still fetched for its headers, e.g. x-tenant-id/x-ledger-id).
const PLATFORM_BRANDING = {
  name: '54Link',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: '#22c55e',
  secondaryColor: '#16a34a',
  domain: '54link.com',
};

const TenantBrandingContext = createContext<TenantBrandingContextType | undefined>(undefined);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // COMMENTED OUT: User roles removed - app is only for 54link
  // const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const loadTenant = () => {
      const config = tenantService.getTenantConfig();
      setTenant(config);
      setIsLoading(false);

      // COMMENTED OUT: User role logic removed - app is only for 54link
      // Get user role
      // const role = tenantService.getUserRole();
      // setUserRole(role);

      // Platform admin always uses fixed 54Link branding, regardless of tenant config
      const root = document.documentElement;
      root.style.setProperty('--tenant-primary-color', PLATFORM_BRANDING.primaryColor);
      root.style.setProperty('--tenant-secondary-color', PLATFORM_BRANDING.secondaryColor);

      if (PLATFORM_BRANDING.faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = PLATFORM_BRANDING.faviconUrl;
        } else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = PLATFORM_BRANDING.faviconUrl;
          document.head.appendChild(newLink);
        }
      }

      document.title = `${PLATFORM_BRANDING.name} - Admin Portal`;
    };

    loadTenant();

    // COMMENTED OUT: User role storage listener removed
    // Listen for storage changes to update when tenant config or role changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tenant_config') {
        loadTenant();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for changes
    const interval = setInterval(loadTenant, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Platform admin always uses fixed 54Link branding - never derived from tenant config
  const branding = tenant?.branding || null;
  const name = PLATFORM_BRANDING.name;
  const logoUrl = PLATFORM_BRANDING.logoUrl;
  const faviconUrl = PLATFORM_BRANDING.faviconUrl;
  const primaryColor = PLATFORM_BRANDING.primaryColor;
  const secondaryColor = PLATFORM_BRANDING.secondaryColor;
  const domain = PLATFORM_BRANDING.domain;

  // Extract headers from tenant config
  const headers = getTenantHeaders(tenant);

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
        headers,
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

