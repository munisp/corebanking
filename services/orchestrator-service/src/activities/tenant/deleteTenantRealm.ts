import { KeycloakAdminApiClient } from "../../lib/keycloakAdminApiClient";
import logger from "../../config/logger.config";

// PL-02 / OB-08 (saga compensation): delete a tenant's Keycloak realm.
// Used both by decommissionTenantWorkflow and as compensation for a failed
// createTenantWorkflow. Real Admin API call (DELETE /admin/realms/{realm}).
export async function deleteTenantRealm(realm: string): Promise<void> {
  logger.info(`[deleteTenantRealm activity] Deleting Keycloak realm`, { realm });
  await KeycloakAdminApiClient.get_instance().delete_realm(realm);
  logger.info(`[deleteTenantRealm activity] Realm deleted`, { realm });
}
