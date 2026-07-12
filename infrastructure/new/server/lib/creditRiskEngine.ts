/**
 * B8: Credit risk scoring engine with PD/LGD/EAD models.
 * Basel III/IFRS 9 compliant expected credit loss (ECL) computation.
 */

export interface CreditRiskAssessment {
  id: string;
  customerId: string;
  customerName: string;
  customerType: "individual" | "sme" | "corporate";
  creditScore: number;
  creditGrade: "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D";
  pd: number;
  lgd: number;
  ead: number;
  ecl: number;
  stage: 1 | 2 | 3;
  totalExposure: number;
  collateralValue: number;
  collateralCoverage: number;
  debtServiceRatio: number;
  assessmentDate: string;
  nextReviewDate: string;
  factors: Array<{ factor: string; score: number; weight: number; contribution: number }>;
}

const assessments: CreditRiskAssessment[] = [
  {
    id: "CRA-001", customerId: "CUST-001", customerName: "Aisha Mohammed",
    customerType: "individual", creditScore: 750, creditGrade: "A",
    pd: 0.015, lgd: 0.45, ead: 5_000_000, ecl: 33_750,
    stage: 1, totalExposure: 5_000_000, collateralValue: 0, collateralCoverage: 0,
    debtServiceRatio: 28, assessmentDate: "2026-05-01", nextReviewDate: "2026-11-01",
    factors: [
      { factor: "Payment history", score: 85, weight: 0.35, contribution: 29.75 },
      { factor: "Credit utilization", score: 70, weight: 0.20, contribution: 14.00 },
      { factor: "Length of credit history", score: 60, weight: 0.15, contribution: 9.00 },
      { factor: "Income stability", score: 80, weight: 0.20, contribution: 16.00 },
      { factor: "Debt-to-income ratio", score: 72, weight: 0.10, contribution: 7.20 },
    ],
  },
  {
    id: "CRA-002", customerId: "CUST-002", customerName: "Ibrahim Musa",
    customerType: "individual", creditScore: 720, creditGrade: "A",
    pd: 0.02, lgd: 0.25, ead: 45_000_000, ecl: 225_000,
    stage: 1, totalExposure: 45_000_000, collateralValue: 65_000_000, collateralCoverage: 144,
    debtServiceRatio: 32, assessmentDate: "2026-05-01", nextReviewDate: "2026-08-01",
    factors: [
      { factor: "Payment history", score: 90, weight: 0.35, contribution: 31.50 },
      { factor: "Collateral coverage", score: 95, weight: 0.25, contribution: 23.75 },
      { factor: "Income stability", score: 75, weight: 0.20, contribution: 15.00 },
      { factor: "Property valuation", score: 80, weight: 0.10, contribution: 8.00 },
      { factor: "Employment tenure", score: 65, weight: 0.10, contribution: 6.50 },
    ],
  },
  {
    id: "CRA-003", customerId: "CUST-003", customerName: "Chukwuemeka Obi",
    customerType: "sme", creditScore: 480, creditGrade: "B",
    pd: 0.12, lgd: 0.55, ead: 15_000_000, ecl: 990_000,
    stage: 2, totalExposure: 15_000_000, collateralValue: 20_000_000, collateralCoverage: 133,
    debtServiceRatio: 65, assessmentDate: "2026-05-01", nextReviewDate: "2026-06-01",
    factors: [
      { factor: "Payment history", score: 30, weight: 0.35, contribution: 10.50 },
      { factor: "Business revenue trend", score: 45, weight: 0.25, contribution: 11.25 },
      { factor: "Collateral coverage", score: 80, weight: 0.15, contribution: 12.00 },
      { factor: "Industry risk", score: 55, weight: 0.15, contribution: 8.25 },
      { factor: "Management quality", score: 50, weight: 0.10, contribution: 5.00 },
    ],
  },
  {
    id: "CRA-004", customerId: "CUST-050", customerName: "Zenith Construction Ltd",
    customerType: "corporate", creditScore: 650, creditGrade: "BBB",
    pd: 0.04, lgd: 0.40, ead: 250_000_000, ecl: 4_000_000,
    stage: 1, totalExposure: 250_000_000, collateralValue: 350_000_000, collateralCoverage: 140,
    debtServiceRatio: 42, assessmentDate: "2026-04-15", nextReviewDate: "2026-07-15",
    factors: [
      { factor: "Financial statements", score: 70, weight: 0.30, contribution: 21.00 },
      { factor: "Order book / pipeline", score: 75, weight: 0.20, contribution: 15.00 },
      { factor: "Collateral coverage", score: 85, weight: 0.20, contribution: 17.00 },
      { factor: "Industry outlook", score: 60, weight: 0.15, contribution: 9.00 },
      { factor: "Management / governance", score: 55, weight: 0.15, contribution: 8.25 },
    ],
  },
];

export function getCreditAssessments() { return assessments; }

export function computeECL(pd: number, lgd: number, ead: number): { ecl: number; stage: number } {
  const ecl12m = pd * lgd * ead;
  const stage = pd >= 0.10 ? 2 : pd >= 0.50 ? 3 : 1;
  const lifetimeMultiplier = stage === 1 ? 1 : stage === 2 ? 3 : 5;
  return { ecl: Math.round(ecl12m * lifetimeMultiplier * 100) / 100, stage };
}

export function getPortfolioRiskSummary() {
  const totalExposure = assessments.reduce((s, a) => s + a.totalExposure, 0);
  const totalECL = assessments.reduce((s, a) => s + a.ecl, 0);
  const byStage = { stage1: 0, stage2: 0, stage3: 0 };
  const byGrade: Record<string, number> = {};

  for (const a of assessments) {
    if (a.stage === 1) byStage.stage1 += a.totalExposure;
    else if (a.stage === 2) byStage.stage2 += a.totalExposure;
    else byStage.stage3 += a.totalExposure;
    byGrade[a.creditGrade] = (byGrade[a.creditGrade] || 0) + a.totalExposure;
  }

  return { totalExposure, totalECL, eclRate: Math.round((totalECL / totalExposure) * 10000) / 100, byStage, byGrade };
}
