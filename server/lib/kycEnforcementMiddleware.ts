/**
 * KYC/KYB Enforcement Middleware — Gateway-level identity verification gate.
 *
 * Intercepts requests to gated services and verifies KYC/KYB status before
 * proxying. Integrates with:
 *   - kycKybIntegration.ts (gate definitions, trigger records)
 *   - kyc-engine-py (verification status lookup)
 *   - kyc-workflow-orchestration-py (workflow state)
 *   - Kafka (event publishing for blocked/allowed decisions)
 *
 * Enforcement modes:
 *   - "enforcing": Block request if KYC/KYB not verified
 *   - "monitoring": Allow request but log violation
 *   - "disabled": Pass through without check
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// ── Gate Configuration ──────────────────────────────────────────────────────

interface GateRule {
  pathPattern: RegExp;
  serviceId: string;
  kycRequired: boolean;
  kybRequired: boolean;
  minimumLevel: "basic" | "standard" | "enhanced" | "full_edd";
  enforcedMethods: string[];
  bypassConditions: string[];
  extractCustomerId: (req: Request) => string | undefined;
  extractCompanyId?: (req: Request) => string | undefined;
}

const LEVEL_HIERARCHY: Record<string, number> = {
  basic: 1, standard: 2, enhanced: 3, full_edd: 4,
};

const fromBody = (req: Request) => (req.body as Record<string, string>)?.customerId;
const fromBodyCompany = (req: Request) => (req.body as Record<string, string>)?.companyId;

const GATE_RULES: GateRule[] = [
  // Account Opening — standard KYC for Tier 2+
  {
    pathPattern: /^\/api\/platform\/accounts\/(applications|applications\/approve)/,
    serviceId: "account-opening-go", kycRequired: true, kybRequired: false,
    minimumLevel: "standard", enforcedMethods: ["POST", "PUT"],
    bypassConditions: ["tier1_basic_savings"],
    extractCustomerId: fromBody,
  },
  // Loan Origination — enhanced KYC
  {
    pathPattern: /^\/api\/platform\/loan-origination\//,
    serviceId: "loan-origination-go", kycRequired: true, kybRequired: false,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Trade Finance — full EDD KYC + KYB
  {
    pathPattern: /^\/api\/platform\/trade-finance\/(lcs|guarantees)/,
    serviceId: "trade-finance-go", kycRequired: true, kybRequired: true,
    minimumLevel: "full_edd", enforcedMethods: ["POST", "PUT"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Card Management — basic for debit, enhanced for credit
  {
    pathPattern: /^\/api\/platform\/card-management\/cards\/(issue|activate)/,
    serviceId: "card-management-go", kycRequired: true, kybRequired: false,
    minimumLevel: "basic", enforcedMethods: ["POST"],
    bypassConditions: ["debit_card_tier1"],
    extractCustomerId: fromBody,
  },
  // Payments Hub — standard for international/bulk
  {
    pathPattern: /^\/api\/platform\/payments\/(international|bulk)/,
    serviceId: "payments-hub-go", kycRequired: true, kybRequired: false,
    minimumLevel: "standard", enforcedMethods: ["POST"],
    bypassConditions: ["amount_below_50000"],
    extractCustomerId: fromBody,
  },
  // Agent Banking — full EDD
  {
    pathPattern: /^\/api\/platform\/agent-banking\/agents\/(register|activate)/,
    serviceId: "agent-banking-go", kycRequired: true, kybRequired: false,
    minimumLevel: "full_edd", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Mortgage — full EDD
  {
    pathPattern: /^\/api\/platform\/mortgage\/(applications|disbursements)/,
    serviceId: "mortgage-servicing-rs", kycRequired: true, kybRequired: false,
    minimumLevel: "full_edd", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Escrow — enhanced KYC + KYB
  {
    pathPattern: /^\/api\/platform\/escrow\/accounts\/(create|release)/,
    serviceId: "escrow-go", kycRequired: true, kybRequired: true,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Supply Chain Finance — enhanced KYC + KYB
  {
    pathPattern: /^\/api\/platform\/supply-chain\/(programs|invoices\/finance)/,
    serviceId: "supply-chain-finance-go", kycRequired: true, kybRequired: true,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Wealth Management — full EDD
  {
    pathPattern: /^\/api\/platform\/wealth-mgmt\/(clients|portfolios)/,
    serviceId: "wealth-mgmt-py", kycRequired: true, kybRequired: false,
    minimumLevel: "full_edd", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Islamic Banking — enhanced
  {
    pathPattern: /^\/api\/platform\/islamic-banking\/(murabaha|sukuk)/,
    serviceId: "islamic-banking-py", kycRequired: true, kybRequired: false,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Diaspora Banking — enhanced
  {
    pathPattern: /^\/api\/platform\/diaspora\/(accounts|transfers)/,
    serviceId: "diaspora-banking-py", kycRequired: true, kybRequired: false,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Remittance — enhanced
  {
    pathPattern: /^\/api\/platform\/remittance\/(transfers|beneficiaries)/,
    serviceId: "remittance-go", kycRequired: true, kybRequired: false,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
  // Syndicated Loans — full EDD + KYB
  {
    pathPattern: /^\/api\/platform\/syndicated-loans\/(facilities|participations)/,
    serviceId: "syndicated-loans-go", kycRequired: true, kybRequired: true,
    minimumLevel: "full_edd", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Factoring — enhanced + KYB
  {
    pathPattern: /^\/api\/platform\/factoring\/(agreements|invoices\/advance)/,
    serviceId: "factoring-go", kycRequired: true, kybRequired: true,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Open Banking — standard
  {
    pathPattern: /^\/api\/platform\/open-banking\/(consents|payments\/initiate)/,
    serviceId: "open-banking-go", kycRequired: true, kybRequired: false,
    minimumLevel: "standard", enforcedMethods: ["POST"],
    bypassConditions: ["read_only_consent"],
    extractCustomerId: fromBody,
  },
  // Insurance — enhanced
  {
    pathPattern: /^\/api\/platform\/insurance\/(policies\/bind|claims)/,
    serviceId: "insurance-py", kycRequired: true, kybRequired: false,
    minimumLevel: "enhanced", enforcedMethods: ["POST"],
    bypassConditions: ["sum_assured_below_1m"],
    extractCustomerId: fromBody,
  },
  // Customer Onboarding — BVN validation requires basic, full onboarding requires standard
  {
    pathPattern: /^\/api\/platform\/onboarding\/(validate-bvn|validate-nin)/,
    serviceId: "customer-onboarding", kycRequired: false, kybRequired: false,
    minimumLevel: "basic", enforcedMethods: ["POST"],
    bypassConditions: ["onboarding_bvn_nin_self_service"],
    extractCustomerId: fromBody,
  },
  // Customer Creation — Tier 2+ require standard KYC before platform record creation
  {
    pathPattern: /^\/api\/platform\/customers$/,
    serviceId: "customer-creation", kycRequired: true, kybRequired: false,
    minimumLevel: "basic", enforcedMethods: ["POST"],
    bypassConditions: ["tier1_basic_only"],
    extractCustomerId: fromBody,
  },
  // Custody Service — full EDD + KYB
  {
    pathPattern: /^\/api\/platform\/custody\/(accounts|assets\/transfer)/,
    serviceId: "custody-service-go", kycRequired: true, kybRequired: true,
    minimumLevel: "full_edd", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
    extractCompanyId: fromBodyCompany,
  },
  // Virtual Accounts — standard
  {
    pathPattern: /^\/api\/platform\/virtual-accounts\/(create|topup)/,
    serviceId: "virtual-accounts-go", kycRequired: true, kybRequired: false,
    minimumLevel: "standard", enforcedMethods: ["POST"],
    bypassConditions: [],
    extractCustomerId: fromBody,
  },
];

// ── KYC/KYB Verification Store ──────────────────────────────────────────────

interface VerificationRecord {
  customerId: string;
  level: "basic" | "standard" | "enhanced" | "full_edd";
  status: "verified" | "pending" | "expired" | "rejected";
  verifiedAt: string;
  expiresAt: string;
  livenessVerified: boolean;
  documentsVerified: boolean;
  bvnVerified: boolean;
  ninVerified: boolean;
  sanctionsCleared: boolean;
}

interface KYBVerificationRecord {
  companyId: string;
  rcNumber: string;
  level: "basic" | "standard" | "enhanced" | "full_edd";
  status: "verified" | "pending" | "expired" | "rejected";
  verifiedAt: string;
  expiresAt: string;
  cacVerified: boolean;
  tinVerified: boolean;
  uboVerified: boolean;
  directorScreened: boolean;
  sanctionsCleared: boolean;
}

const kycStore: Map<string, VerificationRecord> = new Map([
  ["CUS-1045", { customerId: "CUS-1045", level: "enhanced", status: "verified", verifiedAt: "2026-05-08T09:02:45Z", expiresAt: "2027-05-08T09:02:45Z", livenessVerified: true, documentsVerified: true, bvnVerified: true, ninVerified: true, sanctionsCleared: true }],
  ["CUS-2089", { customerId: "CUS-2089", level: "standard", status: "verified", verifiedAt: "2026-05-05T14:00:00Z", expiresAt: "2027-05-05T14:00:00Z", livenessVerified: true, documentsVerified: true, bvnVerified: true, ninVerified: false, sanctionsCleared: true }],
  ["CUS-4055", { customerId: "CUS-4055", level: "full_edd", status: "verified", verifiedAt: "2026-05-01T00:03:12Z", expiresAt: "2027-05-01T00:03:12Z", livenessVerified: true, documentsVerified: true, bvnVerified: true, ninVerified: true, sanctionsCleared: true }],
  ["CUS-3021", { customerId: "CUS-3021", level: "basic", status: "pending", verifiedAt: "", expiresAt: "", livenessVerified: false, documentsVerified: false, bvnVerified: false, ninVerified: false, sanctionsCleared: false }],
]);

const kybStore: Map<string, KYBVerificationRecord> = new Map([
  ["COMP-001", { companyId: "COMP-001", rcNumber: "RC-71242", level: "full_edd", status: "verified", verifiedAt: "2026-05-08T11:01:30Z", expiresAt: "2027-05-08T11:01:30Z", cacVerified: true, tinVerified: true, uboVerified: true, directorScreened: true, sanctionsCleared: true }],
  ["COMP-002", { companyId: "COMP-002", rcNumber: "RC-151345", level: "enhanced", status: "verified", verifiedAt: "2026-05-09T09:02:00Z", expiresAt: "2027-05-09T09:02:00Z", cacVerified: true, tinVerified: true, uboVerified: true, directorScreened: true, sanctionsCleared: true }],
  ["COMP-003", { companyId: "COMP-003", rcNumber: "RC-999888", level: "enhanced", status: "rejected", verifiedAt: "2026-05-07T15:02:00Z", expiresAt: "", cacVerified: true, tinVerified: false, uboVerified: false, directorScreened: true, sanctionsCleared: false }],
]);

// ── Enforcement Events ──────────────────────────────────────────────────────

interface EnforcementEvent {
  id: string;
  timestamp: string;
  serviceId: string;
  path: string;
  method: string;
  customerId?: string;
  companyId?: string;
  decision: "allowed" | "blocked" | "monitored";
  reason: string;
  kycLevel?: string;
  requiredLevel?: string;
}

const enforcementLog: EnforcementEvent[] = [];
let enforcementMode: "enforcing" | "monitoring" | "disabled" = "enforcing";

function logEnforcement(event: Omit<EnforcementEvent, "id" | "timestamp">) {
  const entry: EnforcementEvent = {
    ...event,
    id: `ENF-${String(enforcementLog.length + 1).padStart(6, "0")}`,
    timestamp: new Date().toISOString(),
  };
  enforcementLog.push(entry);
  if (enforcementLog.length > 10000) enforcementLog.splice(0, 5000);

  if (entry.decision === "blocked") {
    logger.warn(`[KYC-GATE] BLOCKED ${entry.method} ${entry.path} — ${entry.reason} (customer: ${entry.customerId || "N/A"}, service: ${entry.serviceId})`);
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function kycEnforcementMiddleware(req: Request, res: Response, next: NextFunction) {
  if (enforcementMode === "disabled") return next();
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") return next();

  const matchedRule = GATE_RULES.find(
    rule => rule.pathPattern.test(req.path) && rule.enforcedMethods.includes(req.method)
  );

  if (!matchedRule) return next();

  const customerId = matchedRule.extractCustomerId(req);
  const companyId = matchedRule.extractCompanyId?.(req);

  // No customerId in request — allow but log
  if (!customerId && matchedRule.kycRequired) {
    logEnforcement({
      serviceId: matchedRule.serviceId, path: req.path, method: req.method,
      decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
      reason: "No customerId provided in request body",
      requiredLevel: matchedRule.minimumLevel,
    });
    if (enforcementMode === "enforcing") {
      return res.status(400).json({
        error: "KYC verification required",
        code: "KYC_CUSTOMER_ID_REQUIRED",
        message: "customerId is required for this operation — KYC verification must be completed",
        service: matchedRule.serviceId,
        requiredLevel: matchedRule.minimumLevel,
        kycInitiateUrl: "/api/platform/kyc-triggers/initiate",
      });
    }
    return next();
  }

  // KYC check
  if (matchedRule.kycRequired && customerId) {
    const kyc = kycStore.get(customerId);

    if (!kyc || kyc.status !== "verified") {
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason: !kyc ? "No KYC record found" : `KYC status: ${kyc.status}`,
        kycLevel: kyc?.level, requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        return res.status(403).json({
          error: "KYC verification required",
          code: "KYC_NOT_VERIFIED",
          message: `KYC verification is required before accessing ${matchedRule.serviceId}`,
          customerId,
          currentStatus: kyc?.status || "not_found",
          requiredLevel: matchedRule.minimumLevel,
          kycInitiateUrl: "/api/platform/kyc-triggers/initiate",
          kafkaEvent: { topic: "kyc.gate.blocked", payload: { serviceId: matchedRule.serviceId, customerId, path: req.path } },
        });
      }
      return next();
    }

    // Check level hierarchy
    if (LEVEL_HIERARCHY[kyc.level] < LEVEL_HIERARCHY[matchedRule.minimumLevel]) {
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason: `KYC level insufficient: has ${kyc.level}, needs ${matchedRule.minimumLevel}`,
        kycLevel: kyc.level, requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        return res.status(403).json({
          error: "KYC level insufficient",
          code: "KYC_LEVEL_INSUFFICIENT",
          message: `This operation requires ${matchedRule.minimumLevel} KYC — customer has ${kyc.level}`,
          customerId,
          currentLevel: kyc.level,
          requiredLevel: matchedRule.minimumLevel,
          upgradeUrl: `/api/platform/kyc-triggers/initiate`,
        });
      }
      return next();
    }

    // Check expiry
    if (kyc.expiresAt && new Date(kyc.expiresAt) < new Date()) {
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason: `KYC expired at ${kyc.expiresAt}`,
        kycLevel: kyc.level, requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        return res.status(403).json({
          error: "KYC expired",
          code: "KYC_EXPIRED",
          message: "KYC verification has expired — re-verification required",
          customerId,
          expiredAt: kyc.expiresAt,
          reverifyUrl: "/api/platform/kyc-triggers/re-verify",
        });
      }
      return next();
    }
  }

  // KYB check (corporate services)
  if (matchedRule.kybRequired && companyId) {
    const kyb = kybStore.get(companyId);

    if (!kyb || kyb.status !== "verified") {
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, companyId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason: !kyb ? "No KYB record found" : `KYB status: ${kyb.status}`,
        requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        return res.status(403).json({
          error: "KYB verification required",
          code: "KYB_NOT_VERIFIED",
          message: `Corporate identity verification is required before accessing ${matchedRule.serviceId}`,
          companyId,
          currentStatus: kyb?.status || "not_found",
          requiredLevel: matchedRule.minimumLevel,
          kybInitiateUrl: "/api/platform/kyb-triggers/initiate",
        });
      }
      return next();
    }
  }

  // All checks passed
  logEnforcement({
    serviceId: matchedRule.serviceId, path: req.path, method: req.method,
    customerId, companyId, decision: "allowed",
    reason: "KYC/KYB verification passed",
    kycLevel: customerId ? kycStore.get(customerId)?.level : undefined,
    requiredLevel: matchedRule.minimumLevel,
  });

  // Attach verification info to request for downstream services
  (req as any).kycVerification = customerId ? kycStore.get(customerId) : undefined;
  (req as any).kybVerification = companyId ? kybStore.get(companyId) : undefined;

  next();
}

// ── Admin API for Enforcement ───────────────────────────────────────────────

export function registerKYCEnforcementRoutes(app: import("express").Express) {

  // Enforcement status & mode
  app.get("/api/platform/kyc-enforcement/status", (_req: Request, res: Response) => {
    const blocked = enforcementLog.filter(e => e.decision === "blocked").length;
    const allowed = enforcementLog.filter(e => e.decision === "allowed").length;
    const monitored = enforcementLog.filter(e => e.decision === "monitored").length;
    res.json({
      mode: enforcementMode,
      gateRules: GATE_RULES.length,
      kycRecords: kycStore.size,
      kybRecords: kybStore.size,
      enforcementLog: { total: enforcementLog.length, blocked, allowed, monitored },
      blockRate: enforcementLog.length > 0 ? Math.round(blocked / enforcementLog.length * 100 * 100) / 100 : 0,
    });
  });

  app.put("/api/platform/kyc-enforcement/mode", (req: Request, res: Response) => {
    const { mode } = req.body || {};
    if (!["enforcing", "monitoring", "disabled"].includes(mode)) {
      return res.status(400).json({ error: "mode must be enforcing, monitoring, or disabled" });
    }
    enforcementMode = mode;
    res.json({ mode: enforcementMode, message: `KYC enforcement mode set to: ${mode}` });
  });

  // Enforcement log
  app.get("/api/platform/kyc-enforcement/log", (req: Request, res: Response) => {
    const decision = req.query.decision as string | undefined;
    const serviceId = req.query.serviceId as string | undefined;
    let filtered = enforcementLog;
    if (decision) filtered = filtered.filter(e => e.decision === decision);
    if (serviceId) filtered = filtered.filter(e => e.serviceId === serviceId);
    res.json({ events: filtered.slice(-200), total: filtered.length });
  });

  // Manual KYC record management
  app.get("/api/platform/kyc-enforcement/records", (_req: Request, res: Response) => {
    res.json({
      kyc: Array.from(kycStore.values()),
      kyb: Array.from(kybStore.values()),
    });
  });

  app.post("/api/platform/kyc-enforcement/records/kyc", (req: Request, res: Response) => {
    const { customerId, level, livenessVerified, documentsVerified, bvnVerified, ninVerified, sanctionsCleared } = req.body || {};
    if (!customerId || !level) return res.status(400).json({ error: "customerId and level required" });
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const record: VerificationRecord = {
      customerId, level, status: "verified",
      verifiedAt: now, expiresAt: expires,
      livenessVerified: livenessVerified ?? true,
      documentsVerified: documentsVerified ?? true,
      bvnVerified: bvnVerified ?? true,
      ninVerified: ninVerified ?? (level !== "basic"),
      sanctionsCleared: sanctionsCleared ?? true,
    };
    kycStore.set(customerId, record);
    res.status(201).json({
      ...record,
      message: `KYC record created/updated for ${customerId} at level ${level}`,
      kafkaEvent: { topic: "kyc.verification.completed", payload: { customerId, level } },
    });
  });

  app.post("/api/platform/kyc-enforcement/records/kyb", (req: Request, res: Response) => {
    const { companyId, rcNumber, level, cacVerified, tinVerified, uboVerified, directorScreened, sanctionsCleared } = req.body || {};
    if (!companyId || !rcNumber || !level) return res.status(400).json({ error: "companyId, rcNumber, and level required" });
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const record: KYBVerificationRecord = {
      companyId, rcNumber, level, status: "verified",
      verifiedAt: now, expiresAt: expires,
      cacVerified: cacVerified ?? true,
      tinVerified: tinVerified ?? true,
      uboVerified: uboVerified ?? true,
      directorScreened: directorScreened ?? true,
      sanctionsCleared: sanctionsCleared ?? true,
    };
    kybStore.set(companyId, record);
    res.status(201).json({
      ...record,
      message: `KYB record created/updated for ${companyId} (${rcNumber}) at level ${level}`,
      kafkaEvent: { topic: "kyb.verification.completed", payload: { companyId, rcNumber, level } },
    });
  });

  // Inline KYC check (for services to call programmatically)
  app.post("/api/platform/kyc-enforcement/check", (req: Request, res: Response) => {
    const { customerId, companyId, serviceId, operation } = req.body || {};
    const rule = GATE_RULES.find(r => r.serviceId === serviceId);

    const kyc = customerId ? kycStore.get(customerId) : undefined;
    const kyb = companyId ? kybStore.get(companyId) : undefined;

    const kycOk = !rule?.kycRequired || (kyc?.status === "verified" && (!rule || LEVEL_HIERARCHY[kyc.level] >= LEVEL_HIERARCHY[rule.minimumLevel]));
    const kybOk = !rule?.kybRequired || kyb?.status === "verified";
    const allowed = kycOk && kybOk;

    res.json({
      allowed,
      customerId, companyId, serviceId, operation,
      kycStatus: kyc ? { level: kyc.level, status: kyc.status, verified: kyc.status === "verified" } : { status: "not_found", verified: false },
      kybStatus: kyb ? { level: kyb.level, status: kyb.status, verified: kyb.status === "verified" } : companyId ? { status: "not_found", verified: false } : undefined,
      requiredLevel: rule?.minimumLevel,
      reason: allowed ? "All verifications passed" : !kycOk ? "KYC verification required or insufficient level" : "KYB verification required",
    });
  });

  // Gate rules (read-only)
  app.get("/api/platform/kyc-enforcement/rules", (_req: Request, res: Response) => {
    res.json({
      rules: GATE_RULES.map(r => ({
        serviceId: r.serviceId,
        pathPattern: r.pathPattern.source,
        kycRequired: r.kycRequired,
        kybRequired: r.kybRequired,
        minimumLevel: r.minimumLevel,
        enforcedMethods: r.enforcedMethods,
        bypassConditions: r.bypassConditions,
      })),
      total: GATE_RULES.length,
    });
  });
}
