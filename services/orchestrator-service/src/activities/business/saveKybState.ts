import { userService } from "../../services/userService";

export async function saveKybState(kyb_url: string, tenant_id: string, keycloak_id: string) {
  return userService.saveKycState(kyb_url, tenant_id, keycloak_id);
}
