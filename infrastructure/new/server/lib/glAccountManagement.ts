/**
 * General Ledger account management — chart of accounts, trial balance,
 * balance sheet, income statement, GL inquiry.
 */

export interface GLAccount {
  id: string;
  accountCode: string;
  accountName: string;
  category: "asset" | "liability" | "equity" | "revenue" | "expense";
  subcategory: string;
  currency: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  status: "active" | "frozen" | "closed";
  parentCode?: string;
  level: number;
  isHeader: boolean;
}

const glAccounts: GLAccount[] = [
  { id: "GL-001", accountCode: "1000", accountName: "Cash and Cash Equivalents", category: "asset", subcategory: "Current Assets", currency: "NGN", debitBalance: 45_000_000_000, creditBalance: 0, netBalance: 45_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-002", accountCode: "1001", accountName: "Cash on Hand — Vault", category: "asset", subcategory: "Current Assets", currency: "NGN", debitBalance: 8_500_000_000, creditBalance: 0, netBalance: 8_500_000_000, status: "active", parentCode: "1000", level: 2, isHeader: false },
  { id: "GL-003", accountCode: "1002", accountName: "Cash at CBN", category: "asset", subcategory: "Current Assets", currency: "NGN", debitBalance: 22_000_000_000, creditBalance: 0, netBalance: 22_000_000_000, status: "active", parentCode: "1000", level: 2, isHeader: false },
  { id: "GL-004", accountCode: "1003", accountName: "Balances with Other Banks", category: "asset", subcategory: "Current Assets", currency: "NGN", debitBalance: 14_500_000_000, creditBalance: 0, netBalance: 14_500_000_000, status: "active", parentCode: "1000", level: 2, isHeader: false },
  { id: "GL-005", accountCode: "1100", accountName: "Loans and Advances", category: "asset", subcategory: "Earning Assets", currency: "NGN", debitBalance: 250_000_000_000, creditBalance: 0, netBalance: 250_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-006", accountCode: "1101", accountName: "Term Loans — Corporate", category: "asset", subcategory: "Earning Assets", currency: "NGN", debitBalance: 150_000_000_000, creditBalance: 0, netBalance: 150_000_000_000, status: "active", parentCode: "1100", level: 2, isHeader: false },
  { id: "GL-007", accountCode: "1102", accountName: "Term Loans — Retail", category: "asset", subcategory: "Earning Assets", currency: "NGN", debitBalance: 65_000_000_000, creditBalance: 0, netBalance: 65_000_000_000, status: "active", parentCode: "1100", level: 2, isHeader: false },
  { id: "GL-008", accountCode: "1103", accountName: "Overdrafts", category: "asset", subcategory: "Earning Assets", currency: "NGN", debitBalance: 35_000_000_000, creditBalance: 0, netBalance: 35_000_000_000, status: "active", parentCode: "1100", level: 2, isHeader: false },
  { id: "GL-009", accountCode: "1200", accountName: "Investment Securities", category: "asset", subcategory: "Earning Assets", currency: "NGN", debitBalance: 180_000_000_000, creditBalance: 0, netBalance: 180_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-010", accountCode: "1300", accountName: "Fixed Assets", category: "asset", subcategory: "Non-Current Assets", currency: "NGN", debitBalance: 25_000_000_000, creditBalance: 0, netBalance: 25_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-011", accountCode: "2000", accountName: "Customer Deposits", category: "liability", subcategory: "Current Liabilities", currency: "NGN", debitBalance: 0, creditBalance: 380_000_000_000, netBalance: -380_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-012", accountCode: "2001", accountName: "Demand Deposits", category: "liability", subcategory: "Current Liabilities", currency: "NGN", debitBalance: 0, creditBalance: 180_000_000_000, netBalance: -180_000_000_000, status: "active", parentCode: "2000", level: 2, isHeader: false },
  { id: "GL-013", accountCode: "2002", accountName: "Savings Deposits", category: "liability", subcategory: "Current Liabilities", currency: "NGN", debitBalance: 0, creditBalance: 120_000_000_000, netBalance: -120_000_000_000, status: "active", parentCode: "2000", level: 2, isHeader: false },
  { id: "GL-014", accountCode: "2003", accountName: "Fixed Deposits", category: "liability", subcategory: "Current Liabilities", currency: "NGN", debitBalance: 0, creditBalance: 80_000_000_000, netBalance: -80_000_000_000, status: "active", parentCode: "2000", level: 2, isHeader: false },
  { id: "GL-015", accountCode: "2100", accountName: "Interbank Borrowings", category: "liability", subcategory: "Financial Liabilities", currency: "NGN", debitBalance: 0, creditBalance: 45_000_000_000, netBalance: -45_000_000_000, status: "active", level: 1, isHeader: false },
  { id: "GL-016", accountCode: "3000", accountName: "Shareholders Equity", category: "equity", subcategory: "Capital", currency: "NGN", debitBalance: 0, creditBalance: 75_000_000_000, netBalance: -75_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-017", accountCode: "4000", accountName: "Interest Income", category: "revenue", subcategory: "Operating Income", currency: "NGN", debitBalance: 0, creditBalance: 52_000_000_000, netBalance: -52_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-018", accountCode: "4100", accountName: "Fee and Commission Income", category: "revenue", subcategory: "Non-Interest Income", currency: "NGN", debitBalance: 0, creditBalance: 18_500_000_000, netBalance: -18_500_000_000, status: "active", level: 1, isHeader: false },
  { id: "GL-019", accountCode: "5000", accountName: "Interest Expense", category: "expense", subcategory: "Operating Expenses", currency: "NGN", debitBalance: 22_000_000_000, creditBalance: 0, netBalance: 22_000_000_000, status: "active", level: 1, isHeader: true },
  { id: "GL-020", accountCode: "5100", accountName: "Operating Expenses", category: "expense", subcategory: "Operating Expenses", currency: "NGN", debitBalance: 15_000_000_000, creditBalance: 0, netBalance: 15_000_000_000, status: "active", level: 1, isHeader: true },
];

export function getGLAccounts() { return glAccounts; }

export function getTrialBalance() {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of glAccounts) {
    totalDebit += a.debitBalance;
    creditTotal(a);
  }
  function creditTotal(a: GLAccount) { totalCredit += a.creditBalance; }
  return { accounts: glAccounts.filter((a) => !a.isHeader), totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export function getBalanceSheet() {
  const assets = glAccounts.filter((a) => a.category === "asset");
  const liabilities = glAccounts.filter((a) => a.category === "liability");
  const equity = glAccounts.filter((a) => a.category === "equity");
  const totalAssets = assets.reduce((s, a) => s + a.netBalance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.netBalance), 0);
  const totalEquity = equity.reduce((s, a) => s + Math.abs(a.netBalance), 0);
  return { totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity, asOf: "2026-05-09" };
}
