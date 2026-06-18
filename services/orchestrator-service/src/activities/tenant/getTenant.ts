import { tenantService } from "../../services/tenantService";
import logger from "../../config/logger.config";

export async function getTenant(tenant_id: string) {
  logger.info(`[getTenant activity] Fetching tenant`, { tenant_id });
  try {
    const result = await tenantService.getTenant(tenant_id);
    logger.info(`[getTenant activity] Successfully fetched tenant`, {
      tenant_id,
      exists: !!result,
    });
    return result;
  } catch (error: any) {
    logger.error(`[getTenant activity] Failed to fetch tenant`, {
      tenant_id,
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}
