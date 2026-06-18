/**
 * DEPRECATED: Tenant configurations are now fetched from the API
 * 
 * This file is kept for backward compatibility only.
 * All tenant data is now loaded dynamically from:
 * https://54link-dev.upi.dev/tenant-management/tenant/{tenant_id}
 * 
 * Usage:
 * - Add ?tenant={tenant_id} to the URL to load a specific tenant
 *   Example: http://localhost:3000?tenant=lilic
 * 
 * - The tenant_id is saved in localStorage and persisted across sessions
 * 
 * - Default tenant: 54link-dev (if no URL parameter or saved tenant exists)
 * 
 * Implementation:
 * - See TenantContext for context management
 * - See TenantService for API calls and localStorage handling
 * - See TenantInitializer for initialization logic in App.tsx
 */

export const TENANT_CONFIGURATIONS: Record<string, never> = {
  // All tenant configurations are now loaded from the API
};
