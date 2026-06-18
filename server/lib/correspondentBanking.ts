/**
 * Correspondent banking — nostro/vostro accounts, SWIFT RMA relationships,
 * payment corridors, trade finance correspondents.
 */

export interface CorrespondentBank {
  id: string;
  bankName: string;
  swiftBic: string;
  country: string;
  city: string;
  relationship: "nostro" | "vostro" | "both";
  accountNumber: string;
  currency: string;
  balance: number;
  creditLine: number;
  rmaStatus: "active" | "pending" | "expired" | "suspended";
  rmaExpiry: string;
  services: string[];
  lastActivity: string;
  annualVolume: number;
  status: "active" | "dormant" | "under_review";
}

const correspondents: CorrespondentBank[] = [
  { id: "CB-001", bankName: "Citibank N.A.", swiftBic: "CITIUS33", country: "United States", city: "New York", relationship: "nostro", accountNumber: "36829104", currency: "USD", balance: 85_000_000, creditLine: 200_000_000, rmaStatus: "active", rmaExpiry: "2027-12-31", services: ["payments", "trade_finance", "fx", "cash_management"], lastActivity: "2026-05-09", annualVolume: 2_400_000_000, status: "active" },
  { id: "CB-002", bankName: "Standard Chartered Bank", swiftBic: "SCBLGB2L", country: "United Kingdom", city: "London", relationship: "nostro", accountNumber: "GB82SCBL6091", currency: "GBP", balance: 12_000_000, creditLine: 50_000_000, rmaStatus: "active", rmaExpiry: "2027-06-30", services: ["payments", "trade_finance", "fx"], lastActivity: "2026-05-08", annualVolume: 450_000_000, status: "active" },
  { id: "CB-003", bankName: "Deutsche Bank AG", swiftBic: "DEUTDEFF", country: "Germany", city: "Frankfurt", relationship: "nostro", accountNumber: "DE89370400440532013000", currency: "EUR", balance: 18_000_000, creditLine: 80_000_000, rmaStatus: "active", rmaExpiry: "2027-09-30", services: ["payments", "trade_finance", "fx", "securities"], lastActivity: "2026-05-09", annualVolume: 680_000_000, status: "active" },
  { id: "CB-004", bankName: "Emirates NBD", swiftBic: "EABORUGS", country: "UAE", city: "Dubai", relationship: "nostro", accountNumber: "AE070331234567890123456", currency: "USD", balance: 22_000_000, creditLine: 100_000_000, rmaStatus: "active", rmaExpiry: "2027-03-31", services: ["payments", "trade_finance"], lastActivity: "2026-05-07", annualVolume: 320_000_000, status: "active" },
  { id: "CB-005", bankName: "ICBC", swiftBic: "ICBKCNBJ", country: "China", city: "Beijing", relationship: "nostro", accountNumber: "CN1234567890", currency: "CNY", balance: 150_000_000, creditLine: 500_000_000, rmaStatus: "active", rmaExpiry: "2027-12-31", services: ["payments", "trade_finance", "fx"], lastActivity: "2026-05-06", annualVolume: 890_000_000, status: "active" },
  { id: "CB-006", bankName: "First Bank of Nigeria", swiftBic: "FBNINGLA", country: "Nigeria", city: "Lagos", relationship: "vostro", accountNumber: "2033456789", currency: "NGN", balance: 5_200_000_000, creditLine: 0, rmaStatus: "active", rmaExpiry: "2027-12-31", services: ["payments", "clearing"], lastActivity: "2026-05-09", annualVolume: 15_000_000_000, status: "active" },
  { id: "CB-007", bankName: "Zenith Bank PLC", swiftBic: "ZEABORUGS", country: "Nigeria", city: "Lagos", relationship: "vostro", accountNumber: "1014567890", currency: "NGN", balance: 3_800_000_000, creditLine: 0, rmaStatus: "active", rmaExpiry: "2027-12-31", services: ["payments", "clearing", "trade_finance"], lastActivity: "2026-05-09", annualVolume: 12_000_000_000, status: "active" },
];

export function getCorrespondentBanks() { return correspondents; }

export function getCorrespondentSummary() {
  const byRelationship: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  let totalAnnualVolume = 0;
  for (const cb of correspondents) {
    byRelationship[cb.relationship] = (byRelationship[cb.relationship] || 0) + 1;
    byCountry[cb.country] = (byCountry[cb.country] || 0) + 1;
    totalAnnualVolume += cb.annualVolume;
  }
  return { total: correspondents.length, activeRMA: correspondents.filter((c) => c.rmaStatus === "active").length, totalAnnualVolume, byRelationship, byCountry };
}
