/**
 * B10: Fee & commission engine with tiered pricing.
 * Configurable fee schedules per product, channel, and customer tier.
 * Supports flat, percentage, tiered, and capped fee structures.
 */

export interface FeeSchedule {
  id: string;
  name: string;
  product: string;
  channel: string;
  customerTier: string;
  feeType: "flat" | "percentage" | "tiered" | "capped";
  flatAmount?: number;
  percentage?: number;
  cap?: number;
  tiers?: Array<{ from: number; to: number; rate: number }>;
  vatApplicable: boolean;
  currency: string;
  effectiveDate: string;
  expiryDate?: string;
  status: "active" | "expired" | "draft";
}

export interface FeeTransaction {
  id: string;
  scheduleId: string;
  transactionId: string;
  transactionAmount: number;
  feeAmount: number;
  vatAmount: number;
  totalCharge: number;
  currency: string;
  customerId: string;
  channel: string;
  createdAt: string;
}

const feeSchedules: FeeSchedule[] = [
  {
    id: "FS-001", name: "NIP Transfer Fee (below ₦5,000)", product: "nip_transfer",
    channel: "all", customerTier: "all", feeType: "flat", flatAmount: 10,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-002", name: "NIP Transfer Fee (₦5,000 - ₦50,000)", product: "nip_transfer",
    channel: "all", customerTier: "all", feeType: "flat", flatAmount: 25,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-003", name: "NIP Transfer Fee (above ₦50,000)", product: "nip_transfer",
    channel: "all", customerTier: "all", feeType: "flat", flatAmount: 50,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-004", name: "USSD Transfer Fee", product: "ussd_transfer",
    channel: "ussd", customerTier: "all", feeType: "flat", flatAmount: 6.98,
    vatApplicable: false, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-005", name: "RTGS Transfer Fee", product: "rtgs_transfer",
    channel: "all", customerTier: "corporate", feeType: "capped", percentage: 0.05, cap: 5000,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-006", name: "POS Merchant Discount Rate", product: "pos_transaction",
    channel: "pos", customerTier: "merchant", feeType: "capped", percentage: 0.50, cap: 1000,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-007", name: "SMS Alert Fee", product: "sms_alert",
    channel: "all", customerTier: "all", feeType: "flat", flatAmount: 4,
    vatApplicable: false, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-008", name: "ATM Withdrawal (other bank)", product: "atm_withdrawal",
    channel: "atm", customerTier: "all", feeType: "flat", flatAmount: 35,
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-009", name: "LC Issuance Commission", product: "letter_of_credit",
    channel: "trade_finance", customerTier: "corporate", feeType: "tiered",
    tiers: [
      { from: 0, to: 50_000_000, rate: 1.0 },
      { from: 50_000_000, to: 200_000_000, rate: 0.75 },
      { from: 200_000_000, to: Infinity, rate: 0.50 },
    ],
    vatApplicable: true, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
  {
    id: "FS-010", name: "Account Maintenance Fee", product: "account_maintenance",
    channel: "all", customerTier: "all", feeType: "flat", flatAmount: 1,
    vatApplicable: false, currency: "NGN", effectiveDate: "2026-01-01", status: "active",
  },
];

const feeTransactions: FeeTransaction[] = [
  { id: "FT-001", scheduleId: "FS-003", transactionId: "TXN-001", transactionAmount: 500_000, feeAmount: 50, vatAmount: 3.75, totalCharge: 53.75, currency: "NGN", customerId: "CUST-001", channel: "internet_banking", createdAt: "2026-05-09T08:05:00Z" },
  { id: "FT-002", scheduleId: "FS-005", transactionId: "TXN-002", transactionAmount: 25_000_000, feeAmount: 5000, vatAmount: 375, totalCharge: 5375, currency: "NGN", customerId: "CUST-002", channel: "corporate_banking", createdAt: "2026-05-09T10:00:00Z" },
  { id: "FT-003", scheduleId: "FS-006", transactionId: "POS-001", transactionAmount: 150_000, feeAmount: 750, vatAmount: 56.25, totalCharge: 806.25, currency: "NGN", customerId: "MERCH-001", channel: "pos", createdAt: "2026-05-09T12:30:00Z" },
  { id: "FT-004", scheduleId: "FS-004", transactionId: "USSD-001", transactionAmount: 10_000, feeAmount: 6.98, vatAmount: 0, totalCharge: 6.98, currency: "NGN", customerId: "CUST-005", channel: "ussd", createdAt: "2026-05-09T13:15:00Z" },
];

export function getFeeSchedules() { return feeSchedules; }
export function getFeeTransactions() { return feeTransactions; }

export function calculateFee(scheduleId: string, amount: number): { feeAmount: number; vatAmount: number; totalCharge: number } {
  const schedule = feeSchedules.find((s) => s.id === scheduleId);
  if (!schedule) return { feeAmount: 0, vatAmount: 0, totalCharge: 0 };

  let fee = 0;
  if (schedule.feeType === "flat") fee = schedule.flatAmount || 0;
  else if (schedule.feeType === "percentage") fee = amount * (schedule.percentage || 0) / 100;
  else if (schedule.feeType === "capped") {
    fee = Math.min(amount * (schedule.percentage || 0) / 100, schedule.cap || Infinity);
  } else if (schedule.feeType === "tiered" && schedule.tiers) {
    let remaining = amount;
    for (const tier of schedule.tiers) {
      const tierAmount = Math.min(remaining, tier.to - tier.from);
      if (tierAmount <= 0) break;
      fee += tierAmount * tier.rate / 100;
      remaining -= tierAmount;
    }
  }

  fee = Math.round(fee * 100) / 100;
  const vat = schedule.vatApplicable ? Math.round(fee * 0.075 * 100) / 100 : 0;
  return { feeAmount: fee, vatAmount: vat, totalCharge: Math.round((fee + vat) * 100) / 100 };
}

export function getFeeSummary() {
  const totalFees = feeTransactions.reduce((s, t) => s + t.feeAmount, 0);
  const totalVAT = feeTransactions.reduce((s, t) => s + t.vatAmount, 0);
  const byChannel: Record<string, number> = {};
  for (const t of feeTransactions) {
    byChannel[t.channel] = (byChannel[t.channel] || 0) + t.totalCharge;
  }
  return { totalFees, totalVAT, totalRevenue: totalFees + totalVAT, transactions: feeTransactions.length, byChannel };
}
