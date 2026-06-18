/**
 * Collateral management — pledges, valuations, liens, and coverage tracking.
 * Supports property, vehicle, equipment, inventory, securities, and cash collateral.
 */

export interface Collateral {
  id: string;
  type: "property" | "vehicle" | "equipment" | "inventory" | "securities" | "cash_deposit" | "guarantee";
  description: string;
  ownerId: string;
  ownerName: string;
  linkedLoanId: string;
  marketValue: number;
  forcedSaleValue: number;
  haircut: number;
  netCollateralValue: number;
  loanExposure: number;
  coverageRatio: number;
  currency: string;
  valuationDate: string;
  nextValuationDue: string;
  status: "active" | "released" | "under_valuation" | "impaired";
  registrationRef?: string;
  insured: boolean;
  insuranceExpiry?: string;
}

const collaterals: Collateral[] = [
  { id: "COL-001", type: "property", description: "3-Bedroom Duplex, Lekki Phase 1, Lagos", ownerId: "CUST-003", ownerName: "Zenith Construction Ltd", linkedLoanId: "LN-003", marketValue: 150_000_000, forcedSaleValue: 105_000_000, haircut: 30, netCollateralValue: 105_000_000, loanExposure: 80_000_000, coverageRatio: 131.25, currency: "NGN", valuationDate: "2026-01-15", nextValuationDue: "2027-01-15", status: "active", registrationRef: "LAGOS/LK1/2026/001", insured: true, insuranceExpiry: "2027-01-15" },
  { id: "COL-002", type: "vehicle", description: "Toyota Hilux 2025 (fleet of 5)", ownerId: "CUST-003", ownerName: "Zenith Construction Ltd", linkedLoanId: "LN-003", marketValue: 75_000_000, forcedSaleValue: 52_500_000, haircut: 30, netCollateralValue: 52_500_000, loanExposure: 80_000_000, coverageRatio: 65.63, currency: "NGN", valuationDate: "2026-02-01", nextValuationDue: "2026-08-01", status: "active", registrationRef: "FMVR/2026/ABJ/5512", insured: true, insuranceExpiry: "2027-02-01" },
  { id: "COL-003", type: "securities", description: "FGN Bond 14.55% 2029 (N500M face)", ownerId: "CUST-010", ownerName: "Pinnacle Holdings Ltd", linkedLoanId: "LN-010", marketValue: 520_000_000, forcedSaleValue: 494_000_000, haircut: 5, netCollateralValue: 494_000_000, loanExposure: 400_000_000, coverageRatio: 123.5, currency: "NGN", valuationDate: "2026-05-01", nextValuationDue: "2026-06-01", status: "active", insured: false },
  { id: "COL-004", type: "cash_deposit", description: "Fixed Deposit Lien — 12-month tenor", ownerId: "CUST-002", ownerName: "Ibrahim Musa", linkedLoanId: "LN-002", marketValue: 25_000_000, forcedSaleValue: 25_000_000, haircut: 0, netCollateralValue: 25_000_000, loanExposure: 20_000_000, coverageRatio: 125.0, currency: "NGN", valuationDate: "2026-04-01", nextValuationDue: "2027-04-01", status: "active", insured: false },
  { id: "COL-005", type: "equipment", description: "CAT Excavator 320F (2024 model)", ownerId: "CUST-006", ownerName: "Niger Delta Dredging Ltd", linkedLoanId: "LN-006", marketValue: 180_000_000, forcedSaleValue: 108_000_000, haircut: 40, netCollateralValue: 108_000_000, loanExposure: 120_000_000, coverageRatio: 90.0, currency: "NGN", valuationDate: "2025-12-01", nextValuationDue: "2026-06-01", status: "under_valuation", insured: true, insuranceExpiry: "2026-12-01" },
  { id: "COL-006", type: "inventory", description: "Warehouse cocoa stock — 500 tonnes", ownerId: "CUST-008", ownerName: "Farmgate Commodities Ltd", linkedLoanId: "LN-008", marketValue: 450_000_000, forcedSaleValue: 315_000_000, haircut: 30, netCollateralValue: 315_000_000, loanExposure: 250_000_000, coverageRatio: 126.0, currency: "NGN", valuationDate: "2026-03-15", nextValuationDue: "2026-06-15", status: "active", insured: true, insuranceExpiry: "2026-09-15" },
  { id: "COL-007", type: "guarantee", description: "Corporate Guarantee — Dangote Industries", ownerId: "CUST-012", ownerName: "Dangote Cement PLC", linkedLoanId: "LN-012", marketValue: 1_000_000_000, forcedSaleValue: 800_000_000, haircut: 20, netCollateralValue: 800_000_000, loanExposure: 500_000_000, coverageRatio: 160.0, currency: "NGN", valuationDate: "2026-01-01", nextValuationDue: "2027-01-01", status: "active", insured: false },
];

export function getCollaterals() { return collaterals; }

export function getCollateralSummary() {
  const byType: Record<string, { count: number; totalValue: number }> = {};
  let totalMarketValue = 0;
  let totalExposure = 0;
  for (const c of collaterals) {
    if (!byType[c.type]) byType[c.type] = { count: 0, totalValue: 0 };
    byType[c.type].count++;
    byType[c.type].totalValue += c.marketValue;
    totalMarketValue += c.marketValue;
    totalExposure += c.loanExposure;
  }
  const overallCoverage = totalExposure > 0 ? Math.round((totalMarketValue / totalExposure) * 100) / 100 : 0;
  return { total: collaterals.length, totalMarketValue, totalExposure, overallCoverageRatio: overallCoverage, byType };
}
