import { agentService } from "../../services/agentService";

export async function markAgentKycFailed(tenant_id: string, keycloak_id: string) {
  return agentService.markKycFail(tenant_id, keycloak_id);
}
