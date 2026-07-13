import { spawn } from "node:child_process";
import process from "node:process";

const requestedBaseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, "") || null;
const baseUrl = requestedBaseUrl || "http://127.0.0.1:3101";
const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 20);
const waitMs = Number(process.env.SMOKE_WAIT_MS || 1500);

const customerHeaders = { "X-Customer-Id": "CUS-001" };
const branchHeaders = { "X-Customer-Id": "CUS-001", "X-Operator-Role": "branch" };

const checks = [
  {
    name: "platform overview",
    path: "/api/platform/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.products) || !Array.isArray(json.serviceHealth) || !Array.isArray(json.metrics)) {
        throw new Error("overview payload is missing products, serviceHealth, or metrics arrays");
      }
    },
  },
  {
    name: "trade finance overview",
    path: "/api/platform/trade-finance/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "trade-finance" || !Array.isArray(json.actions) || !json.metrics) {
        throw new Error("trade finance overview payload is malformed");
      }
    },
  },
  {
    name: "disputes overview",
    path: "/api/platform/disputes/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "dispute-management" || !Array.isArray(json.audits) || !json.metrics) {
        throw new Error("disputes overview payload is malformed");
      }
    },
  },
  {
    name: "agricultural insurance overview",
    path: "/api/platform/agricultural-insurance/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "agricultural-insurance" || !Array.isArray(json.exports) || !json.metrics) {
        throw new Error("agricultural insurance overview payload is malformed");
      }
    },
  },
  {
    name: "mortgage overview",
    path: "/api/platform/mortgage/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "mortgage-servicing" || !Array.isArray(json.actions) || !Array.isArray(json.audits) || !json.metrics) {
        throw new Error("mortgage overview payload is malformed");
      }
    },
  },
  {
    name: "education loans overview",
    path: "/api/platform/education-loans/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "education-loans" || !Array.isArray(json.actions) || !Array.isArray(json.audits) || !Array.isArray(json.exports) || !json.metrics) {
        throw new Error("education loans overview payload is malformed");
      }
    },
  },
  {
    name: "esusu overview",
    path: "/api/platform/esusu/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "esusu-groups" || !Array.isArray(json.actions) || !Array.isArray(json.audits) || !Array.isArray(json.exports) || !json.metrics) {
        throw new Error("esusu overview payload is malformed");
      }
    },
  },
  {
    name: "virtual accounts overview",
    path: "/api/platform/virtual-accounts/overview",
    assert: async (response) => {
      const json = await response.json();
      if (json.domain?.key !== "virtual-accounts" || !Array.isArray(json.actions) || !Array.isArray(json.audits) || !Array.isArray(json.exports) || !json.metrics) {
        throw new Error("virtual accounts overview payload is malformed");
      }
    },
  },
  {
    name: "teller overview",
    path: "/api/platform/teller/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.sessions) || !Array.isArray(json.recentTransactions)) {
        throw new Error("teller overview payload is malformed");
      }
    },
  },
  {
    name: "reconciliation overview",
    path: "/api/platform/reconciliation/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.discrepancies)) {
        throw new Error("reconciliation overview payload is malformed");
      }
    },
  },
  {
    name: "erpnext overview",
    path: "/api/platform/erpnext/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.syncHistory) || !json.config) {
        throw new Error("erpnext overview payload is malformed");
      }
    },
  },
  {
    name: "islamic banking overview",
    path: "/api/platform/islamic-banking/overview",
    assert: async (response) => {
      const json = await response.json();
      if (!json.summary || !Array.isArray(json.contracts)) {
        throw new Error("islamic banking overview payload is malformed");
      }
    },
  },
  {
    name: "customer registry",
    path: "/api/platform/customers",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || typeof json.total !== "number" || json.items.length < 3) {
        throw new Error("customer registry payload is malformed or unexpectedly sparse");
      }
    },
  },
  {
    name: "workflow registry",
    path: "/api/platform/workflows",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length < 4) {
        throw new Error("workflow payload is empty or too sparse for the current archive-first build");
      }
    },
  },
  {
    name: "operator actions",
    path: "/api/platform/actions?domain=operations&role=operations",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length < 2) {
        throw new Error("operator actions payload is malformed or too sparse");
      }

      const targetAction = json.items.find((item) => item.domainKey === "customer-operations") ?? json.items[0];
      const statusResponse = await fetch(`${baseUrl}/api/platform/actions/${targetAction.id}/status?role=operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Done" }),
      });

      if (!statusResponse.ok) {
        throw new Error(`operator action status update failed with ${statusResponse.status}`);
      }

      const statusJson = await statusResponse.json();
      if (!statusJson.middlewareContract || statusJson.middlewareContract.domain !== "operator-actions") {
        throw new Error("operator action status response is missing the middleware contract payload");
      }
      if (statusJson.middlewareContract.cacheInvalidation !== "refreshed") {
        throw new Error("operator action middleware contract did not report cache invalidation");
      }
    },
  },
  {
    name: "audit registry",
    path: "/api/platform/audit?domain=operations&role=operations",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length < 2) {
        throw new Error("audit payload is malformed or too sparse");
      }
    },
  },
  {
    name: "export registry",
    path: "/api/platform/exports?role=operations",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length < 3) {
        throw new Error("export payload is malformed or too sparse");
      }
    },
  },
  {
    name: "search endpoint",
    path: "/api/platform/search?q=customer",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length === 0) {
        throw new Error("search payload returned no items");
      }
    },
  },
  {
    name: "tenant configurations bridge",
    path: "/api/platform/tenants/configurations",
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || typeof json.total !== "number" || json.items.length === 0) {
        throw new Error("tenant configuration payload is malformed or empty");
      }
    },
  },
  {
    name: "root banking homepage",
    path: "/",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("core banking")) {
        throw new Error("homepage markup does not look like the banking shell");
      }
    },
  },
  {
    name: "trade finance route",
    path: "/trade-finance",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("trade")) {
        throw new Error("trade finance route did not return the SPA shell");
      }
    },
  },
  {
    name: "agricultural insurance route",
    path: "/agricultural-insurance",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("insurance")) {
        throw new Error("agricultural insurance route did not return the expected workspace shell");
      }
    },
  },
  {
    name: "mortgage route",
    path: "/mortgage",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("mortgage")) {
        throw new Error("mortgage route did not return the expected workspace shell");
      }
    },
  },
  {
    name: "education loans route",
    path: "/education-loans",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("education")) {
        throw new Error("education loans route did not return the expected workspace shell");
      }
    },
  },
  {
    name: "esusu route",
    path: "/esusu",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("esusu")) {
        throw new Error("esusu route did not return the expected workspace shell");
      }
    },
  },
  {
    name: "virtual accounts route",
    path: "/virtual-accounts",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("virtual")) {
        throw new Error("virtual accounts route did not return the expected workspace shell");
      }
    },
  },
  {
    name: "billing route",
    path: "/billing",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("billing")) {
        throw new Error("billing route did not return the SPA shell");
      }
    },
  },
  {
    name: "alerts route",
    path: "/alerts",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("alert")) {
        throw new Error("alerts route did not return the SPA shell");
      }
    },
  },
  {
    name: "usage analytics route",
    path: "/usage-analytics",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("analytics")) {
        throw new Error("usage analytics route did not return the SPA shell");
      }
    },
  },
  {
    name: "agriculture agtech route",
    path: "/agriculture/agtech",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("agriculture")) {
        throw new Error("agtech route did not return the SPA shell");
      }
    },
  },
  {
    name: "customer cards route",
    path: "/customer/cards",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("customer")) {
        throw new Error("customer cards route did not return the SPA shell");
      }
    },
  },
  {
    name: "customer bills route",
    path: "/customer/bills",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("customer")) {
        throw new Error("customer bills route did not return the SPA shell");
      }
    },
  },
  {
    name: "customer statements route",
    path: "/customer/statements",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("customer")) {
        throw new Error("customer statements route did not return the SPA shell");
      }
    },
  },
  {
    name: "customer savings route",
    path: "/customer/savings",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("savings")) {
        throw new Error("customer savings route did not return the expected savings shell");
      }
    },
  },
  {
    name: "customer settings route",
    path: "/customer/settings",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("settings")) {
        throw new Error("customer settings route did not return the expected settings shell");
      }
    },
  },
  {
    name: "customer notifications route",
    path: "/customer/notifications",
    assert: async (response) => {
      const html = await response.text();
      if (!html.includes("54Bank") && !html.includes("notification")) {
        throw new Error("customer notifications route did not return the expected notifications shell");
      }
    },
  },
  {
    name: "customer transfers registry",
    path: "/api/platform/customer-servicing/transfers",
    headers: customerHeaders,
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || typeof json.total !== "number") {
        throw new Error("customer transfer registry payload is malformed");
      }
    },
  },
  {
    name: "customer approvals registry",
    path: "/api/platform/customer-servicing/approvals",
    headers: customerHeaders,
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items) || json.items.length < 1) {
        throw new Error("customer approvals payload is unexpectedly empty");
      }
    },
  },
  {
    name: "customer statement exports registry",
    path: "/api/platform/customer-servicing/statement-exports",
    headers: customerHeaders,
    assert: async (response) => {
      const json = await response.json();
      if (!Array.isArray(json.items)) {
        throw new Error("customer statement export payload is malformed");
      }
    },
  },
  {
    name: "customer transfer lifecycle",
    path: "/api/platform/customer-servicing/transfers",
    method: "POST",
    headers: customerHeaders,
    body: {
      customerId: "CUS-001",
      beneficiaryName: "Smoke Test Beneficiary",
      amount: 175000,
      narration: "Smoke suite transfer validation",
      transferType: "bank",
      bankCode: "058",
      bankName: "GTBank",
      accountNumber: "0123456789",
      accountName: "Smoke Test Beneficiary",
    },
    assert: async (response) => {
      const json = await response.json();
      if (!json.transfer?.id) {
        throw new Error("transfer creation response is missing the transfer id");
      }

      const otpResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/transfers/${json.transfer.id}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...customerHeaders },
      });
      if (!otpResponse.ok) {
        throw new Error(`transfer otp request failed with status ${otpResponse.status}`);
      }
      const otpJson = await otpResponse.json();
      if (!otpJson.otp?.otpReference || !otpJson.otp?.previewCode) {
        throw new Error("transfer otp response is missing the OTP challenge data");
      }

      const confirmResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/transfers/${json.transfer.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...customerHeaders },
        body: JSON.stringify({ otpReference: otpJson.otp.otpReference, otpCode: otpJson.otp.previewCode }),
      });
      if (!confirmResponse.ok) {
        throw new Error(`transfer confirm failed with status ${confirmResponse.status}`);
      }
      const confirmJson = await confirmResponse.json();
      if (!["completed", "submitted"].includes(confirmJson.transfer?.status)) {
        throw new Error("transfer confirm did not return a valid lifecycle status");
      }
    },
  },
  {
    name: "customer statement export request lifecycle",
    path: "/api/platform/customer-servicing/statement-exports",
    method: "POST",
    headers: customerHeaders,
    body: {
      format: "csv",
      rowCount: 8,
      title: "Smoke suite statement export",
      customerId: "CUS-001",
    },
    assert: async (response) => {
      const json = await response.json();
      if (!json.exportJob?.id || !json.approvalRequest?.id) {
        throw new Error("statement export request did not return export and approval identifiers");
      }

      const approveResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/approvals/${json.approvalRequest.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...branchHeaders },
        body: JSON.stringify({ resolutionNote: "Smoke approval" }),
      });
      if (!approveResponse.ok) {
        throw new Error(`approval resolution failed with status ${approveResponse.status}`);
      }
      const approveJson = await approveResponse.json();
      if (approveJson.approvalRequest?.state !== "approved") {
        throw new Error("approval request did not move to approved state");
      }
    },
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startLocalServer() {
  if (requestedBaseUrl) {
    return null;
  }

  const child = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3101",
      NODE_ENV: "production",
      TENANT_SECRET: process.env.TENANT_SECRET || "smoke-tenant-secret-2026-production-shaped",
      KEYCLOAK_CLIENT_SECRET:
        process.env.KEYCLOAK_CLIENT_SECRET || "smoke-keycloak-client-secret-2026-production-shaped",
      MOJALOOP_FSP_SECRET:
        process.env.MOJALOOP_FSP_SECRET || "smoke-mojaloop-fsp-secret-2026-production-shaped",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://smoke_user:smoke_db_secret_2026@postgres-primary:5432/smoke_db?sslmode=require",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[smoke-server] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[smoke-server] ${chunk}`);
  });

  return child;
}

async function waitForServer() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/platform/overview`);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        return;
      }
    } catch {
      // keep retrying
    }
    await delay(waitMs);
  }

  throw new Error(`Server at ${baseUrl} did not become ready after ${maxAttempts} attempts`);
}

async function run() {
  const child = startLocalServer();

  try {
    await waitForServer();

    for (const check of checks) {
      const response = await fetch(`${baseUrl}${check.path}`, {
        method: check.method || "GET",
        headers: check.body ? { "Content-Type": "application/json", ...(check.headers || {}) } : check.headers || {},
        body: check.body ? JSON.stringify(check.body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`${check.name} failed with status ${response.status}`);
      }
      await check.assert(response);
      console.log(`PASS ${check.name}`);
    }

    console.log(`Smoke test suite completed successfully with ${checks.length} checks.`);
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await delay(500);
    }
  }
}

run().catch((error) => {
  console.error("Smoke test failure:", error instanceof Error ? error.message : error);
  process.exit(1);
});
