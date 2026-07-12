import { ICreateTenantPayload } from "../../types/tenant";
import { tenantService } from "../../services/tenantService";
import logger from "../../config/logger.config";

export async function createTenant(payload: ICreateTenantPayload) {
  logger.info(`[createTenant activity] Creating tenant`, {
    tenantId: payload.tenantId,
    name: payload.name,
    type: payload.type,
  });
  try {
    const result = await tenantService.createTenant(payload);
    logger.info(`[createTenant activity] Successfully created tenant`, {
      tenantId: payload.tenantId,
      resultId: result?.id,
    });
    return result;
  } catch (error: any) {
    logger.error(`[createTenant activity] Failed to create tenant`, {
      tenantId: payload.tenantId,
      error: error?.message,
      status: error?.status,
      response: error?.response?.data,
      stack: error?.stack,
    });
    throw error;
  }
}
