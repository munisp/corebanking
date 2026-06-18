/**
 * E3: Reporting engine for scheduled and on-demand reports.
 * Generates regulatory returns (CBN eFASS, NDIC, FIRS), management reports,
 * and custom reports with export to CSV/PDF.
 */

export interface ReportDefinition {
  id: string;
  name: string;
  category: "regulatory" | "management" | "operational" | "custom";
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "on_demand";
  description: string;
  lastGenerated?: string;
  nextDue?: string;
  status: "active" | "draft" | "disabled";
  parameters: Record<string, string>;
}

export interface GeneratedReport {
  id: string;
  definitionId: string;
  name: string;
  generatedAt: string;
  generatedBy: string;
  period: string;
  format: "csv" | "pdf" | "xlsx" | "json";
  rowCount: number;
  status: "completed" | "failed" | "generating";
  downloadUrl?: string;
  data?: Record<string, unknown>[];
}

const reportDefinitions: ReportDefinition[] = [
  // Regulatory
  { id: "RPT-001", name: "CBN eFASS Returns", category: "regulatory", frequency: "monthly", description: "Electronic Financial Analysis and Surveillance System returns", status: "active", lastGenerated: "2026-04-30T23:59:00Z", nextDue: "2026-05-31", parameters: { regulator: "CBN" } },
  { id: "RPT-002", name: "NDIC Premium Returns", category: "regulatory", frequency: "quarterly", description: "Nigeria Deposit Insurance Corporation premium computation", status: "active", lastGenerated: "2026-03-31T23:59:00Z", nextDue: "2026-06-30", parameters: { regulator: "NDIC", premiumRate: "0.35%" } },
  { id: "RPT-003", name: "FIRS VAT Returns", category: "regulatory", frequency: "monthly", description: "Federal Inland Revenue Service VAT on banking services", status: "active", lastGenerated: "2026-04-30T18:00:00Z", nextDue: "2026-05-21", parameters: { vatRate: "7.5%" } },
  { id: "RPT-004", name: "Currency Transaction Report (CTR)", category: "regulatory", frequency: "daily", description: "CBN mandated report for cash transactions ≥ ₦5,000,000", status: "active", lastGenerated: "2026-05-09T00:05:00Z", nextDue: "2026-05-10", parameters: { threshold: "5000000" } },
  { id: "RPT-005", name: "Basel III Capital Adequacy", category: "regulatory", frequency: "quarterly", description: "Capital adequacy ratio, leverage ratio, LCR, NSFR", status: "active", lastGenerated: "2026-03-31T23:59:00Z", nextDue: "2026-06-30", parameters: { minCAR: "10%" } },

  // Management
  { id: "RPT-006", name: "Branch Performance Report", category: "management", frequency: "monthly", description: "Transaction volumes, revenue, customer acquisition per branch", status: "active", lastGenerated: "2026-04-30T06:00:00Z", nextDue: "2026-05-31", parameters: {} },
  { id: "RPT-007", name: "Product Profitability Analysis", category: "management", frequency: "quarterly", description: "Revenue, cost, margin analysis by product line", status: "active", lastGenerated: "2026-03-31T06:00:00Z", nextDue: "2026-06-30", parameters: {} },
  { id: "RPT-008", name: "Customer Acquisition Cost", category: "management", frequency: "monthly", description: "Cost per acquisition by channel and segment", status: "active", lastGenerated: "2026-04-30T06:00:00Z", nextDue: "2026-05-31", parameters: {} },
  { id: "RPT-009", name: "Loan Portfolio Quality", category: "management", frequency: "weekly", description: "NPL ratio, provision coverage, concentration risk, PAR analysis", status: "active", lastGenerated: "2026-05-05T06:00:00Z", nextDue: "2026-05-12", parameters: {} },
  { id: "RPT-010", name: "Treasury Daily Position", category: "management", frequency: "daily", description: "FX positions, money market, liquidity ratios, funding gap", status: "active", lastGenerated: "2026-05-09T07:00:00Z", nextDue: "2026-05-10", parameters: {} },

  // Operational
  { id: "RPT-011", name: "Failed Transaction Report", category: "operational", frequency: "daily", description: "NIP/NEFT/RTGS failed transactions with root cause analysis", status: "active", lastGenerated: "2026-05-09T01:00:00Z", nextDue: "2026-05-10", parameters: {} },
  { id: "RPT-012", name: "ATM Availability Report", category: "operational", frequency: "daily", description: "Uptime, downtime, cash-out events per ATM", status: "active", lastGenerated: "2026-05-09T00:30:00Z", nextDue: "2026-05-10", parameters: {} },
  { id: "RPT-013", name: "Dispute Resolution SLA", category: "operational", frequency: "weekly", description: "Open disputes, SLA compliance, average resolution time", status: "active", lastGenerated: "2026-05-05T08:00:00Z", nextDue: "2026-05-12", parameters: {} },
];

const generatedReports: GeneratedReport[] = [
  {
    id: "GEN-001", definitionId: "RPT-001", name: "CBN eFASS Returns - April 2026",
    generatedAt: "2026-04-30T23:59:00Z", generatedBy: "batch-scheduler",
    period: "2026-04", format: "xlsx", rowCount: 147, status: "completed",
  },
  {
    id: "GEN-002", definitionId: "RPT-004", name: "CTR - May 9, 2026",
    generatedAt: "2026-05-09T00:05:00Z", generatedBy: "batch-scheduler",
    period: "2026-05-09", format: "csv", rowCount: 23, status: "completed",
  },
  {
    id: "GEN-003", definitionId: "RPT-009", name: "Loan Portfolio Quality - W19 2026",
    generatedAt: "2026-05-05T06:00:00Z", generatedBy: "batch-scheduler",
    period: "2026-W19", format: "json", rowCount: 1, status: "completed",
    data: [{
      totalLoans: 380_000_000_000, performingLoans: 342_000_000_000,
      nplAmount: 38_000_000_000, nplRatio: 10.0,
      provisionBalance: 8_000_000_000, provisionCoverageRatio: 21.05,
      par30: 15_000_000_000, par60: 12_000_000_000, par90: 11_000_000_000,
    }],
  },
];

export function getReportDefinitions() { return { items: reportDefinitions, total: reportDefinitions.length }; }
export function getGeneratedReports() { return { items: generatedReports, total: generatedReports.length }; }
export function getReportDefinition(id: string) { return reportDefinitions.find((r) => r.id === id); }
