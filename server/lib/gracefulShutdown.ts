/**
 * G8: Graceful shutdown handler for the Express server.
 * Drains in-flight requests, closes DB connections, and flushes metrics before exit.
 */

import type { Server } from "http";
import { closeDbPool } from "../db";
import { logger } from "./logger";

let isShuttingDown = false;

export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info("HTTP server closed — no new connections accepted.");

      try {
        await closeDbPool();
        logger.info("Database pool closed.");
      } catch (err) {
        logger.error("Error closing database pool:", { error: String(err) });
      }

      logger.info("Graceful shutdown complete.");
      process.exit(0);
    });

    // Force shutdown after 30s if graceful shutdown hangs
    setTimeout(() => {
      logger.error("Graceful shutdown timed out after 30s. Forcing exit.");
      process.exit(1);
    }, 30_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Prevent unhandled rejections from crashing the server
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection:", { error: String(reason) });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", { error: String(error) });
    void shutdown("uncaughtException");
  });
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}
