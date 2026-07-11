/**
 * Dapr Integration — Distributed Application Runtime
 *
 * Provides pub/sub messaging, state store, and service invocation via Dapr HTTP sidecar.
 * Falls back to in-memory/PostgreSQL when Dapr sidecar is unavailable.
 *
 * Dapr HTTP API: http://localhost:{DAPR_HTTP_PORT}/v1.0/...
 * Dapr gRPC API: localhost:{DAPR_GRPC_PORT}
 */

import { db } from "../db";
import {
  daprPublishedEvents,
  daprStateOperations,
  daprServiceInvocations,
  daprSubscriptions,
} from "../../drizzle/schema";
import { logger } from "./logger";

const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3500";
const DAPR_BASE_URL = `http://localhost:${DAPR_HTTP_PORT}/v1.0`;
const DAPR_PUBSUB_NAME = process.env.DAPR_PUBSUB_NAME || "54bank-pubsub";
const DAPR_STATE_STORE = process.env.DAPR_STATE_STORE || "54bank-statestore";
const DAPR_SECRET_STORE = process.env.DAPR_SECRET_STORE || "54bank-secrets";

// ── Dapr availability probe ──────────────────────────────────────────────────

let daprAvailable = false;
let lastProbeAt: Date | null = null;

async function probeDapr(): Promise<boolean> {
  try {
    const res = await fetch(`${DAPR_BASE_URL}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    daprAvailable = res.ok;
  } catch {
    daprAvailable = false;
  }
  lastProbeAt = new Date();
  return daprAvailable;
}

// Probe on startup and every 30s
probeDapr();
setInterval(probeDapr, 30_000);

// ── Pub/Sub ──────────────────────────────────────────────────────────────────

export interface DaprEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  topic?: string;
}

/**
 * Publish an event to a Dapr pub/sub topic.
 * Falls back to PostgreSQL outbox if Dapr is unavailable.
 */
export async function publishEvent(
  event: DaprEvent,
  topic?: string
): Promise<{ success: boolean; backend: "dapr" | "postgres" }> {
  const resolvedTopic = topic ?? inferTopic(event.entityType);
  const eventPayload = {
    specversion: "1.0",
    type: event.eventType,
    source: "54bank-platform",
    id: event.eventId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    data: {
      tenantId: event.tenantId,
      entityId: event.entityId,
      entityType: event.entityType,
      ...event.payload,
    },
  };

  if (daprAvailable) {
    try {
      const res = await fetch(
        `${DAPR_BASE_URL}/publish/${DAPR_PUBSUB_NAME}/${resolvedTopic}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/cloudevents+json" },
          body: JSON.stringify(eventPayload),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (res.ok || res.status === 204) {
        // Log to DB for audit
        await db.insert(daprPublishedEvents).values({
          eventId: event.eventId,
          topic: resolvedTopic,
          pubsubName: DAPR_PUBSUB_NAME,
          eventType: event.eventType,
          tenantId: event.tenantId,
          entityId: event.entityId,
          entityType: event.entityType,
          payload: event.payload,
          status: "published",
          daprAvailable: true,
        }).onConflictDoNothing();
        return { success: true, backend: "dapr" };
      }
    } catch (err) {
      logger.warn({ err, eventId: event.eventId }, "Dapr publish failed, falling back to PostgreSQL outbox");
    }
  }

  // Fallback: write to PostgreSQL outbox for later relay
  await db.insert(daprPublishedEvents).values({
    eventId: event.eventId,
    topic: resolvedTopic,
    pubsubName: DAPR_PUBSUB_NAME,
    eventType: event.eventType,
    tenantId: event.tenantId,
    entityId: event.entityId,
    entityType: event.entityType,
    payload: event.payload,
    status: "pending_relay",
    daprAvailable: false,
  }).onConflictDoNothing();

  return { success: true, backend: "postgres" };
}

function inferTopic(entityType: string): string {
  const topicMap: Record<string, string> = {
    transaction: "banking.transactions",
    payment: "banking.payments.raw",
    account: "banking.accounts",
    loan: "banking.loans",
    kyc: "banking.kyc.events",
    aml: "banking.aml.alerts",
    audit: "banking.audit.trail",
    notification: "banking.notifications",
    fx: "banking.fx.rates",
    gl: "banking.gl.entries",
  };
  return topicMap[entityType.toLowerCase()] ?? "banking.events";
}

// ── State Store ──────────────────────────────────────────────────────────────

/**
 * Save state to Dapr state store.
 */
export async function saveState(
  key: string,
  value: unknown,
  options?: { etag?: string; ttlInSeconds?: number }
): Promise<boolean> {
  const stateEntry = {
    key,
    value,
    options: {
      concurrency: "first-write",
      consistency: "strong",
    },
    metadata: options?.ttlInSeconds
      ? { ttlInSeconds: String(options.ttlInSeconds) }
      : undefined,
  };

  if (daprAvailable) {
    try {
      const res = await fetch(`${DAPR_BASE_URL}/state/${DAPR_STATE_STORE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([stateEntry]),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok || res.status === 204) {
        await db.insert(daprStateOperations).values({
          storeName: DAPR_STATE_STORE,
          operation: "save",
          stateKey: key,
          value: value as Record<string, unknown>,
          etag: options?.etag,
          status: "success",
        });
        return true;
      }
    } catch (err) {
      logger.warn({ err, key }, "Dapr saveState failed");
    }
  }

  await db.insert(daprStateOperations).values({
    storeName: DAPR_STATE_STORE,
    operation: "save",
    stateKey: key,
    value: value as Record<string, unknown>,
    status: "fallback",
  });
  return false;
}

/**
 * Get state from Dapr state store.
 */
export async function getState<T = unknown>(key: string): Promise<T | null> {
  if (daprAvailable) {
    try {
      const res = await fetch(
        `${DAPR_BASE_URL}/state/${DAPR_STATE_STORE}/${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json() as T;
        await db.insert(daprStateOperations).values({
          storeName: DAPR_STATE_STORE,
          operation: "get",
          stateKey: key,
          status: "success",
        });
        return data;
      }
    } catch (err) {
      logger.warn({ err, key }, "Dapr getState failed");
    }
  }
  return null;
}

/**
 * Delete state from Dapr state store.
 */
export async function deleteState(key: string): Promise<boolean> {
  if (daprAvailable) {
    try {
      const res = await fetch(
        `${DAPR_BASE_URL}/state/${DAPR_STATE_STORE}/${encodeURIComponent(key)}`,
        { method: "DELETE", signal: AbortSignal.timeout(5000) }
      );
      if (res.ok || res.status === 204) {
        await db.insert(daprStateOperations).values({
          storeName: DAPR_STATE_STORE,
          operation: "delete",
          stateKey: key,
          status: "success",
        });
        return true;
      }
    } catch (err) {
      logger.warn({ err, key }, "Dapr deleteState failed");
    }
  }
  return false;
}

// ── Service Invocation ───────────────────────────────────────────────────────

/**
 * Invoke a method on another Dapr-enabled service.
 */
export async function invokeService<T = unknown>(
  targetAppId: string,
  method: string,
  data?: unknown,
  httpVerb: "GET" | "POST" | "PUT" | "DELETE" = "POST"
): Promise<{ success: boolean; data: T | null; statusCode: number }> {
  const startMs = Date.now();

  if (daprAvailable) {
    try {
      const url = `${DAPR_BASE_URL}/invoke/${targetAppId}/method/${method}`;
      const res = await fetch(url, {
        method: httpVerb,
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(10_000),
      });

      const latencyMs = Date.now() - startMs;
      const responseData = res.ok ? (await res.json() as T) : null;

      await db.insert(daprServiceInvocations).values({
        sourceApp: "54bank-platform",
        targetApp: targetAppId,
        method,
        httpVerb,
        requestPayload: data as Record<string, unknown>,
        responsePayload: responseData as Record<string, unknown>,
        statusCode: res.status,
        latencyMs,
      });

      return { success: res.ok, data: responseData, statusCode: res.status };
    } catch (err) {
      logger.warn({ err, targetAppId, method }, "Dapr service invocation failed");
    }
  }

  await db.insert(daprServiceInvocations).values({
    sourceApp: "54bank-platform",
    targetApp: targetAppId,
    method,
    httpVerb,
    requestPayload: data as Record<string, unknown>,
    statusCode: 503,
    latencyMs: Date.now() - startMs,
  });

  return { success: false, data: null, statusCode: 503 };
}

// ── Subscription Registration ────────────────────────────────────────────────

/**
 * Register a Dapr subscription and persist it to the DB.
 */
export async function registerSubscription(
  pubsubName: string,
  topic: string,
  route: string,
  handlerName: string
): Promise<void> {
  await db.insert(daprSubscriptions).values({
    pubsubName,
    topic,
    route,
    handlerName,
    status: "active",
  }).onConflictDoNothing();
}

// ── Dapr Status ──────────────────────────────────────────────────────────────

export function getDaprStatus(): {
  available: boolean;
  baseUrl: string;
  pubsubName: string;
  stateStore: string;
  lastProbeAt: Date | null;
} {
  return {
    available: daprAvailable,
    baseUrl: DAPR_BASE_URL,
    pubsubName: DAPR_PUBSUB_NAME,
    stateStore: DAPR_STATE_STORE,
    lastProbeAt,
  };
}

// ── Dapr Subscription Endpoint Builder ──────────────────────────────────────

/**
 * Returns the Dapr subscription manifest for /dapr/subscribe endpoint.
 * Mount this on your Express app at GET /dapr/subscribe.
 */
export function getDaprSubscribeManifest(): Array<{
  pubsubname: string;
  topic: string;
  route: string;
  metadata?: Record<string, string>;
}> {
  return [
    {
      pubsubname: DAPR_PUBSUB_NAME,
      topic: "banking.transactions",
      route: "/dapr/subscribe/transactions",
      metadata: { rawPayload: "false" },
    },
    {
      pubsubname: DAPR_PUBSUB_NAME,
      topic: "banking.payments.raw",
      route: "/dapr/subscribe/payments",
      metadata: { rawPayload: "false" },
    },
    {
      pubsubname: DAPR_PUBSUB_NAME,
      topic: "banking.kyc.events",
      route: "/dapr/subscribe/kyc",
      metadata: { rawPayload: "false" },
    },
    {
      pubsubname: DAPR_PUBSUB_NAME,
      topic: "banking.aml.alerts",
      route: "/dapr/subscribe/aml",
      metadata: { rawPayload: "false" },
    },
    {
      pubsubname: DAPR_PUBSUB_NAME,
      topic: "banking.notifications",
      route: "/dapr/subscribe/notifications",
      metadata: { rawPayload: "false" },
    },
  ];
}
