export { tenantService, default } from './tenantService';
export { getTenantHeaders } from './getTenantHeaders';
export type {
  Tenant,
  TenantContact,
  TenantBranding,
  TenantBilling,
  FeatureFlagConfig,
  GetTenantResponse,
  // COMMENTED OUT: UserRole export (no longer used)
  // UserRole,
} from './tenantService';

