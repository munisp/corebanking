/**
 * Kafka Event Bus admin surface.
 *
 * Doctrine: topics, consumer groups, and dead-letter entries are served ONLY
 * from a real Kafka admin client (kafkajs via ./kafkaClient). When no admin
 * client is wired, list endpoints fail fast with 503
 * { error: "kafka_admin_unavailable" } — hardcoded topic/group/DLQ fixtures
 * have been removed. The DLQ retry endpoint returns 501 unless a real
 * producer re-publishes a real DLQ record (no DLQ payload store is wired in
 * this process, so it always fails loud today). The publish endpoint returns
 * 201 only after a real broker send; otherwise 502/503 — partition/offset
 * are never fabricated. Cluster health in /stats reflects the real probe.
 */
import type { Express, Request, Response } from "express";
import {
  publish as kafkaPublish,
  getKafkaStatus,
  listTopicsReal,
  listConsumerGroupsReal,
  isProducerAvailable,
  KafkaUnavailableError,
} from "./kafkaClient";
import { logger } from "./logger";

interface EventSchema {
  name: string;
  version: string;
  fields: { name: string; type: string; required: boolean }[];
  compatibility: "BACKWARD" | "FORWARD" | "FULL";
}

// Declared event schema catalog (static contract documentation, not live
// telemetry). This is configuration, not measured broker state.
const SCHEMAS: EventSchema[] = [
  { name: "TransferInitiated", version: "2.1.0", fields: [{ name: "transferId", type: "string", required: true }, { name: "fromAccount", type: "string", required: true }, { name: "toAccount", type: "string", required: true }, { name: "amount", type: "decimal", required: true }, { name: "currency", type: "string", required: true }, { name: "narration", type: "string", required: false }, { name: "channel", type: "string", required: true }, { name: "tenantId", type: "string", required: true }], compatibility: "BACKWARD" },
  { name: "TransferCompleted", version: "2.1.0", fields: [{ name: "transferId", type: "string", required: true }, { name: "tigerbeetleTransferId", type: "int64", required: true }, { name: "completedAt", type: "timestamp", required: true }, { name: "balanceAfter", type: "decimal", required: true }], compatibility: "BACKWARD" },
  { name: "FraudAlertTriggered", version: "1.3.0", fields: [{ name: "alertId", type: "string", required: true }, { name: "riskScore", type: "decimal", required: true }, { name: "ruleId", type: "string", required: true }, { name: "entityType", type: "string", required: true }, { name: "entityId", type: "string", required: true }, { name: "action", type: "string", required: true }], compatibility: "FULL" },
  { name: "AuditEventCreated", version: "3.0.0", fields: [{ name: "eventId", type: "string", required: true }, { name: "entityType", type: "string", required: true }, { name: "entityId", type: "string", required: true }, { name: "action", type: "string", required: true }, { name: "actorId", type: "string", required: true }, { name: "tenantId", type: "string", required: true }, { name: "oldValue", type: "json", required: false }, { name: "newValue", type: "json", required: false }], compatibility: "FORWARD" },
];

function adminUnavailable(res: Response) {
  return res.status(503).json({
    error: "kafka_admin_unavailable",
    message: "No real Kafka admin client is wired (kafkajs not installed/connected) — refusing to serve fabricated topics/groups/DLQ data",
  });
}

export function registerKafkaEventBus(app: Express) {
  // Topics — real broker metadata only.
  app.get("/api/kafka/v1/topics", async (_req: Request, res: Response) => {
    const topics = await listTopicsReal();
    if (!topics) return adminUnavailable(res);
    res.json({
      items: topics,
      total: topics.length,
      totalPartitions: topics.reduce((s, t) => s + t.partitions, 0),
      source: "kafka_admin",
    });
  });
  app.get("/api/kafka/v1/topics/:name", async (req: Request, res: Response) => {
    const topics = await listTopicsReal();
    if (!topics) return adminUnavailable(res);
    const t = topics.find((x) => x.name === req.params.name);
    t ? res.json({ ...t, source: "kafka_admin" }) : res.status(404).json({ error: "Topic not found" });
  });

  // Consumer groups — real broker metadata only (lag is null: it requires
  // per-partition offset fetches and is never fabricated).
  app.get("/api/kafka/v1/consumer-groups", async (_req: Request, res: Response) => {
    const groups = await listConsumerGroupsReal();
    if (!groups) return adminUnavailable(res);
    res.json({ items: groups, total: groups.length, source: "kafka_admin" });
  });

  // Dead-letter queue — real DLQ topics via the admin client. There is no
  // DLQ payload store in this process, so entry-level fields are null.
  app.get("/api/kafka/v1/dead-letters", async (_req: Request, res: Response) => {
    const topics = await listTopicsReal();
    if (!topics) return adminUnavailable(res);
    const dlqTopics = topics.filter((t) => /dlq|dlt|dead.?letter/i.test(t.name));
    res.json({
      items: dlqTopics.map((t) => ({
        id: t.name,
        originalTopic: t.name.replace(/[._-]?(dlq|dlt|dead.?letter).*$/i, ""),
        errorMessage: null,
        payload: null,
        retryCount: null,
        maxRetries: null,
        createdAt: null,
        status: "unknown",
      })),
      total: dlqTopics.length,
      source: "kafka_admin",
      note: "DLQ entry payloads are not stored by this process; only real DLQ topic names are listed",
    });
  });

  // DLQ retry — 501 unless a real producer actually re-publishes the record.
  // No DLQ payload store is wired here, so a replay cannot be performed
  // honestly today.
  app.post("/api/kafka/v1/dead-letters/:id/retry", async (req: Request, res: Response) => {
    if (!isProducerAvailable()) {
      return res.status(501).json({
        error: "not_implemented",
        message: "DLQ retry requires a real Kafka producer and a DLQ payload store; neither is wired in this process",
      });
    }
    // Even with a producer we have no real DLQ payload for this id (no DLQ
    // consumer/store) — we cannot re-publish what we never durably read.
    return res.status(501).json({
      error: "not_implemented",
      message: `No real DLQ record found for ${req.params.id}; refusing to fabricate a retry`,
    });
  });

  // Schema registry — declared schema catalog (static config).
  app.get("/api/kafka/v1/schemas", (_req: Request, res: Response) => {
    res.json({ items: SCHEMAS, total: SCHEMAS.length, source: "declared-schema-catalog" });
  });

  // Publish event — real broker send only. 201 is returned solely after the
  // producer ack; otherwise 503 (no producer) or 502 (broker error).
  app.post("/api/kafka/v1/publish", async (req: Request, res: Response) => {
    const { topic, key, value } = req.body ?? {};
    if (!topic || value === undefined || value === null) {
      return res.status(400).json({ error: "topic and value required" });
    }
    try {
      await kafkaPublish(topic, { key, value, publishedAt: new Date().toISOString() });
      res.status(201).json({ status: "published", topic, timestamp: new Date().toISOString() });
    } catch (err: any) {
      if (err instanceof KafkaUnavailableError) {
        logger.warn(`[KafkaBus] Publish to ${topic} rejected — ${err.message}`);
        return res.status(503).json({ error: "event_bus_unavailable", message: err.message });
      }
      logger.error(`[KafkaBus] Publish to ${topic} failed: ${err?.message ?? err}`);
      res.status(502).json({ error: "publish_failed", message: err?.message ?? String(err) });
    }
  });

  // Stats — aggregates from the real admin client when available (null when
  // not); cluster health/counters from the real client state. No fabricated
  // message rates or lag figures.
  app.get("/api/kafka/v1/stats", async (_req: Request, res: Response) => {
    const kafka = getKafkaStatus();
    const topics = await listTopicsReal();
    const groups = topics ? await listConsumerGroupsReal() : null;
    res.json({
      totalTopics: topics ? topics.length : null,
      totalPartitions: topics ? topics.reduce((s, t) => s + t.partitions, 0) : null,
      totalMessageRate: null, // requires broker metrics; never fabricated
      consumerGroups: groups ? groups.length : null,
      totalLag: null, // requires real offset fetches; never fabricated
      deadLetters: null, // no DLQ payload store wired
      schemas: SCHEMAS.length,
      brokers: kafka.brokers.length,
      clusterHealth: kafka.connected ? "green" : "red",
      mode: kafka.mode,
      producerAvailable: kafka.producerAvailable,
      adminAvailable: kafka.adminAvailable,
      lastProbe: kafka.lastProbe,
      error: kafka.error,
      publishedMessages: kafka.stats.published,
      consumedMessages: kafka.stats.consumed,
      source: topics ? "kafka_admin" : "unavailable",
    });
  });
}
