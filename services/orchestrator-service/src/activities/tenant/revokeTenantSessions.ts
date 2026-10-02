import { KeycloakAdminApiClient } from "../../lib/keycloakAdminApiClient";
import logger from "../../config/logger.config";

// PL-02: revoke all live sessions/tokens for a tenant realm before deletion.
// Real Admin API call (POST /admin/realms/{realm}/logout-all).
export async function revokeTenantSessions(realm: string): Promise<void> {
  logger.info(`[revokeTenantSessions activity] Logging out all sessions`, { realm });
  await KeycloakAdminApiClient.get_instance().logout_all(realm);
  logger.info(`[revokeTenantSessions activity] Sessions revoked`, { realm });
}
