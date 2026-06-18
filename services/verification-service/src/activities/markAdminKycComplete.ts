import { AppDataSource } from "../database/dataSource";
import logger from "../config/logger.config";

export async function markAdminKycComplete(keycloak_id: string, tenant_id: string) {
  const result = await AppDataSource.query(
    `UPDATE admin
     SET is_verified = TRUE, updated_at = NOW()
     WHERE keycloak_id = $1 AND tenant_id = $2`,
    [keycloak_id, tenant_id],
  );
  logger.info(`[markAdminKycComplete] updated ${result[1] ?? 0} row(s) — keycloak_id=${keycloak_id} tenant_id=${tenant_id}`);
}
