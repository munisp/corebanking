/**
 * C10: Compliance scoring engine — automated regulatory health assessment.
 * Tracks CBN, NDIC, FIRS, Basel III compliance with scoring matrix.
 */

export interface ComplianceCheck {
  id: string;
  category: "cbn" | "ndic" | "firs" | "basel" | "aml" | "pci" | "data_privacy";
  name: string;
  description: string;
  status: "compliant" | "non_compliant" | "warning" | "not_assessed";
  score: number;
  maxScore: number;
  lastAssessed: string;
  nextDue: string;
  evidence?: string;
  remediation?: string;
}

export interface RegulatoryCalendarItem {
  id: string;
  regulator: string;
  requirement: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  nextDue: string;
  status: "upcoming" | "overdue" | "submitted" | "accepted";
  responsible: string;
  automationLevel: "manual" | "semi_automated" | "fully_automated";
}

const complianceChecks: ComplianceCheck[] = [
  // CBN Requirements
  { id: "CC-001", category: "cbn", name: "Capital Adequacy Ratio", description: "Minimum 10% for national, 15% for international banks (CBN)", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "CAR = 21.03% (above 15% threshold)" },
  { id: "CC-002", category: "cbn", name: "Liquidity Ratio", description: "Minimum 30% of total deposit liabilities", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "LR = 42.5% (above 30% threshold)" },
  { id: "CC-003", category: "cbn", name: "Cash Reserve Requirement", description: "27.5% of deposits with CBN", status: "compliant", score: 8, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-16", evidence: "CRR = 27.8% (marginally above requirement)" },
  { id: "CC-004", category: "cbn", name: "Single Obligor Limit", description: "Max exposure 20% of shareholders funds (unsecured)", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-06-30", evidence: "Largest single exposure = 12.3%" },
  { id: "CC-005", category: "cbn", name: "eFASS Returns", description: "Monthly electronic financial analysis returns", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-01", nextDue: "2026-06-01", evidence: "May 2026 returns submitted on time" },

  // NDIC Requirements
  { id: "CC-006", category: "ndic", name: "Premium Payment", description: "Annual deposit insurance premium", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-01-15", nextDue: "2027-01-15", evidence: "2026 premium: ₦850M paid" },
  { id: "CC-007", category: "ndic", name: "Quarterly Returns", description: "NDIC quarterly examination returns", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-04-15", nextDue: "2026-07-15", evidence: "Q1 2026 returns accepted" },

  // FIRS Requirements
  { id: "CC-008", category: "firs", name: "VAT Remittance", description: "Monthly 7.5% VAT on banking fees", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-07", nextDue: "2026-06-21", evidence: "April 2026 VAT: ₦125M remitted" },
  { id: "CC-009", category: "firs", name: "WHT Deduction", description: "Withholding tax on interest and dividends", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-07", nextDue: "2026-06-21", evidence: "Q1 2026 WHT: ₦450M remitted" },

  // Basel III
  { id: "CC-010", category: "basel", name: "LCR (Liquidity Coverage)", description: "Minimum 100% for 30-day stress scenario", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "LCR = 145%" },
  { id: "CC-011", category: "basel", name: "NSFR (Net Stable Funding)", description: "Minimum 100% stable funding ratio", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "NSFR = 112%" },
  { id: "CC-012", category: "basel", name: "Leverage Ratio", description: "Minimum 3% Tier 1 capital to total exposure", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "Leverage ratio = 8.5%" },

  // AML/CFT
  { id: "CC-013", category: "aml", name: "KYC Completion", description: "All customers must have complete KYC", status: "warning", score: 7, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "97.2% completion (target: 99%)", remediation: "270 accounts pending KYC review — escalated to compliance team" },
  { id: "CC-014", category: "aml", name: "CTR Filing", description: "Currency transaction reports for >₦5M", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-12", evidence: "47 CTRs filed in last 7 days" },
  { id: "CC-015", category: "aml", name: "STR Filing", description: "Suspicious transaction reports within 72 hours", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-05-31", evidence: "All 8 STRs filed within required window" },

  // PCI-DSS
  { id: "CC-016", category: "pci", name: "Card Data Encryption", description: "PAN data encrypted at rest and in transit", status: "compliant", score: 10, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-08-09", evidence: "AES-256 encryption verified" },
  { id: "CC-017", category: "pci", name: "Access Control", description: "Role-based access to cardholder data", status: "warning", score: 8, maxScore: 10, lastAssessed: "2026-05-09", nextDue: "2026-06-09", evidence: "2 service accounts with excess privileges", remediation: "Scheduled for next sprint — restrict card_reader service account" },

  // Data Privacy
  { id: "CC-018", category: "data_privacy", name: "NDPR Compliance", description: "Nigeria Data Protection Regulation", status: "compliant", score: 9, maxScore: 10, lastAssessed: "2026-04-15", nextDue: "2026-07-15", evidence: "Annual DPIA submitted" },
];

const regulatoryCalendar: RegulatoryCalendarItem[] = [
  { id: "RC-001", regulator: "CBN", requirement: "eFASS Monthly Returns", frequency: "monthly", nextDue: "2026-06-01", status: "upcoming", responsible: "Finance Team", automationLevel: "semi_automated" },
  { id: "RC-002", regulator: "CBN", requirement: "CRR Compliance Check", frequency: "weekly", nextDue: "2026-05-16", status: "upcoming", responsible: "Treasury", automationLevel: "fully_automated" },
  { id: "RC-003", regulator: "NDIC", requirement: "Quarterly Returns", frequency: "quarterly", nextDue: "2026-07-15", status: "upcoming", responsible: "Compliance", automationLevel: "semi_automated" },
  { id: "RC-004", regulator: "FIRS", requirement: "Monthly VAT Return", frequency: "monthly", nextDue: "2026-06-21", status: "upcoming", responsible: "Tax Team", automationLevel: "fully_automated" },
  { id: "RC-005", regulator: "CBN", requirement: "Annual Audited Accounts", frequency: "annual", nextDue: "2027-03-31", status: "upcoming", responsible: "External Auditors", automationLevel: "manual" },
  { id: "RC-006", regulator: "NFIU", requirement: "CTR Daily Filing", frequency: "daily", nextDue: "2026-05-10", status: "upcoming", responsible: "AML Team", automationLevel: "fully_automated" },
  { id: "RC-007", regulator: "SEC", requirement: "Quarterly Financial Statement", frequency: "quarterly", nextDue: "2026-07-31", status: "upcoming", responsible: "Finance Team", automationLevel: "semi_automated" },
  { id: "RC-008", regulator: "NSE", requirement: "Price Sensitive Information", frequency: "quarterly", nextDue: "2026-07-15", status: "upcoming", responsible: "Company Secretary", automationLevel: "manual" },
];

export function getComplianceChecks() { return complianceChecks; }
export function getRegulatoryCalendar() { return regulatoryCalendar; }

export function getComplianceScore(): { overallScore: number; maxScore: number; percentage: number; byCategory: Record<string, { score: number; max: number; pct: number }> } {
  const byCategory: Record<string, { score: number; max: number; pct: number }> = {};
  let totalScore = 0;
  let totalMax = 0;

  for (const check of complianceChecks) {
    totalScore += check.score;
    totalMax += check.maxScore;
    if (!byCategory[check.category]) byCategory[check.category] = { score: 0, max: 0, pct: 0 };
    byCategory[check.category].score += check.score;
    byCategory[check.category].max += check.maxScore;
  }

  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].pct = Math.round((byCategory[cat].score / byCategory[cat].max) * 100);
  }

  return { overallScore: totalScore, maxScore: totalMax, percentage: Math.round((totalScore / totalMax) * 100), byCategory };
}
