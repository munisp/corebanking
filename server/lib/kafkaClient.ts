/**
 * Kafka Client — connects to Kafka when KAFKA_BROKERS is set.
 * Uses native TCP socket to probe broker connectivity (no external dependency).
 * Provides publish/subscribe abstraction with in-memory fallback.
 */

import net from "net";
import { logger } from "./logger";

interface KafkaState {
  connected: boolean;
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

type MessageHandler = (topic: string, message: any) => void;

const state: KafkaState = {
  connected: false,
  brokers: [],
  latencyMs: 0,
  lastProbe: null,
  error: null,
  mode: "memory",
  topics: [],
  stats: { published: 0, consumed: 0, errors: 0 },
};

// In-memory event bus for when Kafka is not available
const eventBus = new Map<string, MessageHandler[]>();
const messageLog: Array<{ topic: string; message: any; timestamp: Date }> = [];
const MAX_LOG_SIZE = 10000;

// Standard banking topics
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

export async function initKafka(): Promise<void> {
  const brokersEnv = process.env.KAFKA_BROKERS;
  if (!brokersEnv) {
    logger.info("[Kafka] No KAFKA_BROKERS — using in-memory event bus");
    state.mode = "memory";
    state.topics = BANKING_TOPICS;
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

  if (anyConnected) {
    state.connected = true;
    state.mode = "kafka";
    state.topics = BANKING_TOPICS;
    state.lastProbe = new Date();
    logger.info(`[Kafka] Connected — ${BANKING_TOPICS.length} topics registered`);
  } else {
    state.mode = "memory";
    state.topics = BANKING_TOPICS;
    state.error = "All brokers unreachable — using in-memory event bus";
    logger.warn(`[Kafka] ${state.error}`);
  }
}

export function publish(topic: string, message: any): void {
  state.stats.published++;

  // Log the message
  if (messageLog.length >= MAX_LOG_SIZE) messageLog.shift();
  messageLog.push({ topic, message, timestamp: new Date() });

  // Dispatch to in-memory subscribers
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

export function getKafkaStatus(): KafkaState {
  return { ...state };
}

export function getRecentMessages(topic?: string, limit = 50): typeof messageLog {
  const filtered = topic ? messageLog.filter((m) => m.topic === topic) : messageLog;
  return filtered.slice(-limit);
}

export function shutdownKafka(): void {
  eventBus.clear();
  state.connected = false;
}
