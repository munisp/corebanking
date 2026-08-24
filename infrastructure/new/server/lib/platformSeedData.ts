/**
 * Platform Seed Data — FAIL-SAFE VERSION.
 *
 * SECURITY NOTE: the previous revision of this module unconditionally served
 * fabricated banking data for ~90 routes (fake customer records with BVNs,
 * fake balances, fake regulatory filings "filed", fake test results "passed",
 * fake reconciliation "balanced", etc.) so that PWA pages never showed errors
 * when microservices were offline. That "silent mockware" has been removed.
 *
 * Current behavior:
 *  - Both exported functions are NO-OPS unless SEED_DATA_FALLBACK=true AND
 *    NODE_ENV !== "production". In production this module is inert.
 *  - When explicitly enabled, only a tiny, obviously-fake demo dataset
 *    (DEMO-* ids, "Demo *" names, small round amounts) is served for a few
 *    main dashboard routes, and every response carries
 *    `x-data-source: demo-seed`.
 */
import type { Express, Request, Response } from "express";
import { logger } from "./logger";
import { isDemoSeedMode } from "./seedDataFallback";

const DEMO_HEADER = "demo-seed";

function disabledLog(fn: string): void {
  logger.warn(
    `${fn} is DISABLED (requires SEED_DATA_FALLBACK=true and NODE_ENV !== 'production'). No seed/proxy-fallback data registered.`,
  );
}

/**
 * Register proxy fallback data into the fallback registry.
 * No-op outside demo seed mode — in production the registry stays empty so
 * the gateway fails fast (502/503) instead of serving canned data.
 */
export function registerProxySeedFallback(registry: Map<string, unknown[]>): void {
  if (!isDemoSeedMode()) {
    disabledLog("registerProxySeedFallback");
    return;
  }
  const demoSeeds: Record<string, unknown[]> = {
    "/v1/customers": [{ id: "DEMO-CIF-001", name: "Demo Customer", tier: "Demo", status: "demo" }],
    "/v1/accounts": [{ id: "DEMO-ACC-001", name: "Demo Account", balance: 1000, currency: "NGN", status: "demo" }],
  };
  for (const [path, data] of Object.entries(demoSeeds)) {
    if (!registry.has(path)) {
      registry.set(path, data);
    }
  }
}

/**
 * Register demo seed routes for main dashboard pages.
 * No-op outside demo seed mode.
 */
export function registerPlatformSeedRoutes(app: Express): void {
  if (!isDemoSeedMode()) {
    disabledLog("registerPlatformSeedRoutes");
    return;
  }

  logger.warn("DEMO SEED MODE active — serving clearly-labeled demo data for platform dashboard routes only.");

  const demoRoutes: Record<string, unknown[]> = {
    "/api/kyc-enhanced/summary": [
      { id: "DEMO-KYC-S-001", name: "Demo Total Customers", value: 10, status: "demo" },
      { id: "DEMO-KYC-S-002", name: "Demo KYC Verified", value: 5, status: "demo" },
    ],
    "/api/platform/authz/roles": [
      { id: "DEMO-ROLE-001", name: "Demo Role", permissions: 0, users: 0, status: "demo" },
    ],
    "/api/platform/products": [
      { id: "DEMO-PRD-001", name: "Demo Savings Product", type: "savings", interestRate: 0, status: "demo" },
    ],
    "/api/platform/payments": [
      { id: "DEMO-PAY-001", name: "Demo Payment", type: "demo", amount: 100, currency: "NGN", status: "demo" },
    ],
    "/api/platform/rates/base": [
      { id: "DEMO-RATE-001", name: "Demo Rate", rate: 0, status: "demo" },
    ],
    "/api/platform/identity/users": [
      { id: "DEMO-USR-001", name: "Demo User", email: "demo@example.invalid", role: "demo", status: "demo" },
    ],
    "/api/resilience/dashboard": [
      { id: "DEMO-RES-001", name: "Demo Circuit Breaker", type: "circuit_breaker", state: "demo", status: "demo" },
    ],
  };

  for (const [path, items] of Object.entries(demoRoutes)) {
    app.get(path, (_req: Request, res: Response) => {
      res.setHeader("x-data-source", DEMO_HEADER);
      res.json({ items, total: items.length, dataSource: DEMO_HEADER });
    });
  }
}
