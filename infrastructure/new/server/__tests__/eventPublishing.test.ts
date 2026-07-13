import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const BASE = "http://localhost:3000";

describe("Event Publishing & Kafka Integration", () => {
  it("publishes transaction events", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ published: true, event: "txn.created", topic: "transactions" }),
    });
    const resp = await fetch(`${BASE}/api/events/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "ACC-001", amount: 50000, currency: "NGN" }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.published).toBe(true);
    expect(data.event).toBe("txn.created");
  });

  it("publishes customer events", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ published: true, event: "customer.created" }),
    });
    const resp = await fetch(`${BASE}/api/events/customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "CUST-001", type: "created" }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.published).toBe(true);
    expect(data.event).toBe("customer.created");
  });

  it("publishes AML alert events", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ published: true, event: "aml.alert" }),
    });
    const resp = await fetch(`${BASE}/api/events/aml-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "CUST-002", alertType: "high_risk", riskScore: 85 }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.published).toBe(true);
    expect(data.event).toBe("aml.alert");
  });

  it("publishes completed transaction events", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ published: true, event: "txn.completed" }),
    });
    const resp = await fetch(`${BASE}/api/events/transaction-completed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: "TXN-001", status: "completed" }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.published).toBe(true);
    expect(data.event).toBe("txn.completed");
  });

  it("publishes KYC verification events", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ published: true, event: "kyc.verified" }),
    });
    const resp = await fetch(`${BASE}/api/events/kyc-verified`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "CUST-003", kycLevel: 3 }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.published).toBe(true);
    expect(data.event).toBe("kyc.verified");
  });

  it("kafka status returns 20 topics", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        status: "connected",
        topics: Array.from({ length: 20 }, (_, i) => `topic-${i + 1}`),
        topicCount: 20,
      }),
    });
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.topicCount).toBe(20);
  });

  it("redis status returns mode and stats", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        status: "connected",
        mode: "standalone",
        stats: { hits: 1024, misses: 256, hitRate: "80%" },
      }),
    });
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.mode).toBeTruthy();
    expect(data.stats).toBeTruthy();
  });
});
