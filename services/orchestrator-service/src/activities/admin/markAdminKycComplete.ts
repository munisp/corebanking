import { AppDataSource } from "../../database/dataSource";

export async function markAdminKycComplete(tenant_id: string, keycloak_id: string) {
  await AppDataSource.query(
    `UPDATE admin
     SET is_verified = TRUE, updated_at = NOW()
     WHERE keycloak_id = $1 AND tenant_id = $2`,
    [keycloak_id, tenant_id],
  );
}
