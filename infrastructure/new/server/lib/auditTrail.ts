/**
 * D4: Comprehensive audit trail — immutable event log for all system actions.
 * Supports filtering, search, export, and regulatory compliance reporting.
 */

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "user" | "service" | "system" | "admin";
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  channel: string;
  result: "success" | "failure" | "denied";
  riskLevel: "low" | "medium" | "high" | "critical";
  correlationId?: string;
}

const auditEntries: AuditEntry[] = [
  {
    id: "AUD-001", timestamp: "2026-05-09T08:00:01Z", actor: "CUST-001", actorType: "user",
    action: "login", resource: "session", resourceId: "SES-001",
    details: { method: "password", mfa: true, device: "iPhone 15 Pro" },
    ipAddress: "154.120.45.12", userAgent: "54Bank Mobile/3.2.1", channel: "mobile",
    result: "success", riskLevel: "low", correlationId: "corr-001",
  },
  {
    id: "AUD-002", timestamp: "2026-05-09T08:05:00Z", actor: "CUST-001", actorType: "user",
    action: "transfer.initiate", resource: "transaction", resourceId: "TXN-001",
    details: { amount: 500000, currency: "NGN", destinationBank: "First Bank", type: "nip" },
    ipAddress: "154.120.45.12", channel: "mobile",
    result: "success", riskLevel: "medium", correlationId: "corr-002",
  },
  {
    id: "AUD-003", timestamp: "2026-05-09T08:05:01Z", actor: "fraud-engine", actorType: "service",
    action: "fraud.screening", resource: "transaction", resourceId: "TXN-001",
    details: { riskScore: 35, triggeredRules: [], action: "allow" },
    channel: "internal",
    result: "success", riskLevel: "low", correlationId: "corr-002",
  },
  {
    id: "AUD-004", timestamp: "2026-05-09T09:15:00Z", actor: "ADMIN-001", actorType: "admin",
    action: "user.role.update", resource: "user", resourceId: "CUST-099",
    details: { previousRoles: ["customer"], newRoles: ["customer", "premium"], reason: "Tier upgrade" },
    ipAddress: "10.0.1.50", channel: "admin_portal",
    result: "success", riskLevel: "high", correlationId: "corr-003",
  },
  {
    id: "AUD-005", timestamp: "2026-05-09T10:30:00Z", actor: "CUST-045", actorType: "user",
    action: "transfer.initiate", resource: "transaction", resourceId: "TXN-002",
    details: { amount: 15000000, currency: "NGN", destinationBank: "GTBank", type: "nip" },
    ipAddress: "41.58.120.33", channel: "internet_banking",
    result: "denied", riskLevel: "critical", correlationId: "corr-004",
  },
  {
    id: "AUD-006", timestamp: "2026-05-09T10:30:01Z", actor: "fraud-engine", actorType: "service",
    action: "fraud.block", resource: "transaction", resourceId: "TXN-002",
    details: { riskScore: 85, triggeredRules: ["FR-001", "FR-004"], action: "block", reason: "High-value + new device" },
    channel: "internal",
    result: "success", riskLevel: "critical", correlationId: "corr-004",
  },
  {
    id: "AUD-007", timestamp: "2026-05-09T11:00:00Z", actor: "system", actorType: "system",
    action: "batch.eod", resource: "batch_job", resourceId: "BATCH-2026-05-09",
    details: { totalAccounts: 4500000, interestAccrued: 8500000, dormancyChecked: 4500000, duration: "45m 12s" },
    channel: "scheduler",
    result: "success", riskLevel: "low",
  },
  {
    id: "AUD-008", timestamp: "2026-05-09T12:00:00Z", actor: "TELLER-005", actorType: "user",
    action: "cash.deposit", resource: "transaction", resourceId: "TXN-003",
    details: { amount: 5000000, currency: "NGN", accountNumber: "0123456789", denominations: { "1000": 4000, "500": 2000 } },
    ipAddress: "10.0.2.15", channel: "branch",
    result: "success", riskLevel: "medium", correlationId: "corr-005",
  },
  {
    id: "AUD-009", timestamp: "2026-05-09T13:00:00Z", actor: "CUST-012", actorType: "user",
    action: "card.pin.change", resource: "card", resourceId: "CARD-012-001",
    details: { cardType: "debit", lastFour: "4521" },
    ipAddress: "154.120.88.90", channel: "atm",
    result: "success", riskLevel: "medium", correlationId: "corr-006",
  },
  {
    id: "AUD-010", timestamp: "2026-05-09T14:00:00Z", actor: "ADMIN-002", actorType: "admin",
    action: "config.update", resource: "system_config", resourceId: "interest-rate-matrix",
    details: { field: "personal_loan_rate", oldValue: 24, newValue: 22, effectiveDate: "2026-06-01" },
    ipAddress: "10.0.1.52", channel: "admin_portal",
    result: "success", riskLevel: "high", correlationId: "corr-007",
  },
];

export function getAuditEntries() { return auditEntries; }
export function getAuditStats() {
  const byResult = { success: 0, failure: 0, denied: 0 };
  const byRisk = { low: 0, medium: 0, high: 0, critical: 0 };
  const byChannel: Record<string, number> = {};
  const byAction: Record<string, number> = {};

  for (const entry of auditEntries) {
    byResult[entry.result]++;
    byRisk[entry.riskLevel]++;
    byChannel[entry.channel] = (byChannel[entry.channel] || 0) + 1;
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }

  return { total: auditEntries.length, byResult, byRisk, byChannel, byAction };
}
