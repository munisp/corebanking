import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";

const APP_PORT = Number(readEnv("APP_PORT", 3003));
const ENV = readEnv("NODE_ENV", "development");

export default async function setupServer(
  app: import("express").Application,
  tryInitializeDatabase: () => Promise<void>,
): Promise<void> {
  await tryInitializeDatabase();

  app.listen(APP_PORT, () => {
    logger.info(`[billing-service] Listening on port ${APP_PORT} (${ENV})`);
  });
}
