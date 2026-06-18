/**
 * Open Banking API — CBN Regulatory Sandbox compliant.
 * PSD2-style API gateway for third-party fintech integrations,
 * consent management, TPP registration, and API marketplace.
 */
import type { Express, Request, Response } from "express";

interface TPPRegistration { id: string; name: string; type: string; cbnLicense: string; status: string; apiKeys: number; consentCount: number; registeredAt: string; contactEmail: string; }
interface Consent { id: string; customerId: string; tppId: string; tppName: string; permissions: string[]; status: string; grantedAt: string; expiresAt: string; lastAccessedAt: string; }
interface OpenBankingEndpoint { path: string; method: string; description: string; scope: string; rateLimit: number; version: string; }

const TPPS: TPPRegistration[] = [
  { id: "TPP-001", name: "Paystack", type: "PISP", cbnLicense: "CBN/OB/PISP/001", status: "active", apiKeys: 3, consentCount: 45000, registeredAt: "2026-01-15T00:00:00Z", contactEmail: "api@paystack.com" },
  { id: "TPP-002", name: "Flutterwave", type: "PISP", cbnLicense: "CBN/OB/PISP/002", status: "active", apiKeys: 2, consentCount: 38000, registeredAt: "2026-01-20T00:00:00Z", contactEmail: "developers@flutterwave.com" },
  { id: "TPP-003", name: "Carbon (formerly Paylater)", type: "AISP", cbnLicense: "CBN/OB/AISP/001", status: "active", apiKeys: 2, consentCount: 12000, registeredAt: "2026-02-01T00:00:00Z", contactEmail: "api@carbon.ng" },
  { id: "TPP-004", name: "PiggyVest", type: "AISP", cbnLicense: "CBN/OB/AISP/002", status: "active", apiKeys: 1, consentCount: 28000, registeredAt: "2026-02-15T00:00:00Z", contactEmail: "dev@piggyvest.com" },
  { id: "TPP-005", name: "Mono", type: "AISP", cbnLicense: "CBN/OB/AISP/003", status: "active", apiKeys: 4, consentCount: 65000, registeredAt: "2026-01-10T00:00:00Z", contactEmail: "hello@mono.co" },
  { id: "TPP-006", name: "Kuda Bank", type: "PISP_AISP", cbnLicense: "CBN/OB/PISP-AISP/001", status: "sandbox", apiKeys: 1, consentCount: 500, registeredAt: "2026-04-01T00:00:00Z", contactEmail: "engineering@kuda.com" },
];

const CONSENTS: Consent[] = [
  { id: "CON-001", customerId: "CUST-GT-001", tppId: "TPP-001", tppName: "Paystack", permissions: ["accounts:read", "payments:initiate"], status: "active", grantedAt: "2026-03-01T10:00:00Z", expiresAt: "2026-09-01T10:00:00Z", lastAccessedAt: "2026-05-09T14:00:00Z" },
  { id: "CON-002", customerId: "CUST-GT-001", tppId: "TPP-005", tppName: "Mono", permissions: ["accounts:read", "transactions:read", "balance:read"], status: "active", grantedAt: "2026-02-15T08:00:00Z", expiresAt: "2026-08-15T08:00:00Z", lastAccessedAt: "2026-05-09T12:00:00Z" },
  { id: "CON-003", customerId: "CUST-FB-001", tppId: "TPP-004", tppName: "PiggyVest", permissions: ["accounts:read", "payments:initiate"], status: "active", grantedAt: "2026-04-01T09:00:00Z", expiresAt: "2026-10-01T09:00:00Z", lastAccessedAt: "2026-05-08T16:00:00Z" },
  { id: "CON-004", customerId: "CUST-WEMA-001", tppId: "TPP-003", tppName: "Carbon", permissions: ["accounts:read", "transactions:read"], status: "revoked", grantedAt: "2026-01-20T11:00:00Z", expiresAt: "2026-07-20T11:00:00Z", lastAccessedAt: "2026-04-15T10:00:00Z" },
];

const ENDPOINTS: OpenBankingEndpoint[] = [
  { path: "/open-banking/v1/accounts", method: "GET", description: "List customer accounts", scope: "accounts:read", rateLimit: 100, version: "1.0" },
  { path: "/open-banking/v1/accounts/{id}/balance", method: "GET", description: "Get account balance", scope: "balance:read", rateLimit: 200, version: "1.0" },
  { path: "/open-banking/v1/accounts/{id}/transactions", method: "GET", description: "List account transactions", scope: "transactions:read", rateLimit: 50, version: "1.0" },
  { path: "/open-banking/v1/payments/initiate", method: "POST", description: "Initiate payment on behalf of customer", scope: "payments:initiate", rateLimit: 30, version: "1.0" },
  { path: "/open-banking/v1/payments/{id}/status", method: "GET", description: "Check payment status", scope: "payments:read", rateLimit: 100, version: "1.0" },
  { path: "/open-banking/v1/consent", method: "POST", description: "Request customer consent", scope: "consent:create", rateLimit: 20, version: "1.0" },
  { path: "/open-banking/v1/consent/{id}", method: "DELETE", description: "Revoke consent", scope: "consent:revoke", rateLimit: 20, version: "1.0" },
  { path: "/open-banking/v1/identity/verify", method: "POST", description: "Verify customer identity (BVN/NIN)", scope: "identity:verify", rateLimit: 10, version: "1.0" },
];

export function registerOpenBankingApi(app: Express) {
  app.get("/api/open-banking/v1/tpps", (_req: Request, res: Response) => { res.json({ items: TPPS, total: TPPS.length }); });
  app.get("/api/open-banking/v1/consents", (_req: Request, res: Response) => { res.json({ items: CONSENTS, total: CONSENTS.length, active: CONSENTS.filter((c) => c.status === "active").length }); });
  app.get("/api/open-banking/v1/endpoints", (_req: Request, res: Response) => { res.json({ items: ENDPOINTS, total: ENDPOINTS.length }); });
  app.post("/api/open-banking/v1/consents", (req: Request, res: Response) => {
    const { customerId, tppId, permissions } = req.body ?? {};
    const consent: Consent = { id: `CON-${String(CONSENTS.length + 1).padStart(3, "0")}`, customerId: customerId ?? "CUST-NEW", tppId: tppId ?? "TPP-001", tppName: TPPS.find((t) => t.id === tppId)?.name ?? "Unknown", permissions: permissions ?? ["accounts:read"], status: "active", grantedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 180 * 86400000).toISOString(), lastAccessedAt: new Date().toISOString() };
    CONSENTS.push(consent);
    res.status(201).json(consent);
  });
  app.get("/api/open-banking/v1/stats", (_req: Request, res: Response) => {
    res.json({ registeredTpps: TPPS.length, activeTpps: TPPS.filter((t) => t.status === "active").length, totalConsents: CONSENTS.length,
      activeConsents: CONSENTS.filter((c) => c.status === "active").length, endpoints: ENDPOINTS.length,
      apiCallsToday: 125000, avgResponseTimeMs: 45, complianceStatus: "CBN-sandbox-approved" });
  });
}
