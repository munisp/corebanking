/**
 * Embedded Finance SDK — JavaScript/Flutter SDK for partners to embed
 * 54Bank services (payments, accounts, KYC) into their own apps.
 * API key management, webhook configuration, SDK analytics, and sandbox.
 */
import type { Express, Request, Response } from "express";

interface SDKPartner { id: string; name: string; industry: string; integrationTypes: string[]; apiKeys: { environment: string; keyPrefix: string; status: string; createdAt: string }[]; webhookUrl?: string; sdkVersion: string; platform: string; monthlyApiCalls: number; status: string; onboardedAt: string; }
interface SDKEndpoint { category: string; path: string; method: string; description: string; sdkMethod: string; platforms: string[]; }
interface WebhookEvent { id: string; partnerId: string; eventType: string; payload: Record<string, unknown>; status: string; attempts: number; deliveredAt?: string; }

const PARTNERS: SDKPartner[] = [
  { id: "SDK-001", name: "Jumia Nigeria", industry: "e-commerce", integrationTypes: ["payments", "disbursements"], apiKeys: [{ environment: "production", keyPrefix: "sk_live_54b_jumia_", status: "active", createdAt: "2026-02-01T00:00:00Z" }, { environment: "sandbox", keyPrefix: "sk_test_54b_jumia_", status: "active", createdAt: "2026-01-15T00:00:00Z" }], webhookUrl: "https://api.jumia.com.ng/webhooks/54bank", sdkVersion: "2.3.0", platform: "javascript", monthlyApiCalls: 2500000, status: "active", onboardedAt: "2026-02-01T00:00:00Z" },
  { id: "SDK-002", name: "Gokada", industry: "ride-hailing", integrationTypes: ["payments", "wallets", "kyc"], apiKeys: [{ environment: "production", keyPrefix: "sk_live_54b_gokada_", status: "active", createdAt: "2026-03-01T00:00:00Z" }], webhookUrl: "https://api.gokada.ng/webhooks/54bank", sdkVersion: "2.3.0", platform: "flutter", monthlyApiCalls: 850000, status: "active", onboardedAt: "2026-03-01T00:00:00Z" },
  { id: "SDK-003", name: "Paga", industry: "fintech", integrationTypes: ["accounts", "transfers", "kyc"], apiKeys: [{ environment: "production", keyPrefix: "sk_live_54b_paga_", status: "active", createdAt: "2026-02-15T00:00:00Z" }], webhookUrl: "https://api.mypaga.com/webhooks/54bank", sdkVersion: "2.2.0", platform: "javascript", monthlyApiCalls: 1200000, status: "active", onboardedAt: "2026-02-15T00:00:00Z" },
  { id: "SDK-004", name: "Kobo360", industry: "logistics", integrationTypes: ["payments", "disbursements"], apiKeys: [{ environment: "sandbox", keyPrefix: "sk_test_54b_kobo_", status: "active", createdAt: "2026-04-01T00:00:00Z" }], sdkVersion: "2.3.0", platform: "javascript", monthlyApiCalls: 15000, status: "sandbox", onboardedAt: "2026-04-01T00:00:00Z" },
  { id: "SDK-005", name: "Farmcrowdy", industry: "agriculture", integrationTypes: ["payments", "accounts", "kyc", "loans"], apiKeys: [{ environment: "production", keyPrefix: "sk_live_54b_farmc_", status: "active", createdAt: "2026-03-15T00:00:00Z" }], webhookUrl: "https://api.farmcrowdy.com/webhooks/54bank", sdkVersion: "2.3.0", platform: "flutter", monthlyApiCalls: 350000, status: "active", onboardedAt: "2026-03-15T00:00:00Z" },
];

const SDK_ENDPOINTS: SDKEndpoint[] = [
  { category: "Payments", path: "/sdk/v1/payments/initialize", method: "POST", description: "Initialize a payment — returns checkout URL or inline widget config", sdkMethod: "FiftyFourBank.payments.initialize()", platforms: ["javascript", "flutter", "react_native"] },
  { category: "Payments", path: "/sdk/v1/payments/verify/{reference}", method: "GET", description: "Verify payment status", sdkMethod: "FiftyFourBank.payments.verify(reference)", platforms: ["javascript", "flutter", "react_native"] },
  { category: "Accounts", path: "/sdk/v1/accounts/create", method: "POST", description: "Create a virtual account for a customer", sdkMethod: "FiftyFourBank.accounts.create()", platforms: ["javascript", "flutter"] },
  { category: "Accounts", path: "/sdk/v1/accounts/{id}/balance", method: "GET", description: "Get account balance", sdkMethod: "FiftyFourBank.accounts.balance(id)", platforms: ["javascript", "flutter", "react_native"] },
  { category: "Transfers", path: "/sdk/v1/transfers/initiate", method: "POST", description: "Initiate bank transfer", sdkMethod: "FiftyFourBank.transfers.initiate()", platforms: ["javascript", "flutter"] },
  { category: "KYC", path: "/sdk/v1/kyc/verify", method: "POST", description: "Verify customer identity (BVN/NIN)", sdkMethod: "FiftyFourBank.kyc.verify()", platforms: ["javascript", "flutter", "react_native"] },
  { category: "KYC", path: "/sdk/v1/kyc/liveness", method: "POST", description: "Selfie liveness check", sdkMethod: "FiftyFourBank.kyc.livenessCheck()", platforms: ["flutter", "react_native"] },
  { category: "Webhooks", path: "/sdk/v1/webhooks/configure", method: "POST", description: "Configure webhook endpoint for events", sdkMethod: "Dashboard only", platforms: [] },
];

const WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: "WH-001", partnerId: "SDK-001", eventType: "payment.completed", payload: { reference: "PAY-JUMIA-001", amount: 25000, currency: "NGN" }, status: "delivered", attempts: 1, deliveredAt: "2026-05-09T10:30:05Z" },
  { id: "WH-002", partnerId: "SDK-002", eventType: "transfer.completed", payload: { reference: "TXF-GOKADA-001", amount: 150000 }, status: "delivered", attempts: 1, deliveredAt: "2026-05-09T11:00:02Z" },
  { id: "WH-003", partnerId: "SDK-003", eventType: "kyc.verified", payload: { customerId: "PAGA-CUST-001", level: 2 }, status: "delivered", attempts: 2, deliveredAt: "2026-05-09T09:15:08Z" },
  { id: "WH-004", partnerId: "SDK-004", eventType: "payment.failed", payload: { reference: "PAY-KOBO-001", error: "Insufficient funds" }, status: "failed", attempts: 3 },
];

export function registerEmbeddedFinanceSdk(app: Express) {
  app.get("/api/sdk/v1/partners", (_req: Request, res: Response) => { res.json({ items: PARTNERS, total: PARTNERS.length }); });
  app.get("/api/sdk/v1/endpoints", (_req: Request, res: Response) => { res.json({ items: SDK_ENDPOINTS, total: SDK_ENDPOINTS.length }); });
  app.get("/api/sdk/v1/webhooks", (_req: Request, res: Response) => { res.json({ items: WEBHOOK_EVENTS, total: WEBHOOK_EVENTS.length }); });
  app.post("/api/sdk/v1/partners", (req: Request, res: Response) => {
    const { name, industry, integrationTypes } = req.body ?? {};
    const partner: SDKPartner = { id: `SDK-${String(PARTNERS.length + 1).padStart(3, "0")}`, name: name ?? "New Partner", industry: industry ?? "fintech", integrationTypes: integrationTypes ?? ["payments"], apiKeys: [{ environment: "sandbox", keyPrefix: `sk_test_54b_${(name ?? "new").toLowerCase().replace(/\s/g, "")}_`, status: "active", createdAt: new Date().toISOString() }], sdkVersion: "2.3.0", platform: "javascript", monthlyApiCalls: 0, status: "sandbox", onboardedAt: new Date().toISOString() };
    PARTNERS.push(partner);
    res.status(201).json(partner);
  });
  app.get("/api/sdk/v1/stats", (_req: Request, res: Response) => {
    res.json({ totalPartners: PARTNERS.length, activePartners: PARTNERS.filter((p) => p.status === "active").length,
      totalMonthlyApiCalls: PARTNERS.reduce((s, p) => s + p.monthlyApiCalls, 0), sdkEndpoints: SDK_ENDPOINTS.length,
      webhookDeliveryRate: 75, avgLatencyMs: 35, platforms: ["javascript", "flutter", "react_native"],
      topPartner: PARTNERS.sort((a, b) => b.monthlyApiCalls - a.monthlyApiCalls)[0]?.name });
  });
}
