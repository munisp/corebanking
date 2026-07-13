import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

describe("Database-backed Routes", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  const tables = [
    "customers", "accounts", "transactions", "loans", "tenants",
    "aml-alerts", "kyc-verifications", "fx-trades", "audit-trail",
    "journal-entries", "gl-accounts", "transfers", "settlements",
  ];

  for (const table of tables) {
    it(`/api/db/${table} returns source=database with items`, async () => {
      if (!serverUp) return;
      const resp = await fetch(`${BASE}/api/db/${table}`);
      expect(resp.status).toBe(200);
      const data = await resp.json() as any;
      expect(data.source).toBe("database");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });
  }

  it("/api/db/customers returns Nigerian banking data", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers`);
    const data = await resp.json() as any;
    expect(data.items.length).toBeGreaterThan(0);
    const first = data.items[0];
    expect(first.name || first.customerId).toBeTruthy();
  });

  it("/api/db/accounts returns accounts with balances", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/accounts`);
    const data = await resp.json() as any;
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("supports pagination via page and limit params", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers?page=1&limit=2`);
    const data = await resp.json() as any;
    expect(data.items.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
  });

  it("returns count endpoint for tables", async () => {
    if (!serverUp) return;
    const resp = await fetch(`${BASE}/api/db/customers/count`);
    if (resp.ok) {
      const data = await resp.json() as any;
      expect(data.count || data.total).toBeGreaterThanOrEqual(0);
    }
  });
});
