/**
 * Fixed deposit management — tenor-based deposits, auto-rollover,
 * early liquidation penalties, top-up, interest payout options.
 */

export interface FixedDeposit {
  id: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  principal: number;
  currency: string;
  tenor: number;
  tenorUnit: "days" | "months" | "years";
  interestRate: number;
  interestType: "at_maturity" | "monthly" | "quarterly";
  maturityAmount: number;
  accruedInterest: number;
  startDate: string;
  maturityDate: string;
  autoRollover: boolean;
  rolloverCount: number;
  status: "active" | "matured" | "liquidated" | "rolled_over" | "top_up_pending";
  earlyLiquidationPenalty: number;
  source: "branch" | "internet" | "mobile";
}

const deposits: FixedDeposit[] = [
  { id: "FD-001", customerId: "CUST-002", customerName: "Ibrahim Musa", accountNumber: "FD-5400001001", principal: 50_000_000, currency: "NGN", tenor: 365, tenorUnit: "days", interestRate: 14.5, interestType: "at_maturity", maturityAmount: 57_250_000, accruedInterest: 2_604_110, startDate: "2026-01-15", maturityDate: "2027-01-15", autoRollover: true, rolloverCount: 0, status: "active", earlyLiquidationPenalty: 25, source: "branch" },
  { id: "FD-002", customerId: "CUST-010", customerName: "Pinnacle Holdings Ltd", accountNumber: "FD-5400002001", principal: 500_000_000, currency: "NGN", tenor: 180, tenorUnit: "days", interestRate: 16.0, interestType: "quarterly", maturityAmount: 539_452_055, accruedInterest: 17_753_425, startDate: "2026-03-01", maturityDate: "2026-08-28", autoRollover: false, rolloverCount: 0, status: "active", earlyLiquidationPenalty: 30, source: "branch" },
  { id: "FD-003", customerId: "CUST-001", customerName: "Aisha Mohammed", accountNumber: "FD-5400003001", principal: 5_000_000, currency: "NGN", tenor: 90, tenorUnit: "days", interestRate: 10.0, interestType: "at_maturity", maturityAmount: 5_123_288, accruedInterest: 123_288, startDate: "2026-04-01", maturityDate: "2026-06-30", autoRollover: true, rolloverCount: 2, status: "active", earlyLiquidationPenalty: 20, source: "mobile" },
  { id: "FD-004", customerId: "CUST-005", customerName: "Fatimah Abdullahi", accountNumber: "FD-5400004001", principal: 2_000_000, currency: "NGN", tenor: 30, tenorUnit: "days", interestRate: 8.0, interestType: "at_maturity", maturityAmount: 2_013_151, accruedInterest: 13_151, startDate: "2026-04-15", maturityDate: "2026-05-15", autoRollover: false, rolloverCount: 0, status: "matured", earlyLiquidationPenalty: 15, source: "internet" },
  { id: "FD-005", customerId: "CUST-012", customerName: "Dangote Cement PLC", accountNumber: "FD-5400005001", principal: 2_000_000_000, currency: "NGN", tenor: 270, tenorUnit: "days", interestRate: 18.0, interestType: "monthly", maturityAmount: 2_266_301_370, accruedInterest: 59_178_082, startDate: "2026-02-01", maturityDate: "2026-10-29", autoRollover: true, rolloverCount: 0, status: "active", earlyLiquidationPenalty: 35, source: "branch" },
  { id: "FD-006", customerId: "CUST-008", customerName: "Farmgate Commodities Ltd", accountNumber: "FD-5400006001", principal: 100_000_000, currency: "USD", tenor: 365, tenorUnit: "days", interestRate: 5.5, interestType: "at_maturity", maturityAmount: 105_500_000, accruedInterest: 1_972_603, startDate: "2026-01-01", maturityDate: "2027-01-01", autoRollover: false, rolloverCount: 0, status: "active", earlyLiquidationPenalty: 50, source: "branch" },
];

export function getFixedDeposits() { return deposits; }

export function getFixedDepositSummary() {
  let totalNGN = 0; let totalUSD = 0; let totalAccruedInterest = 0;
  const byTenor: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const d of deposits) {
    if (d.currency === "NGN") totalNGN += d.principal; else totalUSD += d.principal;
    totalAccruedInterest += d.accruedInterest;
    const bucket = d.tenor <= 30 ? "0-30d" : d.tenor <= 90 ? "31-90d" : d.tenor <= 180 ? "91-180d" : d.tenor <= 365 ? "181-365d" : ">365d";
    byTenor[bucket] = (byTenor[bucket] || 0) + 1;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }
  return { total: deposits.length, totalPrincipalNGN: totalNGN, totalPrincipalUSD: totalUSD, totalAccruedInterest, autoRolloverCount: deposits.filter((d) => d.autoRollover).length, byTenor, byStatus };
}
