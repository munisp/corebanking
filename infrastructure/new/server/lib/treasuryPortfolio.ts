/**
 * B6: Treasury investment portfolio management.
 * Tracks fixed income securities, T-bills, bonds, placements with maturity ladder,
 * yield computation, and mark-to-market valuation.
 */

export interface Investment {
  id: string;
  type: "treasury_bill" | "fgn_bond" | "corporate_bond" | "commercial_paper" | "placement" | "eurobond";
  issuer: string;
  faceValue: number;
  purchasePrice: number;
  currentValue: number;
  couponRate: number;
  yieldToMaturity: number;
  purchaseDate: string;
  maturityDate: string;
  currency: string;
  status: "active" | "matured" | "sold" | "defaulted";
  tenor: string;
  unrealizedPnl: number;
  portfolio: "trading" | "held_to_maturity" | "available_for_sale";
}

export interface MaturityLadder {
  bucket: string;
  count: number;
  totalFaceValue: number;
  totalCurrentValue: number;
  weightedYield: number;
}

const investments: Investment[] = [
  {
    id: "INV-001", type: "treasury_bill", issuer: "Federal Government of Nigeria",
    faceValue: 5_000_000_000, purchasePrice: 4_750_000_000, currentValue: 4_850_000_000,
    couponRate: 0, yieldToMaturity: 14.5, purchaseDate: "2026-02-15", maturityDate: "2026-08-15",
    currency: "NGN", status: "active", tenor: "182 days", unrealizedPnl: 100_000_000,
    portfolio: "trading",
  },
  {
    id: "INV-002", type: "fgn_bond", issuer: "Federal Government of Nigeria",
    faceValue: 10_000_000_000, purchasePrice: 9_800_000_000, currentValue: 10_150_000_000,
    couponRate: 13.98, yieldToMaturity: 14.2, purchaseDate: "2025-06-01", maturityDate: "2035-06-01",
    currency: "NGN", status: "active", tenor: "10 years", unrealizedPnl: 350_000_000,
    portfolio: "held_to_maturity",
  },
  {
    id: "INV-003", type: "corporate_bond", issuer: "Dangote Industries",
    faceValue: 2_000_000_000, purchasePrice: 2_000_000_000, currentValue: 2_030_000_000,
    couponRate: 15.5, yieldToMaturity: 15.2, purchaseDate: "2026-01-10", maturityDate: "2029-01-10",
    currency: "NGN", status: "active", tenor: "3 years", unrealizedPnl: 30_000_000,
    portfolio: "available_for_sale",
  },
  {
    id: "INV-004", type: "eurobond", issuer: "Federal Republic of Nigeria",
    faceValue: 50_000_000, purchasePrice: 48_500_000, currentValue: 49_200_000,
    couponRate: 7.875, yieldToMaturity: 8.2, purchaseDate: "2025-09-01", maturityDate: "2032-02-16",
    currency: "USD", status: "active", tenor: "7 years", unrealizedPnl: 700_000,
    portfolio: "held_to_maturity",
  },
  {
    id: "INV-005", type: "placement", issuer: "Access Bank Plc",
    faceValue: 3_000_000_000, purchasePrice: 3_000_000_000, currentValue: 3_000_000_000,
    couponRate: 12, yieldToMaturity: 12, purchaseDate: "2026-04-01", maturityDate: "2026-07-01",
    currency: "NGN", status: "active", tenor: "90 days", unrealizedPnl: 0,
    portfolio: "trading",
  },
  {
    id: "INV-006", type: "commercial_paper", issuer: "MTN Nigeria",
    faceValue: 1_500_000_000, purchasePrice: 1_440_000_000, currentValue: 1_480_000_000,
    couponRate: 0, yieldToMaturity: 13.8, purchaseDate: "2026-03-15", maturityDate: "2026-06-15",
    currency: "NGN", status: "active", tenor: "91 days", unrealizedPnl: 40_000_000,
    portfolio: "trading",
  },
];

export function getInvestments() { return investments; }

export function getMaturityLadder(): MaturityLadder[] {
  const now = new Date("2026-05-09");
  const buckets: Record<string, Investment[]> = {
    "0-30 days": [], "31-90 days": [], "91-180 days": [],
    "181-365 days": [], "1-3 years": [], "3-5 years": [],
    "5-10 years": [], "10+ years": [],
  };

  for (const inv of investments) {
    if (inv.status !== "active") continue;
    const daysToMaturity = Math.floor((new Date(inv.maturityDate).getTime() - now.getTime()) / 86400000);
    if (daysToMaturity <= 30) buckets["0-30 days"].push(inv);
    else if (daysToMaturity <= 90) buckets["31-90 days"].push(inv);
    else if (daysToMaturity <= 180) buckets["91-180 days"].push(inv);
    else if (daysToMaturity <= 365) buckets["181-365 days"].push(inv);
    else if (daysToMaturity <= 1095) buckets["1-3 years"].push(inv);
    else if (daysToMaturity <= 1825) buckets["3-5 years"].push(inv);
    else if (daysToMaturity <= 3650) buckets["5-10 years"].push(inv);
    else buckets["10+ years"].push(inv);
  }

  return Object.entries(buckets).map(([bucket, items]) => ({
    bucket,
    count: items.length,
    totalFaceValue: items.reduce((s, i) => s + i.faceValue, 0),
    totalCurrentValue: items.reduce((s, i) => s + i.currentValue, 0),
    weightedYield: items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.yieldToMaturity * i.faceValue, 0) / items.reduce((s, i) => s + i.faceValue, 0) * 100) / 100
      : 0,
  }));
}

export function getPortfolioSummary() {
  const byPortfolio: Record<string, { count: number; totalValue: number; totalPnl: number }> = {};
  const byType: Record<string, { count: number; totalValue: number }> = {};

  for (const inv of investments) {
    if (!byPortfolio[inv.portfolio]) byPortfolio[inv.portfolio] = { count: 0, totalValue: 0, totalPnl: 0 };
    byPortfolio[inv.portfolio].count++;
    byPortfolio[inv.portfolio].totalValue += inv.currentValue;
    byPortfolio[inv.portfolio].totalPnl += inv.unrealizedPnl;

    if (!byType[inv.type]) byType[inv.type] = { count: 0, totalValue: 0 };
    byType[inv.type].count++;
    byType[inv.type].totalValue += inv.currentValue;
  }

  return {
    totalInvestments: investments.length,
    totalCurrentValue: investments.reduce((s, i) => s + i.currentValue, 0),
    totalUnrealizedPnl: investments.reduce((s, i) => s + i.unrealizedPnl, 0),
    byPortfolio,
    byType,
  };
}
