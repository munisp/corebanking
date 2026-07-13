/**
 * B9: Reconciliation engine — GL, nostro, card settlement, inter-branch.
 * Automated matching with configurable tolerance, exception handling, and reporting.
 */

export interface ReconciliationRun {
  id: string;
  type: "gl_subledger" | "nostro" | "card_settlement" | "inter_branch" | "suspense";
  name: string;
  status: "running" | "completed" | "failed" | "pending_review";
  startedAt: string;
  completedAt?: string;
  sourceSystem: string;
  targetSystem: string;
  totalRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  matchRate: number;
  toleranceAmount: number;
  currency: string;
  exceptions: ReconciliationException[];
}

export interface ReconciliationException {
  id: string;
  type: "missing_source" | "missing_target" | "amount_mismatch" | "date_mismatch" | "duplicate";
  reference: string;
  sourceAmount?: number;
  targetAmount?: number;
  difference?: number;
  description: string;
  status: "open" | "investigating" | "resolved" | "escalated";
  assignedTo?: string;
  resolvedAt?: string;
}

const reconciliationRuns: ReconciliationRun[] = [
  {
    id: "REC-001", type: "nostro", name: "USD Nostro — Citibank (May 09)",
    status: "completed", startedAt: "2026-05-09T06:00:00Z", completedAt: "2026-05-09T06:15:00Z",
    sourceSystem: "Core Banking (GL)", targetSystem: "MT940 Statement",
    totalRecords: 1250, matchedRecords: 1243, unmatchedRecords: 7, matchRate: 99.44,
    toleranceAmount: 0.01, currency: "USD",
    exceptions: [
      { id: "EX-001", type: "missing_target", reference: "TXN-49850", sourceAmount: 15000, description: "Outbound wire not yet reflected on Citibank statement", status: "open" },
      { id: "EX-002", type: "amount_mismatch", reference: "TXN-49200", sourceAmount: 25000, targetAmount: 24999.50, difference: 0.50, description: "Rounding difference on FX conversion", status: "resolved", resolvedAt: "2026-05-09T10:00:00Z" },
    ],
  },
  {
    id: "REC-002", type: "gl_subledger", name: "Loans GL vs Loan Module (May 09)",
    status: "completed", startedAt: "2026-05-09T02:00:00Z", completedAt: "2026-05-09T02:30:00Z",
    sourceSystem: "General Ledger", targetSystem: "Loan Management System",
    totalRecords: 45000, matchedRecords: 44985, unmatchedRecords: 15, matchRate: 99.97,
    toleranceAmount: 1.00, currency: "NGN",
    exceptions: [
      { id: "EX-003", type: "amount_mismatch", reference: "LA-003", sourceAmount: 15000000, targetAmount: 14999500, difference: 500, description: "Interest accrual timing difference", status: "investigating", assignedTo: "Recon Team" },
    ],
  },
  {
    id: "REC-003", type: "card_settlement", name: "Visa Settlement (May 08)",
    status: "completed", startedAt: "2026-05-09T04:00:00Z", completedAt: "2026-05-09T04:45:00Z",
    sourceSystem: "Card Switch", targetSystem: "Visa Settlement File",
    totalRecords: 85000, matchedRecords: 84950, unmatchedRecords: 50, matchRate: 99.94,
    toleranceAmount: 10.00, currency: "NGN",
    exceptions: [
      { id: "EX-004", type: "missing_source", reference: "VISA-2026050800450", targetAmount: 35000, description: "POS transaction not captured in card switch — merchant terminal timeout", status: "escalated", assignedTo: "Card Operations" },
      { id: "EX-005", type: "duplicate", reference: "VISA-2026050800128", sourceAmount: 12500, description: "Duplicate reversal posted — double credit to customer", status: "open" },
    ],
  },
  {
    id: "REC-004", type: "inter_branch", name: "Inter-branch Transfers (May 09)",
    status: "completed", startedAt: "2026-05-09T01:00:00Z", completedAt: "2026-05-09T01:10:00Z",
    sourceSystem: "Branch A Entries", targetSystem: "Branch B Entries",
    totalRecords: 3200, matchedRecords: 3200, unmatchedRecords: 0, matchRate: 100.00,
    toleranceAmount: 0, currency: "NGN", exceptions: [],
  },
  {
    id: "REC-005", type: "suspense", name: "Suspense Account Clearance (May 09)",
    status: "pending_review", startedAt: "2026-05-09T05:00:00Z", completedAt: "2026-05-09T05:20:00Z",
    sourceSystem: "Suspense GL", targetSystem: "Transaction Log",
    totalRecords: 890, matchedRecords: 845, unmatchedRecords: 45, matchRate: 94.94,
    toleranceAmount: 100, currency: "NGN",
    exceptions: [
      { id: "EX-006", type: "missing_target", reference: "SUSP-20260509-001", sourceAmount: 2500000, description: "NIP credit with no matching customer account — BVN lookup failed", status: "open" },
    ],
  },
];

export function getReconciliationRuns() { return reconciliationRuns; }
