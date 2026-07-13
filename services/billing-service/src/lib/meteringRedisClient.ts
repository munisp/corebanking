import Redis from "ioredis";
import { readEnv } from "../config/readEnv.config";
import logger from "../config/logger.config";

const REDIS_HOST = readEnv("REDIS_HOST", "redis-master.redis.svc.cluster.local") as string;
const REDIS_PORT = Number(readEnv("REDIS_PORT", 6379));

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on("error", (err) => logger.warn("[billing-service] Metering Redis error", { err: err.message }));
  }
  return client;
}

/**
 * Atomically reads and resets the API-call counter the APISIX gateway increments
 * per tenant per period (key format: usage:api_call:<tenantId>:<periodKey>).
 * Returns 0 if the key doesn't exist or Redis is unreachable — metering failures
 * must never block invoice generation.
 */
export async function popApiCallCount(tenantId: string, periodKey: string): Promise<number> {
  const key = `usage:api_call:${tenantId}:${periodKey}`;
  try {
    const previous = await getClient().getset(key, "0");
    return previous ? parseInt(previous, 10) || 0 : 0;
  } catch (err) {
    logger.warn("[billing-service] Failed to pop API call count", { tenantId, periodKey, err });
    return 0;
  }
}
