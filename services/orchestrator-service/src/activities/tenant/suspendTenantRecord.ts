import { tenantService } from "../../services/tenantService";
import logger from "../../config/logger.config";

// PL-02 / OB-08 (saga compensation): mark the tenant record SUSPENDED in
// tenant-management (POST /tenant/{id}/suspend). tenant-management has no
// OFFBOARDED status as of 1c9134e2 — suspension is the terminal state it
// exposes; the realm deletion (deleteTenantRealm) is what revokes access.
export async function suspendTenantRecord(tenantId: string): Promise<void> {
  logger.info(`[suspendTenantRecord activity] Suspending tenant`, { tenantId });
  await tenantService.suspendTenant(tenantId);
  logger.info(`[suspendTenantRecord activity] Tenant suspended`, { tenantId });
}
