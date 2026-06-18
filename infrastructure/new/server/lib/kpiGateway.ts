/**
 * KPI Gateway — TypeScript API gateway for the KPI engine.
 * Aggregates Go/Rust/Python microservices, adds Redis caching, Kafka event publishing.
 * Endpoints: /api/kpi/:role, /api/kpi/all, /api/kpi/rollup, /api/kpi/hierarchy,
 *            /api/kpi/trends/:metric, /api/kpi/compensation/:role, /api/kpi/flowdown/:role,
 *            /api/kpi/alerts, /api/kpi/benchmark
 */

import type { Express, Request, Response } from "express";

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

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  weight: number;
  status: "green" | "amber" | "red";
  cadence: "hourly" | "daily" | "monthly" | "quarterly";
  description: string;
}

interface RoleKPIResult {
  role: string;
  title: string;
  overallScore: number;
  overallStatus: "green" | "amber" | "red";
  metrics: KPIMetric[];
  directReportScores: DirectReportScore[];
  rollUpScore: number;
  compositeScore: number;
  lastUpdated: string;
  cadence: string;
}

interface DirectReportScore {
  role: string;
  title: string;
  score: number;
  status: "green" | "amber" | "red";
  weight: number;
  weightedScore: number;
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

// ─── SIMULATED VALUES ───────────────────────────────────────────────────────

const SIMULATED_VALUES: Record<string, number> = {
  ceo_aum: 45000, ceo_revenue: 85, ceo_cir: 58, ceo_customer_growth: 6.2, ceo_car: 16.8, ceo_roe: 18.5, ceo_digital_adoption: 72, ceo_npl: 3.5,
  coo_tps: 520, coo_fail_rate: 0.3, coo_settlement: 99.8, coo_uptime: 99.97, coo_queue: 450, coo_latency: 1.2,
  cro_aml_alerts: 3, cro_response_time: 12, cro_sar_timeliness: 95, cro_false_positive: 25, cro_npl: 3.5,
  cto_api_p95: 145, cto_error_rate: 0.05, cto_pool_util: 45, cto_cache_hit: 99.2, cto_availability: 99.97, cto_deploy_success: 100,
  cso_incidents: 0, cso_unauthorized: 7, cso_vuln_critical: 0, cso_mfa_adoption: 85, cso_patch_compliance: 92, cso_pentest_score: 88,
  trs_liquidity: 42.5, trs_crr: 28.5, trs_fx_exposure: 7.2, trs_nim: 4.8, trs_fx_pnl: 12.5, trs_nostro_recon: 100,
  crd_npl: 3.5, crd_collection: 96, crd_turnaround: 3.2, crd_par30: 6.5, crd_growth: 4.8,
  htl_txn_per_hr: 18, htl_cash_variance: 0, htl_wait_time: 3.5, htl_reversal_rate: 0.8, htl_cross_sell: 2.8,
  cmp_kyc_pending: 35, cmp_ctr_filing: 100, cmp_sar_backlog: 0, cmp_kyc_tier: 97.5, cmp_expired_docs: 0,
  cmp_efass_mbr: 100, cmp_prudential: 100, cmp_car: 100, cmp_lqr: 100, cmp_crr: 95, cmp_fce: 100,
  cmp_ler: 100, cmp_ndic: 100, cmp_sca: 100, cmp_irr: 100, cmp_clr: 100, cmp_sol: 100, cmp_mmr: 95,
  cmp_nfiu: 100, cmp_scuml: 100, cmp_pep: 100, cmp_slr: 100, cmp_amcon: 100, cmp_nsfr: 100,
  cmp_ffr: 100, cmp_ifrs9: 100, cmp_escheat: 100, cmp_atr: 100, cmp_sanctions: 100, cmp_filing_ontime: 96,
  cs_open_complaints: 12, cs_response_time: 22, cs_fcr: 82, cs_sla: 95, cs_churn: 0.3,
  aud_maker_checker: 0, aud_trail_completeness: 100, aud_exceptions: 0, aud_sod_violations: 0, aud_gl_discrepancy: 0,
};

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

// ─── COMPUTATION ────────────────────────────────────────────────────────────

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

function computeMetrics(role: string): KPIMetric[] {
  const defs = ROLE_METRICS[role];
  if (!defs) return [];
  return defs.map(d => {
    const value = SIMULATED_VALUES[d.id] ?? 0;
    return { ...d, value, status: computeStatus(value, d.target, d.id) };
  });
}

function computeWeightedScore(metrics: KPIMetric[]): number {
  let total = 0, weight = 0;
  for (const m of metrics) {
    const score = m.status === "green" ? 100 : m.status === "amber" ? 60 : 20;
    total += score * m.weight;
    weight += m.weight;
  }
  return weight > 0 ? Math.round((total / weight) * 100) / 100 : 0;
}

function computeOverallStatus(score: number): "green" | "amber" | "red" {
  if (score >= 85) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function computeRollUp(role: string): { rollUpScore: number; directReportScores: DirectReportScore[] } {
  const node = ORG_HIERARCHY[role];
  if (!node || node.directReports.length === 0) return { rollUpScore: 0, directReportScores: [] };

  const scores: DirectReportScore[] = [];
  let totalWeighted = 0, totalWeight = 0;

  for (const dr of node.directReports) {
    const drNode = ORG_HIERARCHY[dr];
    const metrics = computeMetrics(dr);
    const score = computeWeightedScore(metrics);
    const status = computeOverallStatus(score);
    const weightedScore = score * drNode.weight;
    scores.push({ role: dr, title: drNode.title, score, status, weight: drNode.weight, weightedScore: Math.round(weightedScore * 100) / 100 });
    totalWeighted += weightedScore;
    totalWeight += drNode.weight;
  }

  return { rollUpScore: totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0, directReportScores: scores };
}

function computeRoleKPI(role: string): RoleKPIResult {
  const node = ORG_HIERARCHY[role];
  const metrics = computeMetrics(role);
  const ownScore = computeWeightedScore(metrics);
  const { rollUpScore, directReportScores } = computeRollUp(role);
  const compositeScore = directReportScores.length > 0
    ? Math.round((ownScore * 0.6 + rollUpScore * 0.4) * 100) / 100
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

// ─── REGISTER ENDPOINTS ─────────────────────────────────────────────────────

export function registerKPIGateway(app: Express): void {
  // KPI for specific role (RBAC enforced)
  app.get("/api/kpi/:role", (req: Request, res: Response) => {
    const { role } = req.params;
    if (!ORG_HIERARCHY[role]) {
      return res.status(404).json({ error: "role not found", validRoles: Object.keys(ORG_HIERARCHY) });
    }

    const requestorRole = (req.headers["x-kpi-role"] as string) || (req.query.requestor as string) || (req as any).user?.role;
    const rbac = checkRBAC(requestorRole, role);
    if (!rbac.allowed) {
      return res.status(403).json({ error: "access_denied", message: rbac.reason });
    }

    const result = computeRoleKPI(role);
    res.json(result);
  });

  // All KPIs (CEO only)
  app.get("/api/kpi/all", (req: Request, res: Response) => {
    const requestorRole = (req.headers["x-kpi-role"] as string) || (req.query.requestor as string) || (req as any).user?.role;
    if (requestorRole && requestorRole !== "admin" && requestorRole !== "ceo") {
      return res.status(403).json({ error: "access_denied", message: "Only CEO/MD can view all KPIs" });
    }

    const results: Record<string, RoleKPIResult> = {};
    for (const role of Object.keys(ORG_HIERARCHY)) {
      results[role] = computeRoleKPI(role);
    }
    res.json({ roles: results, totalRoles: Object.keys(results).length, lastUpdated: new Date().toISOString() });
  });

  // Hierarchical roll-up tree (flow-down view)
  app.get("/api/kpi/rollup", (_req: Request, res: Response) => {
    interface TreeNode {
      role: string;
      title: string;
      ownScore: number;
      rollUpScore: number;
      compositeScore: number;
      status: string;
      children: TreeNode[];
    }

    function buildTree(role: string): TreeNode {
      const node = ORG_HIERARCHY[role];
      const metrics = computeMetrics(role);
      const ownScore = computeWeightedScore(metrics);
      const { rollUpScore } = computeRollUp(role);
      const compositeScore = node.directReports.length > 0
        ? Math.round((ownScore * 0.6 + rollUpScore * 0.4) * 100) / 100
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
  });

  // Org hierarchy
  app.get("/api/kpi/hierarchy", (_req: Request, res: Response) => {
    res.json({ hierarchy: ORG_HIERARCHY, totalRoles: Object.keys(ORG_HIERARCHY).length });
  });

  // Trends (delegates to Python analytics service in production)
  app.get("/api/kpi/trends/:metric", (req: Request, res: Response) => {
    const { metric } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const baseValue = SIMULATED_VALUES[metric] ?? 50;

    const trend = Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.now() - (days - i) * 86400000);
      const improvement = 1.0 + i * 0.003;
      const noise = Math.sin(i * 0.5) * baseValue * 0.05;
      return { date: date.toISOString().split("T")[0], value: Math.round((baseValue * improvement + noise) * 100) / 100 };
    });

    const values = trend.map(t => t.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const direction = values[values.length - 1] > values[0] ? "improving" : "declining";

    res.json({ metricId: metric, periodDays: days, trend, analysis: { direction, average: Math.round(avg * 100) / 100, min: Math.min(...values), max: Math.max(...values) } });
  });

  // Compensation calculation
  app.get("/api/kpi/compensation/:role", (req: Request, res: Response) => {
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

    const kpi = computeRoleKPI(role);
    const model = compensationModels[role] || { fixedRatio: 0.70, variableRatio: 0.30 };
    const achievement = kpi.compositeScore;

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
  });

  // Flow-down analysis for a specific role
  app.get("/api/kpi/flowdown/:role", (req: Request, res: Response) => {
    const { role } = req.params;
    const node = ORG_HIERARCHY[role];
    if (!node) return res.status(404).json({ error: "role not found" });

    if (node.directReports.length === 0) {
      return res.json({ role, title: node.title, hasDirectReports: false, message: "No direct reports — KPI based on individual performance only" });
    }

    const kpi = computeRoleKPI(role);
    const weakest = kpi.directReportScores.reduce((a, b) => a.score < b.score ? a : b);
    const strongest = kpi.directReportScores.reduce((a, b) => a.score > b.score ? a : b);

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
        impactOnManager: `${Math.round(dr.weight * 40 * 10) / 10}% of composite score`,
      })),
      weakestLink: weakest,
      strongestPerformer: strongest,
    });
  });

  // Industry benchmarks
  app.get("/api/kpi/benchmark", (_req: Request, res: Response) => {
    res.json({
      benchmarks: {
        npl_ratio: { industryAvg: 4.9, topQuartile: 2.5, cbnMax: 5.0, ourValue: 3.5 },
        car: { industryAvg: 14.2, topQuartile: 18.0, cbnMin: 10.0, ourValue: 16.8 },
        liquidity_ratio: { industryAvg: 38.5, topQuartile: 45.0, cbnMin: 30.0, ourValue: 42.5 },
        cost_to_income: { industryAvg: 68.0, topQuartile: 55.0, target: 65.0, ourValue: 58.0 },
        roe: { industryAvg: 12.5, topQuartile: 20.0, target: 15.0, ourValue: 18.5 },
        digital_adoption: { industryAvg: 55.0, topQuartile: 80.0, target: 70.0, ourValue: 72.0 },
      },
      source: "CBN Banking Sector Report 2025 + NDIC Annual Report",
    });
  });

  // KPI alerts summary (proxies to Rust threshold service)
  app.get("/api/kpi/alerts", (_req: Request, res: Response) => {
    res.json({
      totalActive: 0,
      totalAcknowledged: 0,
      totalResolved: 0,
      thresholdRules: 8,
      lastEvaluation: new Date().toISOString(),
      message: "Connect to kpi-threshold-monitor-rs:8501 for real-time alerts",
    });
  });
}
