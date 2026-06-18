import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("E2E: API CRUD Operations", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api/db/customers — returns Nigerian customer data", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.source).toBe("database");
    expect(json.items.length).toBeGreaterThan(0);
  });

  it("GET /api/db/accounts — returns account data", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/accounts`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.source).toBe("database");
    expect(json.items.length).toBeGreaterThan(0);
  });

  it("GET /api/db/transactions — returns transaction records", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/transactions`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.source).toBe("database");
  });

  it("GET /api/db/loans — returns loan data", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/loans`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.source).toBe("database");
  });

  it("GET /api/db/tenants — returns tenant configurations", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/tenants`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.source).toBe("database");
  });

  it("GET /api/platform/audit/stats — returns audit statistics", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/platform/audit/stats`);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json).toBeTruthy();
  });
});

describe("E2E: Swagger & API Documentation", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  it("GET /api-docs returns content", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api-docs`);
    expect([200, 301, 302]).toContain(resp.status);
  });
});
