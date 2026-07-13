import { AppDataSource } from "../../database/dataSource";

export async function markCustomerKycComplete(tenant_id: string, keycloak_id: string) {
  await AppDataSource.query(
    `UPDATE "user"
     SET kyc_verification_status = 'VERIFIED', status = 'ACTIVE', updated_at = NOW()
     WHERE keycloak_id = $1 AND tenant_id = $2`,
    [keycloak_id, tenant_id],
  );
}
