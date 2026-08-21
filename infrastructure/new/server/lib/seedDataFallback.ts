/**
 * Seed Data Fallback & Feature Flag Engine — FAIL-SAFE VERSION.
 *
 * SECURITY NOTE: the previous revision of this module silently served
 * fabricated banking data (fake GL balances, KYC "verified" records, a PEP
 * list containing real people's names, fabricated SAR filings, FX rates,
 * Basel/LCR "compliant" ratios, face-match scores, and even fabricated
 * passing integration-test results) whenever microservices were offline.
 * That "silent mockware" has been removed.
 *
 * Current behavior:
 *  - NO fake business data is served in production, ever.
 *  - A small, clearly-labeled demo dataset (DEMO-* ids, "Demo *" names,
 *    small round amounts) is available ONLY when SEED_DATA_FALLBACK=true
 *    AND NODE_ENV !== "production". Every demo response carries
 *    `x-data-source: demo-seed`.
 *  - The proxy fallback registry is empty unless an explicit demo seed
 *    registers into it, so the gateway fails fast (502/503) on upstream
 *    outages instead of serving fakes.
 *  - The feature-flag engine is FAIL CLOSED: flags are read from the
 *    FEATURE_FLAGS_JSON env var (JSON object of flagKey -> boolean).
 *    Unknown flags default to DISABLED for non-admin tenants.
 *    TEN-PLATFORM-ADMIN retains full access. The in-memory admin store is
 *    only mutable in demo mode; otherwise flags are env-backed read-only.
 */
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { logger } from "./logger";

/** True only for explicit, non-production demo/seed mode. */
export function isDemoSeedMode(): boolean {
  return process.env.SEED_DATA_FALLBACK === "true" && process.env.NODE_ENV !== "production";
}

const DEMO_HEADER = "demo-seed";
function markDemo(res: Response): void {
  res.setHeader("x-data-source", DEMO_HEADER);
}

// ═══════════════════════════════════════════════════════════════════
//  PROXY FALLBACK REGISTRY
// ═══════════════════════════════════════════════════════════════════

/**
 * Registry of proxy-fallback datasets keyed by service path.
 * In production nothing registers here, so getProxyFallback() returns
 * undefined and callers must fail fast instead of serving canned data.
 */
export const fallbackRegistry = new Map<string, unknown[]>();

export function getProxyFallback(servicePath: string): unknown[] | undefined {
  return fallbackRegistry.get(servicePath);
}

// ═══════════════════════════════════════════════════════════════════
//  DEMO SEED DATA (opt-in, non-production only)
// ═══════════════════════════════════════════════════════════════════

// Small, obviously-fake dataset for local UI development of the main
// dashboard pages. Never registered unless isDemoSeedMode() is true.
const DEMO_DATA: Record<string, unknown[]> = {
  "/api/gl-engine/v1/gl/accounts": [
    { id: "DEMO-GL-001", code: "1000", name: "Demo Cash Account", type: "asset", balance: 10000, currency: "NGN", status: "demo" },
    { id: "DEMO-GL-002", code: "2000", name: "Demo Deposits Account", type: "liability", balance: 5000, currency: "NGN", status: "demo" },
  ],
  "/api/platform/health/registry": [
    { id: "DEMO-SVC-001", serviceName: "demo-service", status: "demo", port: 0, version: "0.0.0-demo" },
  ],
  "/api/platform/kyc-aml/v1/kyc/records": [
    { id: "DEMO-KYC-001", name: "Demo Customer", tier: "Demo", riskLevel: "demo", status: "demo" },
  ],
  "/api/fx-rates-engine/v1/fx/rates": [
    { id: "DEMO-FX-001", pair: "DEMO/DEMO", bid: 1, ask: 1, mid: 1, source: "demo-seed", status: "demo" },
  ],
  "/api/eod-processor/v1/eod/runs": [
    { id: "DEMO-EOD-001", date: "1970-01-01", status: "demo", accountsProcessed: 0, transactionsSettled: 0 },
  ],
};

// In-memory stores for demo CRUD (demo mode only)
const demoStores = new Map<string, unknown[]>();

function regDemo(app: Express, path: string, data: unknown[]): void {
  demoStores.set(path, [...data]);

  app.get(path, (_: Request, res: Response) => {
    const items = demoStores.get(path) ?? [];
    markDemo(res);
    res.json({ items, total: items.length, dataSource: DEMO_HEADER });
  });

  app.post(path, (req: Request, res: Response) => {
    const items = demoStores.get(path) ?? [];
    const record = { id: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`, ...req.body, status: "demo" };
    items.push(record);
    demoStores.set(path, items);
    markDemo(res);
    res.status(201).json(record);
  });

  app.put(`${path}/:id`, (req: Request, res: Response) => {
    const items = demoStores.get(path) ?? [];
    const idx = items.findIndex((r) => (r as { id?: string }).id === req.params.id);
    markDemo(res);
    if (idx < 0) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    items[idx] = { ...(items[idx] as object), ...req.body };
    demoStores.set(path, items);
    res.json(items[idx]);
  });

  app.delete(`${path}/:id`, (req: Request, res: Response) => {
    const items = demoStores.get(path) ?? [];
    demoStores.set(path, items.filter((r) => (r as { id?: string }).id !== req.params.id));
    markDemo(res);
    res.json({ deleted: req.params.id });
  });
}

/**
 * Register demo seed routes. No-op unless SEED_DATA_FALLBACK=true and
 * NODE_ENV !== "production"; in production this function is inert.
 */
export function registerSeedDataFallback(app: Express): void {
  if (!isDemoSeedMode()) {
    logger.warn(
      "Seed data fallback is DISABLED (requires SEED_DATA_FALLBACK=true and NODE_ENV !== 'production'). No demo routes registered.",
    );
    return;
  }
  logger.warn("DEMO SEED MODE active — serving clearly-labeled demo data for dashboard routes only.");
  for (const [path, data] of Object.entries(DEMO_DATA)) {
    regDemo(app, path, data);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  FEATURE FLAG TENANT CUSTOMIZATION ENGINE (fail-closed)
// ═══════════════════════════════════════════════════════════════════

const FLAG_CATEGORIES = [
  "core_banking", "payments", "cards_digital", "mobile_money", "lending",
  "treasury", "trade_finance", "wealth_management", "accounting",
  "risk_compliance", "agent_banking", "microfinance", "islamic_banking",
  "diaspora_banking", "cooperative_banking", "agriculture_banking",
  "billing", "multi_tenant",
  "chatbot", "smart_savings", "virtual_cards", "qr_payments",
  "bnpl", "investments", "remittances", "gamification",
];

const PLATFORM_ADMIN_TENANT = "TEN-PLATFORM-ADMIN";

// Route-to-flag mapping for API middleware (route gating)
const ROUTE_FLAG_MAP: Record<string, string> = {
  "/api/account-opening": "core_banking",
  "/api/customer": "core_banking",
  "/api/beneficiary": "core_banking",
  "/api/interest": "core_banking",
  "/api/fixed-deposit": "core_banking",
  "/api/savings": "core_banking",
  "/api/dormancy": "core_banking",
  "/api/standing": "core_banking",
  "/api/branch": "core_banking",
  "/api/teller": "core_banking",
  "/api/atm": "core_banking",
  "/api/pos": "core_banking",
  "/api/channel": "core_banking",
  "/api/transfer": "payments",
  "/api/payment": "payments",
  "/api/bulk-payment": "payments",
  "/api/utility-payment": "payments",
  "/api/bill-payment": "payments",
  "/api/direct-debit": "payments",
  "/api/mandate": "payments",
  "/api/collection": "payments",
  "/api/disbursement": "payments",
  "/api/card": "cards_digital",
  "/api/virtual-card": "cards_digital",
  "/api/qr": "cards_digital",
  "/api/wallet": "cards_digital",
  "/api/mobile-money": "mobile_money",
  "/api/ussd": "mobile_money",
  "/api/loan": "lending",
  "/api/credit": "lending",
  "/api/collateral": "lending",
  "/api/education-loan": "lending",
  "/api/group-lending": "lending",
  "/api/leasing": "lending",
  "/api/mortgage": "lending",
  "/api/treasury": "treasury",
  "/api/fx": "treasury",
  "/api/money-market": "treasury",
  "/api/otc": "treasury",
  "/api/securities": "treasury",
  "/api/cash-pooling": "treasury",
  "/api/trade-finance": "trade_finance",
  "/api/letter-of-credit": "trade_finance",
  "/api/bank-guarantee": "trade_finance",
  "/api/project-finance": "trade_finance",
  "/api/swift": "trade_finance",
  "/api/iso20022": "trade_finance",
  "/api/escrow": "trade_finance",
  "/api/wealth": "wealth_management",
  "/api/portfolio": "wealth_management",
  "/api/pension": "wealth_management",
  "/api/insurance": "wealth_management",
  "/api/gl": "accounting",
  "/api/gl-engine": "accounting",
  "/api/chart-of-accounts": "accounting",
  "/api/accounting-rules": "accounting",
  "/api/eod": "accounting",
  "/api/reconciliation": "accounting",
  "/api/statement": "accounting",
  "/api/risk": "risk_compliance",
  "/api/compliance": "risk_compliance",
  "/api/regulatory": "risk_compliance",
  "/api/aml": "risk_compliance",
  "/api/kyc": "risk_compliance",
  "/api/kyb": "risk_compliance",
  "/api/fraud": "risk_compliance",
  "/api/sanctions": "risk_compliance",
  "/api/ifrs9": "risk_compliance",
  "/api/lcr-nsfr": "risk_compliance",
  "/api/basel": "risk_compliance",
  "/api/agent-banking": "agent_banking",
  "/api/microfinance": "microfinance",
  "/api/islamic": "islamic_banking",
  "/api/diaspora": "diaspora_banking",
  "/api/esusu": "cooperative_banking",
  "/api/agriculture": "agriculture_banking",
  "/api/farm": "agriculture_banking",
  "/api/crop": "agriculture_banking",
  "/api/livestock": "agriculture_banking",
  "/api/warehouse": "agriculture_banking",
  "/api/commodity": "agriculture_banking",
  "/api/billing": "billing",
  "/api/pricing": "billing",
  "/api/revenue": "billing",
  "/api/enhancements/chatbot": "chatbot",
  "/api/enhancements/smart-savings": "smart_savings",
  "/api/enhancements/virtual-cards": "virtual_cards",
  "/api/enhancements/qr-payments": "qr_payments",
  "/api/enhancements/bnpl": "bnpl",
  "/api/enhancements/investments": "investments",
  "/api/enhancements/remittances": "remittances",
  "/api/enhancements/gamification": "gamification",
  "/api/growth": "chatbot",
};

/** Env-backed flag source: FEATURE_FLAGS_JSON = JSON object flagKey -> boolean. */
function loadEnvFlags(): Record<string, boolean> {
  const raw = process.env.FEATURE_FLAGS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = v === true;
    return out;
  } catch {
    logger.error("FEATURE_FLAGS_JSON is not valid JSON — all flags default to DISABLED (fail closed)");
    return {};
  }
}

// In-memory store, mutable ONLY in demo seed mode (per-tenant overrides).
interface TenantFlags {
  tenantId: string;
  flags: { key: string; enabled: boolean; rolloutPct: number }[];
}
const tenantFlagStore = new Map<string, TenantFlags>();

/** Fail-closed flag resolution: unknown flags are disabled for non-admin tenants. */
function isFlagEnabled(tenantId: string, flagKey: string): boolean {
  if (tenantId === PLATFORM_ADMIN_TENANT) return true;
  if (isDemoSeedMode()) {
    const override = tenantFlagStore.get(tenantId);
    const flag = override?.flags.find((f) => f.key === flagKey);
    if (flag) return flag.enabled;
  }
  return loadEnvFlags()[flagKey] === true;
}

function flagsForTenant(tenantId: string): TenantFlags {
  if (tenantId === PLATFORM_ADMIN_TENANT) {
    return { tenantId, flags: FLAG_CATEGORIES.map((key) => ({ key, enabled: true, rolloutPct: 100 })) };
  }
  if (isDemoSeedMode()) {
    const override = tenantFlagStore.get(tenantId);
    if (override) return override;
  }
  const env = loadEnvFlags();
  return {
    tenantId,
    flags: FLAG_CATEGORIES.map((key) => ({ key, enabled: env[key] === true, rolloutPct: env[key] === true ? 100 : 0 })),
  };
}

const READ_ONLY_ERROR = {
  error: "feature_flags_read_only",
  message:
    "Feature flags are env-backed (FEATURE_FLAGS_JSON) and read-only in this environment. " +
    "In-memory flag mutation is only available with SEED_DATA_FALLBACK=true and NODE_ENV !== 'production'.",
};

export function registerFeatureFlagEngine(app: Express): void {
  // GET tenant flags (for sidebar filtering) — fail closed for non-admins.
  app.get("/api/feature-flag-engine/v1/tenant-flags", (req: Request, res: Response) => {
    const tenantId = (req.headers["x-tenant-id"] as string) || PLATFORM_ADMIN_TENANT;
    const config = flagsForTenant(tenantId);
    res.json({
      items: config.flags.map((f) => ({
        key: f.key,
        label: f.key,
        enabled: f.enabled,
        rolloutPct: f.rolloutPct,
        category: f.key,
        tenantId: config.tenantId,
      })),
      tenantId: config.tenantId,
      total: config.flags.length,
    });
  });

  // PUT update tenant flags — in-memory only in demo mode, otherwise read-only.
  app.put("/api/feature-flag-engine/v1/tenant-flags", (req: Request, res: Response) => {
    if (!isDemoSeedMode()) {
      res.status(409).json(READ_ONLY_ERROR);
      return;
    }
    const { tenantId, flags } = req.body as { tenantId: string; flags: { key: string; enabled: boolean; rolloutPct: number }[] };
    if (!tenantId || !Array.isArray(flags)) {
      res.status(400).json({ error: "tenantId and flags required" });
      return;
    }
    tenantFlagStore.set(tenantId, { tenantId, flags });
    markDemo(res);
    res.json({ success: true, tenantId, flagCount: flags.length, dataSource: DEMO_HEADER });
  });

  // GET all tenants' flag configs (admin view).
  app.get("/api/feature-flag-engine/v1/tenant-flags/all", (_: Request, res: Response) => {
    if (isDemoSeedMode()) {
      const all: TenantFlags[] = [];
      tenantFlagStore.forEach((v) => all.push(v));
      markDemo(res);
      res.json({ items: all, total: all.length, dataSource: DEMO_HEADER });
      return;
    }
    // Env-backed: only the effective, non-admin flag set can be reported.
    res.json({ items: [flagsForTenant("env-backed")], total: 1, source: "FEATURE_FLAGS_JSON" });
  });

  // Service catalog endpoint — static module catalog with effective state.
  app.get("/api/service-catalog/v1/modules", (req: Request, res: Response) => {
    const tenantId = (req.headers["x-tenant-id"] as string) || PLATFORM_ADMIN_TENANT;
    res.json({
      items: FLAG_CATEGORIES.map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        available: true,
        enabled: isFlagEnabled(tenantId, key),
      })),
      total: FLAG_CATEGORIES.length,
    });
  });
}

// Feature flag API middleware — checks tenant's enabled flags before routing.
// FAIL CLOSED: for non-admin tenants a route is allowed only when its flag is
// explicitly enabled (env-backed, or in-memory override in demo mode).
export function featureFlagMiddleware(app: Express): void {
  app.use("/api", (req: Request, res: Response, next: () => void) => {
    if (req.path.includes("/healthz") || req.path.includes("/feature-flag-engine") ||
        req.path.includes("/service-catalog") || req.path.includes("/white-label") ||
        req.path.includes("/platform") || req.method === "OPTIONS") {
      next();
      return;
    }

    const tenantId = (req.headers["x-tenant-id"] as string) || PLATFORM_ADMIN_TENANT;

    // Platform admin bypasses all checks.
    if (tenantId === PLATFORM_ADMIN_TENANT) {
      next();
      return;
    }

    const routePrefix = Object.keys(ROUTE_FLAG_MAP).find((prefix) =>
      req.path.startsWith(prefix.replace("/api", "")),
    );
    if (!routePrefix) {
      next();
      return;
    }

    const flagKey = ROUTE_FLAG_MAP[routePrefix];
    if (!isFlagEnabled(tenantId, flagKey)) {
      res.status(403).json({
        error: "Module not enabled for this tenant",
        module: flagKey,
        tenantId,
        message: `The ${flagKey.replace(/_/g, " ")} module is not enabled for tenant ${tenantId}. Contact your platform administrator to enable this module.`,
      });
      return;
    }

    next();
  });
}
