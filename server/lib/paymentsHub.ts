/**
 * B2: Payments Hub — unified payment processing across NIP, NEFT, RTGS, and internal.
 * Handles routing, fee calculation, limit checking, and reconciliation.
 */

export interface PaymentTransaction {
  id: string;
  reference: string;
  type: "nip" | "neft" | "rtgs" | "internal" | "ussd" | "pos" | "atm";
  sourceAccount: string;
  sourceBank: string;
  destinationAccount: string;
  destinationBank: string;
  amount: number;
  fee: number;
  vat: number;
  currency: string;
  narration: string;
  status: "pending" | "processing" | "completed" | "failed" | "reversed";
  channel: string;
  initiatedBy: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
  nipSessionId?: string;
}

export interface PaymentLimit {
  channel: string;
  tier: string;
  singleLimit: number;
  dailyLimit: number;
  currency: string;
}

const PAYMENT_LIMITS: PaymentLimit[] = [
  { channel: "nip", tier: "Tier 1", singleLimit: 50_000, dailyLimit: 300_000, currency: "NGN" },
  { channel: "nip", tier: "Tier 2", singleLimit: 200_000, dailyLimit: 500_000, currency: "NGN" },
  { channel: "nip", tier: "Tier 3", singleLimit: 5_000_000, dailyLimit: 10_000_000, currency: "NGN" },
  { channel: "ussd", tier: "Tier 1", singleLimit: 50_000, dailyLimit: 300_000, currency: "NGN" },
  { channel: "ussd", tier: "Tier 3", singleLimit: 500_000, dailyLimit: 2_000_000, currency: "NGN" },
  { channel: "rtgs", tier: "Tier 3", singleLimit: 100_000_000, dailyLimit: 500_000_000, currency: "NGN" },
  { channel: "pos", tier: "Tier 3", singleLimit: 2_000_000, dailyLimit: 10_000_000, currency: "NGN" },
];

const PAYMENT_FEES: Record<string, { fixed: number; percentage: number; cap: number }> = {
  nip_below_5000: { fixed: 10, percentage: 0, cap: 10 },
  nip_5000_50000: { fixed: 25, percentage: 0, cap: 25 },
  nip_above_50000: { fixed: 50, percentage: 0, cap: 50 },
  neft: { fixed: 50, percentage: 0, cap: 50 },
  rtgs: { fixed: 0, percentage: 0.05, cap: 5000 },
  internal: { fixed: 0, percentage: 0, cap: 0 },
  ussd: { fixed: 6.98, percentage: 0, cap: 6.98 },
  pos: { fixed: 0, percentage: 0.5, cap: 1000 },
  atm: { fixed: 35, percentage: 0, cap: 35 },
};

const seedTransactions: PaymentTransaction[] = [
  {
    id: "TXN-001", reference: "NIP-2026050900001", type: "nip",
    sourceAccount: "0123456789", sourceBank: "54Bank",
    destinationAccount: "9876543210", destinationBank: "First Bank",
    amount: 500_000, fee: 50, vat: 3.75, currency: "NGN",
    narration: "Rent payment - May 2026", status: "completed",
    channel: "internet_banking", initiatedBy: "CUST-001",
    initiatedAt: "2026-05-09T08:30:00Z", completedAt: "2026-05-09T08:30:02Z",
    nipSessionId: "NIP-090520260001",
  },
  {
    id: "TXN-002", reference: "RTG-2026050900001", type: "rtgs",
    sourceAccount: "0123456789", sourceBank: "54Bank",
    destinationAccount: "5555666677", destinationBank: "Zenith Bank",
    amount: 25_000_000, fee: 5000, vat: 375, currency: "NGN",
    narration: "Equipment purchase - Invoice INV-2026-0451", status: "completed",
    channel: "corporate_banking", initiatedBy: "CUST-002",
    initiatedAt: "2026-05-09T10:00:00Z", completedAt: "2026-05-09T10:15:00Z",
  },
  {
    id: "TXN-003", reference: "INT-2026050900001", type: "internal",
    sourceAccount: "0123456789", sourceBank: "54Bank",
    destinationAccount: "0123456790", destinationBank: "54Bank",
    amount: 1_000_000, fee: 0, vat: 0, currency: "NGN",
    narration: "Transfer to savings", status: "completed",
    channel: "mobile_banking", initiatedBy: "CUST-001",
    initiatedAt: "2026-05-09T11:00:00Z", completedAt: "2026-05-09T11:00:01Z",
  },
  {
    id: "TXN-004", reference: "NIP-2026050900002", type: "nip",
    sourceAccount: "9988776655", sourceBank: "54Bank",
    destinationAccount: "1122334455", destinationBank: "GTBank",
    amount: 3_500_000, fee: 50, vat: 3.75, currency: "NGN",
    narration: "Salary payment - Contractor", status: "failed",
    channel: "corporate_banking", initiatedBy: "CUST-003",
    initiatedAt: "2026-05-09T14:00:00Z",
    failureReason: "Destination account frozen",
  },
];

export function calculateFee(type: string, amount: number): { fee: number; vat: number } {
  let feeKey = type;
  if (type === "nip") {
    if (amount < 5_000) feeKey = "nip_below_5000";
    else if (amount <= 50_000) feeKey = "nip_5000_50000";
    else feeKey = "nip_above_50000";
  }
  const schedule = PAYMENT_FEES[feeKey] || PAYMENT_FEES["internal"];
  const rawFee = schedule.fixed + (amount * schedule.percentage / 100);
  const fee = Math.min(rawFee, schedule.cap || rawFee);
  const vat = fee * 0.075; // 7.5% VAT on banking fees
  return { fee: Math.round(fee * 100) / 100, vat: Math.round(vat * 100) / 100 };
}

export function checkLimit(channel: string, tier: string, amount: number): { allowed: boolean; limit?: PaymentLimit; reason?: string } {
  const limit = PAYMENT_LIMITS.find((l) => l.channel === channel && l.tier === tier);
  if (!limit) return { allowed: false, reason: `No limit configured for ${channel}/${tier}` };
  if (amount > limit.singleLimit) return { allowed: false, limit, reason: `Amount ₦${amount.toLocaleString()} exceeds single transaction limit ₦${limit.singleLimit.toLocaleString()}` };
  return { allowed: true, limit };
}

export function getPaymentTransactions() { return seedTransactions; }
export function getPaymentLimits() { return PAYMENT_LIMITS; }
export function getPaymentFees() { return PAYMENT_FEES; }
