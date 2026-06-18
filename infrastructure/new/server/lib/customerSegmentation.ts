/**
 * Customer segmentation engine — retail/SME/corporate/HNW classification,
 * behavioral scoring, cross-sell propensity, churn risk.
 */

export interface CustomerSegment {
  id: string;
  customerId: string;
  customerName: string;
  segment: "mass_retail" | "premium_retail" | "sme" | "mid_corporate" | "large_corporate" | "institutional" | "hnw" | "diaspora";
  totalRelationshipValue: number;
  totalDeposits: number;
  totalLoans: number;
  productCount: number;
  monthlyTransactions: number;
  avgTransactionValue: number;
  currency: string;
  profitabilityScore: number;
  churnRisk: "low" | "medium" | "high" | "critical";
  crossSellOpportunities: string[];
  lastInteraction: string;
  relationshipManager?: string;
  npsScore?: number;
  onboardedDate: string;
}

const segments: CustomerSegment[] = [
  { id: "SEG-001", customerId: "CUST-001", customerName: "Aisha Mohammed", segment: "premium_retail", totalRelationshipValue: 18_500_000, totalDeposits: 15_000_000, totalLoans: 3_500_000, productCount: 5, monthlyTransactions: 45, avgTransactionValue: 125_000, currency: "NGN", profitabilityScore: 72, churnRisk: "low", crossSellOpportunities: ["Platinum Visa card", "T-Bill investment", "Life insurance"], lastInteraction: "2026-05-09", relationshipManager: "Adebayo Ogundimu", npsScore: 8, onboardedDate: "2022-06-15" },
  { id: "SEG-002", customerId: "CUST-002", customerName: "Ibrahim Musa", segment: "premium_retail", totalRelationshipValue: 75_000_000, totalDeposits: 50_000_000, totalLoans: 25_000_000, productCount: 7, monthlyTransactions: 30, avgTransactionValue: 800_000, currency: "NGN", profitabilityScore: 88, churnRisk: "low", crossSellOpportunities: ["Wealth management", "Offshore investment"], lastInteraction: "2026-05-08", relationshipManager: "Adebayo Ogundimu", npsScore: 9, onboardedDate: "2020-03-01" },
  { id: "SEG-003", customerId: "CUST-010", customerName: "Pinnacle Holdings Ltd", segment: "large_corporate", totalRelationshipValue: 2_500_000_000, totalDeposits: 1_800_000_000, totalLoans: 700_000_000, productCount: 12, monthlyTransactions: 8_500, avgTransactionValue: 5_200_000, currency: "NGN", profitabilityScore: 95, churnRisk: "low", crossSellOpportunities: ["Trade finance LC", "FX hedging", "Cash management"], lastInteraction: "2026-05-09", relationshipManager: "Oluwafemi Adeleke", npsScore: 7, onboardedDate: "2018-11-20" },
  { id: "SEG-004", customerId: "CUST-003", customerName: "Zenith Construction Ltd", segment: "mid_corporate", totalRelationshipValue: 450_000_000, totalDeposits: 200_000_000, totalLoans: 250_000_000, productCount: 8, monthlyTransactions: 2_200, avgTransactionValue: 1_500_000, currency: "NGN", profitabilityScore: 68, churnRisk: "medium", crossSellOpportunities: ["Performance guarantee", "Equipment leasing", "Payroll services"], lastInteraction: "2026-05-07", relationshipManager: "Nkechi Eze", onboardedDate: "2021-07-10" },
  { id: "SEG-005", customerId: "CUST-005", customerName: "Fatimah Abdullahi", segment: "mass_retail", totalRelationshipValue: 2_500_000, totalDeposits: 2_500_000, totalLoans: 0, productCount: 2, monthlyTransactions: 15, avgTransactionValue: 35_000, currency: "NGN", profitabilityScore: 25, churnRisk: "high", crossSellOpportunities: ["Personal loan", "Savings plan", "Mobile insurance"], lastInteraction: "2026-04-20", npsScore: 5, onboardedDate: "2024-01-15" },
  { id: "SEG-006", customerId: "CUST-012", customerName: "Dangote Cement PLC", segment: "institutional", totalRelationshipValue: 8_500_000_000, totalDeposits: 6_000_000_000, totalLoans: 2_500_000_000, productCount: 18, monthlyTransactions: 25_000, avgTransactionValue: 12_000_000, currency: "NGN", profitabilityScore: 99, churnRisk: "low", crossSellOpportunities: ["Eurobond issuance", "Syndicated facility"], lastInteraction: "2026-05-09", relationshipManager: "Oluwafemi Adeleke", npsScore: 8, onboardedDate: "2015-03-01" },
  { id: "SEG-007", customerId: "CUST-008", customerName: "Farmgate Commodities Ltd", segment: "sme", totalRelationshipValue: 350_000_000, totalDeposits: 100_000_000, totalLoans: 250_000_000, productCount: 6, monthlyTransactions: 800, avgTransactionValue: 2_500_000, currency: "NGN", profitabilityScore: 55, churnRisk: "medium", crossSellOpportunities: ["Warehouse receipt finance", "FX account", "Trade credit insurance"], lastInteraction: "2026-05-05", onboardedDate: "2023-02-01" },
  { id: "SEG-008", customerId: "CUST-020", customerName: "Olusegun Bakare", segment: "diaspora", totalRelationshipValue: 45_000_000, totalDeposits: 40_000_000, totalLoans: 5_000_000, productCount: 4, monthlyTransactions: 8, avgTransactionValue: 2_000_000, currency: "NGN", profitabilityScore: 62, churnRisk: "medium", crossSellOpportunities: ["Property investment", "Dom account top-up", "Remittance plan"], lastInteraction: "2026-04-28", onboardedDate: "2022-09-01" },
];

export function getCustomerSegments() { return segments; }

export function getSegmentStats() {
  const bySegment: Record<string, { count: number; totalValue: number }> = {};
  const byChurnRisk: Record<string, number> = {};
  let totalValue = 0;
  for (const s of segments) {
    if (!bySegment[s.segment]) bySegment[s.segment] = { count: 0, totalValue: 0 };
    bySegment[s.segment].count++;
    bySegment[s.segment].totalValue += s.totalRelationshipValue;
    byChurnRisk[s.churnRisk] = (byChurnRisk[s.churnRisk] || 0) + 1;
    totalValue += s.totalRelationshipValue;
  }
  const avgProfitability = Math.round(segments.reduce((s, c) => s + c.profitabilityScore, 0) / segments.length);
  return { total: segments.length, totalRelationshipValue: totalValue, avgProfitabilityScore: avgProfitability, bySegment, byChurnRisk };
}
