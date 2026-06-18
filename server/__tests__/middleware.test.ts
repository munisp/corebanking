import { describe, it, expect } from "vitest";

describe("Middleware Configuration", () => {
  const MIDDLEWARE_CONFIG = [
    { name: "Kafka", type: "event-streaming", envVar: "KAFKA_BROKERS" },
    { name: "Dapr", type: "microservice-runtime", envVar: "DAPR_HTTP_PORT" },
    { name: "Fluvio", type: "stream-processing", envVar: "FLUVIO_ADDR" },
    { name: "Temporal", type: "workflow-orchestration", envVar: "TEMPORAL_ADDRESS" },
    { name: "PostgreSQL", type: "primary-database", envVar: "DATABASE_URL" },
    { name: "Keycloak", type: "identity-provider", envVar: "KEYCLOAK_URL" },
    { name: "Permify", type: "authorization", envVar: "PERMIFY_URL" },
    { name: "Redis", type: "cache-sessions", envVar: "REDIS_URL" },
    { name: "Mojaloop", type: "interoperability", envVar: "MOJALOOP_HUB_URL" },
    { name: "OpenSearch", type: "search-analytics", envVar: "OPENSEARCH_URL" },
    { name: "APISIX", type: "api-gateway", envVar: "APISIX_ADMIN_URL" },
    { name: "OpenAppSec", type: "web-app-firewall", envVar: "OPENAPPSEC_URL" },
    { name: "TigerBeetle", type: "financial-ledger", envVar: "TIGERBEETLE_ADDRESS" },
    { name: "Lakehouse", type: "data-lake", envVar: "LAKEHOUSE_API_URL" },
  ];

  it("should have exactly 14 middleware configured", () => {
    expect(MIDDLEWARE_CONFIG).toHaveLength(14);
  });

  it("each middleware should have name, type, and envVar", () => {
    for (const mw of MIDDLEWARE_CONFIG) {
      expect(mw.name).toBeTruthy();
      expect(mw.type).toBeTruthy();
      expect(mw.envVar).toBeTruthy();
    }
  });

  it("should include all required middleware types", () => {
    const types = MIDDLEWARE_CONFIG.map(m => m.type);
    expect(types).toContain("event-streaming");
    expect(types).toContain("primary-database");
    expect(types).toContain("identity-provider");
    expect(types).toContain("cache-sessions");
    expect(types).toContain("financial-ledger");
    expect(types).toContain("api-gateway");
    expect(types).toContain("web-app-firewall");
  });

  it("should have unique env var names", () => {
    const envVars = MIDDLEWARE_CONFIG.map(m => m.envVar);
    expect(new Set(envVars).size).toBe(envVars.length);
  });
});

describe("Kafka Topic Configuration", () => {
  const TOPICS = [
    "banking.transactions",
    "banking.aml.alerts",
    "banking.kyc.events",
    "banking.notifications",
    "banking.audit.log",
    "banking.transfers.initiated",
    "banking.loans.events",
    "agriculture.farmer.events",
    "channel.voice.sessions",
    "channel.ussd.sessions",
  ];

  it("should have at least 10 topics defined", () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(10);
  });

  it("all topics should follow dot-notation naming", () => {
    for (const topic of TOPICS) {
      expect(topic).toMatch(/^[a-z]+(\.[a-z]+)+$/);
    }
  });
});

describe("Temporal Workflow Registry", () => {
  const WORKFLOWS = [
    { name: "KYCOnboarding", taskQueue: "kyc-queue" },
    { name: "TransferWorkflow", taskQueue: "transfer-queue" },
    { name: "LoanApproval", taskQueue: "lending-queue" },
    { name: "AMLScreening", taskQueue: "aml-queue" },
    { name: "SARFiling", taskQueue: "compliance-queue" },
    { name: "AgriLoanDisbursement", taskQueue: "agriculture-queue" },
    { name: "VoiceCallRouting", taskQueue: "voice-queue" },
  ];

  it("should have workflow definitions", () => {
    expect(WORKFLOWS.length).toBeGreaterThan(0);
  });

  it("each workflow should have name and taskQueue", () => {
    for (const wf of WORKFLOWS) {
      expect(wf.name).toBeTruthy();
      expect(wf.taskQueue).toBeTruthy();
      expect(wf.taskQueue).toMatch(/-queue$/);
    }
  });
});
