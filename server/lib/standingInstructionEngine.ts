/**
 * Standing instruction engine — scheduled payments, recurring transfers,
 * sweep instructions, auto-debit mandates, payment reminders.
 */

export interface StandingInstruction {
  id: string;
  customerId: string;
  customerName: string;
  type: "recurring_transfer" | "bill_payment" | "loan_repayment" | "sweep" | "auto_savings" | "salary_payment";
  sourceAccount: string;
  destinationAccount: string;
  destinationBank?: string;
  amount: number;
  currency: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually";
  nextExecutionDate: string;
  lastExecutionDate?: string;
  executionCount: number;
  totalExecuted: number;
  maxExecutions?: number;
  startDate: string;
  endDate?: string;
  status: "active" | "paused" | "completed" | "failed" | "cancelled";
  failureReason?: string;
  description: string;
}

const instructions: StandingInstruction[] = [
  { id: "SI-001", customerId: "CUST-001", customerName: "Aisha Mohammed", type: "recurring_transfer", sourceAccount: "5400001234", destinationAccount: "0123456789", destinationBank: "GTBank", amount: 150_000, currency: "NGN", frequency: "monthly", nextExecutionDate: "2026-06-01", lastExecutionDate: "2026-05-01", executionCount: 5, totalExecuted: 750_000, startDate: "2026-01-01", status: "active", description: "Monthly rent payment" },
  { id: "SI-002", customerId: "CUST-002", customerName: "Ibrahim Musa", type: "loan_repayment", sourceAccount: "5400005678", destinationAccount: "INTERNAL-LN-002", amount: 2_500_000, currency: "NGN", frequency: "monthly", nextExecutionDate: "2026-06-15", lastExecutionDate: "2026-05-15", executionCount: 8, totalExecuted: 20_000_000, maxExecutions: 36, startDate: "2025-10-15", status: "active", description: "Term loan EMI — 36 months" },
  { id: "SI-003", customerId: "CUST-010", customerName: "Pinnacle Holdings Ltd", type: "salary_payment", sourceAccount: "5400100200", destinationAccount: "BATCH-SALARY", amount: 85_000_000, currency: "NGN", frequency: "monthly", nextExecutionDate: "2026-05-28", lastExecutionDate: "2026-04-28", executionCount: 12, totalExecuted: 1_020_000_000, startDate: "2025-05-28", status: "active", description: "Monthly payroll — 450 employees" },
  { id: "SI-004", customerId: "CUST-005", customerName: "Fatimah Abdullahi", type: "auto_savings", sourceAccount: "5400003456", destinationAccount: "5400003457-SAV", amount: 25_000, currency: "NGN", frequency: "weekly", nextExecutionDate: "2026-05-12", lastExecutionDate: "2026-05-05", executionCount: 18, totalExecuted: 450_000, startDate: "2026-01-06", status: "active", description: "Weekly savings — target ₦1.3M" },
  { id: "SI-005", customerId: "CUST-012", customerName: "Dangote Cement PLC", type: "sweep", sourceAccount: "5400500100", destinationAccount: "5400500200-INVEST", amount: 0, currency: "NGN", frequency: "daily", nextExecutionDate: "2026-05-10", lastExecutionDate: "2026-05-09", executionCount: 95, totalExecuted: 45_000_000_000, startDate: "2026-02-01", status: "active", description: "Daily sweep — balance above ₦500M to investment account" },
  { id: "SI-006", customerId: "CUST-003", customerName: "Zenith Construction Ltd", type: "bill_payment", sourceAccount: "5400009012", destinationAccount: "EKEDC-CUST-9012", amount: 450_000, currency: "NGN", frequency: "monthly", nextExecutionDate: "2026-06-05", lastExecutionDate: "2026-05-05", executionCount: 3, totalExecuted: 1_350_000, startDate: "2026-03-05", status: "active", description: "EKEDC electricity payment — Lekki office" },
  { id: "SI-007", customerId: "CUST-015", customerName: "Amara Okonkwo", type: "recurring_transfer", sourceAccount: "5400007890", destinationAccount: "2098765432", destinationBank: "Access Bank", amount: 50_000, currency: "NGN", frequency: "monthly", nextExecutionDate: "2026-05-10", lastExecutionDate: "2026-04-10", executionCount: 2, totalExecuted: 100_000, startDate: "2026-03-10", status: "failed", failureReason: "Insufficient funds — balance ₦32,400", description: "Monthly contribution to family fund" },
];

export function getStandingInstructions() { return instructions; }

export function getStandingInstructionStats() {
  const byType: Record<string, number> = {};
  const byFrequency: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalScheduledMonthly = 0;
  for (const si of instructions) {
    byType[si.type] = (byType[si.type] || 0) + 1;
    byFrequency[si.frequency] = (byFrequency[si.frequency] || 0) + 1;
    byStatus[si.status] = (byStatus[si.status] || 0) + 1;
    if (si.status === "active" && si.frequency === "monthly") totalScheduledMonthly += si.amount;
  }
  return { total: instructions.length, activeCount: instructions.filter((s) => s.status === "active").length, failedCount: instructions.filter((s) => s.status === "failed").length, totalScheduledMonthly, byType, byFrequency, byStatus };
}
