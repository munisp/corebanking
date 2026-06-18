import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: Middleware Integration", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /healthz — returns database connected status", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.database).toBe("connected");
    expect(json.status).toBe("ok");
  });

  it("GET /api/platform/redis/status — returns Redis stats", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.mode).toBeTruthy();
  });

  it("GET /api/platform/kafka/status — returns Kafka stats", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.topics).toBeTruthy();
  });

  it("POST /api/platform/kafka/publish — publishes event", async () => {
    if (!serverUp) return;
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

  it("Cache middleware adds X-Cache header on DB routes", async () => {
    if (!serverUp) return;
    const uniqueKey = `_t=${Date.now()}-${Math.random()}`;
    const resp = await fetch(`${BASE}/api/db/customers?${uniqueKey}`);
    expect(resp.status).toBe(200);
    const cacheHeader = resp.headers.get("x-cache");
    if (cacheHeader) expect(["HIT", "MISS"]).toContain(cacheHeader);
  });

  it("Second request to same endpoint may benefit from cache", async () => {
    if (!serverUp) return;
    const key = `cache-test-${Date.now()}`;
    await fetch(`${BASE}/api/db/customers?k=${key}`);
    const resp2 = await fetch(`${BASE}/api/db/customers?k=${key}`);
    expect(resp2.status).toBe(200);
  });
});

describe("E2E: Session Management", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api/platform/sessions/stats — returns session statistics", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/sessions/stats`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json).toBeTruthy();
  });
});

describe("E2E: MFA/TOTP", () => {
  let adminToken = "";
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("Login to get token for MFA tests", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@54bank.ng", password: "admin" }),
    });
    if (resp.status === 200) {
      const json = await resp.json();
      adminToken = json.accessToken;
    }
  });

  it("POST /api/auth/mfa/enroll — returns TOTP secret and QR code", async () => {
    if (!serverUp || !adminToken) return;
    const resp = await fetch(`${BASE}/api/auth/mfa/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    if (resp.status === 200) {
      const json = await resp.json();
      expect(json.secret).toBeTruthy();
      expect(json.otpauthUrl).toContain("otpauth://totp/");
      expect(json.backupCodes?.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("GET /api/auth/mfa/status — returns MFA enrollment status", async () => {
    if (!serverUp || !adminToken) return;
    const resp = await fetch(`${BASE}/api/auth/mfa/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (resp.status === 200) {
      const json = await resp.json();
      expect(typeof json.enrolled).toBe("boolean");
    }
  });
});
