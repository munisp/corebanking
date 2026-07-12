import { AppConfig } from '../config/app_config';
import type { TenantConfig, TenantServerResponse } from '../models/tenant';
import { transformTenantData } from '../models/tenant';
import { apiService } from './api_service';

export class TenantService {
  private static readonly TENANT_STORAGE_KEY = 'tenant_config';
  private static readonly TENANT_ID_STORAGE_KEY = 'tenant_id';

  /**
   * Fetch tenant configuration from API
   */
  static async fetchTenantConfig(tenantId: string): Promise<TenantConfig> {
    try {
      const response = await apiService.get<TenantServerResponse>(`${AppConfig.tenantEndpoint}/tenant/${tenantId}`);
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch tenant config: ${response.statusText}`);
      }

      const serverResponse = response.data;
      console.log('[TenantService] Raw API response:', {
        tenantName: serverResponse.tenant?.name,
        branding: serverResponse.tenant?.branding,
      });
      
      const tenantConfig = transformTenantData(serverResponse.tenant);
      
      console.log('[TenantService] Transformed config:', {
        tenantName: tenantConfig.name,
        primaryColor: tenantConfig.branding.primary_color,
        secondaryColor: tenantConfig.branding.secondary_color,
      });
      
      // Save tenant ID to localStorage
      this.saveTenantId(tenantId);
      
      return tenantConfig;
    } catch (error) {
      console.error('Error fetching tenant configuration:', error);
      throw error;
    }
  }

  /**
   * Fetch tenant configuration by domain
   */
  static async fetchTenantByDomain(domain: string): Promise<TenantConfig> {
    try {
      const response = await apiService.get<TenantServerResponse>(`${AppConfig.tenantEndpoint}/tenant/by-domain`, {
        domain: domain,
      });
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch tenant by domain: ${response.statusText}`);
      }

      const serverResponse = response.data;
      const tenantConfig = transformTenantData(serverResponse.tenant);
      
      return tenantConfig;
    } catch (error) {
      console.error('Error fetching tenant by domain:', error);
      throw error;
    }
  }

  /**
   * Save tenant configuration to localStorage
   */
  static saveTenantConfig(tenant: TenantConfig): void {
    try {
      localStorage.setItem(this.TENANT_STORAGE_KEY, JSON.stringify(tenant));
    } catch (error) {
      console.error('Error saving tenant configuration:', error);
    }
  }

  /**
   * Load tenant configuration from localStorage
   */
  static loadTenantConfig(): TenantConfig | null {
    try {
      const stored = localStorage.getItem(this.TENANT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error loading tenant configuration:', error);
      return null;
    }
  }

  /**
   * Clear tenant configuration from localStorage
   */
  static clearTenantConfig(): void {
    try {
      localStorage.removeItem(this.TENANT_STORAGE_KEY);
      localStorage.removeItem(this.TENANT_ID_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing tenant configuration:', error);
    }
  }

  /**
   * Save tenant ID to localStorage
   */
  static saveTenantId(tenantId: string): void {
    try {
      localStorage.setItem(this.TENANT_ID_STORAGE_KEY, tenantId);
    } catch (error) {
      console.error('Error saving tenant ID:', error);
    }
  }

  /**
   * Get tenant ID from localStorage
   */
  static getTenantId(): string | null {
    try {
      return localStorage.getItem(this.TENANT_ID_STORAGE_KEY);
    } catch (error) {
      console.error('Error getting tenant ID:', error);
      return null;
    }
  }

  /**
   * Get tenant ID from URL query parameter
   */
  static getTenantIdFromURL(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tenant') || urlParams.get('tenant_id') || urlParams.get('bank');
  }

  /**
   * Detect tenant from current hostname
   */
  static detectTenantFromHostname(): string {
    const hostname = window.location.hostname;
    
    // Remove common prefixes
    const cleanHostname = hostname
      .replace('www.', '')
      .replace('app.', '')
      .replace('portal.', '');

    // Extract subdomain if exists
    const parts = cleanHostname.split('.');
    if (parts.length > 2) {
      return parts[0]; // Return subdomain as tenant identifier
    }

    // Extract domain name as tenant identifier
    return parts[0];
  }

  /**
   * Validate tenant configuration
   */
  static validateTenantConfig(tenant: TenantConfig): boolean {
    if (!tenant.id || !tenant.name || !tenant.domain) {
      console.error('Invalid tenant configuration: missing required fields');
      return false;
    }

    if (!tenant.branding || !tenant.features) {
      console.error('Invalid tenant configuration: missing required sections');
      return false;
    }

    return true;
  }

  /**
   * Apply tenant branding to manifest.json for PWA
   */
  static updatePWAManifest(tenant: TenantConfig): void {
    const manifest = {
      name: tenant.displayName,
      short_name: tenant.name,
      description: `${tenant.displayName} - Digital Banking Platform`,
      theme_color: tenant.branding.primary_color,
      background_color: tenant.branding.backgroundColor,
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        {
          src: tenant.logo,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: tenant.logo,
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    };

    // Update manifest dynamically
    const manifestElement = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestElement) {
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const manifestURL = URL.createObjectURL(blob);
      manifestElement.href = manifestURL;
    }
  }

  /**
   * Get feature flag value for current tenant
   */
  static isFeatureEnabled(tenant: TenantConfig, feature: keyof TenantConfig['features']): boolean {
    if (!tenant.features) return false;
    return tenant.features[feature] as boolean;
  }

  /**
   * Get feature config for a specific feature
   */
  static getFeatureConfig(tenant: TenantConfig, feature: string): Record<string, unknown> | undefined {
    if (!tenant.features) return undefined;
    const configKey = `${feature}Config`;
    return tenant.features[configKey] as Record<string, unknown> | undefined;
  }

  /**
   * Check if tenant is active
   */
  static isTenantActive(tenant: TenantConfig): boolean {
    return tenant.status === 'active';
  }

  /**
   * Get auth realm from feature config
   */
  static getAuthRealm(tenant: TenantConfig): string | undefined {
    const authConfig = this.getFeatureConfig(tenant, 'auth');
    if (authConfig && typeof authConfig === 'object' && 'realm' in authConfig) {
      return authConfig.realm as string;
    }
    return undefined;
  }

  /**
   * Get accounts config
   */
  static getAccountsConfig(tenant: TenantConfig): unknown {
    const accountsConfig = this.getFeatureConfig(tenant, 'accounts');
    if (accountsConfig && typeof accountsConfig === 'object' && 'account' in accountsConfig) {
      return accountsConfig.account;
    }
    return accountsConfig;
  }
}
