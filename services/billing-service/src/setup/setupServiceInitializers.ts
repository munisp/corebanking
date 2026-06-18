import { AppDataSource } from "../database/dataSource";
import logger from "../config/logger.config";

export async function tryInitializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info("[billing-service] Database connection established");
    }
  } catch (error) {
    logger.error("[billing-service] Database initialization failed", { error });
    throw error;
  }
}
