/**
 * Cash management / liquidity forecasting — cash position, inflow/outflow
 * projections, CRR monitoring, liquidity ratios, funding gap analysis.
 */

export interface CashPosition {
  id: string;
  category: "vault" | "cbn_reserve" | "nostro" | "interbank" | "atm_network" | "branch_float";
  description: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface LiquidityForecast {
  id: string;
  date: string;
  projectedInflows: number;
  projectedOutflows: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  crrRequired: number;
  crrActual: number;
  crrCompliant: boolean;
  liquidityRatio: number;
}

const positions: CashPosition[] = [
  { id: "CP-001", category: "vault", description: "Head Office Main Vault", balance: 3_500_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-002", category: "vault", description: "Branch Network Vaults (45 branches)", balance: 5_000_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-003", category: "cbn_reserve", description: "CBN Current Account (CRR)", balance: 114_000_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-004", category: "nostro", description: "Citibank New York (USD)", balance: 85_000_000, currency: "USD", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-005", category: "nostro", description: "Standard Chartered London (GBP)", balance: 12_000_000, currency: "GBP", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-006", category: "nostro", description: "Deutsche Bank Frankfurt (EUR)", balance: 18_000_000, currency: "EUR", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-007", category: "interbank", description: "Call Placements — 5 counterparties", balance: 25_000_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-008", category: "atm_network", description: "ATM Cash Holdings (320 ATMs)", balance: 2_400_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
  { id: "CP-009", category: "branch_float", description: "Agent Banking Float (12,500 agents)", balance: 1_800_000_000, currency: "NGN", lastUpdated: "2026-05-09T15:00:00Z" },
];

const forecasts: LiquidityForecast[] = [
  { id: "LF-001", date: "2026-05-10", projectedInflows: 18_500_000_000, projectedOutflows: 16_200_000_000, netCashFlow: 2_300_000_000, openingBalance: 151_700_000_000, closingBalance: 154_000_000_000, crrRequired: 114_000_000_000, crrActual: 114_000_000_000, crrCompliant: true, liquidityRatio: 42.5 },
  { id: "LF-002", date: "2026-05-11", projectedInflows: 12_000_000_000, projectedOutflows: 14_800_000_000, netCashFlow: -2_800_000_000, openingBalance: 154_000_000_000, closingBalance: 151_200_000_000, crrRequired: 114_000_000_000, crrActual: 114_000_000_000, crrCompliant: true, liquidityRatio: 41.2 },
  { id: "LF-003", date: "2026-05-12", projectedInflows: 22_000_000_000, projectedOutflows: 19_500_000_000, netCashFlow: 2_500_000_000, openingBalance: 151_200_000_000, closingBalance: 153_700_000_000, crrRequired: 114_000_000_000, crrActual: 114_000_000_000, crrCompliant: true, liquidityRatio: 42.3 },
  { id: "LF-004", date: "2026-05-13", projectedInflows: 15_000_000_000, projectedOutflows: 20_500_000_000, netCashFlow: -5_500_000_000, openingBalance: 153_700_000_000, closingBalance: 148_200_000_000, crrRequired: 114_000_000_000, crrActual: 112_000_000_000, crrCompliant: false, liquidityRatio: 38.8 },
  { id: "LF-005", date: "2026-05-14", projectedInflows: 25_000_000_000, projectedOutflows: 18_000_000_000, netCashFlow: 7_000_000_000, openingBalance: 148_200_000_000, closingBalance: 155_200_000_000, crrRequired: 114_000_000_000, crrActual: 115_000_000_000, crrCompliant: true, liquidityRatio: 43.0 },
];

export function getCashPositions() { return positions; }
export function getLiquidityForecasts() { return forecasts; }

export function getCashSummary() {
  let totalNGN = 0;
  const byCurrency: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const p of positions) {
    if (p.currency === "NGN") totalNGN += p.balance;
    byCurrency[p.currency] = (byCurrency[p.currency] || 0) + p.balance;
    byCategory[p.category] = (byCategory[p.category] || 0) + p.balance;
  }
  const latestForecast = forecasts[forecasts.length - 1];
  return { totalNGN, byCurrency, byCategory, liquidityRatio: latestForecast?.liquidityRatio, crrCompliant: latestForecast?.crrCompliant };
}
