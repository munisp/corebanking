import { accountService } from "../../services/accountService";
import { ICreateAccountPayload } from "../../types/account";
import logger from "../../config/logger.config";

export async function createMintAccount(payload: ICreateAccountPayload) {
  logger.info(`[createMintAccount activity] Creating mint account`, {
    name: payload.name,
    tenantId: payload.tenant_id,
    shouldCreateBank: payload.bank?.create,
  });

  try {
    if (payload.bank?.create) {
      logger.info(`[createMintAccount activity] Creating bank`, {
        bankName: payload.bank.name,
        tenantId: payload.tenant_id,
      });
      await accountService.createBank({
        name: payload.bank.name,
        logo: payload.bank?.logo || "",
        tenant_id: payload.tenant_id,
        keycloak_id: payload.keycloak_id,
        ledger_id: payload.ledger_id,
      });
      logger.info(`[createMintAccount activity] Bank created successfully`, {
        tenantId: payload.tenant_id,
      });
    }

    logger.info(`[createMintAccount activity] Creating mint account`, {
      name: payload.name,
      tenantId: payload.tenant_id,
    });
    const result = await accountService.createMintAccount(payload);
    logger.info(`[createMintAccount activity] Mint account created successfully`, {
      accountId: result?.account?.id,
      tenantId: payload.tenant_id,
    });
    return result;
  } catch (error: any) {
    logger.error(`[createMintAccount activity] Failed to create mint account`, {
      name: payload.name,
      tenantId: payload.tenant_id,
      error: error?.message,
      status: error?.status,
      response: error?.response?.data,
      stack: error?.stack,
    });
    throw error;
  }
}
