/**
 * Swagger/OpenAPI Documentation Generator
 * Auto-generates API documentation from route registrations.
 */

import { Express } from "express";
import { logger } from "./logger";

const PLATFORM_INFO = {
  title: "54Bank Core Banking Platform API",
  version: "2.0.0",
  description: "Africa-first core banking platform — 423 microservices, 267 database tables, 1,150+ API endpoints.",
  contact: { name: "54Bank Engineering", email: "engineering@54bank.ng" },
  license: { name: "Proprietary", url: "https://54bank.ng/license" },
};

function generateOpenAPISpec(): object {
  return {
    openapi: "3.0.3",
    info: PLATFORM_INFO,
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://api.54bank.ng", description: "Production" },
    ],
    tags: [
      { name: "Authentication", description: "Login, JWT, RBAC" },
      { name: "Core Banking", description: "Accounts, customers, transactions" },
      { name: "Payments", description: "Transfers, settlements, NIP" },
      { name: "Lending", description: "Loans, disbursements, repayments" },
      { name: "KYC/AML", description: "Identity verification, sanctions screening" },
      { name: "Agriculture", description: "Farmer banking, crop insurance, cooperatives" },
      { name: "Channel Banking", description: "Voice, Telegram, WhatsApp, USSD, SMS" },
      { name: "Treasury", description: "FX, fixed income, derivatives" },
      { name: "Compliance", description: "CBN returns, NFIU reports, NDPR" },
      { name: "Database", description: "Direct Drizzle ORM CRUD operations (267 tables)" },
      { name: "Monitoring", description: "Health, metrics, readiness probes" },
    ],
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "User login",
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } }, required: ["email", "password"] } } },
          },
          responses: { "200": { description: "JWT tokens returned" }, "401": { description: "Invalid credentials" } },
        },
      },
      "/api/auth/me": {
        get: { tags: ["Authentication"], summary: "Get current user", security: [{ bearerAuth: [] }], responses: { "200": { description: "User info" } } },
      },
      "/api/auth/refresh": {
        post: { tags: ["Authentication"], summary: "Refresh access token", responses: { "200": { description: "New access token" } } },
      },
      "/api/health": {
        get: { tags: ["Monitoring"], summary: "Comprehensive health check", responses: { "200": { description: "Health status with dependency checks" } } },
      },
      "/api/ready": {
        get: { tags: ["Monitoring"], summary: "Readiness probe (Kubernetes)", responses: { "200": { description: "Service ready" } } },
      },
      "/api/live": {
        get: { tags: ["Monitoring"], summary: "Liveness probe", responses: { "200": { description: "Service alive" } } },
      },
      "/api/metrics/prometheus": {
        get: { tags: ["Monitoring"], summary: "Prometheus metrics", responses: { "200": { description: "Metrics in Prometheus format" } } },
      },
      "/api/platform/core-banking/customers": {
        get: {
          tags: ["Core Banking"], summary: "List customers", security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 25 } },
          ],
          responses: { "200": { description: "Paginated customer list with Nigerian banking data" } },
        },
        post: {
          tags: ["Core Banking"], summary: "Create customer",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string", pattern: "^\\+234\\d{10}$" }, bvn: { type: "string", pattern: "^\\d{11}$" } } } } } },
          responses: { "201": { description: "Customer created" }, "400": { description: "Validation error" } },
        },
      },
      "/api/platform/payments/transfers": {
        post: {
          tags: ["Payments"], summary: "Initiate transfer",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["sourceAccount", "destinationAccount", "amount", "beneficiaryName"], properties: { sourceAccount: { type: "string" }, destinationAccount: { type: "string" }, amount: { type: "number" }, currency: { type: "string", default: "NGN" }, beneficiaryName: { type: "string" } } } } } },
          responses: { "201": { description: "Transfer completed" }, "400": { description: "Insufficient balance or validation error" } },
        },
      },
      "/api/platform/aml/screen": {
        post: {
          tags: ["KYC/AML"], summary: "Screen entity against sanctions lists",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["entityName", "entityType"], properties: { entityName: { type: "string" }, entityType: { type: "string", enum: ["individual", "corporate", "government"] }, screenType: { type: "string", enum: ["sanctions", "pep", "adverse_media", "full"] } } } } } },
          responses: { "200": { description: "Screening results with risk level and watchlist matches" } },
        },
      },
      "/api/db/{table}": {
        get: {
          tags: ["Database"], summary: "List records from any of the 267 Drizzle tables",
          parameters: [
            { name: "table", in: "path", required: true, schema: { type: "string" }, description: "Table name (e.g., customers, accounts, farmers)" },
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Paginated records from Postgres" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  };
}

export function registerSwaggerDocs(app: Express) {
  // Serve OpenAPI spec as JSON
  app.get("/api/docs/spec", (_req, res) => {
    res.json(generateOpenAPISpec());
  });

  // Serve Swagger UI
  app.get("/api/docs", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><title>54Bank API Documentation</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/docs/spec', dom_id: '#swagger-ui', deepLinking: true });</script>
</body></html>`);
  });

  logger.info("Swagger docs registered: /api/docs, /api/docs/spec");
}
