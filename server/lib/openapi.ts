/**
 * OpenAPI / Swagger Auto-Documentation (#28)
 * Generates OpenAPI 3.1 spec from Express routes.
 */

export function generateOpenAPISpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "54Bank Core Banking Platform API",
      version: "1.0.0",
      description: "Core banking platform with 17 microservices across Go, Rust, and Python. Provides PBAC security, offline resilience, and comprehensive CRUD for 15+ banking domains.",
      contact: { name: "54Bank Platform Team", email: "platform@54bank.com" },
      license: { name: "MIT" },
    },
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://api.54bank.com", description: "Production" },
    ],
    tags: [
      { name: "Health", description: "Service health and metrics" },
      { name: "Authentication", description: "JWT/Keycloak authentication" },
      { name: "Security", description: "PBAC policies, roles, vulnerability scanning" },
      { name: "Resilience", description: "Offline queue, sync, conflict resolution" },
      { name: "Customers", description: "Customer CRUD and workflow operations" },
      { name: "Agriculture", description: "Agriculture banking — farmers, loans, insurance, value chain" },
      { name: "Teller", description: "Teller operations — sessions, transactions, vault" },
      { name: "IslamicBanking", description: "Islamic banking — Murabaha, Ijara, Mudarabah" },
      { name: "TradeFinance", description: "Trade finance — letters of credit, warehouse receipts" },
      { name: "Mortgage", description: "Mortgage servicing — applications, payments, amortization" },
      { name: "Esusu", description: "Esusu groups — rotating savings" },
      { name: "VirtualAccounts", description: "Virtual accounts — credit, debit, hold, release" },
      { name: "AgentBanking", description: "Agent banking — float, transactions, KYC" },
      { name: "GroupLending", description: "Group lending — solidarity groups, joint liability" },
      { name: "EducationLoans", description: "Education loans — disbursement, deferment" },
      { name: "LedgerRecon", description: "Ledger reconciliation — discrepancies, GL assertions" },
      { name: "Identity", description: "Identity & channels — profiles, MFA, OTP, sessions" },
      { name: "Disputes", description: "Dispute management — cases, evidence, chargebacks" },
      { name: "ERPNext", description: "ERPNext sync — journal entries, COA mappings" },
      { name: "Regulatory", description: "Regulatory reporting — CTR, STR, capital adequacy, ECL" },
      { name: "Audit", description: "Immutable audit trail" },
      { name: "Search", description: "Full-text cross-domain search" },
      { name: "Billing", description: "Billing engine — rate cards, invoices, accruals" },
    ],
    paths: {
      "/healthz": {
        get: {
          tags: ["Health"],
          summary: "Express gateway health check",
          responses: { "200": { description: "Healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, uptime: { type: "number" } } } } } } },
        },
      },
      "/healthz/services": {
        get: {
          tags: ["Health"],
          summary: "Aggregated health of all 17 microservices",
          responses: { "200": { description: "All services healthy" }, "207": { description: "Some services degraded" } },
        },
      },
      "/metrics": {
        get: {
          tags: ["Health"],
          summary: "Prometheus metrics endpoint",
          responses: { "200": { description: "Prometheus text format" } },
        },
      },
      "/api/platform/security/evaluate": {
        post: {
          tags: ["Security"],
          summary: "Evaluate PBAC access request",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["subject", "resource", "action"], properties: { subject: { type: "string" }, resource: { type: "string" }, action: { type: "string" } } } } } },
          responses: { "200": { description: "Access decision (allowed/denied)" } },
        },
      },
      "/api/platform/security/policies": {
        get: { tags: ["Security"], summary: "List all PBAC policies", responses: { "200": { description: "Array of policies" } } },
      },
      "/api/platform/security/roles": {
        get: { tags: ["Security"], summary: "List all PBAC roles", responses: { "200": { description: "Array of roles" } } },
      },
      "/api/platform/resilience/queue": {
        post: {
          tags: ["Resilience"],
          summary: "Queue an offline mutation",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["operation_type", "payload", "idempotency_key"], properties: { operation_type: { type: "string" }, payload: { type: "object" }, idempotency_key: { type: "string" } } } } } },
          responses: { "202": { description: "Queued successfully" } },
        },
      },
      "/api/platform/resilience/queue/stats": {
        get: { tags: ["Resilience"], summary: "Get queue statistics", responses: { "200": { description: "Queue statistics" } } },
      },
      "/api/platform/resilience/config": {
        get: { tags: ["Resilience"], summary: "Get resilience configuration", responses: { "200": { description: "Config including bandwidth thresholds" } } },
      },
      "/api/platform/audit": {
        get: {
          tags: ["Audit"],
          summary: "Query audit trail",
          parameters: [
            { name: "domain", in: "query", schema: { type: "string" } },
            { name: "userId", in: "query", schema: { type: "string" } },
            { name: "action", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: { "200": { description: "Array of audit entries" } },
        },
      },
      "/api/platform/search": {
        get: {
          tags: ["Search"],
          summary: "Full-text search across domains",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" } },
            { name: "domain", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          ],
          responses: { "200": { description: "Search results with relevance scores" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
    },
    security: [{ bearerAuth: [] }, { apiKey: [] }],
  };
}
