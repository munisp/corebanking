/**
 * Kafka Client — honest event publishing.
 *
 * Doctrine:
 *  - publish() NEVER pretends to have delivered to a broker. It succeeds
 *    only when a real producer (kafkajs) is configured and connected —
 *    i.e. KAFKA_BOOTSTRAP_SERVERS (or KAFKA_BROKERS) is set AND the kafkajs
 *    package is installed in this app. Otherwise it throws
 *    KafkaUnavailableError, and HTTP callers must surface 502/503 — never
 *    { published: true }.
 *  - The TCP probe (probeBroker) measures broker reachability only; it is
 *    NOT proof of publication and never gates a 201 by itself.
 *  - getRecentMessages()/subscribe() serve the in-process ring buffer of
 *    events THIS process successfully published or observed; every entry is
 *    labeled source: "in-process". It is not broker history.
 *  - Admin metadata (topics/consumer groups) is served only from a real
 *    kafkajs admin client; when none is available the admin helpers return
 *    null so callers can respond 503 kafka_admin_unavailable.
 */

import net from "net";
import { logger } from "./logger";

export class KafkaUnavailableError extends Error {
  constructor(message = "No real Kafka producer is configured — the event was NOT published") {
    super(message);
    this.name = "KafkaUnavailableError";
  }
}

interface KafkaState {
  connected: boolean; // broker TCP reachability (probe only — NOT publishability)
  producerAvailable: boolean; // real kafkajs producer connected
  adminAvailable: boolean; // real kafkajs admin client connected
  brokers: string[];
  latencyMs: number;
  lastProbe: Date | null;
  error: string | null;
  mode: "kafka" | "memory";
  topics: string[];
  stats: {
    published: number;
    consumed: number;
    errors: number;
  };
}

interface MessageLogEntry {
  topic: string;
  message: any;
  timestamp: Date;
  source: "in-process";
}

type MessageHandler = (topic: string, message: any) => void;

const state: KafkaState = {
  connected: false,
  producerAvailable: false,
  adminAvailable: false,
  brokers: [],
  latencyMs: 0,
  lastProbe: null,
  error: null,
  mode: "memory",
  topics: [],
  stats: { published: 0, consumed: 0, errors: 0 },
};

// In-process subscribers/ring buffer — only fed after a REAL publish.
const eventBus = new Map<string, MessageHandler[]>();
const messageLog: MessageLogEntry[] = [];
const MAX_LOG_SIZE = 10000;

// Real kafkajs handles (null unless the package is installed and connected)
let realProducer: { send: (record: any) => Promise<unknown>; disconnect: () => Promise<void> } | null = null;
let adminClient: any = null;

// Standard banking topics (desired topic catalog, not live broker metadata)
const BANKING_TOPICS = [
  "txn.created",
  "txn.completed",
  "txn.failed",
  "txn.reversed",
  "customer.created",
  "customer.updated",
  "customer.kyc.verified",
  "account.opened",
  "account.closed",
  "account.balance.changed",
  "loan.disbursed",
  "loan.repaid",
  "loan.overdue",
  "aml.alert",
  "aml.sar.filed",
  "fraud.detected",
  "auth.login",
  "auth.logout",
  "auth.failed",
  "audit.event",
];

function parseBrokers(brokersStr: string): Array<{ host: string; port: number }> {
  return brokersStr.split(",").map((b) => {
    const parts = b.trim().split(":");
    return { host: parts[0], port: parseInt(parts[1]) || 9092 };
  });
}

async function probeBroker(host: string, port: number): Promise<{ ok: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout: 3000 });

    socket.on("connect", () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, latencyMs });
    });

    socket.on("error", () => {
      resolve({ ok: false, latencyMs: Date.now() - start });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start });
    });
  });
}

/**
 * Attempt to wire a real kafkajs producer + admin client. kafkajs is an
 * optional dependency: if it is not installed, or the connect fails, both
 * handles stay null and publish()/admin queries fail loud.
 */
async function tryInitRealClients(brokers: string[]): Promise<void> {
  let KafkaCtor: any = null;
  try {
    // Indirect specifier so TS does not require kafkajs types at build time.
    const specifier = "kafkajs";
    const mod: any = await import(specifier).catch(() => null);
    KafkaCtor = mod?.Kafka ?? null;
  } catch {
    KafkaCtor = null;
  }
  if (!KafkaCtor) {
    logger.warn("[Kafka] kafkajs package not installed — real producer/admin unavailable");
    return;
  }
  try {
    const kafka = new KafkaCtor({ brokers, clientId: "infra-admin-server" });
    realProducer = kafka.producer();
    await realProducer!.send === undefined; // no-op type guard
    await (realProducer as any).connect();
    state.producerAvailable = true;
    adminClient = kafka.admin();
    await adminClient.connect();
    state.adminAvailable = true;
    logger.info("[Kafka] Real producer + admin client connected (kafkajs)");
  } catch (err: any) {
    logger.warn(`[Kafka] Real client connect failed: ${err?.message ?? err}`);
    realProducer = null;
    adminClient = null;
    state.producerAvailable = false;
    state.adminAvailable = false;
  }
}

export async function initKafka(): Promise<void> {
  const brokersEnv = process.env.KAFKA_BOOTSTRAP_SERVERS || process.env.KAFKA_BROKERS;
  if (!brokersEnv) {
    logger.info("[Kafka] No KAFKA_BOOTSTRAP_SERVERS/KAFKA_BROKERS — no real producer; publish() will fail loud");
    state.mode = "memory";
    state.topics = BANKING_TOPICS;
    state.error = "no_brokers_configured";
    return;
  }

  const brokers = parseBrokers(brokersEnv);
  state.brokers = brokers.map((b) => `${b.host}:${b.port}`);
  logger.info(`[Kafka] Probing ${brokers.length} broker(s): ${state.brokers.join(", ")}`);

  let anyConnected = false;
  for (const broker of brokers) {
    const result = await probeBroker(broker.host, broker.port);
    if (result.ok) {
      anyConnected = true;
      state.latencyMs = result.latencyMs;
      logger.info(`[Kafka] Broker ${broker.host}:${broker.port} reachable (${result.latencyMs}ms)`);
    } else {
      logger.warn(`[Kafka] Broker ${broker.host}:${broker.port} unreachable`);
    }
  }

  state.connected = anyConnected;
  state.lastProbe = new Date();
  state.topics = BANKING_TOPICS;

  if (anyConnected) {
    await tryInitRealClients(state.brokers);
  } else {
    state.error = "All brokers unreachable";
    logger.warn(`[Kafka] ${state.error}`);
  }

  state.mode = state.producerAvailable ? "kafka" : "memory";
  if (!state.producerAvailable) {
    state.error =
      (state.error ? state.error + "; " : "") +
      "no real producer configured (kafkajs missing or connect failed) — publish() throws KafkaUnavailableError";
    logger.warn(`[Kafka] ${state.error}`);
  }
}

/**
 * Publish an event to the real Kafka broker. Throws KafkaUnavailableError
 * when no real producer is configured; propagates broker send errors.
 * Callers must treat a throw as "NOT published" (HTTP 502/503).
 */
export async function publish(topic: string, message: any): Promise<void> {
  if (!state.producerAvailable || !realProducer) {
    state.stats.errors++;
    throw new KafkaUnavailableError();
  }

  await realProducer.send({
    topic,
    messages: [{ value: typeof message === "string" ? message : JSON.stringify(message) }],
  });

  state.stats.published++;

  // Record in the in-process ring buffer (clearly labeled) and notify
  // in-process subscribers.
  if (messageLog.length >= MAX_LOG_SIZE) messageLog.shift();
  messageLog.push({ topic, message, timestamp: new Date(), source: "in-process" });

  const handlers = eventBus.get(topic) || [];
  for (const handler of handlers) {
    try {
      handler(topic, message);
      state.stats.consumed++;
    } catch (err: any) {
      state.stats.errors++;
      logger.error(`[Kafka] Handler error on ${topic}: ${err.message}`);
    }
  }
}

export function subscribe(topic: string, handler: MessageHandler): void {
  const handlers = eventBus.get(topic) || [];
  handlers.push(handler);
  eventBus.set(topic, handlers);
}

export function isProducerAvailable(): boolean {
  return state.producerAvailable;
}

export function isAdminAvailable(): boolean {
  return state.adminAvailable;
}

export function getKafkaStatus(): KafkaState {
  return { ...state };
}

/**
 * Real topic metadata from the kafkajs admin client, or null when no admin
 * client is available. No synthetic rates/statuses are attached.
 */
export async function listTopicsReal(): Promise<Array<{ name: string; partitions: number; replicationFactor: number }> | null> {
  if (!adminClient) return null;
  try {
    const names: string[] = (await adminClient.listTopics()).filter((t: string) => !t.startsWith("__"));
    const meta = await adminClient.fetchTopicMetadata({ topics: names });
    return (meta.topics || []).map((t: any) => ({
      name: t.name,
      partitions: Array.isArray(t.partitions) ? t.partitions.length : 0,
      replicationFactor: t.partitions?.[0]?.replicas?.length ?? 0,
    }));
  } catch (err: any) {
    logger.warn(`[Kafka] admin listTopics failed: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * Real consumer-group metadata from the kafkajs admin client, or null when
 * unavailable. Lag requires per-partition offset fetches and is reported as
 * null rather than fabricated.
 */
export async function listConsumerGroupsReal(): Promise<Array<{ groupId: string; members: number; status: string; lag: number | null }> | null> {
  if (!adminClient) return null;
  try {
    const listed = await adminClient.listGroups();
    const ids: string[] = (listed.groups || []).map((g: any) => g.groupId);
    if (ids.length === 0) return [];
    const described = await adminClient.describeGroups(ids);
    return (described.groups || []).map((g: any) => ({
      groupId: g.groupId,
      members: Array.isArray(g.members) ? g.members.length : 0,
      status: g.state ?? "unknown",
      lag: null,
    }));
  } catch (err: any) {
    logger.warn(`[Kafka] admin describeGroups failed: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * In-process ring buffer of recently published events (source-labeled).
 * This is NOT broker history.
 */
export function getRecentMessages(topic?: string, limit = 50): MessageLogEntry[] {
  const filtered = topic ? messageLog.filter((m) => m.topic === topic) : messageLog;
  return filtered.slice(-limit);
}

export async function shutdownKafka(): Promise<void> {
  eventBus.clear();
  state.connected = false;
  state.producerAvailable = false;
  state.adminAvailable = false;
  try {
    await realProducer?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    await adminClient?.disconnect();
  } catch {
    /* ignore */
  }
  realProducer = null;
  adminClient = null;
}
