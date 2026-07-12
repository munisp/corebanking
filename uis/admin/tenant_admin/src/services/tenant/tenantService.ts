import apiClient from "../api";
import { getTenantHeaders as extractTenantHeaders } from "./getTenantHeaders";

export interface TenantContact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface TenantBranding {
  id: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  domain: string;
}

export interface TenantBilling {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  plan: string;
}

export interface FeatureFlagConfig {
  id: string;
  name: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

export interface Tenant {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  status: string;
  tenant_id: string;
  status_message: string | null;
  contact: TenantContact;
  branding: TenantBranding;
  billing: TenantBilling;
  feature_flags: FeatureFlagConfig[];
  admin_feature_flags?: FeatureFlagConfig[];
  super_admin_feature_flags?: FeatureFlagConfig[];
  super_tenant_feature_flags?: FeatureFlagConfig[];
}

export interface GetTenantResponse {
  message: string;
  tenant: Tenant;
}

// COMMENTED OUT: UserRole type (no longer used)
export type UserRole = "admin" | "super_admin" | "super_tenant";

class TenantService {
  private readonly TENANT_CONFIG_KEY = "tenant_config";
  private readonly TENANT_ID_KEY = "tenant_id";

  /**
   * Extract tenant_id from URL if present
   */
  private extractTenantIdFromUrl(): string | null {
    if (typeof window === "undefined") return null;

    const path = window.location.pathname;
    // Check for patterns like /tenant-management/tenant/{tenant_id} or /tenant/{tenant_id}
    const tenantMatch = path.match(/\/tenant[^/]*\/([^/]+)/);
    if (tenantMatch && tenantMatch[1]) {
      return tenantMatch[1];
    }

    return null;
  }

  /**
   * Get tenant_id from environment variable, localStorage, or URL
   */
  private getTenantId(): string | null {
    // First check environment variable
    const envTenantId = import.meta.env.VITE_TENANT_ID;
    // const envTenantId = "kembi"

    if (envTenantId) {
      return envTenantId;
    }

    // Then check localStorage
    const storedTenantId = localStorage.getItem(this.TENANT_ID_KEY);
    if (storedTenantId) {
      return storedTenantId;
    }

    // Try to extract from URL
    const urlTenantId = this.extractTenantIdFromUrl();
    if (urlTenantId) {
      // Store it for future use
      this.setTenantId(urlTenantId);
      return urlTenantId;
    }

    // Default fallback (can be removed if tenant_id is always provided)
    return null;
  }

  /**
   * Set tenant_id in localStorage
   */
  setTenantId(tenantId: string): void {
    localStorage.setItem(this.TENANT_ID_KEY, tenantId);
  }

  /**
   * Change tenant ID and fetch new config
   * Useful for switching tenants dynamically
   */
  async changeTenant(tenantId: string): Promise<Tenant> {
    this.setTenantId(tenantId);
    // Clear old config to force fresh fetch
    this.removeTenantConfig();
    // Fetch new tenant config
    return await this.getTenant(tenantId);
  }

  /**
   * Fetch tenant data from API
   * @param tenantId - Optional tenant ID
   */
  async getTenant(tenantId?: string): Promise<Tenant> {
    // Check for existing tenant config in localStorage first (cache)
    const existingConfig = this.getTenantConfig();
    if (existingConfig) {
      return existingConfig;
    }

    const id = tenantId || this.getTenantId();

    if (!id) {
      throw new Error(
        "Tenant ID is required. Please set VITE_TENANT_ID environment variable or call setTenantId() first.",
      );
    }

    try {
      const response = await apiClient.get<GetTenantResponse>(
        `/tenant-management/tenant/${id}`,
      );

      if (response.data.message === "success" && response.data.tenant) {
        const tenant = response.data.tenant;

        // Debug logging
        if (import.meta.env.DEV) {
          console.log("Tenant API response:", response.data);
          console.log("Tenant object to store:", tenant);
          console.log("Feature flags in response:", tenant.feature_flags);
        }

        // Store tenant config in localStorage
        this.setTenantConfig(tenant);
        return tenant;
      }

      throw new Error("Invalid response format from tenant API");
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Get tenant config from localStorage
   * Returns null if no config is stored (use regular tenant config, not default)
   */
  getTenantConfig(): Tenant | null {
    const configStr = localStorage.getItem(this.TENANT_CONFIG_KEY);
    if (!configStr) {
      // Return null if no config is stored - use regular tenant config
      return null;
    }

    try {
      return JSON.parse(configStr);
    } catch {
      // Return null if parsing fails
      return null;
    }
  }

  /**
   * Set tenant config in localStorage.
   * Also extracts and caches ledger_id as a standalone key so the API
   * client can include x-ledger-id even when the full config isn't parsed.
   */
  setTenantConfig(tenant: Tenant): void {
    localStorage.setItem(this.TENANT_CONFIG_KEY, JSON.stringify(tenant));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tenant_config_updated"));
    }

    // Cache ledger_id and mint_id separately for fast header injection
    const accountsFeature = (tenant.feature_flags || []).find(
      (f) => f.name === "accounts",
    );
    if (accountsFeature?.config) {
      const cfg = accountsFeature.config as Record<string, unknown>;
      const account = (cfg.account || {}) as Record<string, unknown>;

      const ledgerId =
        account.ledger_id ?? cfg.ledger_id ?? (cfg.account_config as any)?.ledger_id;
      if (ledgerId != null) {
        localStorage.setItem("ledger_id", String(ledgerId));
      }

      const mintId =
        (account as any).id ?? (account as any).mint_id ?? (cfg as any).mint_id;
      if (mintId != null) {
        localStorage.setItem("mint_id", String(mintId));
      }
    }
  }

  /**
   * Fetch fresh tenant config from the API, bypassing the localStorage cache.
   * Silently no-ops if tenant_id is unknown or the request fails (returns null).
   * On success, stores the result and dispatches "tenant_config_updated" so
   * the sidebar and branding context update without a page reload.
   */
  async refreshTenantConfig(tenantId?: string): Promise<Tenant | null> {
    const id = tenantId || this.getTenantId();
    if (!id) return null;
    try {
      const response = await apiClient.get<GetTenantResponse>(
        `/tenant-management/tenant/${id}`,
      );
      if (response.data.message === "success" && response.data.tenant) {
        this.setTenantConfig(response.data.tenant);
        return response.data.tenant;
      }
    } catch {
      // network / auth failures should not crash the app
    }
    return null;
  }

  /**
   * Remove tenant config from localStorage
   */
  removeTenantConfig(): void {
    localStorage.removeItem(this.TENANT_CONFIG_KEY);
    localStorage.removeItem(this.TENANT_ID_KEY);
    localStorage.removeItem("ledger_id");
    localStorage.removeItem("mint_id");
  }

  /**
   * Check if tenant config exists in localStorage
   */
  hasTenantConfig(): boolean {
    return this.getTenantConfig() !== null;
  }

  /**
   * Get required headers from tenant config
   * Returns an object with headers: x-tenant-id, x-ledger-id, x-mint-id, x-mint-account-id, x-staff-id
   */
  getTenantHeaders(): Record<string, string> {
    const tenant = this.getTenantConfig();
    return extractTenantHeaders(tenant);
  }

  /**
   * Get feature flags for the current context.
   * Branch admins get branch-scoped flags (is_enabled overridden from branch_feature_flags).
   * Tenant-level admins get the full tenant flags unchanged.
   * Config values (ledger_id, keycloak realm etc.) always come from the tenant flags
   * since branch flags only store which features are on/off, not their config.
   */
  getFeatureFlags(): FeatureFlagConfig[] {
    const tenant = this.getTenantConfig();
    if (!tenant) return [];

    const branchId = localStorage.getItem("branch_id");
    const branchFlagsRaw = localStorage.getItem("branch_feature_flags");

    if (branchId && branchFlagsRaw) {
      try {
        const enabledBranchFlags: string[] = JSON.parse(branchFlagsRaw);
        return (tenant.feature_flags || []).map((flag) => ({
          ...flag,
          is_enabled: enabledBranchFlags.includes(flag.name),
        }));
      } catch {}
    }

    return tenant.feature_flags || [];
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    const featureFlags = this.getFeatureFlags();
    const feature = featureFlags.find((flag) => flag.name === featureName);
    return feature ? feature.is_enabled : false;
  }

  /**
   * Get configuration for a specific feature
   */
  getFeatureConfig(featureName: string): Record<string, unknown> {
    const featureFlags = this.getFeatureFlags();
    const feature = featureFlags.find((flag) => flag.name === featureName);
    return feature?.config || {};
  }

  /**
   * Get all enabled feature names
   */
  getEnabledFeatures(): string[] {
    const featureFlags = this.getFeatureFlags();
    return featureFlags
      .filter((flag) => flag.is_enabled)
      .map((flag) => flag.name);
  }

  /**
   * COMMENTED OUT: Get feature flags based on user role
   * Returns the appropriate feature flags array for the given role
   */
  getFeatureFlagsByRole(role: UserRole): FeatureFlagConfig[] {
    const tenant = this.getTenantConfig();
    if (!tenant) return [];

    switch (role) {
      case "admin":
        return tenant.admin_feature_flags || [];
      case "super_admin":
        return tenant.super_admin_feature_flags || [];
      case "super_tenant":
        return tenant.super_tenant_feature_flags || [];
      default:
        return tenant.feature_flags || [];
    }
  }

  /**
   * COMMENTED OUT: Get current user role from localStorage
   */
  // getUserRole(): UserRole | null {
  //   const role = localStorage.getItem('user_role');
  //   if (role && ['admin', 'super_admin', 'super_tenant'].includes(role)) {
  //     return role as UserRole;
  //   }
  //   return null;
  // }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === "object" && error !== null && "response" in error) {
      const axiosError = error as {
        response?: { data?: { message?: string }; status?: number };
      };
      if (axiosError.response?.data?.message) {
        return new Error(axiosError.response.data.message);
      }
      if (axiosError.response?.status === 404) {
        return new Error("Tenant not found");
      }
      if (axiosError.response?.status === 401) {
        return new Error("Unauthorized. Please check your authentication.");
      }
    }

    return new Error("An unexpected error occurred while fetching tenant data");
  }

  getUserRole = (): "admin" | "super_admin" | "super_tenant" | null => {
    // First try to get from auth_user object
    try {
      const userStr = localStorage.getItem("auth_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const role = user.user_role || user.role;
        if (role && ["admin", "super_admin", "super_tenant"].includes(role)) {
          return role as "admin" | "super_admin" | "super_tenant";
        }
      }
    } catch (e) {
      console.error("Error parsing auth_user:", e);
    }

    // Fallback to old user_role key for backward compatibility
    const role = localStorage.getItem("user_role");
    if (role && ["admin", "super_admin", "super_tenant"].includes(role)) {
      return role as "admin" | "super_admin" | "super_tenant";
    }
    return null;
  };
}

// Export singleton instance
export const tenantService = new TenantService();
export default tenantService;
