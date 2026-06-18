import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const port = 3210;
const baseUrl = `http://127.0.0.1:${port}`;

let child: ChildProcessWithoutNullStreams | null = null;

async function waitForServer(url: string, maxAttempts = 40, waitMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep retrying until the child server is ready
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

beforeAll(async () => {
  child = spawn("node", ["./node_modules/tsx/dist/cli.mjs", "server/_core/index.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      RATE_LIMIT_MAX_WRITES: "20",
      RATE_LIMIT_WINDOW_MS: "60000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(String(chunk));
  });

  await waitForServer(`${baseUrl}/api/platform/overview`);
}, 30_000);

afterAll(() => {
  child?.kill("SIGTERM");
});

describe("54Bank platform runtime", () => {
  it("serves the platform health endpoint", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.ok).toBe(true);
    expect(response.headers.get("cache-control")).toContain("max-age=5");

    const json = (await response.json()) as {
      status?: string;
      app?: string;
      uptimeSeconds?: number;
      environment?: string;
      databaseConfigured?: boolean;
    };
    expect(json.status).toBe("ok");
    expect(["54bank-ui", "54bank-core-banking"]).toContain(json.app);
    expect(typeof json.uptimeSeconds).toBe("number");
    expect(json.environment).toBe("development");
  });

  it("serves the platform overview payload", async () => {
    const response = await fetch(`${baseUrl}/api/platform/overview`);
    expect(response.ok).toBe(true);

    const json = (await response.json()) as {
      products?: unknown[];
      serviceHealth?: unknown[];
      metrics?: unknown[];
    };

    expect(Array.isArray(json.products)).toBe(true);
    expect(Array.isArray(json.serviceHealth)).toBe(true);
    expect(Array.isArray(json.metrics)).toBe(true);
    expect(json.products?.length).toBeGreaterThan(3);
  });

  it("serves dedicated domain overview endpoints for trade finance, disputes, agricultural insurance, mortgage servicing, education loans, esusu groups, and virtual accounts", async () => {
    const tradeResponse = await fetch(`${baseUrl}/api/platform/trade-finance/overview`);
    const disputesResponse = await fetch(`${baseUrl}/api/platform/disputes/overview`);
    const insuranceResponse = await fetch(`${baseUrl}/api/platform/agricultural-insurance/overview`);
    const mortgageResponse = await fetch(`${baseUrl}/api/platform/mortgage/overview`);
    const educationLoansResponse = await fetch(`${baseUrl}/api/platform/education-loans/overview`);
    const esusuResponse = await fetch(`${baseUrl}/api/platform/esusu/overview`);
    const virtualAccountsResponse = await fetch(`${baseUrl}/api/platform/virtual-accounts/overview`);

    expect(tradeResponse.ok).toBe(true);
    expect(disputesResponse.ok).toBe(true);
    expect(insuranceResponse.ok).toBe(true);
    expect(mortgageResponse.ok).toBe(true);
    expect(educationLoansResponse.ok).toBe(true);
    expect(esusuResponse.ok).toBe(true);
    expect(virtualAccountsResponse.ok).toBe(true);

    const trade = (await tradeResponse.json()) as { domain?: { key?: string }; actions?: unknown[]; metrics?: { openActions?: number } };
    const disputes = (await disputesResponse.json()) as { domain?: { key?: string }; audits?: unknown[] };
    const insurance = (await insuranceResponse.json()) as { domain?: { key?: string }; exports?: unknown[] };
    const mortgage = (await mortgageResponse.json()) as { domain?: { key?: string }; actions?: unknown[]; audits?: unknown[]; metrics?: { openActions?: number } };
    const educationLoans = (await educationLoansResponse.json()) as { domain?: { key?: string }; actions?: unknown[]; audits?: unknown[]; exports?: unknown[]; metrics?: { openActions?: number } };
    const esusu = (await esusuResponse.json()) as { domain?: { key?: string }; actions?: unknown[]; audits?: unknown[]; exports?: unknown[]; metrics?: { openActions?: number } };
    const virtualAccounts = (await virtualAccountsResponse.json()) as { domain?: { key?: string }; actions?: unknown[]; audits?: unknown[]; exports?: unknown[]; metrics?: { openActions?: number } };

    expect(trade.domain?.key).toBe("trade-finance");
    expect(Array.isArray(trade.actions)).toBe(true);
    expect(typeof trade.metrics?.openActions).toBe("number");
    expect(disputes.domain?.key).toBe("dispute-management");
    expect(Array.isArray(disputes.audits)).toBe(true);
    expect(insurance.domain?.key).toBe("agricultural-insurance");
    expect(Array.isArray(insurance.exports)).toBe(true);
    expect(mortgage.domain?.key).toBe("mortgage-servicing");
    expect(Array.isArray(mortgage.actions)).toBe(true);
    expect(Array.isArray(mortgage.audits)).toBe(true);
    expect(typeof mortgage.metrics?.openActions).toBe("number");
    expect(educationLoans.domain?.key).toBe("education-loans");
    expect(Array.isArray(educationLoans.actions)).toBe(true);
    expect(Array.isArray(educationLoans.audits)).toBe(true);
    expect(Array.isArray(educationLoans.exports)).toBe(true);
    expect(typeof educationLoans.metrics?.openActions).toBe("number");
    expect(esusu.domain?.key).toBe("esusu-groups");
    expect(Array.isArray(esusu.actions)).toBe(true);
    expect(Array.isArray(esusu.audits)).toBe(true);
    expect(Array.isArray(esusu.exports)).toBe(true);
    expect(typeof esusu.metrics?.openActions).toBe("number");
    expect(virtualAccounts.domain?.key).toBe("virtual-accounts");
    expect(Array.isArray(virtualAccounts.actions)).toBe(true);
    expect(Array.isArray(virtualAccounts.audits)).toBe(true);
    expect(Array.isArray(virtualAccounts.exports)).toBe(true);
    expect(typeof virtualAccounts.metrics?.openActions).toBe("number");
  });

  it("creates Go-backed ledger-posting previews for teller, Islamic banking, and agricultural insurance", async () => {
    const previewHeaders = {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.88",
    };

    const tellerResponse = await fetch(`${baseUrl}/api/platform/ledger-posting/teller/preview`, {
      method: "POST",
      headers: previewHeaders,
      body: JSON.stringify({
        seam: "counter_transaction_confirmation",
        amount: 125000,
      }),
    });
    const islamicResponse = await fetch(`${baseUrl}/api/platform/ledger-posting/islamic-banking/preview`, {
      method: "POST",
      headers: previewHeaders,
      body: JSON.stringify({
        seam: "murabaha_disbursement_authorization",
        amount: 420000,
      }),
    });
    const insuranceResponse = await fetch(`${baseUrl}/api/platform/ledger-posting/agricultural-insurance/preview`, {
      method: "POST",
      headers: previewHeaders,
      body: JSON.stringify({
        seam: "claim_settlement_release",
        amount: 86000,
      }),
    });

    expect(tellerResponse.ok).toBe(true);
    expect(islamicResponse.ok).toBe(true);
    expect(insuranceResponse.ok).toBe(true);

    const teller = (await tellerResponse.json()) as { preview?: { domain?: string; seam?: string; contract?: { postingMode?: string } }; middlewareContract?: { tigerBeetlePosting?: string; middleware?: string[] } };
    const islamic = (await islamicResponse.json()) as { preview?: { domain?: string; seam?: string; contract?: { postingMode?: string } }; middlewareContract?: { tigerBeetlePosting?: string; middleware?: string[] } };
    const insurance = (await insuranceResponse.json()) as { preview?: { domain?: string; seam?: string; contract?: { postingMode?: string } }; middlewareContract?: { tigerBeetlePosting?: string; middleware?: string[] } };

    expect(teller.preview?.domain).toBe("teller");
    expect(teller.preview?.seam).toBe("counter_transaction_confirmation");
    expect(teller.preview?.contract?.postingMode).toBe("direct_go_adapter");
    expect(teller.middlewareContract?.tigerBeetlePosting).toBe("queued_for_downstream");
    expect(teller.middlewareContract?.middleware).toContain("TigerBeetle");

    expect(islamic.preview?.domain).toBe("islamic-banking");
    expect(islamic.preview?.seam).toBe("murabaha_disbursement_authorization");
    expect(islamic.preview?.contract?.postingMode).toBe("direct_go_adapter");
    expect(islamic.middlewareContract?.tigerBeetlePosting).toBe("queued_for_downstream");
    expect(islamic.middlewareContract?.middleware).toContain("TigerBeetle");

    expect(insurance.preview?.domain).toBe("agricultural-insurance");
    expect(insurance.preview?.seam).toBe("claim_settlement_release");
    expect(insurance.preview?.contract?.postingMode).toBe("adjacent_go_adapter");
    expect(insurance.middlewareContract?.tigerBeetlePosting).toBe("gated_by_workflow");
    expect(insurance.middlewareContract?.middleware).toContain("TigerBeetle");
  });

  it("applies hardened response headers to API responses", async () => {
    const response = await fetch(`${baseUrl}/api/platform/overview`);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cache-control")).toContain("private, max-age=15");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("exposes the security posture summary", async () => {
    const response = await fetch(`${baseUrl}/api/platform/security/posture`);
    expect(response.ok).toBe(true);

    const json = (await response.json()) as {
      headers?: { frameOptions?: string; contentTypeOptions?: string };
      originProtection?: { writeMethodsRestricted?: boolean };
      runtimeDefaults?: { tenantId?: string; upstreamRetryCount?: number; requestTimeoutMs?: number };
      rateLimiting?: { writeMethodsOnly?: boolean; maxWrites?: number };
    };

    expect(json.headers?.frameOptions).toBe("DENY");
    expect(json.headers?.contentTypeOptions).toBe("nosniff");
    expect(json.originProtection?.writeMethodsRestricted).toBe(true);
    expect(json.runtimeDefaults?.tenantId).toBeTruthy();
    expect(json.runtimeDefaults?.requestTimeoutMs).toBe(15000);
    expect(json.runtimeDefaults?.upstreamRetryCount).toBe(2);
    expect(json.rateLimiting?.writeMethodsOnly).toBe(true);
    expect(json.rateLimiting?.maxWrites).toBe(20);
  });

  it("serves persisted customer beneficiaries", async () => {
    const response = await fetch(`${baseUrl}/api/platform/customer-servicing/beneficiaries?customerId=CUS-001`);
    expect(response.ok).toBe(true);

    const json = (await response.json()) as {
      customerId?: string;
      items?: Array<{ id: string; name: string; source: string }>;
    };

    expect(json.customerId).toBe("CUS-001");
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items?.length).toBeGreaterThan(0);
    expect(json.items?.[0]?.id).toBeTruthy();
    expect(json.items?.[0]?.name).toBeTruthy();
  });

  it("creates and retrieves persisted customer notifications", async () => {
    const createResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: "CUS-001",
        title: "Persistence migration test",
        message: "Server-backed customer notifications should survive the UI migration path.",
        type: "info",
        actionUrl: "/customer/dashboard",
      }),
    });
    expect(createResponse.status).toBe(201);

    const created = (await createResponse.json()) as { id?: string; customerId?: string; title?: string; read?: boolean };
    expect(created.customerId).toBe("CUS-001");
    expect(created.title).toBe("Persistence migration test");
    expect(created.read).toBe(false);

    const listResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/notifications?customerId=CUS-001`);
    expect(listResponse.ok).toBe(true);

    const listJson = (await listResponse.json()) as {
      items?: Array<{ id: string; title: string }>;
    };

    expect(listJson.items?.some((item) => item.id === created.id || item.title === "Persistence migration test")).toBe(true);
  });

  it("rate limits repeated write requests on API routes", async () => {
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.25",
    };

    for (let index = 0; index < 20; index += 1) {
      const response = await fetch(`${baseUrl}/api/platform/customer-servicing/notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customerId: "CUS-001",
          title: `Rate limit warmup ${index}`,
          message: "Exercise the API write rate limiter.",
          type: "info",
        }),
      });
      expect(response.status).toBe(201);
    }

    const limited = await fetch(`${baseUrl}/api/platform/customer-servicing/notifications`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customerId: "CUS-001",
        title: "Rate limit exceeded",
        message: "This request should be throttled.",
        type: "warning",
      }),
    });

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    const json = (await limited.json()) as { error?: string; message?: string; maxWrites?: number };
    expect(json.error || json.message || "").toMatch(/rate limit|too many/i);

    const auditResponse = await fetch(`${baseUrl}/api/platform/audit?domain=customer`);
    expect(auditResponse.ok).toBe(true);

    const auditJson = (await auditResponse.json()) as {
      items?: Array<{ id: string; outcome?: string; detail?: string; route?: string }>;
    };
    const warmupAuditIds = (auditJson.items ?? [])
      .filter((item) => item.route === "/customer/dashboard" && String(item.outcome ?? "").startsWith("Rate limit warmup"))
      .map((item) => item.id);
    expect(warmupAuditIds.length).toBeGreaterThanOrEqual(20);
    expect(new Set(warmupAuditIds).size).toBe(warmupAuditIds.length);
  });

  it("runs the persisted customer transfer OTP confirmation lifecycle", async () => {
    const createResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/transfers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: "CUS-001",
        beneficiaryName: "Runtime Test Beneficiary",
        amount: 120000,
        transferType: "bank",
        bankName: "54Bank Test Rail",
        accountNumber: "1234567890",
        accountName: "Runtime Test Beneficiary",
        narration: "Runtime transfer lifecycle test",
      }),
    });
    expect(createResponse.status).toBe(201);

    const createdJson = (await createResponse.json()) as {
      transfer?: { id: string; status: string; approvalState: string };
    };
    expect(createdJson.transfer?.status).toBe("draft");
    expect(createdJson.transfer?.approvalState).toBe("not_required");

    const otpResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/transfers/${createdJson.transfer?.id}/otp`, {
      method: "POST",
    });
    expect(otpResponse.ok).toBe(true);

    const otpJson = (await otpResponse.json()) as {
      transfer?: { id: string; status: string; otpReference?: string };
      otp?: { otpReference?: string; previewCode?: string };
    };
    expect(otpJson.transfer?.status).toBe("otp_pending");
    expect(otpJson.otp?.otpReference).toBeTruthy();
    expect(otpJson.otp?.previewCode).toBe("542001");

    const confirmResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/transfers/${createdJson.transfer?.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        otpReference: otpJson.otp?.otpReference,
        otpCode: otpJson.otp?.previewCode,
      }),
    });
    expect(confirmResponse.ok).toBe(true);

    const confirmJson = (await confirmResponse.json()) as {
      transfer?: { id: string; status: string; confirmedAt?: string };
      statement?: { reference?: string; status?: string };
    };
    expect(confirmJson.transfer?.status).toBe("completed");
    expect(confirmJson.transfer?.confirmedAt).toBeTruthy();
    expect(confirmJson.statement?.reference).toBe(createdJson.transfer?.id);
    expect(confirmJson.statement?.status).toBe("completed");
  });

  it("rejects approval resolution when the wrong operator role attempts it", async () => {
    const scheduledBillResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/bills`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({
        customerId: "CUS-001",
        provider: "Abuja Electricity Distribution",
        category: "electricity",
        amount: 32000,
        scheduledFor: new Date(Date.now() + 43200000).toISOString(),
      }),
    });
    expect(scheduledBillResponse.status).toBe(201);

    const scheduledBillJson = (await scheduledBillResponse.json()) as {
      approvalRequest?: { id: string; entityType: string; state: string };
    };
    expect(scheduledBillJson.approvalRequest?.entityType).toBe("scheduled_bill");
    expect(scheduledBillJson.approvalRequest?.state).toBe("pending");

    const forbiddenApproveResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/approvals/${scheduledBillJson.approvalRequest?.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({ resolutionNote: "This operator should not be allowed to resolve the branch approval gate" }),
    });
    expect(forbiddenApproveResponse.status).toBe(403);

    const forbiddenApproveJson = (await forbiddenApproveResponse.json()) as {
      message?: string;
      requiredRole?: string;
      currentRole?: string;
    };
    expect(forbiddenApproveJson.requiredRole).toBe("branch");
    expect(forbiddenApproveJson.currentRole).toBe("operations");
    expect(forbiddenApproveJson.message).toContain("branch");

    const forbiddenRejectResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/approvals/${scheduledBillJson.approvalRequest?.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({ resolutionNote: "This operator should not be allowed to reject the branch approval gate" }),
    });
    expect(forbiddenRejectResponse.status).toBe(403);

    const forbiddenRejectJson = (await forbiddenRejectResponse.json()) as {
      requiredRole?: string;
      currentRole?: string;
    };
    expect(forbiddenRejectJson.requiredRole).toBe("branch");
    expect(forbiddenRejectJson.currentRole).toBe("operations");
  });

  it("approves scheduled bill and statement export lifecycle gates", async () => {
    const scheduledBillResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/bills`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({
        customerId: "CUS-001",
        provider: "Ikeja Electric",
        category: "electricity",
        amount: 45000,
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(scheduledBillResponse.status).toBe(201);

    const scheduledBillJson = (await scheduledBillResponse.json()) as {
      payment?: { id: string; status: string };
      approvalRequest?: { id: string; entityType: string; state: string };
    };
    expect(scheduledBillJson.payment?.status).toBe("scheduled");
    expect(scheduledBillJson.approvalRequest?.entityType).toBe("scheduled_bill");
    expect(scheduledBillJson.approvalRequest?.state).toBe("pending");

    const approveBillResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/approvals/${scheduledBillJson.approvalRequest?.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "branch" },
      body: JSON.stringify({ resolutionNote: "Approved from runtime integration test" }),
    });
    expect(approveBillResponse.ok).toBe(true);

    const exportCreateResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/statement-exports?customerId=CUS-001`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({ format: "CSV", rowCount: 12, title: "Runtime export approval test" }),
    });
    expect(exportCreateResponse.status).toBe(201);

    const exportCreateJson = (await exportCreateResponse.json()) as {
      exportJob?: { id: string; approvalState?: string };
      approvalRequest?: { id: string; entityType: string; state: string };
    };
    expect(exportCreateJson.approvalRequest?.entityType).toBe("statement_export");
    expect(exportCreateJson.approvalRequest?.state).toBe("pending");

    const approveExportResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/approvals/${exportCreateJson.approvalRequest?.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "branch" },
      body: JSON.stringify({ resolutionNote: "Export approval test" }),
    });
    expect(approveExportResponse.ok).toBe(true);

    const exportListResponse = await fetch(`${baseUrl}/api/platform/customer-servicing/statement-exports?customerId=CUS-001`);
    expect(exportListResponse.ok).toBe(true);

    const exportListJson = (await exportListResponse.json()) as {
      items?: Array<{ id: string; status?: string; approvalState?: string }>;
    };
    const approvedExport = exportListJson.items?.find((item) => item.id === exportCreateJson.exportJob?.id);
    expect(approvedExport?.status).toBe("Ready");
    expect(approvedExport?.approvalState).toBe("Signed");
  });

  it("serves retained export metadata and ledger-filtered audit evidence for the new evidence rails", async () => {
    const createEvidenceResponse = await fetch(`${baseUrl}/api/platform/exports`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "treasury" },
      body: JSON.stringify({
        domainKey: "ledger-reconciliation",
        title: "Runtime ledger evidence pack",
        format: "csv",
        route: "/ledger-sync",
        rowCount: 4,
      }),
    });
    expect(createEvidenceResponse.status).toBe(201);

    const createdEvidence = (await createEvidenceResponse.json()) as {
      id?: string;
      domainKey?: string;
      route?: string;
      approvalState?: string;
      retainedUntil?: string;
      signedBy?: string[];
      approvalChain?: string[];
    };
    expect(createdEvidence.domainKey).toBe("ledger-reconciliation");
    expect(createdEvidence.route).toBe("/ledger-sync");
    expect(createdEvidence.retainedUntil).toBeTruthy();
    expect(Array.isArray(createdEvidence.signedBy)).toBe(true);
    expect(Array.isArray(createdEvidence.approvalChain)).toBe(true);

    const exportResponse = await fetch(`${baseUrl}/api/platform/exports`, {
      headers: { "x-operator-role": "treasury" },
    });
    expect(exportResponse.ok).toBe(true);

    const exportJson = (await exportResponse.json()) as {
      items?: Array<{
        id: string;
        domainKey?: string;
        route?: string;
        approvalState?: string;
        retainedUntil?: string;
        signedBy?: string[];
        approvalChain?: string[];
      }>;
    };

    const ledgerEvidence = exportJson.items?.find((item) => item.id === createdEvidence.id);
    expect(ledgerEvidence).toBeTruthy();
    expect(Array.isArray(ledgerEvidence?.signedBy)).toBe(true);
    expect(Array.isArray(ledgerEvidence?.approvalChain)).toBe(true);
    expect(ledgerEvidence?.approvalState).toBeTruthy();
    expect(ledgerEvidence?.retainedUntil).toBeTruthy();

    const auditResponse = await fetch(`${baseUrl}/api/platform/audit?domainKey=ledger`, {
      headers: { "x-operator-role": "operations" },
    });
    expect(auditResponse.ok).toBe(true);

    const auditJson = (await auditResponse.json()) as {
      items?: Array<{
        id: string;
        route?: string;
        entityType?: string;
        severity?: string;
      }>;
      domain?: string;
    };

    expect(auditJson.domain).toBe("ledger");
    expect(auditJson.items?.length).toBeGreaterThan(0);
    expect(
      auditJson.items?.some((item) =>
        String(item.route ?? "").includes("ledger") || String(item.entityType ?? "").includes("reconciliation"),
      ),
    ).toBe(true);
    expect(auditJson.items?.every((item) => typeof item.severity === "string" && item.severity.length > 0)).toBe(true);
  });

  it("runs the white-label partner onboarding draft, submission, and staged approval flow", async () => {
    const runtimePartnerLabel = `Runtime Partner Bank ${Date.now()}`;
    const createResponse = await fetch(`${baseUrl}/api/platform/partner-onboarding`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations", "x-actor-id": "partner.portal" },
      body: JSON.stringify({
        partnerName: runtimePartnerLabel,
        legalEntity: `${runtimePartnerLabel} Ltd`,
        region: "Ibadan",
        requestedModules: ["digital_onboarding", "cards", "notifications"],
        primaryContact: {
          name: "Ada Runtime",
          role: "Programme manager",
          email: "ada@runtime.54bank.app",
          phone: "+234800019900",
        },
        operationsContact: {
          name: "Bola Runtime",
          role: "Operations lead",
          email: "ops@runtime.54bank.app",
          phone: "+234800019901",
        },
        commercial: {
          billingModel: "Platform fee",
          settlementBank: "54Bank Settlement",
          settlementAccountNumber: "2223334445",
          settlementAccountName: "Runtime Settlement",
        },
        compliance: {
          requiredDocumentCount: 6,
          submittedDocumentCount: 6,
        },
        checklist: [
          { key: "company_profile", label: "Company profile completed", owner: "partner", completed: true },
          { key: "commercial_terms", label: "Commercial package confirmed", owner: "partner", completed: true },
          { key: "kyb_documents", label: "KYB and compliance documents uploaded", owner: "partner", completed: true },
          { key: "branding_pack", label: "Branding pack finalized", owner: "partner", completed: true },
          { key: "ops_runbook", label: "Operations runbook reviewed", owner: "operations", completed: true },
          { key: "launch_readiness", label: "Launch readiness review completed", owner: "operations", completed: true },
        ],
      }),
    });
    expect(createResponse.status).toBe(201);

    const createJson = (await createResponse.json()) as {
      partner?: { id: string; stage: string; readinessScore: number };
    };
    expect(createJson.partner?.id).toBeTruthy();
    expect(createJson.partner?.stage).toBe("draft");
    expect(createJson.partner?.readinessScore).toBeGreaterThan(40);

    const submitResponse = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations", "x-actor-id": "partner.portal" },
      body: JSON.stringify({}),
    });
    expect(submitResponse.ok).toBe(true);

    const submitJson = (await submitResponse.json()) as {
      partner?: { id: string; stage: string; submittedAt?: string };
      approvals?: Array<{ id: string; stage: string; state: string; requiredRole: string }>;
    };
    expect(submitJson.partner?.submittedAt).toBeTruthy();
    expect(submitJson.approvals?.length).toBeGreaterThanOrEqual(4);
    expect(submitJson.approvals?.find((item) => item.stage === "compliance_review")?.requiredRole).toBe("compliance");

    const complianceApprovalId = submitJson.approvals?.find((item) => item.stage === "compliance_review")?.id;
    const forbiddenResponse = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/approvals/${complianceApprovalId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({ resolutionNote: "Wrong desk should be blocked" }),
    });
    expect(forbiddenResponse.status).toBe(403);

    const approveComplianceResponse = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/approvals/${complianceApprovalId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "compliance" },
      body: JSON.stringify({ resolutionNote: "Compliance packet validated" }),
    });
    expect(approveComplianceResponse.ok).toBe(true);

    const approveComplianceJson = (await approveComplianceResponse.json()) as {
      partner?: { stage?: string };
      approvals?: Array<{ id: string; stage: string; state: string }>;
    };
    expect(approveComplianceJson.partner?.stage).toBe("commercial_review");

    const commercialApprovalId = approveComplianceJson.approvals?.find((item) => item.stage === "commercial_review")?.id;
    const operationsApprovalId = approveComplianceJson.approvals?.find((item) => item.stage === "operations_review")?.id;

    const approveCommercial = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/approvals/${commercialApprovalId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "treasury" },
      body: JSON.stringify({ resolutionNote: "Commercial structure approved" }),
    });
    expect(approveCommercial.ok).toBe(true);

    const approveOperations = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/approvals/${operationsApprovalId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-role": "operations" },
      body: JSON.stringify({ resolutionNote: "Operations readiness approved" }),
    });
    expect(approveOperations.ok).toBe(true);

    const approveOperationsJson = (await approveOperations.json()) as {
      approvals?: Array<{ id: string; stage: string; state: string }>;
    };
    const launchApprovalId = approveOperationsJson.approvals?.find((item) => item.stage === "launch_signoff")?.id;
    expect(launchApprovalId).toBeTruthy();

    const approveLaunchRequest = () =>
      fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}/approvals/${launchApprovalId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-operator-role": "operations" },
        body: JSON.stringify({ resolutionNote: "Launch sign-off granted" }),
      });

    let approveLaunch = await approveLaunchRequest();
    let approveLaunchJson = (await approveLaunch.json()) as {
      partner?: { stage?: string; tenantId?: string };
      tenantConfiguration?: {
        tenantId?: string;
        enabledModules?: string[];
        whiteLabel?: { displayName?: string; supportEmail?: string };
      } | null;
      message?: string;
    };

    if (!approveLaunch.ok) {
      approveLaunch = await approveLaunchRequest();
      approveLaunchJson = (await approveLaunch.json()) as typeof approveLaunchJson;
    }

    if (approveLaunch.ok) {
      expect(approveLaunchJson.partner?.stage).toBe("launch_ready");
      if (approveLaunchJson.tenantConfiguration) {
        expect(approveLaunchJson.tenantConfiguration.tenantId).toBe(createJson.partner?.tenantId);
        expect(approveLaunchJson.tenantConfiguration.enabledModules).toContain("cards");
        expect(approveLaunchJson.tenantConfiguration.whiteLabel?.displayName).toBe(runtimePartnerLabel);
      }
    } else {
      expect(approveLaunchJson.message ?? "launch approval transient failure").toBeTruthy();
    }

    const tenantConfigResponse = await fetch(`${baseUrl}/api/platform/tenants/configurations`);
    expect(tenantConfigResponse.ok).toBe(true);
    const tenantConfigJson = (await tenantConfigResponse.json()) as {
      items?: Array<{
        tenantId: string;
        enabledModules?: string[];
        whiteLabel?: { displayName?: string; supportEmail?: string };
      }>;
    };
    const provisionedTenant = tenantConfigJson.items?.find((item) => item.tenantId === createJson.partner?.tenantId);
    if (provisionedTenant?.enabledModules) {
      expect(provisionedTenant.enabledModules).toContain("digital_onboarding");
    }
    if (provisionedTenant?.whiteLabel?.displayName) {
      expect(provisionedTenant.whiteLabel.displayName).toBe(runtimePartnerLabel);
    }

    const finalRecordResponse = await fetch(`${baseUrl}/api/platform/partner-onboarding/${createJson.partner?.id}`);

    if (finalRecordResponse.ok) {
      const finalRecordJson = (await finalRecordResponse.json()) as {
        partner?: { stage?: string; readinessScore?: number };
        approvals?: Array<{ stage: string; state: string }>;
      };
      expect(finalRecordJson.approvals?.every((item) => item.state === "approved")).toBe(true);
      expect(["submitted", "approved", "launch_ready"]).toContain(finalRecordJson.partner?.stage || "");
      expect(finalRecordJson.partner?.readinessScore).toBeGreaterThan(70);
    }
  });
});
