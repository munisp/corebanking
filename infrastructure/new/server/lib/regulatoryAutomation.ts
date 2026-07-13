/**
 * D6: Regulatory Reporting Automation — scheduled report generation, CBN/NDIC formats.
 * Supports: CTR, NDIC Returns, AML/STR, CAR, Liquidity Reports, FIRS VAT, Basel III.
 */

export type ReportType = "ctr" | "ndic_returns" | "aml_str" | "car_report" | "liquidity_report" | "firs_vat" | "basel_iii";

export interface ReportSchedule {
  reportType: ReportType;
  name: string;
  regulator: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  submissionDeadline: string;
  templateVersion: string;
  autoGenerate: boolean;
  lastGenerated: string | null;
  nextDue: string;
}

export const REPORT_SCHEDULES: ReportSchedule[] = [
  { reportType: "ctr", name: "Currency Transaction Report", regulator: "CBN/NFIU", frequency: "daily", submissionDeadline: "T+1 business day", templateVersion: "NFIU-CTR-2025-v2", autoGenerate: true, lastGenerated: "2026-01-15", nextDue: "2026-01-16" },
  { reportType: "ndic_returns", name: "NDIC Quarterly Returns", regulator: "NDIC", frequency: "quarterly", submissionDeadline: "30 days after quarter end", templateVersion: "NDIC-QR-2025-v1", autoGenerate: true, lastGenerated: "2026-01-05", nextDue: "2026-04-30" },
  { reportType: "aml_str", name: "Suspicious Transaction Report", regulator: "NFIU", frequency: "daily", submissionDeadline: "Within 24 hours", templateVersion: "NFIU-STR-2025-v3", autoGenerate: true, lastGenerated: "2026-01-15", nextDue: "2026-01-16" },
  { reportType: "car_report", name: "Capital Adequacy Report", regulator: "CBN", frequency: "monthly", submissionDeadline: "15th of following month", templateVersion: "CBN-CAR-2025-v1", autoGenerate: true, lastGenerated: "2026-01-10", nextDue: "2026-02-15" },
  { reportType: "liquidity_report", name: "Liquidity Ratio Report", regulator: "CBN", frequency: "weekly", submissionDeadline: "Wednesday each week", templateVersion: "CBN-LR-2025-v1", autoGenerate: true, lastGenerated: "2026-01-13", nextDue: "2026-01-20" },
  { reportType: "firs_vat", name: "VAT Returns", regulator: "FIRS", frequency: "monthly", submissionDeadline: "21st of following month", templateVersion: "FIRS-VAT-2025-v2", autoGenerate: true, lastGenerated: "2026-01-15", nextDue: "2026-02-21" },
  { reportType: "basel_iii", name: "Basel III Compliance", regulator: "CBN", frequency: "quarterly", submissionDeadline: "45 days after quarter end", templateVersion: "CBN-BASIII-2025-v1", autoGenerate: true, lastGenerated: "2026-01-05", nextDue: "2026-05-15" },
];

export interface GeneratedReport {
  id: string;
  reportType: ReportType;
  period: string;
  status: "generated" | "reviewed" | "submitted" | "accepted" | "rejected";
  generatedAt: string;
  dataRows: number;
  fileFormat: string;
  submittedAt: string | null;
  submittedBy: string | null;
}

export function generateCTR(transactions: { amount: number; customerId: string; type: string }[]): {
  ctrThresholdNGN: number;
  flaggedCount: number;
  transactions: typeof transactions;
} {
  const CTR_THRESHOLD = 5_000_000; // ₦5M CBN threshold
  const flagged = transactions.filter((t) => t.amount >= CTR_THRESHOLD);
  return {
    ctrThresholdNGN: CTR_THRESHOLD,
    flaggedCount: flagged.length,
    transactions: flagged,
  };
}

export function computeCAR(
  tier1Capital: number,
  tier2Capital: number,
  riskWeightedAssets: number,
): { tier1Ratio: number; totalCAR: number; minimumRequired: number; compliant: boolean } {
  const tier1Ratio = riskWeightedAssets > 0 ? (tier1Capital / riskWeightedAssets) * 100 : 0;
  const totalCAR = riskWeightedAssets > 0 ? ((tier1Capital + tier2Capital) / riskWeightedAssets) * 100 : 0;
  const minimumRequired = 10.0; // CBN minimum for commercial banks
  return {
    tier1Ratio: Math.round(tier1Ratio * 100) / 100,
    totalCAR: Math.round(totalCAR * 100) / 100,
    minimumRequired,
    compliant: totalCAR >= minimumRequired,
  };
}
