import { adminService } from "../../services/adminService";
import { IAdminProfilePayload } from "../../types/admin";
import logger from "../../config/logger.config";

export async function createAdminProfile(payload: IAdminProfilePayload) {
  logger.info("[createAdminProfile] activity payload: %o", payload);
  await adminService.createAdminProfile(payload);
}
