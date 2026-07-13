/**
 * D5: Fraud detection engine — rule-based and ML-ready transaction scoring.
 * Real-time transaction screening with configurable rules, velocity checks,
 * geo-anomaly detection, and device fingerprinting.
 */

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  category: "velocity" | "amount" | "geo" | "behavior" | "device" | "pattern";
  severity: "low" | "medium" | "high" | "critical";
  threshold: Record<string, number | string>;
  action: "flag" | "block" | "otp" | "review";
  enabled: boolean;
  hitCount: number;
  lastTriggered?: string;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  customerId: string;
  ruleId: string;
  ruleName: string;
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  details: string;
  action: "flagged" | "blocked" | "otp_required" | "under_review" | "cleared";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

const fraudRules: FraudRule[] = [
  { id: "FR-001", name: "High-value single transaction", description: "Transaction exceeds ₦10M in a single transfer", category: "amount", severity: "high", threshold: { maxAmount: 10_000_000, currency: "NGN" }, action: "otp", enabled: true, hitCount: 47, lastTriggered: "2026-05-09T13:22:00Z" },
  { id: "FR-002", name: "Velocity check — 5 transactions in 10 minutes", description: "Unusually rapid succession of transactions from same account", category: "velocity", severity: "medium", threshold: { maxTransactions: 5, windowMinutes: 10 }, action: "flag", enabled: true, hitCount: 123, lastTriggered: "2026-05-09T14:15:00Z" },
  { id: "FR-003", name: "Cross-border velocity", description: "More than 3 international transfers in 24 hours", category: "velocity", severity: "high", threshold: { maxTransfers: 3, windowHours: 24, type: "international" }, action: "block", enabled: true, hitCount: 12, lastTriggered: "2026-05-08T22:00:00Z" },
  { id: "FR-004", name: "New device login + transfer", description: "Transfer initiated from unrecognized device within 1 hour of first login", category: "device", severity: "high", threshold: { loginToTransferMinutes: 60 }, action: "otp", enabled: true, hitCount: 89, lastTriggered: "2026-05-09T11:30:00Z" },
  { id: "FR-005", name: "Unusual time transaction", description: "Transaction between 1AM-5AM local time", category: "behavior", severity: "low", threshold: { startHour: 1, endHour: 5 }, action: "flag", enabled: true, hitCount: 342, lastTriggered: "2026-05-09T03:45:00Z" },
  { id: "FR-006", name: "Account drain pattern", description: "Multiple transfers emptying >80% of account balance within 24 hours", category: "pattern", severity: "critical", threshold: { drainPercentage: 80, windowHours: 24 }, action: "block", enabled: true, hitCount: 5, lastTriggered: "2026-05-07T16:00:00Z" },
  { id: "FR-007", name: "Geo-anomaly — impossible travel", description: "Transactions from 2+ countries within physically impossible travel time", category: "geo", severity: "critical", threshold: { minKmPerHour: 900 }, action: "block", enabled: true, hitCount: 3, lastTriggered: "2026-04-28T09:00:00Z" },
  { id: "FR-008", name: "Dormant account activation", description: "Large transaction on account dormant >180 days", category: "behavior", severity: "medium", threshold: { dormantDays: 180, minAmount: 500_000 }, action: "review", enabled: true, hitCount: 18, lastTriggered: "2026-05-06T10:00:00Z" },
];

const fraudAlerts: FraudAlert[] = [
  { id: "FA-001", transactionId: "TXN-50001", customerId: "CUST-099", ruleId: "FR-001", ruleName: "High-value single transaction", riskScore: 72, severity: "high", details: "₦15M NIP transfer to new beneficiary (first-time payee)", action: "otp_required", createdAt: "2026-05-09T13:22:00Z" },
  { id: "FA-002", transactionId: "TXN-50002", customerId: "CUST-045", ruleId: "FR-002", ruleName: "Velocity check — 5 transactions in 10 minutes", riskScore: 55, severity: "medium", details: "7 POS transactions in 8 minutes across 3 merchants in Ikeja", action: "flagged", createdAt: "2026-05-09T14:15:00Z" },
  { id: "FA-003", transactionId: "TXN-50003", customerId: "CUST-012", ruleId: "FR-006", ruleName: "Account drain pattern", riskScore: 95, severity: "critical", details: "4 transfers totaling ₦45M (92% of balance) to 3 different accounts in 2 hours", action: "blocked", createdAt: "2026-05-07T16:00:00Z", resolvedAt: "2026-05-07T16:30:00Z", resolvedBy: "fraud-team-lead" },
];

export function scoreTransaction(amount: number, channel: string, hour: number, isNewDevice: boolean, isNewBeneficiary: boolean): { riskScore: number; triggeredRules: string[]; action: string } {
  let score = 0;
  const triggered: string[] = [];

  if (amount > 10_000_000) { score += 30; triggered.push("FR-001"); }
  if (hour >= 1 && hour <= 5) { score += 10; triggered.push("FR-005"); }
  if (isNewDevice) { score += 20; triggered.push("FR-004"); }
  if (isNewBeneficiary && amount > 1_000_000) { score += 15; triggered.push("FR-001"); }

  let action = "allow";
  if (score >= 70) action = "block";
  else if (score >= 40) action = "otp";
  else if (score >= 20) action = "flag";

  return { riskScore: Math.min(score, 100), triggeredRules: Array.from(new Set(triggered)), action };
}

export function getFraudRules() { return fraudRules; }
export function getFraudAlerts() { return fraudAlerts; }
