/**
 * Fluvio Streaming Integration — Node.js BFF layer
 *
 * Provides event production to Fluvio topics with PostgreSQL outbox fallback.
 * Fluvio is a Rust-native streaming platform; Node.js integrates via HTTP Admin API
 * and the fluvio-wasm-transform-rs / fluvio-streams-rs microservices.
 *
 * Fluvio SC (System Controller): fluvio:9003
 * Fluvio Admin API: http://fluvio-streams-rs:8119 (internal service)
 */

import { db } from "../db";
import {
  fluvioEventLog,
  fluvioEventOutbox,
  fluvioConsumerGroups,
  fluvioTopics,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

const FLUVIO_STREAMS_URL = process.env.FLUVIO_STREAMS_URL || "http://fluvio-streams-rs:8119";
const FLUVIO_ENDPOINT = process.env.FLUVIO_ENDPOINT || "fluvio:9003";

// ── Fluvio availability probe ────────────────────────────────────────────────

let fluvioAvailable = false;

async function probeFluvio(): Promise<boolean> {
  try {
    const res = await fetch(`${FLUVIO_STREAMS_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    fluvioAvailable = res.ok;
  } catch {
    fluvioAvailable = false;
  }
  return fluvioAvailable;
}

probeFluvio();
setInterval(probeFluvio, 30_000);

// ── Topic Definitions ────────────────────────────────────────────────────────

export const FLUVIO_TOPICS = {
  TRANSACTIONS: "banking.transactions",
  ACCOUNTS: "banking.accounts",
  PAYMENTS_RAW: "banking.payments.raw",
  PAYMENTS_ENRICHED: "banking.payments.enriched",
  KYC_EVENTS: "banking.kyc.events",
  AML_ALERTS: "banking.aml.alerts",
  AUDIT_TRAIL: "banking.audit.trail",
  NOTIFICATIONS: "banking.notifications",
  LOANS: "banking.loans",
  FX_RATES: "banking.fx.rates",
  GL_ENTRIES: "banking.gl.entries",
  REGULATORY_REPORTS: "banking.regulatory.reports",
} as const;

export type FluvioTopic = (typeof FLUVIO_TOPICS)[keyof typeof FLUVIO_TOPICS];

// ── Event Production ─────────────────────────────────────────────────────────

export interface FluvioEvent {
  eventType: string;
  tenantId: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  partitionKey?: string;
}

/**
 * Produce an event to a Fluvio topic.
 * Falls back to PostgreSQL outbox if Fluvio is unavailable.
 */
export async function produceEvent(
  topic: FluvioTopic | string,
  event: FluvioEvent
): Promise<{ success: boolean; backend: "fluvio" | "postgres_outbox"; eventId: string }> {
  const eventId = crypto.randomUUID();
  const partitionKey = event.partitionKey ?? event.tenantId;

  if (fluvioAvailable) {
    try {
      const res = await fetch(`${FLUVIO_STREAMS_URL}/produce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          key: partitionKey,
          value: {
            eventId,
            eventType: event.eventType,
            tenantId: event.tenantId,
            entityId: event.entityId,
            entityType: event.entityType,
            timestamp: new Date().toISOString(),
            ...event.payload,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const result = await res.json() as { offset?: number };
        // Log to DB for audit trail
        await db.insert(fluvioEventLog).values({
          eventId,
          topic,
          eventType: event.eventType,
          tenantId: event.tenantId,
          entityId: event.entityId,
          entityType: event.entityType,
          payload: event.payload,
          partitionKey,
          fluvioOffset: result.offset,
          backend: "fluvio",
        }).onConflictDoNothing();

        return { success: true, backend: "fluvio", eventId };
      }
    } catch (err) {
      logger.warn({ err, topic, eventId }, "Fluvio produce failed, writing to outbox");
    }
  }

  // Fallback: PostgreSQL outbox
  await db.insert(fluvioEventOutbox).values({
    eventId,
    topic,
    eventType: event.eventType,
    tenantId: event.tenantId,
    entityId: event.entityId,
    payload: event.payload,
    status: "pending",
    attempts: 0,
  }).onConflictDoNothing();

  return { success: true, backend: "postgres_outbox", eventId };
}

// ── Batch Production ─────────────────────────────────────────────────────────

/**
 * Produce multiple events to a topic in a single batch.
 */
export async function produceBatch(
  topic: FluvioTopic | string,
  events: FluvioEvent[]
): Promise<{ produced: number; failed: number; backend: "fluvio" | "postgres_outbox" }> {
  if (fluvioAvailable) {
    try {
      const records = events.map((event) => ({
        key: event.partitionKey ?? event.tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: event.eventType,
          tenantId: event.tenantId,
          entityId: event.entityId,
          entityType: event.entityType,
          timestamp: new Date().toISOString(),
          ...event.payload,
        },
      }));

      const res = await fetch(`${FLUVIO_STREAMS_URL}/produce/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, records }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const result = await res.json() as { produced?: number; failed?: number };
        return {
          produced: result.produced ?? events.length,
          failed: result.failed ?? 0,
          backend: "fluvio",
        };
      }
    } catch (err) {
      logger.warn({ err, topic }, "Fluvio batch produce failed, falling back to outbox");
    }
  }

  // Fallback: write all to outbox
  const outboxRows = events.map((event) => ({
    eventId: crypto.randomUUID(),
    topic,
    eventType: event.eventType,
    tenantId: event.tenantId,
    entityId: event.entityId,
    payload: event.payload,
    status: "pending" as const,
    attempts: 0,
  }));

  await db.insert(fluvioEventOutbox).values(outboxRows).onConflictDoNothing();
  return { produced: events.length, failed: 0, backend: "postgres_outbox" };
}

// ── Outbox Relay ─────────────────────────────────────────────────────────────

/**
 * Relay pending outbox events to Fluvio when it becomes available.
 * Call this from a background job or scheduled task.
 */
export async function relayOutboxEvents(batchSize = 100): Promise<{
  relayed: number;
  failed: number;
}> {
  if (!fluvioAvailable) return { relayed: 0, failed: 0 };

  const pending = await db
    .select()
    .from(fluvioEventOutbox)
    .where(eq(fluvioEventOutbox.status, "pending"))
    .limit(batchSize);

  let relayed = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      const res = await fetch(`${FLUVIO_STREAMS_URL}/produce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: event.topic,
          key: event.tenantId,
          value: { eventId: event.eventId, ...event.payload },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        await db
          .update(fluvioEventOutbox)
          .set({ status: "processed", processedAt: new Date() })
          .where(eq(fluvioEventOutbox.eventId, event.eventId));
        relayed++;
      } else {
        await db
          .update(fluvioEventOutbox)
          .set({ attempts: (event.attempts ?? 0) + 1, lastError: `HTTP ${res.status}` })
          .where(eq(fluvioEventOutbox.eventId, event.eventId));
        failed++;
      }
    } catch (err) {
      await db
        .update(fluvioEventOutbox)
        .set({
          attempts: (event.attempts ?? 0) + 1,
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(fluvioEventOutbox.eventId, event.eventId));
      failed++;
    }
  }

  return { relayed, failed };
}

// ── Consumer Group Management ────────────────────────────────────────────────

/**
 * Update consumer group offset.
 */
export async function updateConsumerOffset(
  groupId: string,
  topic: string,
  partitionId: number,
  offset: number
): Promise<void> {
  await db
    .update(fluvioConsumerGroups)
    .set({
      committedOffset: offset,
      lastHeartbeat: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fluvioConsumerGroups.groupId, groupId),
        eq(fluvioConsumerGroups.topic, topic),
        eq(fluvioConsumerGroups.partitionId, partitionId)
      )
    );
}

// ── Fluvio Status ────────────────────────────────────────────────────────────

export function getFluvioStatus(): {
  available: boolean;
  endpoint: string;
  streamsServiceUrl: string;
} {
  return {
    available: fluvioAvailable,
    endpoint: FLUVIO_ENDPOINT,
    streamsServiceUrl: FLUVIO_STREAMS_URL,
  };
}

// ── Convenience Helpers ──────────────────────────────────────────────────────

/** Produce a transaction event */
export const produceTransactionEvent = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.TRANSACTIONS, event);

/** Produce a payment event */
export const producePaymentEvent = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.PAYMENTS_RAW, event);

/** Produce a KYC event */
export const produceKycEvent = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.KYC_EVENTS, event);

/** Produce an AML alert */
export const produceAmlAlert = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.AML_ALERTS, event);

/** Produce an audit trail event */
export const produceAuditEvent = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.AUDIT_TRAIL, event);

/** Produce a notification event */
export const produceNotificationEvent = (event: FluvioEvent) =>
  produceEvent(FLUVIO_TOPICS.NOTIFICATIONS, event);
