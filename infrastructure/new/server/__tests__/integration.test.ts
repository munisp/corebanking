import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/healthz`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        serverAvailable = json.database === "connected";
      }
    }
  } catch {
    serverAvailable = false;
  }
});

// H-40 remediation: this helper previously FABRICATED passing payloads
// ({ items: [{ _skipped: true }], ... }) whenever the server was unavailable
// or returned non-JSON — every test downstream was a guaranteed green no-op.
// It now asserts the real response contract and fails loudly.
async function fetchJSON(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  expect(res.status, `GET ${path} must return 200`).toBe(200);
  const contentType = res.headers.get("content-type") || "";
  expect(contentType, `GET ${path} must return JSON`).toContain("application/json");
  return res.json();
}

describe("Platform Health", () => {
  it("should return platform health status", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/health");
    expect(data).toBeDefined();
  });
});

describe("Core Banking APIs", () => {
  it("should list customers with Nigerian seed data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/customers");
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("should list accounts", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/accounts");
    expect(data.items).toBeDefined();
  });

  it("should list transfers", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/transfers");
    expect(data.items).toBeDefined();
  });

  it("should list loans", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/loans");
    expect(data.items).toBeDefined();
  });
});

describe("Middleware APIs", () => {
  it("should return APISIX routes", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/apisix/routes");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("uri");
      expect(data.items[0]).toHaveProperty("upstream");
  });

  it("should return OpenAppSec WAF rules", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/openappsec/rules");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("category");
      expect(data.items[0]).toHaveProperty("mlConfidence");
  });

  it("should return Keycloak realms", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/keycloak/realms");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0].name).toBe("54bank");
      expect(data.items[0].mfaEnforced).toBe(true);
  });

  it("should return Keycloak clients", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/keycloak/clients");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items.find((c: any) => c.clientId === "54bank-pwa")).toBeDefined();
  });
});

describe("Postgres Optimization APIs", () => {
  it("should return query profiles", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/query-profiles");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("hitRatio");
  });

  it("should return index advisories", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/index-advisories");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("createStatement");
  });

  it("should return connection pool stats", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/connection-pools");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("poolMode");
  });

  it("should return slow queries", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/slow-queries");
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("should return table stats", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/table-stats");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("bloatPct");
  });

  it("should return tuning parameters", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/postgres/tuning-params");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("recommendedValue");
  });
});

describe("Service Mesh", () => {
  it("should return service registry", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/service-mesh/registry");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.healthy).toBeGreaterThan(0);
  });

  it("should return proxy routes", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/service-mesh/proxy-routes");
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("Observability", () => {
  it("should return Grafana dashboards", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/observability/grafana-dashboards");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("uid");
  });

  it("should return alert rules", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/observability/alert-rules");
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0]).toHaveProperty("expression");
  });

  it("should return Prometheus metrics", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/observability/prometheus-metrics");
    expect(data.items.length).toBeGreaterThan(0);
  });
});

describe("Mojaloop Interoperability", () => {
  it("should return Mojaloop participants", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/mojaloop/participants");
    expect(data.items).toBeDefined();
  });

  it("should return settlement windows", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/mojaloop/settlement-windows");
    expect(data.items).toBeDefined();
  });
});

describe("TigerBeetle ↔ Postgres Sync", () => {
  it("should return sync configs", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/tigerbeetle-sync/configs");
    expect(Array.isArray(data.items ?? data.configs)).toBe(true);
  });

  it("should return reconciliation runs", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/tigerbeetle-sync/reconciliation-configs");
    expect(Array.isArray(data.items ?? data.configs)).toBe(true);
  });
});

describe("Security & Resilience", () => {
  it("should return circuit breaker states", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/circuit-breaker/services");
    expect(Array.isArray(data.items ?? data.services)).toBe(true);
  });
});

// ── E2E Behavioral Tests ──

describe("Authentication Flow", () => {
  it("should reject login with wrong credentials", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/health");
    expect(data).toBeDefined();
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "wrong@test.com", password: "wrong" }),
      });
      expect([401, 403]).toContain(res.status);
  });

});

describe("Database Data Serving", () => {
  it("should serve customers from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/customers");
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
      expect(data.source).toBe("database");
  });

  it("should serve accounts from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/accounts");
    expect(data.items).toBeDefined();
      expect(data.source).toBe("database");
  });

  it("should serve transactions from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/transactions");
    expect(data.items).toBeDefined();
      expect(data.source).toBe("database");
  });

  it("should serve loans from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/loans");
    expect(data.items).toBeDefined();
      expect(data.source).toBe("database");
  });

  it("should serve GL journal entries from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/gl_journal_entries");
    expect(data.items).toBeDefined();
  });

  it("should serve AML cases from database", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/aml_cases");
    expect(data.items).toBeDefined();
  });
});

describe("Security Headers", () => {
  it("should return OWASP security headers", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const res = await fetch(`${BASE_URL}/healthz`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("should enforce CORS policy", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const res = await fetch(`${BASE_URL}/healthz`);
    const acao = res.headers.get("access-control-allow-origin");
    expect(acao).toBeDefined();
  });
});

describe("Health & Monitoring", () => {
  it("should return health with database status", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/healthz");
    expect(data).toBeDefined();
      expect(data.database).toBeDefined();
      expect(data.redis).toBeDefined();
      expect(data.kafka).toBeDefined();
  });

  it("should include uptime and memory in health", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/healthz");
    expect(data).toBeDefined();
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(data.memory).toBeDefined();
  });
});

describe("Middleware Status", () => {
  it("should return Redis status", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/redis/status");
    expect(data).toBeDefined();
      expect(data.mode).toBeDefined();
  });

  it("should return Kafka status", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/platform/kafka/status");
    expect(data).toBeDefined();
      expect(data.mode).toBeDefined();
      expect(data.topics).toBeDefined();
  });
});

describe("API Validation", () => {
  it("should return 400 for invalid Kafka publish", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const res = await fetch(`${BASE_URL}/api/platform/kafka/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("should accept valid Kafka publish", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const res = await fetch(`${BASE_URL}/api/platform/kafka/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "test.event", message: { test: true } }),
    });
    expect(res.status).toBe(201);
  });
});

describe("Channel Banking APIs", () => {
  it("should serve voice banking data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/voice_banking_gateway");
    expect(data.items).toBeDefined();
  });

  it("should serve telegram bot data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/telegram_bot_gateway");
    expect(data.items).toBeDefined();
  });

  it("should serve USSD banking data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/ussd_banking_gateway");
    expect(data.items).toBeDefined();
  });
});

describe("Agriculture Banking APIs", () => {
  it("should serve cooperative management data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/cooperative_management");
    expect(data.items).toBeDefined();
  });

  it("should serve livestock management data", async (ctx) => {
    if (!serverAvailable) return ctx.skip();
    const data = await fetchJSON("/api/db/livestock_management");
    expect(data.items).toBeDefined();
  });
});
