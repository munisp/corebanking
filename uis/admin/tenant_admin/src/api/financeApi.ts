/**
 * Finance & Accounting — Central API Registry
 *
 * Every Finance module API call is routed through the APISIX gateway.
 * Pattern: /<apisix-prefix>/<backend-path>
 * APISIX rewrites: /prefix/* → /* (strips prefix before forwarding to backend).
 *
 * ┌──────────────────────────────┬──────────────────────────┬─────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix            │ Backend Svc │ Port  │
 * ├──────────────────────────────┼──────────────────────────┼─────────────┼───────┤
 * │ /billing                     │ /tenant-billing          │ tenant-billing-go      │ 8257  │
 * │ /chart-of-accounts           │ /chart-of-accounts       │ chart-of-accounts-svc  │ 80    │
 * │ /gl-accounts                 │ /gl-engine               │ gl-engine-go           │ 8090  │
 * │ /fee-management              │ /fee-management          │ fee-management-go      │ 9268  │
 * │ /interest-accrual            │ /interest-accrual-engine │ interest-accrual-go    │ 8093  │
 * │ /interest-rate               │ /interest-rate-engine    │ interest-rate-go       │ 9278  │
 * │ /interest-computation        │ /interest                │ interest-computation-rs│ 8336  │
 * │ /fixed-assets                │ /fixed-assets            │ fixed-assets-go        │ 8191  │
 * │ /expense-mgmt                │ /expenses                │ expense-mgmt-go        │ 8192  │
 * │ /accounting-rules            │ /accounting-rules        │ accounting-rules-rs    │ 8209  │
 * │ /erp-integration             │ /erp                     │ erpnext-integration    │ 80    │
 * └──────────────────────────────┴──────────────────────────┴─────────────┴───────┘
 */

import apiClient from "@/services/api";

// ─── APISIX Gateway Prefixes ──────────────────────────────────────────────────
const GL_ENGINE            = "/gl-engine";               // gl-engine-go :8090
const FEE_MANAGEMENT       = "/fee-management";          // fee-management-go :9268
const INTEREST_ACCRUAL_SVC = "/interest-accrual-engine"; // interest-accrual-engine-go :8093
const INTEREST_RATE_SVC    = "/interest-rate-engine";    // interest-rate-engine-go :9278
const INTEREST_COMPUTATION = "/interest";                // interest-computation-rs :8336
const FIXED_ASSETS         = "/fixed-assets";            // fixed-assets-go :8191
const EXPENSE_MGMT         = "/expenses";                // expense-mgmt-go :8192
const ACCOUNTING_RULES     = "/accounting-rules";        // accounting-rules-rs :8209

// ─── Endpoint Map ─────────────────────────────────────────────────────────────
export const FINANCE_API = {
  GL: {
    accounts:     `${GL_ENGINE}/v1/gl/accounts`,
    journal:      `${GL_ENGINE}/v1/gl/journal`,
    trialBalance: `${GL_ENGINE}/v1/gl/trial-balance`,
    periodClose:  `${GL_ENGINE}/v1/gl/period-close`,
    efassGenerate:`${GL_ENGINE}/v1/gl/efass/generate`,
    efassMapping: `${GL_ENGINE}/v1/gl/efass/mapping`,
    cbnReturns:   `${GL_ENGINE}/v1/gl/cbn-returns`,
  },
  FEE: {
    // fee-management-go is currently a stub service — routes pending backend implementation
    rules:    `${FEE_MANAGEMENT}/v1/fee-rules`,
    ruleById: (id: string) => `${FEE_MANAGEMENT}/v1/fee-rules/${id}`,
    health:   `${FEE_MANAGEMENT}/healthz`,
  },
  INTEREST_ACCRUAL: {
    run:    `${INTEREST_ACCRUAL_SVC}/v1/interest/accrue`,
    health: `${INTEREST_ACCRUAL_SVC}/healthz`,
  },
  INTEREST_RATE: {
    // interest-rate-engine-go is currently a stub service — routes pending backend implementation
    rates:    `${INTEREST_RATE_SVC}/v1/rates`,
    rateById: (id: string) => `${INTEREST_RATE_SVC}/v1/rates/${id}`,
    health:   `${INTEREST_RATE_SVC}/healthz`,
  },
  INTEREST_COMPUTATION: {
    rates:           `${INTEREST_COMPUTATION}/api/interest/rates`,
    accrue:          `${INTEREST_COMPUTATION}/api/interest/accrue`,
    runs:            `${INTEREST_COMPUTATION}/api/interest/runs`,
    accountAccruals: (id: string) => `${INTEREST_COMPUTATION}/api/interest/accounts/${id}/accruals`,
  },
  FIXED_ASSETS: {
    list:  `${FIXED_ASSETS}/v1/fixed-assets-go/list`,
    stats: `${FIXED_ASSETS}/v1/fixed-assets-go/stats`,
  },
  EXPENSES: {
    list:  `${EXPENSE_MGMT}/v1/expense-mgmt-go/list`,
    stats: `${EXPENSE_MGMT}/v1/expense-mgmt-go/stats`,
  },
  ACCOUNTING_RULES: {
    list:   `${ACCOUNTING_RULES}/v1/accounting-rules/list`,
    stats:  `${ACCOUNTING_RULES}/v1/accounting-rules/stats`,
    byId:   (id: string) => `${ACCOUNTING_RULES}/v1/accounting-rules/${id}`,
    create: `${ACCOUNTING_RULES}/v1/accounting-rules`,
  },
} as const;

// ─── GL Engine Types ──────────────────────────────────────────────────────────
export interface GLAccount {
  glAccountCode: string;
  tenantId: string;
  name: string;
  category: string;
  subcategory: string;
  parentCode: string | null;
  currency: string;
  balance: number;
  status: string;
  isControlAccount: number;
}

export interface GLAccountsResponse {
  items: GLAccount[];
  total: number;
  source: string;
}

export interface PostJournalRequest {
  tenantId: string;
  accountId: string;
  glAccountCode: string;
  type: "debit" | "credit";
  amount: number;
  currency: string;
  narration: string;
  transactionRef: string;
  batchId?: string;
}

export interface JournalEntry {
  entryId: string;
  tenantId: string;
  accountId: string;
  glAccountCode: string;
  type: "debit" | "credit";
  amount: number;
  currency: string;
  narration: string;
  transactionRef: string;
  batchId: string | null;
  postingDate: string;
  valueDate: string;
}

export interface TrialBalanceEntry {
  trialBalanceId: string;
  tenantId: string;
  glAccountCode: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  currency: string;
  status: string;
}

export interface PeriodCloseRequest {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}

export interface EFASSLine {
  mbrForm: string;
  mbrLine: number;
  lineName: string;
  reportCategory: string;
  amount: number;
  cbnCode: string;
}

export interface EFASSReport {
  reportId: string;
  period: string;
  tenantId: string;
  generatedAt: string;
  status: string;
  forms: EFASSLine[];
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    car: number;
    liquidityRatio: number;
  };
}

// ─── Fixed Assets Types ───────────────────────────────────────────────────────
export interface FixedAsset {
  id: string;
  asset_name: string;
  category: string;
  location: string;
  purchase_value: number;
  currency: string;
  depreciation_method: string;
  net_book_value: number;
  status: string;
}

export interface FixedAssetStats {
  total_assets: number;
  total_purchase_value: number;
  total_nbv: number;
}

// ─── Expense Types ────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  category: string;
  department: string;
  description: string;
  amount: number;
  currency: string;
  approved_by: string;
  date: string;
  status: string;
}

export interface ExpenseStats {
  total_expenses: number;
  total_amount: number;
}

// ─── Accounting Rule Types ────────────────────────────────────────────────────
export interface AccountingRule {
  id: string;
  event?: string;
  product?: string;
  debit_gl?: string;
  credit_gl?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AccountingRuleListResponse {
  items: AccountingRule[];
  total: number;
  page: number;
  limit: number;
  source: string;
  service: string;
}

export interface AccountingRuleStats {
  total: number;
  service: string;
  source: string;
}

// ─── Interest Computation Types ───────────────────────────────────────────────
export interface RateConfig {
  id: number;
  tenant_id: string;
  product_code: string;
  account_type: "savings" | "current" | "fixed_deposit" | "loan";
  annual_rate_bps: number;
  compounding: "daily" | "monthly" | "quarterly" | "annually";
  posting_freq: "daily" | "monthly" | "quarterly";
  min_balance_kobo: number;
  is_active: boolean;
  effective_from: string;
  created_at: string;
}

export interface PostingRun {
  id: number;
  tenant_id: string;
  run_date: string;
  accounts_processed: number;
  total_posted_kobo: number;
  status: "running" | "completed" | "failed";
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface AccrualRunRequest {
  accrual_date?: string;
  account_ids?: string[];
}

// ─── Interest Accrual (Batch Engine) Types ────────────────────────────────────
export interface AccrualResult {
  accountId: string;
  accountName: string;
  productType: string;
  principal: number;
  annualRate: number;
  dayBasis: number;
  dailyAccrual: number;
  glDebitCode: string;
  glCreditCode: string;
  journalEntryId: string;
  status: string;
}

export interface GLPosting {
  entryId: string;
  glCode: string;
  glName: string;
  type: string;
  amount: number;
  postingDate: string;
  narration: string;
}

export interface AccrualBatchResult {
  batchId: string;
  businessDate: string;
  totalAccounts: number;
  totalAccrued: number;
  interestIncome: number;
  interestExpense: number;
  journalEntriesPosted: number;
  results: AccrualResult[];
  glPostings: GLPosting[];
  pipeline: {
    step1_compute: string;
    step2_journal: string;
    step3_gl_post: string;
    step4_balance_update: string;
    step5_audit_index: string;
  };
}

export interface AccrualProduct {
  productType: string;
  glDebit: string;
  glCredit: string;
  description: string;
  sampleRate: number;
  dayBasis: number;
}

// ─── Fee Rule Types (pending backend implementation) ──────────────────────────
export interface FeeRule {
  id: string;
  name: string;
  fee_type: "fixed" | "percentage" | "tiered";
  amount?: number;
  rate?: number;
  product_code?: string;
  service?: string;
  currency: string;
  status: "active" | "inactive";
  effective_from?: string;
  created_at?: string;
}

// ─── Interest Rate Types (pending backend implementation) ─────────────────────
export interface InterestRate {
  id: string;
  name: string;
  rate: number;
  source: string;
  currency: string;
  account_type?: string;
  effective_from?: string;
  status: "active" | "inactive";
  created_at?: string;
}

// ─── Typed API Functions ──────────────────────────────────────────────────────
export const glApi = {
  getAccounts: (params?: { category?: string; tenantId?: string }) =>
    apiClient.get<GLAccountsResponse>(FINANCE_API.GL.accounts, { params }).then((r) => r.data),

  postJournal: (body: PostJournalRequest) =>
    apiClient.post(FINANCE_API.GL.journal, body).then((r) => r.data),

  getTrialBalance: (params?: { tenantId?: string }) =>
    apiClient.get<{ items: TrialBalanceEntry[]; total: number }>(
      FINANCE_API.GL.trialBalance, { params }
    ).then((r) => r.data),

  closePeriod: (body: PeriodCloseRequest) =>
    apiClient.post(FINANCE_API.GL.periodClose, body).then((r) => r.data),

  generateEFASS: (params?: { period?: string; tenantId?: string }) =>
    apiClient.get<EFASSReport>(FINANCE_API.GL.efassGenerate, { params }).then((r) => r.data),

  getEFASSMapping: () =>
    apiClient.get(FINANCE_API.GL.efassMapping).then((r) => r.data),

  getCBNReturns: (params?: { tenantId?: string }) =>
    apiClient.get(FINANCE_API.GL.cbnReturns, { params }).then((r) => r.data),
};

export const fixedAssetsApi = {
  list: () =>
    apiClient.get<{ items: FixedAsset[]; total: number }>(FINANCE_API.FIXED_ASSETS.list).then((r) => r.data),
  stats: () =>
    apiClient.get<FixedAssetStats>(FINANCE_API.FIXED_ASSETS.stats).then((r) => r.data),
};

export const expenseApi = {
  list: () =>
    apiClient.get<{ items: Expense[]; total: number }>(FINANCE_API.EXPENSES.list).then((r) => r.data),
  stats: () =>
    apiClient.get<ExpenseStats>(FINANCE_API.EXPENSES.stats).then((r) => r.data),
};

export const accountingRulesApi = {
  list: (page = 1, limit = 50) =>
    apiClient
      .get<AccountingRuleListResponse>(FINANCE_API.ACCOUNTING_RULES.list, { params: { page, limit } })
      .then((r) => r.data),
  stats: () =>
    apiClient.get<AccountingRuleStats>(FINANCE_API.ACCOUNTING_RULES.stats).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get<AccountingRule>(FINANCE_API.ACCOUNTING_RULES.byId(id)).then((r) => r.data),
  create: (body: Partial<AccountingRule>) =>
    apiClient.post(FINANCE_API.ACCOUNTING_RULES.create, body).then((r) => r.data),
};

export const interestComputationApi = {
  getRates: () =>
    apiClient.get<RateConfig[]>(FINANCE_API.INTEREST_COMPUTATION.rates).then((r) => r.data),
  createRate: (body: Omit<RateConfig, "id" | "tenant_id" | "created_at">) =>
    apiClient.post(FINANCE_API.INTEREST_COMPUTATION.rates, body).then((r) => r.data),
  runAccrual: (body: AccrualRunRequest) =>
    apiClient.post(FINANCE_API.INTEREST_COMPUTATION.accrue, body).then((r) => r.data),
  getRuns: () =>
    apiClient.get<PostingRun[]>(FINANCE_API.INTEREST_COMPUTATION.runs).then((r) => r.data),
};

export const interestAccrualApi = {
  runBatch: () =>
    apiClient.post<AccrualBatchResult>(FINANCE_API.INTEREST_ACCRUAL.run, {}).then((r) => r.data),
  health: () =>
    apiClient.get(FINANCE_API.INTEREST_ACCRUAL.health).then((r) => r.data),
};

export const feeManagementApi = {
  getRules: () =>
    apiClient.get<{ items: FeeRule[]; total: number }>(FINANCE_API.FEE.rules).then((r) => r.data),
  createRule: (body: Partial<FeeRule>) =>
    apiClient.post(FINANCE_API.FEE.rules, body).then((r) => r.data),
  updateRule: (id: string, body: Partial<FeeRule>) =>
    apiClient.put(FINANCE_API.FEE.ruleById(id), body).then((r) => r.data),
  health: () =>
    apiClient.get(FINANCE_API.FEE.health).then((r) => r.data),
};

export const interestRateApi = {
  getRates: () =>
    apiClient.get<{ items: InterestRate[]; total: number }>(FINANCE_API.INTEREST_RATE.rates).then((r) => r.data),
  createRate: (body: Partial<InterestRate>) =>
    apiClient.post(FINANCE_API.INTEREST_RATE.rates, body).then((r) => r.data),
  health: () =>
    apiClient.get(FINANCE_API.INTEREST_RATE.health).then((r) => r.data),
};
