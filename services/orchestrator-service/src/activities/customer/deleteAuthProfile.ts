import { authService } from "../../services/authService";

// OB-08 (saga compensation): best-effort removal of an auth profile created
// earlier in a workflow that has now failed. Never throws — compensation must
// not mask the original failure. See authService.deleteAuthProfile for the
// current auth-service endpoint gap (DELETE /auth/{keycloak_id} owned by R1B).
export async function deleteAuthProfile(args: {
  tenant_id: string;
  keycloak_id: string;
  keycloak_realm: string;
}): Promise<void> {
  return authService.deleteAuthProfile(
    args.tenant_id,
    args.keycloak_id,
    args.keycloak_realm,
  );
}
