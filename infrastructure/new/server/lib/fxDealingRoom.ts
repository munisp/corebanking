/**
 * B5: FX dealing room — live rate feeds, position management, deal execution.
 * Supports spot, forward, and swap transactions with real-time P&L.
 */

export interface FXRate {
  id: string;
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  source: "CBN" | "NAFEM" | "parallel" | "interbank";
  timestamp: string;
  change24h: number;
  volume24h: number;
}

export interface FXDeal {
  id: string;
  dealType: "spot" | "forward" | "swap";
  pair: string;
  side: "buy" | "sell";
  amount: number;
  rate: number;
  counterAmount: number;
  counterparty: string;
  dealer: string;
  status: "pending" | "confirmed" | "settled" | "cancelled";
  valueDate: string;
  createdAt: string;
  settledAt?: string;
  pnl?: number;
}

export interface FXPosition {
  pair: string;
  longAmount: number;
  shortAmount: number;
  netPosition: number;
  averageRate: number;
  currentRate: number;
  unrealizedPnl: number;
  limit: number;
  utilizationPct: number;
}

const fxRates: FXRate[] = [
  { id: "FXR-001", pair: "USD/NGN", bid: 1580.00, ask: 1585.00, mid: 1582.50, spread: 5.00, source: "NAFEM", timestamp: "2026-05-09T14:30:00Z", change24h: -0.32, volume24h: 450_000_000 },
  { id: "FXR-002", pair: "EUR/NGN", bid: 1720.00, ask: 1728.00, mid: 1724.00, spread: 8.00, source: "NAFEM", timestamp: "2026-05-09T14:30:00Z", change24h: 0.15, volume24h: 120_000_000 },
  { id: "FXR-003", pair: "GBP/NGN", bid: 2010.00, ask: 2020.00, mid: 2015.00, spread: 10.00, source: "NAFEM", timestamp: "2026-05-09T14:30:00Z", change24h: -0.08, volume24h: 85_000_000 },
  { id: "FXR-004", pair: "CHF/NGN", bid: 1790.00, ask: 1798.00, mid: 1794.00, spread: 8.00, source: "interbank", timestamp: "2026-05-09T14:30:00Z", change24h: 0.22, volume24h: 25_000_000 },
  { id: "FXR-005", pair: "CNY/NGN", bid: 218.00, ask: 220.00, mid: 219.00, spread: 2.00, source: "CBN", timestamp: "2026-05-09T14:30:00Z", change24h: -0.45, volume24h: 65_000_000 },
  { id: "FXR-006", pair: "USD/NGN", bid: 1620.00, ask: 1650.00, mid: 1635.00, spread: 30.00, source: "parallel", timestamp: "2026-05-09T14:30:00Z", change24h: -1.20, volume24h: 0 },
];

const fxDeals: FXDeal[] = [
  {
    id: "FXD-001", dealType: "spot", pair: "USD/NGN", side: "buy", amount: 5_000_000,
    rate: 1582.00, counterAmount: 7_910_000_000, counterparty: "JPMorgan Chase",
    dealer: "DEALER-001", status: "settled", valueDate: "2026-05-09",
    createdAt: "2026-05-09T09:00:00Z", settledAt: "2026-05-09T14:00:00Z", pnl: 2_500_000,
  },
  {
    id: "FXD-002", dealType: "forward", pair: "EUR/NGN", side: "sell", amount: 2_000_000,
    rate: 1735.00, counterAmount: 3_470_000_000, counterparty: "Standard Chartered",
    dealer: "DEALER-002", status: "confirmed", valueDate: "2026-08-09",
    createdAt: "2026-05-09T10:30:00Z",
  },
  {
    id: "FXD-003", dealType: "swap", pair: "USD/NGN", side: "buy", amount: 10_000_000,
    rate: 1583.50, counterAmount: 15_835_000_000, counterparty: "Citibank",
    dealer: "DEALER-001", status: "confirmed", valueDate: "2026-05-09",
    createdAt: "2026-05-09T11:00:00Z",
  },
  {
    id: "FXD-004", dealType: "spot", pair: "GBP/NGN", side: "sell", amount: 1_000_000,
    rate: 2018.00, counterAmount: 2_018_000_000, counterparty: "Access Bank",
    dealer: "DEALER-003", status: "pending", valueDate: "2026-05-09",
    createdAt: "2026-05-09T14:00:00Z",
  },
];

const fxPositions: FXPosition[] = [
  { pair: "USD/NGN", longAmount: 25_000_000, shortAmount: 18_000_000, netPosition: 7_000_000, averageRate: 1580.50, currentRate: 1582.50, unrealizedPnl: 14_000_000, limit: 50_000_000, utilizationPct: 14 },
  { pair: "EUR/NGN", longAmount: 5_000_000, shortAmount: 7_000_000, netPosition: -2_000_000, averageRate: 1722.00, currentRate: 1724.00, unrealizedPnl: -4_000_000, limit: 20_000_000, utilizationPct: 10 },
  { pair: "GBP/NGN", longAmount: 3_000_000, shortAmount: 4_000_000, netPosition: -1_000_000, averageRate: 2012.00, currentRate: 2015.00, unrealizedPnl: -3_000_000, limit: 15_000_000, utilizationPct: 6.7 },
];

export function getFXRates() { return fxRates; }
export function getFXDeals() { return fxDeals; }
export function getFXPositions() { return fxPositions; }
export function convertCurrency(amount: number, fromPair: string): { convertedAmount: number; rate: number } {
  const rate = fxRates.find((r) => r.pair === fromPair && r.source !== "parallel");
  if (!rate) return { convertedAmount: 0, rate: 0 };
  return { convertedAmount: Math.round(amount * rate.mid * 100) / 100, rate: rate.mid };
}
