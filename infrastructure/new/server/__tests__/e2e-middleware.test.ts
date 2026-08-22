import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Middleware Integration", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /healthz — returns database connected status", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.database).toBe("connected");
    expect(json.status).toBe("ok");
  });

  it("GET /api/platform/redis/status — returns Redis stats", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.mode).toBeTruthy();
  });

  it("GET /api/platform/kafka/status — returns Kafka stats", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.topics).toBeTruthy();
  });

  it("POST /api/platform/kafka/publish — publishes event", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/platform/kafka/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "txn.created",
        payload: { transactionId: "TXN-TEST-001", amount: 50000, currency: "NGN" },
      }),
    });
    expect([200, 201]).toContain(resp.status);
    const json = await resp.json();
    expect(json.published).toBe(true);
  });

  it("Cache middleware adds X-Cache header on DB routes", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const uniqueKey = `_t=${Date.now()}-${Math.random()}`;
    const resp = await fetch(`${BASE}/api/db/customers?${uniqueKey}`);
    expect(resp.status).toBe(200);
    const cacheHeader = resp.headers.get("x-cache");
    expect(cacheHeader, "X-Cache header must be set on /api/db GET responses").toBe("MISS"); // fresh unique key
  });

  it("Second request to same endpoint is served from cache (X-Cache: HIT)", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const key = `cache-test-${Date.now()}`;
    const first = await fetch(`${BASE}/api/db/customers?k=${key}`);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-cache")).toBe("MISS");
    const resp2 = await fetch(`${BASE}/api/db/customers?k=${key}`);
    expect(resp2.status).toBe(200);
    expect(resp2.headers.get("x-cache")).toBe("HIT");
  });
});

describe("E2E: Session Management", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api/platform/sessions/stats — returns session statistics", async (ctx) => {
    if (!serverUp) return ctx.skip();
    const resp = await fetch(`${BASE}/api/platform/sessions/stats`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json).toBeTruthy();
  });
});

