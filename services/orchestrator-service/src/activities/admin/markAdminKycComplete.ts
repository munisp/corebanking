import { adminService } from "../../services/adminService";

// OB-06: previously this ran raw SQL against the orchestrator's own DB
// (`UPDATE admin ...`), but the orchestrator schema has no admin table — the
// admin record lives in admin-service. Call the real API
// (POST /admin/kyc/complete, admin-service api/v1/admin.py:270).
export async function markAdminKycComplete(tenant_id: string, keycloak_id: string) {
  return adminService.markKycComplete(tenant_id, keycloak_id);
}
