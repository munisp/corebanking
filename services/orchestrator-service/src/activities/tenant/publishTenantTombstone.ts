import { readEnv } from "../../config/readEnv.config";
import logger from "../../config/logger.config";
import { DaprClientService } from "../../lib/daprClient";

// PL-02: publish a tenant tombstone event so downstream services
// (audit, billing, data-retention) can react to the offboarding.
export async function publishTenantTombstone(tenantId: string): Promise<void> {
  const pubsubName = (readEnv("DAPR_PUBSUB_NAME") as string) || "pubsub";
  const topicPrefix = (readEnv("DAPR_PUBSUB_TOPIC_PREFIX") as string) || "";
  const topic = `${topicPrefix}tenant.tombstoned`;

  logger.info(`[publishTenantTombstone activity] Publishing tombstone`, {
    tenantId,
    topic,
  });
  await DaprClientService.getInstance().publish(pubsubName, topic, {
    tenantId,
    tombstonedAt: new Date().toISOString(),
  });
}
