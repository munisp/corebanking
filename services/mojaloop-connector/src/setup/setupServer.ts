import createLogger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { daprServer } from "../services";
import { setupTemporalWorker } from "./setupTemporalWorker";

const logger = createLogger(__filename.split("/").pop() || "UnknownFile");

const APP_PORT = Number(readEnv("APP_PORT", 3000));
const APP_HOST = readEnv("APP_HOST", "localhost");
const ENV = process.env.NODE_ENV || readEnv("NODE_ENV");

export default async function setupServer(tryInitializeDatabase: () => Promise<void>): Promise<void> {
  await tryInitializeDatabase();
  try {
    await daprServer.start();
  } catch (error: any) {
    logger.warn(`Dapr sidecar unavailable, pubsub disabled: ${error.message}`);
  }

  logger.info(`Application is running on Host: ${APP_HOST} Port: ${APP_PORT}`);
  logger.info(`Application is running in ${ENV} mode`);

  await setupTemporalWorker();
}
