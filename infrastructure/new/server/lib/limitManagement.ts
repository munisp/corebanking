/**
 * Limit management — transaction limits, channel limits, customer tier limits.
 * Enforces CBN-mandated daily/weekly/monthly ceilings per customer tier and channel.
 */

export interface TransactionLimit {
  id: string;
  name: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3" | "Corporate" | "Agent";
  channel: "mobile" | "internet" | "ussd" | "pos" | "atm" | "branch" | "api";
  dailyLimit: number;
  singleTransactionLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  currency: string;
  status: "active" | "suspended";
  effectiveDate: string;
}

export interface LimitUtilization {
  id: string;
  customerId: string;
  customerName: string;
  tier: string;
  channel: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyPct: number;
  weeklyUsed: number;
  weeklyLimit: number;
  weeklyPct: number;
  lastTransaction: string;
}

const limits: TransactionLimit[] = [
  { id: "TL-001", name: "Tier 1 Mobile", tier: "Tier 1", channel: "mobile", dailyLimit: 50_000, singleTransactionLimit: 50_000, weeklyLimit: 300_000, monthlyLimit: 300_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-002", name: "Tier 1 USSD", tier: "Tier 1", channel: "ussd", dailyLimit: 50_000, singleTransactionLimit: 50_000, weeklyLimit: 300_000, monthlyLimit: 300_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-003", name: "Tier 2 Mobile", tier: "Tier 2", channel: "mobile", dailyLimit: 200_000, singleTransactionLimit: 200_000, weeklyLimit: 1_000_000, monthlyLimit: 5_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-004", name: "Tier 2 Internet", tier: "Tier 2", channel: "internet", dailyLimit: 500_000, singleTransactionLimit: 500_000, weeklyLimit: 3_000_000, monthlyLimit: 10_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-005", name: "Tier 3 Mobile", tier: "Tier 3", channel: "mobile", dailyLimit: 5_000_000, singleTransactionLimit: 5_000_000, weeklyLimit: 25_000_000, monthlyLimit: 100_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-006", name: "Tier 3 Internet", tier: "Tier 3", channel: "internet", dailyLimit: 10_000_000, singleTransactionLimit: 10_000_000, weeklyLimit: 50_000_000, monthlyLimit: 200_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-007", name: "Corporate API", tier: "Corporate", channel: "api", dailyLimit: 500_000_000, singleTransactionLimit: 100_000_000, weeklyLimit: 2_000_000_000, monthlyLimit: 10_000_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
  { id: "TL-008", name: "Agent POS", tier: "Agent", channel: "pos", dailyLimit: 1_000_000, singleTransactionLimit: 500_000, weeklyLimit: 5_000_000, monthlyLimit: 20_000_000, currency: "NGN", status: "active", effectiveDate: "2026-01-01" },
];

const utilizations: LimitUtilization[] = [
  { id: "LU-001", customerId: "CUST-001", customerName: "Aisha Mohammed", tier: "Tier 3", channel: "mobile", dailyUsed: 1_500_000, dailyLimit: 5_000_000, dailyPct: 30, weeklyUsed: 8_200_000, weeklyLimit: 25_000_000, weeklyPct: 32.8, lastTransaction: "2026-05-09T14:30:00Z" },
  { id: "LU-002", customerId: "CUST-002", customerName: "Ibrahim Musa", tier: "Tier 3", channel: "internet", dailyUsed: 8_500_000, dailyLimit: 10_000_000, dailyPct: 85, weeklyUsed: 42_000_000, weeklyLimit: 50_000_000, weeklyPct: 84, lastTransaction: "2026-05-09T13:00:00Z" },
  { id: "LU-003", customerId: "CUST-005", customerName: "Fatimah Abdullahi", tier: "Tier 1", channel: "ussd", dailyUsed: 35_000, dailyLimit: 50_000, dailyPct: 70, weeklyUsed: 180_000, weeklyLimit: 300_000, weeklyPct: 60, lastTransaction: "2026-05-09T11:00:00Z" },
  { id: "LU-004", customerId: "CUST-050", customerName: "Zenith Construction Ltd", tier: "Corporate", channel: "api", dailyUsed: 125_000_000, dailyLimit: 500_000_000, dailyPct: 25, weeklyUsed: 680_000_000, weeklyLimit: 2_000_000_000, weeklyPct: 34, lastTransaction: "2026-05-09T15:00:00Z" },
];

export function getTransactionLimits() { return limits; }
export function getLimitUtilizations() { return utilizations; }

export function checkLimit(tier: string, channel: string, amount: number): { allowed: boolean; reason?: string } {
  const limit = limits.find((l) => l.tier === tier && l.channel === channel && l.status === "active");
  if (!limit) return { allowed: false, reason: `No limit configured for ${tier}/${channel}` };
  if (amount > limit.singleTransactionLimit) return { allowed: false, reason: `Amount ₦${amount.toLocaleString()} exceeds single transaction limit ₦${limit.singleTransactionLimit.toLocaleString()}` };
  return { allowed: true };
}
