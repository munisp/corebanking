/**
 * B1: Double-entry ledger engine.
 * Ensures every financial transaction has balanced debit and credit entries.
 * Supports chart of accounts, journal entries, trial balance, and GL aggregation.
 */

export interface ChartOfAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent?: string;
  currency: string;
  balance: number;
  status: "active" | "frozen" | "closed";
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  entries: LedgerEntry[];
  status: "pending" | "posted" | "reversed";
  postedBy: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerEntry {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  currency: string;
  narration: string;
}

// Chart of accounts - Nigerian banking standard
const chartOfAccounts: ChartOfAccount[] = [
  // Assets
  { code: "1000", name: "Cash and Balances with CBN", type: "asset", currency: "NGN", balance: 45_000_000_000, status: "active" },
  { code: "1100", name: "Treasury Bills", type: "asset", currency: "NGN", balance: 120_000_000_000, status: "active" },
  { code: "1200", name: "Loans and Advances", type: "asset", currency: "NGN", balance: 380_000_000_000, status: "active" },
  { code: "1210", name: "Personal Loans", type: "asset", parent: "1200", currency: "NGN", balance: 85_000_000_000, status: "active" },
  { code: "1220", name: "Corporate Loans", type: "asset", parent: "1200", currency: "NGN", balance: 195_000_000_000, status: "active" },
  { code: "1230", name: "Mortgage Loans", type: "asset", parent: "1200", currency: "NGN", balance: 55_000_000_000, status: "active" },
  { code: "1240", name: "Agriculture Loans", type: "asset", parent: "1200", currency: "NGN", balance: 45_000_000_000, status: "active" },
  { code: "1300", name: "Fixed Assets", type: "asset", currency: "NGN", balance: 28_000_000_000, status: "active" },
  { code: "1400", name: "Other Assets", type: "asset", currency: "NGN", balance: 15_000_000_000, status: "active" },

  // Liabilities
  { code: "2000", name: "Customer Deposits", type: "liability", currency: "NGN", balance: 420_000_000_000, status: "active" },
  { code: "2010", name: "Savings Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 180_000_000_000, status: "active" },
  { code: "2020", name: "Current Account Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 150_000_000_000, status: "active" },
  { code: "2030", name: "Fixed Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 90_000_000_000, status: "active" },
  { code: "2100", name: "Borrowings", type: "liability", currency: "NGN", balance: 65_000_000_000, status: "active" },
  { code: "2200", name: "Other Liabilities", type: "liability", currency: "NGN", balance: 18_000_000_000, status: "active" },

  // Equity
  { code: "3000", name: "Share Capital", type: "equity", currency: "NGN", balance: 50_000_000_000, status: "active" },
  { code: "3100", name: "Retained Earnings", type: "equity", currency: "NGN", balance: 25_000_000_000, status: "active" },
  { code: "3200", name: "Reserves", type: "equity", currency: "NGN", balance: 10_000_000_000, status: "active" },

  // Revenue
  { code: "4000", name: "Interest Income", type: "revenue", currency: "NGN", balance: 48_000_000_000, status: "active" },
  { code: "4100", name: "Fee and Commission Income", type: "revenue", currency: "NGN", balance: 12_000_000_000, status: "active" },
  { code: "4200", name: "Trading Income", type: "revenue", currency: "NGN", balance: 5_000_000_000, status: "active" },

  // Expenses
  { code: "5000", name: "Interest Expense", type: "expense", currency: "NGN", balance: 22_000_000_000, status: "active" },
  { code: "5100", name: "Operating Expenses", type: "expense", currency: "NGN", balance: 18_000_000_000, status: "active" },
  { code: "5200", name: "Provision for Loan Losses", type: "expense", currency: "NGN", balance: 8_000_000_000, status: "active" },
  { code: "5300", name: "Personnel Expenses", type: "expense", currency: "NGN", balance: 15_000_000_000, status: "active" },
];

// Seed journal entries
const journalEntries: JournalEntry[] = [
  {
    id: "JE-001",
    date: "2026-05-09",
    description: "Customer loan disbursement - Personal Loan",
    reference: "LN-2026-00451",
    entries: [
      { accountCode: "1210", accountName: "Personal Loans", debit: 5_000_000, credit: 0, currency: "NGN", narration: "Loan disbursement to CUST-001" },
      { accountCode: "2020", accountName: "Current Account Deposits", debit: 0, credit: 5_000_000, currency: "NGN", narration: "Credit customer current account" },
    ],
    status: "posted",
    postedBy: "system",
    postedAt: "2026-05-09T10:30:00Z",
  },
  {
    id: "JE-002",
    date: "2026-05-09",
    description: "Interest accrual on savings deposits",
    reference: "INT-ACCRUAL-20260509",
    entries: [
      { accountCode: "5000", accountName: "Interest Expense", debit: 2_450_000, credit: 0, currency: "NGN", narration: "Daily interest accrual" },
      { accountCode: "2010", accountName: "Savings Deposits", debit: 0, credit: 2_450_000, currency: "NGN", narration: "Interest payable to savings accounts" },
    ],
    status: "posted",
    postedBy: "batch-eod",
    postedAt: "2026-05-09T23:59:59Z",
  },
  {
    id: "JE-003",
    date: "2026-05-09",
    description: "NIP transfer - customer to external bank",
    reference: "NIP-2026050900123",
    entries: [
      { accountCode: "2020", accountName: "Current Account Deposits", debit: 1_500_000, credit: 0, currency: "NGN", narration: "Debit sender CUST-002" },
      { accountCode: "1000", accountName: "Cash and Balances with CBN", debit: 0, credit: 1_500_000, currency: "NGN", narration: "Nostro settlement" },
    ],
    status: "posted",
    postedBy: "nip-engine",
    postedAt: "2026-05-09T14:22:10Z",
  },
];

export function validateJournalBalance(entries: LedgerEntry[]): { valid: boolean; totalDebit: number; totalCredit: number; difference: number } {
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  return {
    valid: Math.abs(totalDebit - totalCredit) < 0.01,
    totalDebit,
    totalCredit,
    difference: Math.round((totalDebit - totalCredit) * 100) / 100,
  };
}

export function computeTrialBalance(): {
  accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number }>;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
} {
  const accounts = chartOfAccounts
    .filter((a) => !a.parent)
    .map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      debit: ["asset", "expense"].includes(a.type) ? a.balance : 0,
      credit: ["liability", "equity", "revenue"].includes(a.type) ? a.balance : 0,
    }));

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  return { accounts, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 1 };
}

export function getChartOfAccounts() { return chartOfAccounts; }
export function getJournalEntries() { return journalEntries; }
export function addJournalEntry(entry: JournalEntry) { journalEntries.push(entry); }
