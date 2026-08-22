/**
 * 54Bank GL → CoA → eFASS Report Pipeline Gateway
 *
 * GL balances are sourced from the REAL GL engine service (GL_ENGINE_URL,
 * default http://localhost:8251 per server/index.ts) with a Postgres fallback
 * via ../db. No hardcoded GL balances exist in this module.
 *
 * CBN returns are only ever reported as `submitted` when a real submission
 * succeeded; this module does not submit returns, so all return definitions
 * are reported as `draft`. Period-close is delegated to the GL engine.
 *
 * Any route that cannot reach a real data source fails fast with 503.
 */

import { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

const GL_ENGINE_URL = process.env.GL_ENGINE_URL || "http://localhost:8251";
const GL_TIMEOUT_MS = Number.parseInt(process.env.GL_ENGINE_TIMEOUT_MS || "5000", 10);
const HEALTH_PROBE_TIMEOUT_MS = 2000;

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface GLAccount {
  glAccountCode: string;
  tenantId: string;
  name: string;
  category: "asset" | "liability" | "equity" | "income" | "expense";
  subcategory: string;
  parentCode: string | null;
  currency: string;
  balance: number;
  status: string;
  isControlAccount: number;
}

interface EFASSFormLine {
  mbrForm: string;
  mbrLine: number;
  lineName: string;
  reportCategory: string;
  amount: number;
  cbnCode: string;
  glCodesUsed: string;
}

interface CBNReturn {
  code: string;
  name: string;
  regulator: string;
  frequency: string;
  dueDay: number;
  glSource: string;
  computation: string;
  status: string;
  lastFiled: string | null;
  nextDue: string | null;
}

// ─── REAL GL ACCOUNT SOURCE ─────────────────────────────────────────────────

function normalizeGLAccount(raw: Record<string, unknown>): GLAccount {
  return {
    glAccountCode: String(raw.glAccountCode ?? raw.gl_account_code ?? ""),
    tenantId: String(raw.tenantId ?? raw.tenant_id ?? ""),
    name: String(raw.name ?? ""),
    category: String(raw.category ?? "asset") as GLAccount["category"],
    subcategory: String(raw.subcategory ?? ""),
    parentCode: raw.parentCode !== undefined || raw.parent_code !== undefined
      ? ((raw.parentCode ?? raw.parent_code) as string | null)
      : null,
    currency: String(raw.currency ?? "NGN"),
    balance: Number(raw.balance ?? 0),
    status: String(raw.status ?? "active"),
    isControlAccount: Number(raw.isControlAccount ?? raw.is_control_account ?? 0),
  };
}

/**
 * Loads GL accounts from the GL engine, falling back to Postgres.
 * Returns null when NO real source is available (callers must 503).
 */
async function loadGLAccounts(): Promise<{ accounts: GLAccount[]; source: string } | null> {
  try {
    const response = await fetch(`${GL_ENGINE_URL}/v1/gl/accounts`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(GL_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GL engine returned ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    return { accounts: items.map(normalizeGLAccount), source: "gl-engine" };
  } catch (engineError) {
    logger.warn("GL engine unavailable, trying Postgres fallback", { error: String(engineError) });
  }

  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.execute(sql`
      SELECT gl_account_code AS "glAccountCode", tenant_id AS "tenantId", name,
             category, subcategory, parent_code AS "parentCode", currency,
             balance::float8 AS balance, status, is_control_account AS "isControlAccount"
      FROM gl_accounts
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ?? []) as Array<Record<string, unknown>>;
    return { accounts: rows.map(normalizeGLAccount), source: "postgres" };
  } catch (dbError) {
    logger.error("GL account load failed from all sources", { error: String(dbError) });
    return null;
  }
}

function glSourceUnavailable(res: Response) {
  return res.status(503).json({
    error: "gl_source_unavailable",
    message: "Neither the GL engine nor Postgres could provide GL balances; refusing to serve fabricated data",
  });
}

// ─── eFASS MAPPING (static GL-code → MBR form-line configuration) ───────────

const EFASS_MAPPINGS: Array<{
  glCodeStart: string; glCodeEnd: string; mbrForm: string; mbrLine: number;
  lineName: string; reportCategory: string; signConvention: string; cbnCode: string;
}> = [
  { glCodeStart: "1001", glCodeEnd: "1007", mbrForm: "MBR100", mbrLine: 1, lineName: "Cash & Balances with CBN", reportCategory: "assets", signConvention: "normal", cbnCode: "BS-A-001" },
  { glCodeStart: "1101", glCodeEnd: "1108", mbrForm: "MBR100", mbrLine: 2, lineName: "Due from Banks (Placements)", reportCategory: "assets", signConvention: "normal", cbnCode: "BS-A-002" },
  { glCodeStart: "1201", glCodeEnd: "1211", mbrForm: "MBR100", mbrLine: 3, lineName: "Investment Securities", reportCategory: "assets", signConvention: "normal", cbnCode: "BS-A-003" },
  { glCodeStart: "1301", glCodeEnd: "1316", mbrForm: "MBR100", mbrLine: 4, lineName: "Loans & Advances (Gross)", reportCategory: "assets", signConvention: "normal", cbnCode: "BS-A-004" },
  { glCodeStart: "1351", glCodeEnd: "1358", mbrForm: "MBR100", mbrLine: 5, lineName: "Allowance for Loan Losses", reportCategory: "assets", signConvention: "negate", cbnCode: "BS-A-005" },
  { glCodeStart: "2101", glCodeEnd: "2115", mbrForm: "MBR200", mbrLine: 1, lineName: "Deposits from Customers", reportCategory: "liabilities", signConvention: "normal", cbnCode: "BS-L-001" },
  { glCodeStart: "2201", glCodeEnd: "2208", mbrForm: "MBR200", mbrLine: 2, lineName: "Due to Banks & Borrowings", reportCategory: "liabilities", signConvention: "normal", cbnCode: "BS-L-002" },
  { glCodeStart: "3001", glCodeEnd: "3002", mbrForm: "MBR300", mbrLine: 1, lineName: "Share Capital", reportCategory: "equity", signConvention: "normal", cbnCode: "BS-E-001" },
  { glCodeStart: "3003", glCodeEnd: "3003", mbrForm: "MBR300", mbrLine: 2, lineName: "Share Premium", reportCategory: "equity", signConvention: "normal", cbnCode: "BS-E-002" },
  { glCodeStart: "3004", glCodeEnd: "3011", mbrForm: "MBR300", mbrLine: 3, lineName: "Reserves", reportCategory: "equity", signConvention: "normal", cbnCode: "BS-E-003" },
  { glCodeStart: "4101", glCodeEnd: "4108", mbrForm: "MBR400", mbrLine: 1, lineName: "Interest & Similar Income", reportCategory: "income", signConvention: "normal", cbnCode: "PL-I-001" },
  { glCodeStart: "4201", glCodeEnd: "4210", mbrForm: "MBR400", mbrLine: 2, lineName: "Fees & Commission Income", reportCategory: "income", signConvention: "normal", cbnCode: "PL-I-002" },
  { glCodeStart: "4301", glCodeEnd: "4307", mbrForm: "MBR400", mbrLine: 3, lineName: "Other Operating Income", reportCategory: "income", signConvention: "normal", cbnCode: "PL-I-003" },
  { glCodeStart: "5101", glCodeEnd: "5106", mbrForm: "MBR500", mbrLine: 1, lineName: "Interest & Similar Expense", reportCategory: "expenses", signConvention: "normal", cbnCode: "PL-E-001" },
  { glCodeStart: "5201", glCodeEnd: "5205", mbrForm: "MBR500", mbrLine: 2, lineName: "Impairment Charges", reportCategory: "expenses", signConvention: "normal", cbnCode: "PL-E-002" },
  { glCodeStart: "5301", glCodeEnd: "5350", mbrForm: "MBR500", mbrLine: 3, lineName: "Operating Expenses", reportCategory: "expenses", signConvention: "normal", cbnCode: "PL-E-003" },
  { glCodeStart: "5401", glCodeEnd: "5405", mbrForm: "MBR500", mbrLine: 4, lineName: "Taxation", reportCategory: "expenses", signConvention: "normal", cbnCode: "PL-E-004" },
];

// ─── CBN RETURN DEFINITIONS (26) ────────────────────────────────────────────
// These are return DEFINITIONS (schedule + computation lineage). This module
// never submits to the regulator, so nothing here is ever "submitted":
// status is `draft` and filing dates are null until a real submission service
// records one.

const CBN_RETURNS: CBNReturn[] = [
  { code: "MBR-100", name: "eFASS Balance Sheet - Assets", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 1001-1605 → trialBalances", computation: "SUM(closingBalance) per efassMapping", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-200", name: "eFASS Balance Sheet - Liabilities", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 2101-2318 → trialBalances", computation: "SUM(closingBalance) per efassMapping", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-300", name: "eFASS Shareholders Equity", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 3001-3013 → trialBalances", computation: "SUM(closingBalance) per efassMapping", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-400", name: "eFASS P&L - Revenue", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 4101-4307 → trialBalances", computation: "SUM(credits) for income accounts", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-500", name: "eFASS P&L - Expenses", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 5101-5405 → trialBalances", computation: "SUM(debits) for expense accounts", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-600", name: "Capital Adequacy Return (CAR)", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "Equity (3001-3012) + Tier2 (2206) / RWA", computation: "(Tier1 + Tier2) / RWA × 100", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-700", name: "Liquidity Ratio Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "Liquid (1001-1205) / Current Liab (2101-2201)", computation: "Liquid Assets / Current Liabilities × 100", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-800", name: "Sectoral Credit Allocation", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 1301-1316 by loan subcategory", computation: "Loans by ISIC sector codes", status: "draft", lastFiled: null, nextDue: null },
  { code: "MBR-900", name: "Maturity Mismatch Report", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 2103-2105 time deposits by tenor", computation: "Maturity buckets analysis", status: "draft", lastFiled: null, nextDue: null },
  { code: "PRGL-A", name: "Prudential Return Form A", regulator: "CBN", frequency: "monthly", dueDay: 10, glSource: "All asset GL accounts detailed", computation: "Detailed asset breakdown", status: "draft", lastFiled: null, nextDue: null },
  { code: "PRGL-B", name: "Prudential Return Form B", regulator: "CBN", frequency: "monthly", dueDay: 10, glSource: "All liability GL accounts detailed", computation: "Detailed liability breakdown", status: "draft", lastFiled: null, nextDue: null },
  { code: "NDIC-PA", name: "NDIC Premium Assessment", regulator: "NDIC", frequency: "monthly", dueDay: 20, glSource: "GL 2101-2115 (total deposits)", computation: "Insured deposits × 0.35% / 12", status: "draft", lastFiled: null, nextDue: null },
  { code: "LER", name: "Large Exposures Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 1301-1316 by obligor", computation: "Max exposure / shareholders funds", status: "draft", lastFiled: null, nextDue: null },
  { code: "CLR", name: "Connected Lending Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 1301-1316 insider loans", computation: "Insider exposure / capital (max 10%)", status: "draft", lastFiled: null, nextDue: null },
  { code: "SOL", name: "Single Obligor Limit", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "Largest single loan from GL 1301-1316", computation: "Single exposure / qualifying capital", status: "draft", lastFiled: null, nextDue: null },
  { code: "IRR", name: "Interest Rate Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "GL 4101-4108 / GL 5101-5106", computation: "Weighted avg lending/deposit rates", status: "draft", lastFiled: null, nextDue: null },
  { code: "FCE", name: "Foreign Currency Exposure", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "All GL where currency ≠ NGN", computation: "Net Open Position / capital (max 20%)", status: "draft", lastFiled: null, nextDue: null },
  { code: "SLR", name: "Staff Loan Return", regulator: "CBN", frequency: "monthly", dueDay: 20, glSource: "GL 1310 (Staff Loans)", computation: "Staff loan analysis", status: "draft", lastFiled: null, nextDue: null },
  { code: "AMCON", name: "AMCON Contribution Return", regulator: "AMCON", frequency: "monthly", dueDay: 15, glSource: "GL 5347 + GL 2309", computation: "Total assets × 0.5%", status: "draft", lastFiled: null, nextDue: null },
  { code: "FFR", name: "Fraud & Forgery Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "Fraud DB + GL 1407 (suspense)", computation: "Incidents, amounts, recoveries", status: "draft", lastFiled: null, nextDue: null },
  { code: "CTR", name: "Currency Transaction Report", regulator: "NFIU", frequency: "daily", dueDay: 1, glSource: "GL 1001-1004 transactions ≥ ₦5M", computation: "All large cash transactions", status: "draft", lastFiled: null, nextDue: null },
  { code: "STR", name: "Suspicious Transaction Report", regulator: "NFIU", frequency: "as_needed", dueDay: 3, glSource: "AML monitoring alerts", computation: "Suspicious patterns analysis", status: "draft", lastFiled: null, nextDue: null },
  { code: "PEP", name: "PEP Screening Return", regulator: "CBN", frequency: "monthly", dueDay: 15, glSource: "Customer PEP flags + GL exposure", computation: "PEP count and exposure", status: "draft", lastFiled: null, nextDue: null },
  { code: "SCUML", name: "SCUML Registration Update", regulator: "SCUML", frequency: "monthly", dueDay: 15, glSource: "DNFIs customer database", computation: "Registration status updates", status: "draft", lastFiled: null, nextDue: null },
  { code: "NSFR", name: "Basel III Net Stable Funding Ratio", regulator: "CBN", frequency: "monthly", dueDay: 20, glSource: "ASF (2103-2206) / RSF (1301-1316)", computation: "ASF / RSF × 100 (≥100%)", status: "draft", lastFiled: null, nextDue: null },
  { code: "LCR", name: "Basel III Liquidity Coverage Ratio", regulator: "CBN", frequency: "monthly", dueDay: 20, glSource: "HQLA (1001-1205) / Net Outflows", computation: "HQLA / Net Cash Outflows × 100 (≥100%)", status: "draft", lastFiled: null, nextDue: null },
];

// ─── COMPUTATION ENGINE (operates on real GL accounts passed in) ────────────

interface EFASSTotals {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  car: number | null;
  liquidityRatio: number;
}

function generateEFASSFromGL(accounts: GLAccount[], rwa: number | null): { forms: EFASSFormLine[]; totals: EFASSTotals } {
  const forms: EFASSFormLine[] = EFASS_MAPPINGS.map(mapping => {
    const matchingAccounts = accounts.filter(
      gl => gl.glAccountCode >= mapping.glCodeStart && gl.glAccountCode <= mapping.glCodeEnd
    );
    const amount = matchingAccounts.reduce((sum, gl) => {
      return sum + (mapping.signConvention === "negate" ? -gl.balance : gl.balance);
    }, 0);

    return {
      mbrForm: mapping.mbrForm,
      mbrLine: mapping.mbrLine,
      lineName: mapping.lineName,
      reportCategory: mapping.reportCategory,
      amount,
      cbnCode: mapping.cbnCode,
      glCodesUsed: `${mapping.glCodeStart}-${mapping.glCodeEnd}`,
    };
  });

  const totals: EFASSTotals = {
    totalAssets: forms.filter(f => f.reportCategory === "assets").reduce((s, f) => s + f.amount, 0),
    totalLiabilities: forms.filter(f => f.reportCategory === "liabilities").reduce((s, f) => s + f.amount, 0),
    totalEquity: forms.filter(f => f.reportCategory === "equity").reduce((s, f) => s + f.amount, 0),
    totalIncome: forms.filter(f => f.reportCategory === "income").reduce((s, f) => s + f.amount, 0),
    totalExpenses: forms.filter(f => f.reportCategory === "expenses").reduce((s, f) => s + f.amount, 0),
    netProfit: 0,
    car: null,
    liquidityRatio: 0,
  };
  totals.netProfit = totals.totalIncome - totals.totalExpenses;

  const tier1 = accounts.filter(g => ["3002", "3003", "3004", "3006"].includes(g.glAccountCode))
    .reduce((s, g) => s + g.balance, 0);
  const tier2 = Math.min(
    accounts.filter(g => g.glAccountCode === "2206").reduce((s, g) => s + g.balance, 0) +
    accounts.filter(g => g.glAccountCode === "3008").reduce((s, g) => s + g.balance, 0) * 0.5,
    tier1 * 0.5
  );
  // CAR is only computed from REAL risk-weighted assets. If RWA is not computable
  // from actual risk-weighted exposure data, car stays null → reported as
  // "unavailable". A fabricated ratio (e.g. a flat fraction of total assets)
  // must never be produced.
  totals.car = rwa !== null && rwa > 0 ? ((tier1 + tier2) / rwa) * 100 : null;

  const liquidAssets = accounts.filter(g => g.glAccountCode >= "1001" && g.glAccountCode <= "1007")
    .reduce((s, g) => s + g.balance, 0) +
    accounts.filter(g => g.glAccountCode >= "1201" && g.glAccountCode <= "1205")
    .reduce((s, g) => s + g.balance, 0);
  const currentLiab = accounts.filter(g => g.glAccountCode >= "2101" && g.glAccountCode <= "2103")
    .reduce((s, g) => s + g.balance, 0) +
    accounts.filter(g => g.glAccountCode === "2201").reduce((s, g) => s + g.balance, 0);
  totals.liquidityRatio = currentLiab > 0 ? (liquidAssets / currentLiab) * 100 : 0;

  return { forms, totals };
}

/**
 * Computes risk-weighted assets from real risk-weighted exposure records in
 * Postgres (`risk_weighted_exposures`: exposure_amount × risk_weight). Returns
 * null when no such data exists — callers must report CAR as "unavailable"
 * rather than fabricating a ratio.
 */
async function computeRiskWeightedAssets(): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(exposure_amount::float8 * risk_weight::float8), 0) AS rwa
      FROM risk_weighted_exposures
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ?? []) as Array<{ rwa?: number }>;
    const rwa = Number(rows[0]?.rwa ?? 0);
    return rwa > 0 ? rwa : null;
  } catch (error) {
    // Table missing or DB down — RWA is not computable from real data.
    logger.warn("Risk-weighted assets not computable from DB; CAR will be reported as unavailable", { error: String(error) });
    return null;
  }
}

// ─── REAL HEALTH PROBES ─────────────────────────────────────────────────────
type ProbeStatus = "connected" | "unavailable";

async function probeHttp(baseUrl: string): Promise<ProbeStatus> {
  try {
    const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS) });
    return response.ok ? "connected" : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function probePostgres(): Promise<ProbeStatus> {
  try {
    const db = await getDb();
    if (!db) return "unavailable";
    await db.execute(sql`SELECT 1`);
    return "connected";
  } catch {
    return "unavailable";
  }
}

// ─── REGISTER ROUTES ────────────────────────────────────────────────────────

export function registerGLPipelineRoutes(app: Express): void {
  // GL Chart of Accounts — real GL engine (fallback: Postgres); 503 if neither.
  app.get("/api/gl/accounts", async (req: Request, res: Response) => {
    const loaded = await loadGLAccounts();
    if (!loaded) return glSourceUnavailable(res);
    const category = req.query.category as string | undefined;
    const accounts = category ? loaded.accounts.filter(a => a.category === category) : loaded.accounts;
    res.json({ items: accounts, total: accounts.length, source: loaded.source });
  });

  // eFASS Report Generation — computed only from real GL balances.
  app.get("/api/gl/efass/generate", async (req: Request, res: Response) => {
    const loaded = await loadGLAccounts();
    if (!loaded) return glSourceUnavailable(res);
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    const rwa = await computeRiskWeightedAssets();
    const { forms, totals } = generateEFASSFromGL(loaded.accounts, rwa);
    res.json({
      reportId: `EFASS-54BANK-${period}`,
      period,
      generatedAt: new Date().toISOString(),
      status: "computed",
      source: loaded.source,
      forms,
      totals,
      cbnCompliance: {
        carCompliant: totals.car !== null ? totals.car >= 10.0 : null,
        liquidityCompliant: totals.liquidityRatio >= 30.0,
        carValue: totals.car !== null ? `${totals.car.toFixed(2)}%` : "unavailable",
        carStatus: totals.car !== null ? "computed" : "unavailable",
        liquidityValue: `${totals.liquidityRatio.toFixed(2)}%`,
      },
    });
  });

  // eFASS Mapping (static configuration)
  app.get("/api/gl/efass/mapping", (_req: Request, res: Response) => {
    res.json({ items: EFASS_MAPPINGS, total: EFASS_MAPPINGS.length });
  });

  // CBN Returns (all 26) — definitions only; nothing is marked submitted here.
  app.get("/api/gl/cbn-returns", (_req: Request, res: Response) => {
    res.json({
      items: CBN_RETURNS,
      total: CBN_RETURNS.length,
      note: "Return definitions are drafts; a return is only marked submitted by the regulatory submission service after a successful filing.",
      pipeline: {
        step1: "Journal entries posted via double-entry to glAccounts",
        step2: "Period-close aggregates JEs into trialBalances by GL code",
        step3: "efassMapping maps GL code ranges to MBR form lines",
        step4: "Report amounts computed from trial balance by mapping",
        step5: "eFASS XML/XLSX generated and submitted to CBN portal by the submission service",
      },
    });
  });

  // Period Close — executed by the real GL engine; never simulated locally.
  app.post("/api/gl/period-close", async (req: Request, res: Response) => {
    try {
      const response = await fetch(`${GL_ENGINE_URL}/v1/gl/period-close`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(req.body ?? {}),
        signal: AbortSignal.timeout(GL_TIMEOUT_MS * 3),
      });
      const body = await response.text();
      res.status(response.status).type("application/json").send(body);
    } catch (error) {
      logger.error("GL engine period-close failed", { error: String(error) });
      res.status(503).json({
        error: "gl_engine_unavailable",
        message: "GL engine is unavailable; period close was NOT executed and no trial-balance or return statuses were changed",
      });
    }
  });

  // Trial Balance — real GL engine, Postgres fallback, else 503.
  app.get("/api/gl/trial-balance", async (req: Request, res: Response) => {
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    try {
      const response = await fetch(`${GL_ENGINE_URL}/v1/gl/trial-balance?period=${encodeURIComponent(period)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(GL_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`GL engine returned ${response.status}`);
      const body = await response.text();
      res.status(200).type("application/json").send(body);
      return;
    } catch (engineError) {
      logger.warn("GL engine trial-balance unavailable, trying Postgres fallback", { error: String(engineError) });
    }

    try {
      const db = await getDb();
      if (!db) return glSourceUnavailable(res);
      const result = await db.execute(sql`
        SELECT trial_balance_id AS "trialBalanceId", tenant_id AS "tenantId",
               gl_account_code AS "glAccountCode", period_start AS "periodStart",
               period_end AS "periodEnd", opening_balance::float8 AS "openingBalance",
               total_debits::float8 AS "totalDebits", total_credits::float8 AS "totalCredits",
               closing_balance::float8 AS "closingBalance", currency, status
        FROM trial_balances
        WHERE period_start <= ${period + "-31"} AND period_end >= ${period + "-01"}
      `);
      const items = ((result as unknown as { rows?: unknown[] }).rows ?? []) as unknown[];
      res.json({ items, total: items.length, period, source: "postgres" });
    } catch (dbError) {
      logger.error("Trial balance load failed from all sources", { error: String(dbError) });
      glSourceUnavailable(res);
    }
  });

  // Middleware status — REAL probes only; no hardcoded "connected".
  app.get("/api/gl/middleware", async (_req: Request, res: Response) => {
    const [glEngine, postgres, tigerbeetle, kafka, redis] = await Promise.all([
      probeHttp(GL_ENGINE_URL),
      probePostgres(),
      probeHttp(process.env.TIGERBEETLE_ADAPTER_URL || "http://localhost:8205"),
      probeHttp(process.env.KAFKA_BROKER_URL || "http://localhost:8201"),
      probeHttp(process.env.REDIS_CACHE_URL || "http://localhost:8202"),
    ]);
    const systems: Record<string, { status: ProbeStatus; endpoint: string }> = {
      glEngine: { status: glEngine, endpoint: GL_ENGINE_URL },
      postgres: { status: postgres, endpoint: "database pool (DATABASE_URL)" },
      tigerbeetle: { status: tigerbeetle, endpoint: process.env.TIGERBEETLE_ADAPTER_URL || "http://localhost:8205" },
      kafka: { status: kafka, endpoint: process.env.KAFKA_BROKER_URL || "http://localhost:8201" },
      redis: { status: redis, endpoint: process.env.REDIS_CACHE_URL || "http://localhost:8202" },
    };
    const degraded = Object.values(systems).some(s => s.status === "unavailable");
    res.status(degraded ? 503 : 200).json({
      overall: degraded ? "degraded" : "operational",
      probedAt: new Date().toISOString(),
      probeTimeoutMs: HEALTH_PROBE_TIMEOUT_MS,
      systems,
    });
  });
}
