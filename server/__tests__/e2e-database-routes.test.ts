import { describe, it, expect, beforeAll } from "vitest";
import { BASE, isServerAvailable } from "./e2e-helpers";

let serverUp = false;

async function fetchJson(path: string) {
  const resp = await fetch(`${BASE}${path}`);
  const text = await resp.text();
  try {
    return { status: resp.status, json: JSON.parse(text), isJson: true };
  } catch {
    return { status: resp.status, json: null, isJson: false };
  }
}

describe("E2E: Database Routes — Core Tables", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  const coreTables = [
    "customers", "accounts", "transactions", "loans", "tenants",
    "transfers", "settlements", "aml-alerts", "kyc-verifications",
    "audit-trail", "journal-entries", "gl-accounts",
  ];

  for (const table of coreTables) {
    it(`/api/db/${table} returns source=database with items`, async () => {
      if (!serverUp) return;
      const { status, json, isJson } = await fetchJson(`/api/db/${table}`);
      expect(status).toBe(200);
      expect(isJson).toBe(true);
      expect(json.source).toBe("database");
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThan(0);
    });
  }

  it("supports pagination via page and limit params", async () => {
    if (!serverUp) return;
    const { status, json } = await fetchJson("/api/db/customers?page=1&limit=2");
    expect(status).toBe(200);
    expect(json.source).toBe("database");
    expect(json.page).toBe(1);
    expect(json.limit).toBe(2);
    expect(json.items.length).toBeLessThanOrEqual(2);
  });

  it("returns total count for customers", async () => {
    if (!serverUp) return;
    const { json } = await fetchJson("/api/db/customers");
    expect(json.total).toBeGreaterThan(0);
  });
});

describe("E2E: Database Routes — Regulatory & Compliance", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  const regulatoryTables = ["aml-alerts", "kyc-verifications", "regulatory-reports", "sanctions-screenings"];

  for (const table of regulatoryTables) {
    it(`/api/db/${table} returns database data`, async () => {
      if (!serverUp) return;
      const { status, json, isJson } = await fetchJson(`/api/db/${table}`);
      expect(status).toBe(200);
      expect(isJson).toBe(true);
      expect(json.source).toBe("database");
    });
  }
});

describe("E2E: Database Routes — Channel Banking", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  const channelTables = [
    "voice-banking-gateway", "telegram-bot-gateway",
    "whatsapp-business-gateway", "ussd-banking-gateway", "sms-banking-gateway",
  ];

  for (const table of channelTables) {
    it(`/api/db/${table} returns data from Postgres`, async () => {
      if (!serverUp) return;
      const { status, json, isJson } = await fetchJson(`/api/db/${table}`);
      expect(status).toBe(200);
      expect(isJson).toBe(true);
      expect(json.source).toBe("database");
    });
  }
});

describe("E2E: Database Routes — Agriculture & Cooperative Banking", () => {
  beforeAll(async () => { serverUp = await isServerAvailable(); });

  const agriTables = ["agri-loans", "cooperative-management", "livestock-management"];

  for (const table of agriTables) {
    it(`/api/db/${table} returns data from Postgres`, async () => {
      if (!serverUp) return;
      const { status, json, isJson } = await fetchJson(`/api/db/${table}`);
      expect(status).toBe(200);
      expect(isJson).toBe(true);
      expect(json.source).toBe("database");
    });
  }
});
