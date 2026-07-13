import { type Application } from "express";
import logger from "../config/logger.config";
import swaggerDocs from "../config/swagger.config";
import { DaprServerService } from "../lib/daprServer";
import { DaprClientService } from "../lib/daprClient";
import { setupTemporalWorker } from "./setupTemporalWorker";

export default async function setupServer(
  app: Application,
  APP_HOST: string,
  APP_PORT: number,
  tryInitializeDatabase: () => Promise<void>
) {
  const BASE_URL = `http://${APP_HOST}:${APP_PORT}`;

  await tryInitializeDatabase();

  DaprClientService.getInstance();

  const server = DaprServerService.getInstance();
  await server.start();

  logger.info(`Application is running at ${BASE_URL}`);
  logger.info("Application is running in " + process.env.NODE_ENV + " mode");

  swaggerDocs(app, BASE_URL);

  // Start Temporal worker in background (non-blocking) so HTTP server can start
  // worker.run() is a blocking call that never completes during normal operation
  setupTemporalWorker().catch((err) => {
    logger.error("[setupServer] Temporal worker failed", {
      error: err?.message,
      stack: err?.stack,
    });
    process.exit(1);
  });
}
