/**
 * otel/init.ts — OpenTelemetry bootstrap for billing-service.
 *
 * MUST be imported BEFORE any other module in the entrypoint (src/index.ts),
 * because OTel instrumentations patch modules (http/express/typeorm/ioredis) at
 * require time. Honors OTEL_SDK_DISABLED (SPEC §2.1): when "true" this module is
 * a complete no-op.
 */

import { initOtel } from "./otel";

export const shutdownOtel: () => Promise<void> = initOtel("billing-service");

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await shutdownOtel();
  } catch (error) {
    // Never let telemetry shutdown crash the process exit path.
    console.error(`[otel] shutdown error on ${signal}:`, error);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
