import { businessService } from "../../services/businessService";

export async function markBusinessKybComplete(tenant_id: string, keycloak_id: string) {
  return businessService.markKybComplete(tenant_id, keycloak_id);
}
