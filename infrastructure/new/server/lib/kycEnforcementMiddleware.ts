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
 *
 * REMEDIATION (silent mockware): verification status is sourced from the
 * database (kyc_enforcement_verifications / kyb_enforcement_verifications) —
 * not from hardcoded in-memory records with sanctionsCleared: true. Any
 * database error, missing record, non-verified status, expiry, or
 * sanctionsCleared !== true is treated as NOT cleared (fail closed) and is
 * logged loudly. The demo in-memory seed store is only consulted when
 * SEED_DATA_FALLBACK === "true" AND NODE_ENV !== "production".
 */
import { Request, Response, NextFunction } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { kycEnforcementVerifications, kybEnforcementVerifications } from "../../drizzle/schema";
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

// Demo seed data — ONLY consulted when SEED_DATA_FALLBACK === "true" and
// NODE_ENV !== "production". Never used as an authority in production.
const SEED_DATA_FALLBACK =
  process.env.SEED_DATA_FALLBACK === "true" && process.env.NODE_ENV !== "production";

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

// ── Database-backed verification lookups (fail closed) ──────────────────────

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : "");

/**
 * Latest KYC verification record for a customer, from the database.
 * Returns null when the DB is unavailable, the query fails, or no record
 * exists — callers MUST treat null as NOT cleared. Only behind the explicit
 * non-production SEED_DATA_FALLBACK flag does it fall back to demo seed data.
 */
async function lookupKyc(customerId: string): Promise<VerificationRecord | null> {
  const db = await getDb();
  if (!db) {
    logger.error("[KYC-GATE] Database unavailable during KYC lookup — treating customer as NOT cleared", { customerId });
    return SEED_DATA_FALLBACK ? kycStore.get(customerId) ?? null : null;
  }
  try {
    const rows = await db
      .select()
      .from(kycEnforcementVerifications)
      .where(eq(kycEnforcementVerifications.customerId, customerId))
      .orderBy(desc(kycEnforcementVerifications.createdAt))
      .limit(1);
    const r = rows[0];
    if (!r) return SEED_DATA_FALLBACK ? kycStore.get(customerId) ?? null : null;
    return {
      customerId: r.customerId,
      level: r.level as VerificationRecord["level"],
      status: r.status as VerificationRecord["status"],
      verifiedAt: iso(r.verifiedAt),
      expiresAt: iso(r.expiresAt),
      livenessVerified: r.livenessVerified === true,
      documentsVerified: r.documentsVerified === true,
      bvnVerified: r.bvnVerified === true,
      ninVerified: r.ninVerified === true,
      sanctionsCleared: r.sanctionsCleared === true,
    };
  } catch (err) {
    logger.error("[KYC-GATE] KYC lookup query failed — treating customer as NOT cleared", { customerId, error: String(err) });
    return SEED_DATA_FALLBACK ? kycStore.get(customerId) ?? null : null;
  }
}

/** Latest KYB verification record for a company — same fail-closed semantics as lookupKyc. */
async function lookupKyb(companyId: string): Promise<KYBVerificationRecord | null> {
  const db = await getDb();
  if (!db) {
    logger.error("[KYC-GATE] Database unavailable during KYB lookup — treating company as NOT cleared", { companyId });
    return SEED_DATA_FALLBACK ? kybStore.get(companyId) ?? null : null;
  }
  try {
    const rows = await db
      .select()
      .from(kybEnforcementVerifications)
      .where(eq(kybEnforcementVerifications.companyId, companyId))
      .orderBy(desc(kybEnforcementVerifications.createdAt))
      .limit(1);
    const r = rows[0];
    if (!r) return SEED_DATA_FALLBACK ? kybStore.get(companyId) ?? null : null;
    return {
      companyId: r.companyId,
      rcNumber: r.rcNumber ?? "",
      level: r.level as KYBVerificationRecord["level"],
      status: r.status as KYBVerificationRecord["status"],
      verifiedAt: iso(r.verifiedAt),
      expiresAt: iso(r.expiresAt),
      cacVerified: r.cacVerified === true,
      tinVerified: r.tinVerified === true,
      uboVerified: r.uboVerified === true,
      directorScreened: r.directorScreened === true,
      sanctionsCleared: r.sanctionsCleared === true,
    };
  } catch (err) {
    logger.error("[KYC-GATE] KYB lookup query failed — treating company as NOT cleared", { companyId, error: String(err) });
    return SEED_DATA_FALLBACK ? kybStore.get(companyId) ?? null : null;
  }
}

/** Persist a KYC record to the database; falls back to the demo seed store only behind the flag. */
async function saveKycRecord(record: VerificationRecord): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    if (SEED_DATA_FALLBACK) { kycStore.set(record.customerId, record); return true; }
    return false;
  }
  try {
    await db.insert(kycEnforcementVerifications).values({
      verificationId: `KYC-ENF-${record.customerId}-${Date.now()}`,
      customerId: record.customerId,
      tenantId: "default",
      level: record.level,
      status: record.status,
      bvnVerified: record.bvnVerified,
      ninVerified: record.ninVerified,
      livenessVerified: record.livenessVerified,
      documentsVerified: record.documentsVerified,
      sanctionsCleared: record.sanctionsCleared,
      verifiedAt: record.verifiedAt ? new Date(record.verifiedAt) : null,
      expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
      verifiedBy: "kyc-enforcement-admin-api",
    });
    return true;
  } catch (err) {
    logger.error("[KYC-GATE] Failed to persist KYC record", { customerId: record.customerId, error: String(err) });
    if (SEED_DATA_FALLBACK) { kycStore.set(record.customerId, record); return true; }
    return false;
  }
}

/** Persist a KYB record to the database; falls back to the demo seed store only behind the flag. */
async function saveKybRecord(record: KYBVerificationRecord): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    if (SEED_DATA_FALLBACK) { kybStore.set(record.companyId, record); return true; }
    return false;
  }
  try {
    await db.insert(kybEnforcementVerifications).values({
      verificationId: `KYB-ENF-${record.companyId}-${Date.now()}`,
      companyId: record.companyId,
      rcNumber: record.rcNumber,
      tenantId: "default",
      level: record.level,
      status: record.status,
      cacVerified: record.cacVerified,
      tinVerified: record.tinVerified,
      uboVerified: record.uboVerified,
      directorScreened: record.directorScreened,
      sanctionsCleared: record.sanctionsCleared,
      verifiedAt: record.verifiedAt ? new Date(record.verifiedAt) : null,
      expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
      verifiedBy: "kyc-enforcement-admin-api",
    });
    return true;
  } catch (err) {
    logger.error("[KYC-GATE] Failed to persist KYB record", { companyId: record.companyId, error: String(err) });
    if (SEED_DATA_FALLBACK) { kybStore.set(record.companyId, record); return true; }
    return false;
  }
}

/** A record only clears the gate when it is verified, unexpired, AND sanctions-cleared. */
function isCleared(rec: VerificationRecord | KYBVerificationRecord | null | undefined): rec is VerificationRecord {
  if (!rec) return false;
  if (rec.status !== "verified") return false;
  if (rec.sanctionsCleared !== true) return false;
  if (rec.expiresAt && new Date(rec.expiresAt) < new Date()) return false;
  return true;
}

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
  // Errors are caught inside — a lookup failure always resolves to a blocked
  // (fail-closed) response rather than an unhandled rejection.
  kycEnforcementHandler(req, res, next).catch(err => {
    logger.error("[KYC-GATE] Enforcement middleware error — blocking request (fail closed)", {
      path: req.path, method: req.method, error: String(err),
    });
    if (!res.headersSent) {
      res.status(503).json({
        error: "KYC verification status unavailable",
        code: "KYC_STATUS_UNKNOWN",
        message: "KYC/KYB verification status could not be determined — request blocked (fail closed)",
      });
    }
  });
}

async function kycEnforcementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      res.status(400).json({
        error: "KYC verification required",
        code: "KYC_CUSTOMER_ID_REQUIRED",
        message: "customerId is required for this operation — KYC verification must be completed",
        service: matchedRule.serviceId,
        requiredLevel: matchedRule.minimumLevel,
        kycInitiateUrl: "/api/platform/kyc-triggers/initiate",
      });
      return;
    }
    return next();
  }

  // KYC check — real verification status from the database, fail closed.
  let kyc: VerificationRecord | null = null;
  if (matchedRule.kycRequired && customerId) {
    kyc = await lookupKyc(customerId);

    if (!isCleared(kyc)) {
      const reason = !kyc
        ? "No KYC record found (or verification store unavailable)"
        : kyc.status !== "verified"
          ? `KYC status: ${kyc.status}`
          : kyc.sanctionsCleared !== true
            ? "Sanctions screening not cleared"
            : `KYC expired at ${kyc.expiresAt}`;
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason,
        kycLevel: kyc?.level, requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        res.status(403).json({
          error: "KYC verification required",
          code: !kyc ? "KYC_STATUS_UNKNOWN" : "KYC_NOT_VERIFIED",
          message: `KYC verification is required before accessing ${matchedRule.serviceId}`,
          customerId,
          currentStatus: kyc?.status || "not_found",
          sanctionsCleared: kyc ? kyc.sanctionsCleared === true : null,
          requiredLevel: matchedRule.minimumLevel,
          kycInitiateUrl: "/api/platform/kyc-triggers/initiate",
          kafkaEvent: { topic: "kyc.gate.blocked", payload: { serviceId: matchedRule.serviceId, customerId, path: req.path } },
        });
        return;
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
        res.status(403).json({
          error: "KYC level insufficient",
          code: "KYC_LEVEL_INSUFFICIENT",
          message: `This operation requires ${matchedRule.minimumLevel} KYC — customer has ${kyc.level}`,
          customerId,
          currentLevel: kyc.level,
          requiredLevel: matchedRule.minimumLevel,
          upgradeUrl: `/api/platform/kyc-triggers/initiate`,
        });
        return;
      }
      return next();
    }
  }

  // KYB check (corporate services) — real verification status, fail closed.
  let kyb: KYBVerificationRecord | null = null;
  if (matchedRule.kybRequired && companyId) {
    kyb = await lookupKyb(companyId);

    if (!isCleared(kyb)) {
      const reason = !kyb
        ? "No KYB record found (or verification store unavailable)"
        : kyb.status !== "verified"
          ? `KYB status: ${kyb.status}`
          : kyb.sanctionsCleared !== true
            ? "Sanctions screening not cleared"
            : `KYB expired at ${kyb.expiresAt}`;
      logEnforcement({
        serviceId: matchedRule.serviceId, path: req.path, method: req.method,
        customerId, companyId, decision: enforcementMode === "enforcing" ? "blocked" : "monitored",
        reason,
        requiredLevel: matchedRule.minimumLevel,
      });
      if (enforcementMode === "enforcing") {
        res.status(403).json({
          error: "KYB verification required",
          code: !kyb ? "KYB_STATUS_UNKNOWN" : "KYB_NOT_VERIFIED",
          message: `Corporate identity verification is required before accessing ${matchedRule.serviceId}`,
          companyId,
          currentStatus: kyb?.status || "not_found",
          sanctionsCleared: kyb ? kyb.sanctionsCleared === true : null,
          requiredLevel: matchedRule.minimumLevel,
          kybInitiateUrl: "/api/platform/kyb-triggers/initiate",
        });
        return;
      }
      return next();
    }
  }

  // All checks passed
  logEnforcement({
    serviceId: matchedRule.serviceId, path: req.path, method: req.method,
    customerId, companyId, decision: "allowed",
    reason: "KYC/KYB verification passed",
    kycLevel: kyc?.level,
    requiredLevel: matchedRule.minimumLevel,
  });

  // Attach verification info to request for downstream services
  (req as any).kycVerification = kyc ?? undefined;
  (req as any).kybVerification = kyb ?? undefined;

  next();
}

// ── Admin API for Enforcement ───────────────────────────────────────────────

export function registerKYCEnforcementRoutes(app: import("express").Express) {

  // Enforcement status & mode
  app.get("/api/platform/kyc-enforcement/status", async (_req: Request, res: Response) => {
    const blocked = enforcementLog.filter(e => e.decision === "blocked").length;
    const allowed = enforcementLog.filter(e => e.decision === "allowed").length;
    const monitored = enforcementLog.filter(e => e.decision === "monitored").length;

    // Real record counts from the database when available
    let kycRecords: number | null = null;
    let kybRecords: number | null = null;
    const db = await getDb();
    if (db) {
      try {
        kycRecords = (await db.select().from(kycEnforcementVerifications)).length;
        kybRecords = (await db.select().from(kybEnforcementVerifications)).length;
      } catch (err) {
        logger.error("[KYC-GATE] Failed to count verification records", { error: String(err) });
      }
    } else if (SEED_DATA_FALLBACK) {
      kycRecords = kycStore.size;
      kybRecords = kybStore.size;
    }

    res.json({
      mode: enforcementMode,
      gateRules: GATE_RULES.length,
      kycRecords,
      kybRecords,
      verificationStoreAvailable: kycRecords !== null,
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
  app.get("/api/platform/kyc-enforcement/records", async (_req: Request, res: Response) => {
    const db = await getDb();
    if (!db) {
      if (SEED_DATA_FALLBACK) {
        res.json({
          kyc: Array.from(kycStore.values()),
          kyb: Array.from(kybStore.values()),
          seedData: true,
          note: "Demo seed data (SEED_DATA_FALLBACK=true, non-production)",
        });
        return;
      }
      res.status(503).json({ error: "verification_store_unavailable" });
      return;
    }
    try {
      const kycRows = await db.select().from(kycEnforcementVerifications).orderBy(desc(kycEnforcementVerifications.createdAt)).limit(500);
      const kybRows = await db.select().from(kybEnforcementVerifications).orderBy(desc(kybEnforcementVerifications.createdAt)).limit(500);
      res.json({
        kyc: kycRows.map(r => ({
          customerId: r.customerId, level: r.level, status: r.status,
          verifiedAt: iso(r.verifiedAt), expiresAt: iso(r.expiresAt),
          livenessVerified: r.livenessVerified === true, documentsVerified: r.documentsVerified === true,
          bvnVerified: r.bvnVerified === true, ninVerified: r.ninVerified === true,
          sanctionsCleared: r.sanctionsCleared === true,
        })),
        kyb: kybRows.map(r => ({
          companyId: r.companyId, rcNumber: r.rcNumber, level: r.level, status: r.status,
          verifiedAt: iso(r.verifiedAt), expiresAt: iso(r.expiresAt),
          cacVerified: r.cacVerified === true, tinVerified: r.tinVerified === true,
          uboVerified: r.uboVerified === true, directorScreened: r.directorScreened === true,
          sanctionsCleared: r.sanctionsCleared === true,
        })),
        source: "database",
      });
    } catch (err) {
      logger.error("[KYC-GATE] Failed to read verification records", { error: String(err) });
      res.status(503).json({ error: "verification_store_unavailable" });
    }
  });

  app.post("/api/platform/kyc-enforcement/records/kyc", async (req: Request, res: Response) => {
    const { customerId, level, livenessVerified, documentsVerified, bvnVerified, ninVerified, sanctionsCleared } = req.body || {};
    if (!customerId || !level) return res.status(400).json({ error: "customerId and level required" });
    // Sub-verification facts are NEVER defaulted to true — only explicit inputs count.
    const flags = {
      livenessVerified: livenessVerified === true,
      documentsVerified: documentsVerified === true,
      bvnVerified: bvnVerified === true,
      ninVerified: ninVerified === true,
      sanctionsCleared: sanctionsCleared === true,
    };
    const fullyVerified = flags.livenessVerified && flags.documentsVerified && flags.bvnVerified && flags.sanctionsCleared;
    const nowTs = new Date().toISOString();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const record: VerificationRecord = {
      customerId, level,
      status: fullyVerified ? "verified" : "pending",
      verifiedAt: fullyVerified ? nowTs : "",
      expiresAt: fullyVerified ? expires : "",
      ...flags,
    };
    const saved = await saveKycRecord(record);
    if (!saved) {
      res.status(503).json({ error: "verification_store_unavailable", message: "KYC record could not be persisted" });
      return;
    }
    logger.info("[KYC-GATE] KYC record created/updated", { customerId, level, status: record.status });
    res.status(201).json({
      ...record,
      message: `KYC record created/updated for ${customerId} at level ${level} (status: ${record.status})`,
      kafkaEvent: { topic: "kyc.verification.completed", payload: { customerId, level } },
    });
  });

  app.post("/api/platform/kyc-enforcement/records/kyb", async (req: Request, res: Response) => {
    const { companyId, rcNumber, level, cacVerified, tinVerified, uboVerified, directorScreened, sanctionsCleared } = req.body || {};
    if (!companyId || !rcNumber || !level) return res.status(400).json({ error: "companyId, rcNumber, and level required" });
    // Sub-verification facts are NEVER defaulted to true — only explicit inputs count.
    const flags = {
      cacVerified: cacVerified === true,
      tinVerified: tinVerified === true,
      uboVerified: uboVerified === true,
      directorScreened: directorScreened === true,
      sanctionsCleared: sanctionsCleared === true,
    };
    const fullyVerified = flags.cacVerified && flags.tinVerified && flags.uboVerified && flags.directorScreened && flags.sanctionsCleared;
    const nowTs = new Date().toISOString();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const record: KYBVerificationRecord = {
      companyId, rcNumber, level,
      status: fullyVerified ? "verified" : "pending",
      verifiedAt: fullyVerified ? nowTs : "",
      expiresAt: fullyVerified ? expires : "",
      ...flags,
    };
    const saved = await saveKybRecord(record);
    if (!saved) {
      res.status(503).json({ error: "verification_store_unavailable", message: "KYB record could not be persisted" });
      return;
    }
    logger.info("[KYC-GATE] KYB record created/updated", { companyId, rcNumber, level, status: record.status });
    res.status(201).json({
      ...record,
      message: `KYB record created/updated for ${companyId} (${rcNumber}) at level ${level} (status: ${record.status})`,
      kafkaEvent: { topic: "kyb.verification.completed", payload: { companyId, rcNumber, level } },
    });
  });

  // Inline KYC check (for services to call programmatically)
  app.post("/api/platform/kyc-enforcement/check", async (req: Request, res: Response) => {
    const { customerId, companyId, serviceId, operation } = req.body || {};
    const rule = GATE_RULES.find(r => r.serviceId === serviceId);

    const kyc = customerId ? await lookupKyc(customerId) : undefined;
    const kyb = companyId ? await lookupKyb(companyId) : undefined;

    const kycOk = !rule?.kycRequired ||
      (isCleared(kyc) && (!rule || LEVEL_HIERARCHY[kyc.level] >= LEVEL_HIERARCHY[rule.minimumLevel]));
    const kybOk = !rule?.kybRequired || isCleared(kyb);
    const allowed = kycOk && kybOk;

    res.json({
      allowed,
      customerId, companyId, serviceId, operation,
      kycStatus: kyc
        ? { level: kyc.level, status: kyc.status, sanctionsCleared: kyc.sanctionsCleared === true, verified: isCleared(kyc) }
        : { status: "not_found", verified: false },
      kybStatus: kyb
        ? { level: kyb.level, status: kyb.status, sanctionsCleared: kyb.sanctionsCleared === true, verified: isCleared(kyb) }
        : companyId ? { status: "not_found", verified: false } : undefined,
      requiredLevel: rule?.minimumLevel,
      reason: allowed ? "All verifications passed" : !kycOk ? "KYC verification required, insufficient level, or sanctions not cleared" : "KYB verification required or sanctions not cleared",
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
