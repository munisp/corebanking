/**
 * KPI Gateway — TypeScript API gateway for the KPI engine.
 * Aggregates Go/Rust/Python microservices, adds Redis caching, Kafka event publishing.
 * Endpoints: /api/kpi/:role, /api/kpi/all, /api/kpi/rollup, /api/kpi/hierarchy,
 *            /api/kpi/trends/:metric, /api/kpi/compensation/:role, /api/kpi/flowdown/:role,
 *            /api/kpi/alerts, /api/kpi/benchmark
 *
 * Data doctrine: KPI values are computed from Postgres (via ../db getDb()).
 * A metric with no computable source is returned with status "unavailable" and is
 * excluded from all score rollups. No regulatory ratio, filing rate, or trend series
 * is ever hardcoded. When the database is unreachable, endpoints fail fast with 503.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

// ─── ORG HIERARCHY ──────────────────────────────────────────────────────────

interface OrgNode {
  role: string;
  title: string;
  reportsTo: string | null;
  directReports: string[];
  weight: number;
}

const ORG_HIERARCHY: Record<string, OrgNode> = {
  ceo: { role: "ceo", title: "CEO / Managing Director", reportsTo: null, directReports: ["coo", "cro", "cto", "cso", "treasury", "credit", "customer_service"], weight: 1.0 },
  coo: { role: "coo", title: "Chief Operating Officer", reportsTo: "ceo", directReports: ["head_teller"], weight: 0.20 },
  cro: { role: "cro", title: "Chief Risk Officer", reportsTo: "ceo", directReports: ["compliance", "internal_audit"], weight: 0.20 },
  cto: { role: "cto", title: "Chief Technology Officer", reportsTo: "ceo", directReports: [], weight: 0.10 },
  cso: { role: "cso", title: "Chief Security Officer", reportsTo: "ceo", directReports: [], weight: 0.15 },
  treasury: { role: "treasury", title: "Treasury Manager", reportsTo: "ceo", directReports: [], weight: 0.10 },
  credit: { role: "credit", title: "Head of Credit / Lending", reportsTo: "ceo", directReports: [], weight: 0.15 },
  head_teller: { role: "head_teller", title: "Head Teller / Branch Manager", reportsTo: "coo", directReports: [], weight: 0.60 },
  compliance: { role: "compliance", title: "Compliance Officer / MLRO", reportsTo: "cro", directReports: [], weight: 0.55 },
  customer_service: { role: "customer_service", title: "Customer Service Manager", reportsTo: "ceo", directReports: [], weight: 0.10 },
  internal_audit: { role: "internal_audit", title: "Internal Auditor", reportsTo: "cro", directReports: [], weight: 0.45 },
};

// ─── KPI METRIC DEFINITIONS ─────────────────────────────────────────────────

type MetricStatus = "green" | "amber" | "red" | "unavailable";

interface KPIMetric {
  id: string;
  name: string;
  value: number | null;
  target: number;
  unit: string;
  weight: number;
  status: MetricStatus;
  cadence: "hourly" | "daily" | "monthly" | "quarterly";
  description: string;
}

interface RoleKPIResult {
  role: string;
  title: string;
  overallScore: number | null;
  overallStatus: MetricStatus;
  metrics: KPIMetric[];
  directReportScores: DirectReportScore[];
  rollUpScore: number | null;
  compositeScore: number | null;
  unavailableMetrics: number;
  lastUpdated: string;
  cadence: string;
}

interface DirectReportScore {
  role: string;
  title: string;
  score: number | null;
  status: MetricStatus;
  weight: number;
  weightedScore: number | null;
}

// ─── METRIC DEFINITIONS PER ROLE ────────────────────────────────────────────

const ROLE_METRICS: Record<string, Array<Omit<KPIMetric, "value" | "status">>> = {
  ceo: [
    { id: "ceo_aum", name: "Total Assets Under Management", target: 50000, unit: "₦M", weight: 0.15, cadence: "daily", description: "Total deposits + investments + loans" },
    { id: "ceo_revenue", name: "Daily Revenue", target: 100, unit: "₦M", weight: 0.15, cadence: "daily", description: "Fee + net interest income" },
    { id: "ceo_cir", name: "Cost-to-Income Ratio", target: 65, unit: "%", weight: 0.15, cadence: "daily", description: "Operating costs / operating income" },
    { id: "ceo_customer_growth", name: "Customer Growth Rate", target: 5, unit: "%/month", weight: 0.10, cadence: "daily", description: "New customers as % of base" },
    { id: "ceo_car", name: "Capital Adequacy Ratio", target: 15, unit: "%", weight: 0.15, cadence: "daily", description: "Total capital / risk-weighted assets" },
    { id: "ceo_roe", name: "Return on Equity", target: 15, unit: "%", weight: 0.10, cadence: "daily", description: "Net income / shareholders equity" },
    { id: "ceo_digital_adoption", name: "Digital Channel Adoption", target: 70, unit: "%", weight: 0.10, cadence: "daily", description: "Digital txns / total txns" },
    { id: "ceo_npl", name: "NPL Ratio", target: 5, unit: "%", weight: 0.10, cadence: "daily", description: "Non-performing / total loans" },
  ],
  coo: [
    { id: "coo_tps", name: "Transaction Throughput", target: 500, unit: "tps", weight: 0.20, cadence: "hourly", description: "Transactions per second" },
    { id: "coo_fail_rate", name: "Failed Transaction Rate", target: 0.5, unit: "%", weight: 0.20, cadence: "hourly", description: "Failed / total txns" },
    { id: "coo_settlement", name: "Settlement Rate", target: 100, unit: "%", weight: 0.25, cadence: "hourly", description: "Settled within T+0" },
    { id: "coo_uptime", name: "System Uptime", target: 99.95, unit: "%", weight: 0.15, cadence: "hourly", description: "Platform availability" },
    { id: "coo_queue", name: "Pending Queue", target: 1000, unit: "count", weight: 0.10, cadence: "hourly", description: "Pending transactions" },
    { id: "coo_latency", name: "Avg Latency", target: 2.0, unit: "seconds", weight: 0.10, cadence: "hourly", description: "Time to complete txn" },
  ],
  cro: [
    { id: "cro_aml_alerts", name: "Unresolved AML Alerts", target: 5, unit: "count", weight: 0.25, cadence: "hourly", description: "Pending high-risk alerts" },
    { id: "cro_response_time", name: "Fraud Response Time", target: 15, unit: "min", weight: 0.20, cadence: "hourly", description: "Time to acknowledge" },
    { id: "cro_sar_timeliness", name: "SAR Filing Timeliness", target: 100, unit: "%", weight: 0.20, cadence: "daily", description: "Filed within 72hrs" },
    { id: "cro_false_positive", name: "False Positive Rate", target: 30, unit: "%", weight: 0.15, cadence: "daily", description: "False positive resolutions" },
    { id: "cro_npl", name: "NPL Ratio", target: 5, unit: "%", weight: 0.20, cadence: "daily", description: "Non-performing loans %" },
  ],
  cto: [
    { id: "cto_api_p95", name: "API p95 Latency", target: 200, unit: "ms", weight: 0.20, cadence: "hourly", description: "95th percentile response" },
    { id: "cto_error_rate", name: "Error Rate (5xx)", target: 0.1, unit: "%", weight: 0.20, cadence: "hourly", description: "Server error percentage" },
    { id: "cto_pool_util", name: "DB Pool Utilization", target: 70, unit: "%", weight: 0.15, cadence: "hourly", description: "Connection pool usage" },
    { id: "cto_cache_hit", name: "Cache Hit Ratio", target: 99, unit: "%", weight: 0.15, cadence: "hourly", description: "Cache effectiveness" },
    { id: "cto_availability", name: "System Availability", target: 99.95, unit: "%", weight: 0.20, cadence: "daily", description: "Rolling availability" },
    { id: "cto_deploy_success", name: "Deploy Success Rate", target: 100, unit: "%", weight: 0.10, cadence: "daily", description: "Successful deploys" },
  ],
  cso: [
    { id: "cso_incidents", name: "Active Security Incidents", target: 0, unit: "count", weight: 0.25, cadence: "hourly", description: "Unresolved incidents" },
    { id: "cso_unauthorized", name: "Unauthorized Access Attempts", target: 10, unit: "count/hr", weight: 0.20, cadence: "hourly", description: "Failed auth indicating breach" },
    { id: "cso_vuln_critical", name: "Critical Vulnerabilities", target: 0, unit: "count", weight: 0.20, cadence: "daily", description: "Unpatched critical CVEs" },
    { id: "cso_mfa_adoption", name: "MFA Adoption Rate", target: 100, unit: "%", weight: 0.15, cadence: "daily", description: "Staff with MFA" },
    { id: "cso_patch_compliance", name: "Patch Compliance", target: 95, unit: "%", weight: 0.10, cadence: "daily", description: "Patched within SLA" },
    { id: "cso_pentest_score", name: "Pentest Score", target: 90, unit: "score", weight: 0.10, cadence: "daily", description: "Latest pentest result" },
  ],
  treasury: [
    { id: "trs_liquidity", name: "Liquidity Ratio", target: 30, unit: "%", weight: 0.25, cadence: "hourly", description: "Liquid assets / liabilities" },
    { id: "trs_crr", name: "Cash Reserve Ratio", target: 27.5, unit: "%", weight: 0.20, cadence: "hourly", description: "CBN cash reserves" },
    { id: "trs_fx_exposure", name: "FX Exposure", target: 10, unit: "%NOP", weight: 0.20, cadence: "hourly", description: "Net open position" },
    { id: "trs_nim", name: "Net Interest Margin", target: 4.0, unit: "%", weight: 0.15, cadence: "daily", description: "NII / earning assets" },
    { id: "trs_fx_pnl", name: "FX P&L", target: 0, unit: "₦M", weight: 0.10, cadence: "daily", description: "Daily trading profit" },
    { id: "trs_nostro_recon", name: "Nostro Reconciliation", target: 100, unit: "%", weight: 0.10, cadence: "daily", description: "Reconciled today" },
  ],
  credit: [
    { id: "crd_npl", name: "NPL Ratio", target: 5, unit: "%", weight: 0.35, cadence: "daily", description: "Non-performing / total" },
    { id: "crd_collection", name: "Collection Rate", target: 95, unit: "%", weight: 0.25, cadence: "daily", description: "Collected / due" },
    { id: "crd_turnaround", name: "Approval Turnaround", target: 4, unit: "hours", weight: 0.15, cadence: "hourly", description: "Application to approval" },
    { id: "crd_par30", name: "PAR > 30 days", target: 8, unit: "%", weight: 0.15, cadence: "daily", description: "Overdue > 30 days" },
    { id: "crd_growth", name: "Portfolio Growth", target: 5, unit: "%/month", weight: 0.10, cadence: "daily", description: "MoM growth" },
  ],
  head_teller: [
    { id: "htl_txn_per_hr", name: "Txn per Teller/Hour", target: 15, unit: "count", weight: 0.25, cadence: "hourly", description: "Teller productivity" },
    { id: "htl_cash_variance", name: "Cash Variance", target: 0, unit: "₦", weight: 0.30, cadence: "hourly", description: "Expected vs actual" },
    { id: "htl_wait_time", name: "Customer Wait Time", target: 5, unit: "min", weight: 0.20, cadence: "hourly", description: "Queue to service" },
    { id: "htl_reversal_rate", name: "Reversal Rate", target: 1, unit: "%", weight: 0.15, cadence: "daily", description: "Reversals / total" },
    { id: "htl_cross_sell", name: "Cross-Selling", target: 3, unit: "products", weight: 0.10, cadence: "daily", description: "Products per interaction" },
  ],
  compliance: [
    // AML/KYC Core (daily operational)
    { id: "cmp_kyc_pending", name: "KYC Pending", target: 50, unit: "count", weight: 0.04, cadence: "hourly", description: "Awaiting verification" },
    { id: "cmp_ctr_filing", name: "CTR Filing (₦5M+)", target: 100, unit: "%", weight: 0.05, cadence: "daily", description: "Filed within 24hrs" },
    { id: "cmp_sar_backlog", name: "SAR Backlog", target: 0, unit: "count", weight: 0.05, cadence: "daily", description: "Overdue SARs" },
    { id: "cmp_kyc_tier", name: "KYC Tier Compliance", target: 100, unit: "%", weight: 0.04, cadence: "daily", description: "Correct tier %" },
    { id: "cmp_expired_docs", name: "Expired Documents", target: 0, unit: "count", weight: 0.02, cadence: "hourly", description: "Active with expired ID" },
    // CBN Monthly Returns (26 returns — filing on-time %)
    { id: "cmp_efass_mbr", name: "eFASS Monthly Returns (MBR 100-900)", target: 100, unit: "%", weight: 0.06, cadence: "monthly", description: "Filed by 15th monthly" },
    { id: "cmp_prudential", name: "Prudential Returns (Form A/B)", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "GL-derived prudential data" },
    { id: "cmp_car", name: "Capital Adequacy Return (CAR)", target: 100, unit: "%", weight: 0.05, cadence: "monthly", description: "CAR ≥10% (CBN minimum)" },
    { id: "cmp_lqr", name: "Liquidity Ratio Return (LQR)", target: 100, unit: "%", weight: 0.05, cadence: "monthly", description: "LQR ≥30% (CBN minimum)" },
    { id: "cmp_crr", name: "Credit Risk Return (CRR-01)", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "NPL classification accuracy" },
    { id: "cmp_fce", name: "Foreign Currency Exposure (FCE-01)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "FX position limits" },
    { id: "cmp_ler", name: "Large Exposures Return (LER)", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "Single obligor ≤25% SHF" },
    { id: "cmp_ndic", name: "NDIC Premium Assessment", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "Deposit insurance premium" },
    { id: "cmp_sca", name: "Sectoral Credit Allocation (SCA)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "By ISIC sector code" },
    { id: "cmp_irr", name: "Interest Rate Return (IRR)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Rate sensitivity analysis" },
    { id: "cmp_clr", name: "Connected Lending Return (CLR)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Insider/related party loans" },
    { id: "cmp_sol", name: "Single Obligor Limit (SOL)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Max 25% shareholders funds" },
    { id: "cmp_mmr", name: "Maturity Mismatch Report (MMR)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Asset-liability gap analysis" },
    { id: "cmp_nfiu", name: "NFIU CTR/STR Filing Status", target: 100, unit: "%", weight: 0.04, cadence: "daily", description: "Filed to NFIU portal" },
    { id: "cmp_scuml", name: "SCUML Registration Update", target: 100, unit: "%", weight: 0.02, cadence: "monthly", description: "DNFI registration" },
    { id: "cmp_pep", name: "PEP Screening Return", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Politically exposed persons" },
    { id: "cmp_slr", name: "Staff Loan Return (SLR)", target: 100, unit: "%", weight: 0.02, cadence: "monthly", description: "Employee lending data" },
    { id: "cmp_amcon", name: "AMCON Contribution Return", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Asset mgt corporation levy" },
    { id: "cmp_nsfr", name: "Basel III NSFR/LCR", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "Net stable funding ratio" },
    { id: "cmp_ffr", name: "Fraud & Forgery Return (FFR)", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "Reported to CBN/NDIC" },
    { id: "cmp_ifrs9", name: "IFRS 9 ECL Report", target: 100, unit: "%", weight: 0.04, cadence: "monthly", description: "Stage 1/2/3 provisioning" },
    { id: "cmp_escheat", name: "Dormancy/Escheatment Return", target: 100, unit: "%", weight: 0.02, cadence: "quarterly", description: "Unclaimed balances to CBN" },
    { id: "cmp_atr", name: "Anti-Terrorism Return", target: 100, unit: "%", weight: 0.02, cadence: "monthly", description: "CFT screening results" },
    { id: "cmp_sanctions", name: "Sanctions Screening Report", target: 100, unit: "%", weight: 0.03, cadence: "monthly", description: "OFAC/UN/EU list screening" },
    { id: "cmp_filing_ontime", name: "Overall Filing On-Time Rate", target: 100, unit: "%", weight: 0.05, cadence: "monthly", description: "All 26 returns filed by deadline" },
  ],
  customer_service: [
    { id: "cs_open_complaints", name: "Open Complaints", target: 20, unit: "count", weight: 0.20, cadence: "hourly", description: "Unresolved" },
    { id: "cs_response_time", name: "Response Time", target: 30, unit: "min", weight: 0.20, cadence: "hourly", description: "First response" },
    { id: "cs_fcr", name: "First-Contact Resolution", target: 80, unit: "%", weight: 0.25, cadence: "daily", description: "Resolved first contact" },
    { id: "cs_sla", name: "SLA Compliance", target: 100, unit: "%", weight: 0.20, cadence: "daily", description: "Within 48hr SLA" },
    { id: "cs_churn", name: "Churn Rate", target: 0.5, unit: "%/month", weight: 0.15, cadence: "daily", description: "Monthly closures" },
  ],
  internal_audit: [
    { id: "aud_maker_checker", name: "Maker-Checker Violations", target: 0, unit: "count", weight: 0.30, cadence: "hourly", description: "Without dual approval" },
    { id: "aud_trail_completeness", name: "Audit Trail Coverage", target: 100, unit: "%", weight: 0.25, cadence: "daily", description: "Txns with full trail" },
    { id: "aud_exceptions", name: "Unreviewed Exceptions", target: 0, unit: "count", weight: 0.20, cadence: "daily", description: "Pending review" },
    { id: "aud_sod_violations", name: "SoD Violations", target: 0, unit: "count", weight: 0.15, cadence: "daily", description: "Same person init+approve" },
    { id: "aud_gl_discrepancy", name: "GL Discrepancies", target: 0, unit: "count", weight: 0.10, cadence: "daily", description: "Trial balance variance" },
  ],
};

// ─── DATABASE-BACKED METRIC VALUES ──────────────────────────────────────────
//
// Values are resolved in this order:
//   1. Code-level computation against schema-verified tables (COMPUTED_QUERIES).
//   2. The metric's own `sql_query` stored in the kpi_metrics catalogue table
//      (authored by the platform's own migrations — see drizzle/seed-kpi.sql).
// A metric with neither source, or whose query fails (missing table/column),
// is returned as null and surfaced as status "unavailable" — never substituted
// with a hardcoded number.

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("database_unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

// NPL ratio is computable from the loans table (status + IFRS9 staging columns
// exist in the deployed schema — see drizzle/0007_core_banking_tables.sql).
const NPL_RATIO_QUERY = `SELECT COUNT(*) FILTER (WHERE status IN ('overdue', 'default', 'non_performing') OR "classificationIFRS9" = 'stage3') * 100.0 / NULLIF(COUNT(*), 0) AS value FROM loans`;

const COMPUTED_QUERIES: Record<string, string> = {
  ceo_npl: NPL_RATIO_QUERY,
  cro_npl: NPL_RATIO_QUERY,
  crd_npl: NPL_RATIO_QUERY,
};

// Cache of the kpi_metrics catalogue (metric_key → sql_query), 60s TTL.
let catalogCache: { at: number; map: Map<string, string> } | null = null;
const CATALOG_TTL_MS = 60_000;

async function getCatalogQueries(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<Map<string, string>> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.map;
  }
  const map = new Map<string, string>();
  try {
    const result = await db.execute(sql`SELECT metric_key, sql_query FROM kpi_metrics WHERE sql_query IS NOT NULL`);
    for (const row of result.rows as Array<{ metric_key: string; sql_query: string }>) {
      if (row.metric_key && row.sql_query) map.set(row.metric_key, row.sql_query);
    }
    catalogCache = { at: Date.now(), map };
  } catch (error) {
    // Catalogue table absent — metrics without a code-level query become unavailable.
    logger.warn("[KPI] kpi_metrics catalogue not readable — catalogue-sourced metrics will be unavailable", { error: String(error) });
  }
  return map;
}

async function executeMetricQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, query: string): Promise<number | null> {
  try {
    const result = await db.execute(sql.raw(query));
    const row = (result.rows as Array<Record<string, unknown>>)[0];
    if (!row) return null;
    const first = Object.values(row)[0];
    const value = Number(first);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    logger.warn("[KPI] metric query failed — marking metric unavailable", { error: String(error) });
    return null;
  }
}

/**
 * Compute current values for the given metric ids from Postgres.
 * Throws DatabaseUnavailableError when there is no DB connection.
 * Individual metrics that cannot be computed resolve to null (unavailable).
 */
export async function computeKpiMetricValues(metricIds: string[]): Promise<Record<string, number | null>> {
  const db = await getDb();
  if (!db) {
    throw new DatabaseUnavailableError();
  }

  const catalog = await getCatalogQueries(db);
  const uniqueIds = Array.from(new Set(metricIds));
  const values: Record<string, number | null> = {};

  await Promise.all(uniqueIds.map(async (id) => {
    const query = COMPUTED_QUERIES[id] ?? catalog.get(id);
    values[id] = query ? await executeMetricQuery(db, query) : null;
  }));

  return values;
}

function allMetricIds(): string[] {
  return Object.values(ROLE_METRICS).flat().map(d => d.id);
}

// ─── COMPUTATION ────────────────────────────────────────────────────────────

// Lower is better for these metrics
const LOWER_IS_BETTER = new Set([
  "coo_fail_rate", "coo_queue", "coo_latency",
  "cro_aml_alerts", "cro_response_time", "cro_false_positive", "cro_npl",
  "cso_incidents", "cso_unauthorized", "cso_vuln_critical",
  "cto_api_p95", "cto_error_rate", "cto_pool_util",
  "trs_fx_exposure",
  "crd_npl", "crd_turnaround", "crd_par30",
  "htl_cash_variance", "htl_wait_time", "htl_reversal_rate",
  "cmp_kyc_pending", "cmp_sar_backlog", "cmp_expired_docs",
  "cs_open_complaints", "cs_response_time", "cs_churn",
  "aud_maker_checker", "aud_exceptions", "aud_sod_violations", "aud_gl_discrepancy",
  "ceo_cir", "ceo_npl",
]);

function computeStatus(value: number, target: number, metricId: string): "green" | "amber" | "red" {
  const lowerBetter = LOWER_IS_BETTER.has(metricId);
  let ratio: number;
  if (lowerBetter) {
    ratio = target === 0 ? (value === 0 ? 1.0 : 0.5) : target / value;
  } else {
    ratio = target === 0 ? 1.0 : value / target;
  }
  if (ratio >= 0.95) return "green";
  if (ratio >= 0.75) return "amber";
  return "red";
}

function computeMetrics(role: string, values: Record<string, number | null>): KPIMetric[] {
  const defs = ROLE_METRICS[role];
  if (!defs) return [];
  return defs.map(d => {
    const value = values[d.id] ?? null;
    return {
      ...d,
      value,
      status: value === null ? "unavailable" : computeStatus(value, d.target, d.id),
    };
  });
}

// Weighted score over metrics with real values only — unavailable metrics are
// excluded from the rollup rather than silently treated as compliant.
function computeWeightedScore(metrics: KPIMetric[]): number | null {
  let total = 0, weight = 0;
  for (const m of metrics) {
    if (m.status === "unavailable") continue;
    const score = m.status === "green" ? 100 : m.status === "amber" ? 60 : 20;
    total += score * m.weight;
    weight += m.weight;
  }
  return weight > 0 ? Math.round((total / weight) * 100) / 100 : null;
}

function computeOverallStatus(score: number | null): MetricStatus {
  if (score === null) return "unavailable";
  if (score >= 85) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function computeRollUp(role: string, values: Record<string, number | null>): { rollUpScore: number | null; directReportScores: DirectReportScore[] } {
  const node = ORG_HIERARCHY[role];
  if (!node || node.directReports.length === 0) return { rollUpScore: null, directReportScores: [] };

  const scores: DirectReportScore[] = [];
  let totalWeighted = 0, totalWeight = 0;

  for (const dr of node.directReports) {
    const drNode = ORG_HIERARCHY[dr];
    const metrics = computeMetrics(dr, values);
    const score = computeWeightedScore(metrics);
    const status = computeOverallStatus(score);
    const weightedScore = score === null ? null : score * drNode.weight;
    scores.push({
      role: dr,
      title: drNode.title,
      score,
      status,
      weight: drNode.weight,
      weightedScore: weightedScore === null ? null : Math.round(weightedScore * 100) / 100,
    });
    if (weightedScore !== null) {
      totalWeighted += weightedScore;
      totalWeight += drNode.weight;
    }
  }

  return { rollUpScore: totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : null, directReportScores: scores };
}

function computeRoleKPI(role: string, values: Record<string, number | null>): RoleKPIResult {
  const node = ORG_HIERARCHY[role];
  const metrics = computeMetrics(role, values);
  const ownScore = computeWeightedScore(metrics);
  const { rollUpScore, directReportScores } = computeRollUp(role, values);
  const compositeScore = directReportScores.length > 0
    ? (ownScore === null && rollUpScore === null
        ? null
        : Math.round(((ownScore ?? rollUpScore ?? 0) * 0.6 + (rollUpScore ?? ownScore ?? 0) * 0.4) * 100) / 100)
    : ownScore;

  return {
    role,
    title: node.title,
    overallScore: ownScore,
    overallStatus: computeOverallStatus(ownScore),
    metrics,
    directReportScores,
    rollUpScore,
    compositeScore,
    unavailableMetrics: metrics.filter(m => m.status === "unavailable").length,
    lastUpdated: new Date().toISOString(),
    cadence: metrics.some(m => m.cadence === "hourly") ? "hourly" : "daily",
  };
}

// ─── RBAC ENFORCEMENT ───────────────────────────────────────────────────────

function checkRBAC(requestorRole: string | undefined, targetRole: string): { allowed: boolean; reason?: string } {
  if (!requestorRole || requestorRole === "admin" || requestorRole === "ceo") return { allowed: true };
  if (requestorRole === targetRole) return { allowed: true };

  // Check if target is a direct report of requestor
  const node = ORG_HIERARCHY[requestorRole];
  if (node && node.directReports.includes(targetRole)) return { allowed: true };

  return { allowed: false, reason: "You can only view your own KPIs or your direct reports' KPIs" };
}

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────

function handleKpiError(res: Response, error: unknown): void {
  if (error instanceof DatabaseUnavailableError) {
    res.status(503).json({ error: "database_unavailable", message: "KPI values require a live Postgres connection — no cached or default regulatory figures are served" });
    return;
  }
  logger.error("[KPI] endpoint failed", { error: String(error) });
  res.status(500).json({ error: "kpi_computation_failed" });
}

// ─── REGISTER ENDPOINTS ─────────────────────────────────────────────────────

export function registerKPIGateway(app: Express): void {
  // KPI for specific role (RBAC enforced)
  app.get("/api/kpi/:role", async (req: Request, res: Response) => {
    const { role } = req.params;
    if (!ORG_HIERARCHY[role]) {
      return res.status(404).json({ error: "role not found", validRoles: Object.keys(ORG_HIERARCHY) });
    }

    const requestorRole = (req.headers["x-kpi-role"] as string) || (req.query.requestor as string) || (req as any).user?.role;
    const rbac = checkRBAC(requestorRole, role);
    if (!rbac.allowed) {
      return res.status(403).json({ error: "access_denied", message: rbac.reason });
    }

    try {
      const values = await computeKpiMetricValues(ROLE_METRICS[role].map(d => d.id));
      res.json(computeRoleKPI(role, values));
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // All KPIs (CEO only)
  app.get("/api/kpi/all", async (req: Request, res: Response) => {
    const requestorRole = (req.headers["x-kpi-role"] as string) || (req.query.requestor as string) || (req as any).user?.role;
    if (requestorRole && requestorRole !== "admin" && requestorRole !== "ceo") {
      return res.status(403).json({ error: "access_denied", message: "Only CEO/MD can view all KPIs" });
    }

    try {
      const values = await computeKpiMetricValues(allMetricIds());
      const results: Record<string, RoleKPIResult> = {};
      for (const role of Object.keys(ORG_HIERARCHY)) {
        results[role] = computeRoleKPI(role, values);
      }
      res.json({ roles: results, totalRoles: Object.keys(results).length, lastUpdated: new Date().toISOString() });
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // Hierarchical roll-up tree (flow-down view)
  app.get("/api/kpi/rollup", async (_req: Request, res: Response) => {
    interface TreeNode {
      role: string;
      title: string;
      ownScore: number | null;
      rollUpScore: number | null;
      compositeScore: number | null;
      status: string;
      children: TreeNode[];
    }

    try {
      const values = await computeKpiMetricValues(allMetricIds());

      function buildTree(role: string): TreeNode {
        const node = ORG_HIERARCHY[role];
        const metrics = computeMetrics(role, values);
        const ownScore = computeWeightedScore(metrics);
        const { rollUpScore } = computeRollUp(role, values);
        const compositeScore = node.directReports.length > 0
          ? (ownScore === null && rollUpScore === null
              ? null
              : Math.round(((ownScore ?? rollUpScore ?? 0) * 0.6 + (rollUpScore ?? ownScore ?? 0) * 0.4) * 100) / 100)
          : ownScore;
        return {
          role,
          title: node.title,
          ownScore,
          rollUpScore,
          compositeScore,
          status: computeOverallStatus(compositeScore),
          children: node.directReports.map(buildTree),
        };
      }

      res.json(buildTree("ceo"));
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // Org hierarchy
  app.get("/api/kpi/hierarchy", (_req: Request, res: Response) => {
    res.json({ hierarchy: ORG_HIERARCHY, totalRoles: Object.keys(ORG_HIERARCHY).length });
  });

  // Trends — real historical scores from the kpi_scores table only.
  // No series is ever synthesized; when there is no recorded history the
  // metric is reported as unavailable with an empty trend.
  app.get("/api/kpi/trends/:metric", async (req: Request, res: Response) => {
    const { metric } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    try {
      const db = await getDb();
      if (!db) throw new DatabaseUnavailableError();

      const result = await db.execute(
        sql`SELECT period_end, value, status FROM kpi_scores WHERE metric_key = ${metric} AND period_end >= NOW() - (${days} || ' days')::interval ORDER BY period_end ASC`
      );
      const rows = result.rows as Array<{ period_end: string | Date; value: number | string; status: string | null }>;

      if (rows.length === 0) {
        return res.json({
          metricId: metric,
          periodDays: days,
          status: "unavailable",
          trend: [],
          analysis: null,
          message: "No recorded history for this metric in kpi_scores — trend is not synthesized",
        });
      }

      const trend = rows.map(r => ({
        date: new Date(r.period_end).toISOString().split("T")[0],
        value: Number(r.value),
        status: r.status ?? "unknown",
      }));
      const vals = trend.map(t => t.value);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const direction = vals[vals.length - 1] > vals[0] ? "improving" : vals[vals.length - 1] < vals[0] ? "declining" : "flat";

      res.json({ metricId: metric, periodDays: days, status: "ok", trend, analysis: { direction, average: Math.round(avg * 100) / 100, min: Math.min(...vals), max: Math.max(...vals) } });
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // Compensation calculation
  app.get("/api/kpi/compensation/:role", async (req: Request, res: Response) => {
    const { role } = req.params;
    if (!ORG_HIERARCHY[role]) {
      return res.status(404).json({ error: "role not found" });
    }

    const compensationModels: Record<string, { fixedRatio: number; variableRatio: number }> = {
      ceo: { fixedRatio: 0.60, variableRatio: 0.40 },
      coo: { fixedRatio: 0.70, variableRatio: 0.30 },
      cro: { fixedRatio: 0.75, variableRatio: 0.25 },
      cto: { fixedRatio: 0.70, variableRatio: 0.30 },
      cso: { fixedRatio: 0.75, variableRatio: 0.25 },
      treasury: { fixedRatio: 0.70, variableRatio: 0.30 },
      credit: { fixedRatio: 0.65, variableRatio: 0.35 },
      head_teller: { fixedRatio: 0.60, variableRatio: 0.40 },
      compliance: { fixedRatio: 0.75, variableRatio: 0.25 },
      customer_service: { fixedRatio: 0.65, variableRatio: 0.35 },
      internal_audit: { fixedRatio: 0.75, variableRatio: 0.25 },
    };

    try {
      const values = await computeKpiMetricValues(ROLE_METRICS[role].map(d => d.id));
      const kpi = computeRoleKPI(role, values);
      const model = compensationModels[role] || { fixedRatio: 0.70, variableRatio: 0.30 };
      const achievement = kpi.compositeScore;

      if (achievement === null) {
        return res.json({
          role,
          title: ORG_HIERARCHY[role].title,
          fixedRatio: model.fixedRatio,
          variableRatio: model.variableRatio,
          compositeScore: null,
          achievementPct: null,
          variableMultiplier: null,
          variablePayoutPct: null,
          performanceBand: "unavailable",
          message: "No computable KPI metrics for this role — compensation cannot be assessed",
          metricBreakdown: kpi.metrics.map(m => ({ id: m.id, name: m.name, weight: m.weight, value: m.value, target: m.target, status: m.status })),
        });
      }

      let multiplier: number;
      if (achievement < 60) multiplier = 0;
      else if (achievement <= 100) multiplier = (achievement - 60) / 40;
      else if (achievement <= 120) multiplier = 1.0 + (achievement - 100) / 40;
      else multiplier = 1.5;

      let band: string;
      if (achievement >= 110) band = "exceptional";
      else if (achievement >= 95) band = "exceeds_expectations";
      else if (achievement >= 80) band = "meets_expectations";
      else if (achievement >= 60) band = "needs_improvement";
      else band = "unsatisfactory";

      res.json({
        role,
        title: ORG_HIERARCHY[role].title,
        fixedRatio: model.fixedRatio,
        variableRatio: model.variableRatio,
        compositeScore: kpi.compositeScore,
        achievementPct: achievement,
        variableMultiplier: Math.round(multiplier * 1000) / 1000,
        variablePayoutPct: Math.round(multiplier * 100 * 10) / 10,
        performanceBand: band,
        metricBreakdown: kpi.metrics.map(m => ({ id: m.id, name: m.name, weight: m.weight, value: m.value, target: m.target, status: m.status })),
      });
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // Flow-down analysis for a specific role
  app.get("/api/kpi/flowdown/:role", async (req: Request, res: Response) => {
    const { role } = req.params;
    const node = ORG_HIERARCHY[role];
    if (!node) return res.status(404).json({ error: "role not found" });

    if (node.directReports.length === 0) {
      return res.json({ role, title: node.title, hasDirectReports: false, message: "No direct reports — KPI based on individual performance only" });
    }

    try {
      const values = await computeKpiMetricValues(allMetricIds());
      const kpi = computeRoleKPI(role, values);
      const scored = kpi.directReportScores.filter(dr => dr.score !== null);

      res.json({
        role,
        title: node.title,
        hasDirectReports: true,
        ownScore: kpi.overallScore,
        ownWeightInComposite: 0.60,
        rollUpScore: kpi.rollUpScore,
        rollUpWeightInComposite: 0.40,
        compositeScore: kpi.compositeScore,
        compositeStatus: computeOverallStatus(kpi.compositeScore),
        directReportsAnalysis: kpi.directReportScores.map(dr => ({
          ...dr,
          impactOnManager: dr.score === null ? "unavailable — excluded from composite" : `${Math.round(dr.weight * 40 * 10) / 10}% of composite score`,
        })),
        weakestLink: scored.length > 0 ? scored.reduce((a, b) => (a.score! < b.score! ? a : b)) : null,
        strongestPerformer: scored.length > 0 ? scored.reduce((a, b) => (a.score! > b.score! ? a : b)) : null,
      });
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // Industry benchmarks — the benchmark figures are static external reference
  // data (clearly labeled). ourValue is computed live; null when the metric
  // has no computable source.
  app.get("/api/kpi/benchmark", async (_req: Request, res: Response) => {
    try {
      const values = await computeKpiMetricValues(["ceo_npl", "ceo_car", "trs_liquidity", "ceo_cir", "ceo_roe", "ceo_digital_adoption"]);
      res.json({
        benchmarks: {
          npl_ratio: { industryAvg: 4.9, topQuartile: 2.5, cbnMax: 5.0, ourValue: values["ceo_npl"] },
          car: { industryAvg: 14.2, topQuartile: 18.0, cbnMin: 10.0, ourValue: values["ceo_car"] },
          liquidity_ratio: { industryAvg: 38.5, topQuartile: 45.0, cbnMin: 30.0, ourValue: values["trs_liquidity"] },
          cost_to_income: { industryAvg: 68.0, topQuartile: 55.0, target: 65.0, ourValue: values["ceo_cir"] },
          roe: { industryAvg: 12.5, topQuartile: 20.0, target: 15.0, ourValue: values["ceo_roe"] },
          digital_adoption: { industryAvg: 55.0, topQuartile: 80.0, target: 70.0, ourValue: values["ceo_digital_adoption"] },
        },
        source: "CBN Banking Sector Report 2025 + NDIC Annual Report (static external reference figures)",
        note: "ourValue is computed live from Postgres; null means the metric has no computable source and is not reported",
      });
    } catch (error) {
      handleKpiError(res, error);
    }
  });

  // KPI alerts summary — real-time threshold evaluation is performed by the
  // Rust threshold monitor; this gateway does not fabricate alert counts.
  app.get("/api/kpi/alerts", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) throw new DatabaseUnavailableError();

      let thresholdRules: number | null = null;
      try {
        const result = await db.execute(sql`SELECT COUNT(*)::int AS c FROM kpi_notification_rules WHERE enabled`);
        thresholdRules = Number((result.rows as Array<{ c: number }>)[0]?.c ?? NaN);
        if (!Number.isFinite(thresholdRules)) thresholdRules = null;
      } catch {
        thresholdRules = null;
      }

      res.json({
        totalActive: null,
        totalAcknowledged: null,
        totalResolved: null,
        thresholdRules,
        status: "unavailable",
        lastEvaluation: null,
        message: "Alert event counts are not stored in this gateway — connect to kpi-threshold-monitor-rs:8501 for real-time alerts. Counts are null rather than fabricated.",
      });
    } catch (error) {
      handleKpiError(res, error);
    }
  });
}
