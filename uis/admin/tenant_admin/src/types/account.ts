// ─── Account Opening ─────────────────────────────────────────────────────────

export type AccountProductType = 'primary' | 'savings' | 'current';
export type AccountCurrencyType = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'GHS';
export type AccountTier = 'tier1' | 'tier2' | 'tier3';
export type ApplicationStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

export interface AccountApplication {
  id: number | string;
  name: string;
  account_number: string;
  account_type?: AccountProductType;
  account_currency?: AccountCurrencyType;
  tier?: AccountTier | string;
  status: ApplicationStatus | string;
  balance?: number;
  balance_kobo?: number;
  keycloak_id?: string;
  tenant_id?: string;
  ledger_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface AccountApplicationListResponse {
  items: AccountApplication[];
  total: number;
  page: number;
  limit: number;
}

export interface AccountOpeningStats {
  total: number;
  [key: string]: unknown;
}

export interface CreateAccountApplicationPayload {
  name: string;
  account_type: AccountProductType;
  account_currency?: AccountCurrencyType;
  tier?: AccountTier;
}

// ─── Account Closure ─────────────────────────────────────────────────────────

export type ClosureStatus = 'pending' | 'in_review' | 'approved' | 'completed' | 'rejected';
export type ClosureType = 'customer_request' | 'regulatory' | 'dormancy' | 'fraud' | 'deceased';

export interface ClosureRequest {
  id: string;
  accountId?: string;
  accountName?: string;
  accountType?: string;
  status: ClosureStatus | string;
  balance?: number;
  reason?: string;
  closureType?: ClosureType;
  requestedBy?: string;
  requestedAt?: string;
  closedAt?: string;
  [key: string]: unknown;
}

export interface ClosureListResponse {
  items: ClosureRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface ClosureStats {
  total: number;
  [key: string]: unknown;
}

export interface CreateClosureRequestPayload {
  accountId: string;
  accountName?: string;
  closureType: ClosureType;
  reason: string;
  requestedBy?: string;
}

// ─── Account Statements ───────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'dormant' | 'frozen' | 'closed';
export type AccountType = 'savings' | 'current' | 'domiciliary' | 'fixed_deposit';

export interface StatementAccount {
  accountNumber: string;
  accountName: string;
  accountType: AccountType | string;
  currency: string;
  openingDate: string;
  currentBalance: number;
  availableBalance: number;
  lienAmount: number;
  status: AccountStatus | string;
  branchCode: string;
}

export interface StatementAccountListResponse {
  items: StatementAccount[];
  total: number;
}

export interface StatementTransaction {
  id: string;
  accountNumber: string;
  date: string;
  valueDate: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  channel: string;
  category: string;
}

export interface StatementTransactionListResponse {
  items: StatementTransaction[];
  total: number;
}

export interface GenerateStatementPayload {
  accountNumber: string;
  startDate: string;
  endDate: string;
}

export interface StatementResponse {
  account: StatementAccount;
  period: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  transactions: StatementTransaction[];
  generatedAt: string;
}

export interface CategoryBreakdown {
  debit: number;
  credit: number;
}

export interface StatementSummary {
  accountNumber: string;
  period: { from: string; to: string };
  totalDebit: number;
  totalCredit: number;
  netMovement: number;
  transactionCount: number;
  averageBalance: number;
  categoryBreakdown: Record<string, CategoryBreakdown>;
  channelBreakdown: Record<string, number>;
}

export interface BalanceTrendPoint {
  date: string;
  balance: number;
}

export interface BalanceTrendResponse {
  accountNumber: string;
  dataPoints: BalanceTrendPoint[];
  count: number;
}

export interface LedgerTransaction {
  id: string;
  transaction_id: string;
  amount: string;
  currency: string;
  payer: string;
  payee: string;
  payer_name: string | null;
  payee_name: string | null;
  payer_account_number: string | null;
  payee_account_number: string | null;
  tag: string;
  status: string;
  note: string;
  ledger_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface LedgerTransactionListResponse {
  message: string;
  transactions: LedgerTransaction[];
}
