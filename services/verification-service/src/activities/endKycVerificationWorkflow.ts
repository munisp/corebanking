import { AppDataSource } from "../database/dataSource";
import { KycVerificationWorkflowEntity } from "../entity/KycVerificationWorkflowEntity";
import { NonRetriableApplicationError } from "../middlewares/error";
import { VerificationWorkflowStatus } from "../utils/enums";
import { lookupHash } from "../utils/fieldEncryption";
import { maskIdentifier } from "../utils/piiMask";
import logger from "../config/logger.config";

export async function endKycVerificationWorkflow(
  client_app_user_id: string,
  status: VerificationWorkflowStatus.COMPLETED | VerificationWorkflowStatus.FAILED,
  score?: number,
  has_sent_webhook: boolean = false,
  metadata?: { keycloak_id?: string; tenant_id?: string; is_admin?: boolean },
) {
  // M-53: the stored identifier is AES-256-GCM encrypted; equality lookups go
  // through the keyed HMAC-SHA256 lookup hash.
  const kycVerification = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
    where: {
      client_app_user_id_hash: lookupHash(client_app_user_id),
      status: VerificationWorkflowStatus.RUNNING,
    },
  });

  if (!kycVerification) {
    // M-52: never log the full identifier — masked (last 3 chars only).
    logger.error(`[endKycVerificationWorkflow] no RUNNING record found for client_app_user_id=${maskIdentifier(client_app_user_id)}`);
    throw new NonRetriableApplicationError("Invalid verification session.");
  }

  logger.info(`[endKycVerificationWorkflow] found record id=${kycVerification.id} — setting status=${status} score=${score ?? "none"} metadata=${JSON.stringify(metadata)}`);

  kycVerification.status = status;
  kycVerification.has_sent_webhook = has_sent_webhook;
  if (score) kycVerification.score = score;

  await AppDataSource.manager.save(kycVerification);
  logger.info(`[endKycVerificationWorkflow] record saved`);

  if (
    status === VerificationWorkflowStatus.COMPLETED &&
    metadata?.keycloak_id &&
    metadata?.tenant_id
  ) {
    logger.info(`[endKycVerificationWorkflow] updating verified status — is_admin=${metadata.is_admin} keycloak_id=${metadata.keycloak_id} tenant_id=${metadata.tenant_id}`);
    if (metadata.is_admin) {
      const result = await AppDataSource.query(
        `UPDATE admin SET is_verified = TRUE, updated_at = NOW() WHERE keycloak_id = $1 AND tenant_id = $2`,
        [metadata.keycloak_id, metadata.tenant_id],
      );
      logger.info(`[endKycVerificationWorkflow] admin UPDATE rows affected=${result[1] ?? 0}`);
    } else {
      const result = await AppDataSource.query(
        `UPDATE "user" SET kyc_verification_status = 'VERIFIED', status = 'ACTIVE', updated_at = NOW() WHERE keycloak_id = $1 AND tenant_id = $2`,
        [metadata.keycloak_id, metadata.tenant_id],
      );
      logger.info(`[endKycVerificationWorkflow] user UPDATE rows affected=${result[1] ?? 0}`);
    }
  } else {
    logger.warn(`[endKycVerificationWorkflow] skipping DB update — status=${status} score=${score ?? 0} keycloak_id=${metadata?.keycloak_id ?? "MISSING"} tenant_id=${metadata?.tenant_id ?? "MISSING"}`);
  }
}
