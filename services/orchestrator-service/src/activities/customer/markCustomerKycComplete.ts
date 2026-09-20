import { userService } from "../../services/userService";

// OB-06: previously this ran raw SQL against the orchestrator's own DB
// (`UPDATE "user" ...`), but the orchestrator schema has no "user" table — the
// user record lives in user-service. Call the real API (POST /user/kyc/complete,
// user-service api/user.py:183), which also publishes the KYC_COMPLETED event.
export async function markCustomerKycComplete(tenant_id: string, keycloak_id: string) {
  return userService.markKycComplete(tenant_id, keycloak_id);
}
