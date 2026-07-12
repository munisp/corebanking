import { AppDataSource } from "./dataSource";
import logger from "../config/logger.config";

export const initializeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    logger.info("Database already connected — skipping re-init");
    return;
  }

  logger.info("Connecting to database...");

  await AppDataSource.initialize()
    .then(async () => {
      logger.info("Database connection success...");
    })
    .catch((error) => {
      throw error;
    });
};
