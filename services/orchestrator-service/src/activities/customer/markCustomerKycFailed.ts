import { userService } from "../../services/userService";

export async function markCustomerKycFailed(tenant_id: string, keycloak_id: string) {
  return userService.markKycFail(tenant_id, keycloak_id);
}
