import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

describe("Event Publishing & Kafka Integration", () => {
  it("publishes transaction events", async () => {
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
    const resp = await fetch(`${BASE}/api/events/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "completed", transactionId: "TXN-999", amount: 100000 }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.event).toBe("txn.completed");
  });

  it("publishes KYC verification events", async () => {
    const resp = await fetch(`${BASE}/api/events/customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "CUST-003", type: "kyc" }),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json() as any;
    expect(data.event).toBe("customer.kyc.verified");
  });

  it("kafka status returns 20 topics", async () => {
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.topics).toHaveLength(20);
    expect(data.topics).toContain("txn.created");
    expect(data.topics).toContain("aml.alert");
  });

  it("redis status returns mode and stats", async () => {
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(["redis", "memory"]).toContain(data.mode);
    expect(data.stats).toBeDefined();
  });
});
