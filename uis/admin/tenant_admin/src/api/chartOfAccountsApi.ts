import apiClient from "../services/api";

// Types aligned with chart-of-accounts-service
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export type NormalBalance = "debit" | "credit";

export interface Account {
  id: string;
  tenant_id: string;
  code: string; // Account code (e.g., "1400")
  name: string; // Account name
  description?: string;
  type: AccountType;
  normal_balance: NormalBalance;
  parent_id?: string;
  level: number;
  is_active: boolean;
  is_system_account: boolean;
  currency: string;
  tigerbeetle_id?: string;
  tigerbeetle_ledger: number;
  tigerbeetle_code: number;
  cbn_code?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated when include_balance=true
  current_balance?: number;
  debit_balance?: number;
  credit_balance?: number;
}

export interface AccountCategory {
  type: AccountType;
  name: string;
  description: string;
  normal_balance: NormalBalance;
  code_range: string;
  subcategories?: Subcategory[];
}

export interface CategoriesResponse {
  asset: AccountCategory;
  liability: AccountCategory;
  equity: AccountCategory;
  revenue: AccountCategory;
  expense: AccountCategory;
}

export interface Subcategory {
  code: string;
  name: string;
  description: string;
}

export type JournalEntryStatus =
  | "draft"
  | "pending"
  | "posted"
  | "rejected"
  | "reversed";

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  date: string;
  entry_date: string;
  description: string;
  reference?: string;
  lines: JournalLine[];
  status: JournalEntryStatus;
  currency: string;
  is_reversed: boolean;
  reversal_of?: string;
  reversed_by?: string;
  reversed_at?: string;
  reversal_reason?: string;
  original_entry_id?: string;
  tigerbeetle_ids?: string[];
  tigerbeetle_transfer_id?: string;
  total_debit: number;
  total_credit: number;
  posted_by: string;
  posted_at?: string;
  approved_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
}

export interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  currency: string;
  debit_balance: number;
  credit_balance: number;
  pending_debits: number;
  pending_credits: number;
  net_balance: number;
  balance_type: string;
  as_of_date: string;
}

export interface TrialBalance {
  tenant_id: string;
  as_of_date: string;
  accounts: TrialBalanceLine[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
  generated_at: string;
}

export interface TrialBalanceLine {
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface BalanceSheet {
  tenant_id: string;
  as_of_date: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
  generated_at: string;
}

export interface BalanceSheetSection {
  name: string;
  items: BalanceSheetItem[];
  subtotal: number;
}

export interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  balance: number;
  level: number;
}

export interface IncomeStatement {
  tenant_id: string;
  start_date: string;
  end_date: string;
  revenue: IncomeStatementSection;
  expenses: IncomeStatementSection;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  generated_at: string;
}

export interface IncomeStatementSection {
  name: string;
  items: IncomeStatementItem[];
  subtotal: number;
}

export interface IncomeStatementItem {
  account_code: string;
  account_name: string;
  amount: number;
  level: number;
}

export interface ReconciliationStatus {
  tenant_id: string;
  last_reconciliation: string;
  status: "never_run" | "reconciled" | "pending" | "discrepancy";
  discrepancy_count: number;
}

export interface AccountHierarchyNode {
  account: Account;
  children: AccountHierarchyNode[];
  balance: number;
}

export interface AccountHierarchyResponse {
  tenant_id: string;
  roots: AccountHierarchyNode[];
}

export interface Tenant {
  id: string;
  name: string;
  fiscal_year_start: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

// API Functions - aligned with chart-of-accounts-service endpoints
export const accountsApi = {
  // List all accounts for a tenant
  listAccounts: async (
    tenantId: string = "default",
    params?: { type?: AccountType; parent_id?: string; active?: boolean },
  ): Promise<Account[]> => {
    const response = await apiClient.get(`/chart-of-accounts/api/v1/accounts`, {
      params: { ...params, include_balance: true },
      headers: { "X-Tenant-ID": tenantId },
    });
    return response.data;
  },

  // Get a single account
  getAccount: async (
    accountId: string,
    tenantId: string = "default",
  ): Promise<Account> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/accounts/${accountId}`,
      {
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Create a new account (admin only)
  createAccount: async (
    accountData: {
      code: string;
      name: string;
      description?: string;
      type: AccountType;
      parent_id?: string;
      currency?: string;
      cbn_code?: string;
      tags?: string[];
    },
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<Account> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/accounts`,
      accountData,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
    return response.data;
  },

  // Update an account (admin only)
  updateAccount: async (
    accountId: string,
    accountData: Partial<Account>,
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<Account> => {
    const response = await apiClient.put(
      `/chart-of-accounts/api/v1/accounts/${accountId}`,
      accountData,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
    return response.data;
  },

  // Delete an account (admin only)
  deleteAccount: async (
    accountId: string,
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<void> => {
    await apiClient.delete(`/chart-of-accounts/api/v1/accounts/${accountId}`, {
      headers: {
        "X-Tenant-ID": tenantId,
        "X-User-Role": userRole,
      },
    });
  },

  // Get account hierarchy
  getAccountHierarchy: async (
    tenantId: string = "default",
    parentId?: string,
  ): Promise<AccountHierarchyNode[]> => {
    const endpoint = parentId
      ? `/chart-of-accounts/api/v1/hierarchy/${parentId}/children`
      : `/chart-of-accounts/api/v1/hierarchy`;
    const response = await apiClient.get<AccountHierarchyResponse>(endpoint, {
      headers: { "X-Tenant-ID": tenantId },
    });
    // Extract roots array from response
    return response.data.roots || [];
  },

  // Get account balance
  getAccountBalance: async (
    accountId: string,
    tenantId: string = "default",
    asOfDate?: string,
  ): Promise<AccountBalance> => {
    const params = asOfDate ? { as_of_date: asOfDate } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/accounts/${accountId}/balance`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Get account history
  getAccountHistory: async (
    accountId: string,
    tenantId: string = "default",
    params?: {
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    account_id: string;
    transactions: any[];
    total_count: number;
  }> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/accounts/${accountId}/history`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Initialize default accounts (super admin only)
  initializeDefaults: async (
    tenantId: string = "default",
    userRole: string = "super_admin",
  ): Promise<void> => {
    await apiClient.post(
      `/chart-of-accounts/api/v1/accounts/initialize-defaults`,
      {},
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
  },
};

export const categoriesApi = {
  // List all categories
  listCategories: async (
    tenantId: string = "default",
  ): Promise<AccountCategory[]> => {
    const response = await apiClient.get<CategoriesResponse>(
      `/chart-of-accounts/api/v1/categories`,
      {
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    // Convert object to array
    return Object.values(response.data);
  },

  // Get a specific category by type
  getCategory: async (
    type: AccountType,
    tenantId: string = "default",
  ): Promise<AccountCategory> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/categories/${type}`,
      {
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },
};

export const journalEntriesApi = {
  // List all journal entries
  listJournalEntries: async (
    tenantId: string = "default",
    params?: {
      status?: JournalEntryStatus;
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<JournalEntry[]> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/journal-entries`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Get a single journal entry
  getJournalEntry: async (
    entryId: string,
    tenantId: string = "default",
  ): Promise<JournalEntry> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/journal-entries/${entryId}`,
      {
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Create a new journal entry (admin only)
  createJournalEntry: async (
    entryData: {
      description: string;
      reference?: string;
      date?: string;
      lines: Array<{
        account_id: string;
        debit_amount: number;
        credit_amount: number;
        description?: string;
      }>;
    },
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<JournalEntry> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/journal-entries`,
      entryData,
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
    return response.data;
  },

  // Reverse a journal entry (admin only)
  reverseJournalEntry: async (
    entryId: string,
    reason: string,
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<JournalEntry> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/journal-entries/${entryId}/reverse`,
      { reason },
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
    return response.data;
  },
};

export const reportsApi = {
  // Generate trial balance
  getTrialBalance: async (
    tenantId: string = "default",
    asOfDate?: string,
  ): Promise<TrialBalance> => {
    const params = asOfDate ? { as_of_date: asOfDate } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/trial-balance`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Generate balance sheet
  getBalanceSheet: async (
    tenantId: string = "default",
    asOfDate?: string,
  ): Promise<BalanceSheet> => {
    const params = asOfDate ? { as_of_date: asOfDate } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/balance-sheet`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Generate income statement
  getIncomeStatement: async (
    tenantId: string = "default",
    startDate?: string,
    endDate?: string,
  ): Promise<IncomeStatement> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/income-statement`,
      {
        params,
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },
};

export const reconciliationApi = {
  // Get reconciliation status for all accounts
  getReconciliationStatus: async (
    tenantId: string = "default",
  ): Promise<ReconciliationStatus> => {
    const response = await apiClient.get<ReconciliationStatus>(
      `/chart-of-accounts/api/v1/reconciliation/status`,
      {
        headers: { "X-Tenant-ID": tenantId },
      },
    );
    return response.data;
  },

  // Reconcile with TigerBeetle (admin only)
  reconcileWithTigerBeetle: async (
    tenantId: string = "default",
    userRole: string = "bank_admin",
  ): Promise<{ reconciled: number; discrepancies: any[] }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/reconciliation/tigerbeetle`,
      {},
      {
        headers: {
          "X-Tenant-ID": tenantId,
          "X-User-Role": userRole,
        },
      },
    );
    return response.data;
  },

  // Placeholder for resolving discrepancies
  resolveDiscrepancy: async (
    tenantId: string,
    accountId: string,
    action: string,
  ): Promise<void> => {
    console.log(
      `Resolving discrepancy for ${accountId} with action: ${action}`,
    );
    // Implementation depends on backend support
  },
};

// ---- COA Mappings ----
// Each tenant maps semantic keys (e.g. "loans.interest.sme") to their own
// COA account UUIDs so services never hardcode account codes.

export interface COAMapping {
  id: string;
  tenant_id: string;
  mapping_key: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/** Canonical set of keys the system uses — used to show unconfigured rows. */
export const STANDARD_MAPPING_KEYS: { key: string; label: string; hint: string }[] = [
  { key: "loans.receivable",          label: "Loans Receivable",                hint: "Asset — principal owed by borrowers" },
  { key: "loans.customer.liability",  label: "Customer Deposits (Loans)",       hint: "Liability — customer account credited on disbursement" },
  { key: "loans.interest",            label: "Interest Income (Generic)",        hint: "Revenue — fallback when loan-type-specific key is missing" },
  { key: "loans.interest.consumer",   label: "Interest Income — Consumer",       hint: "Revenue — interest on consumer loans" },
  { key: "loans.interest.sme",        label: "Interest Income — SME",            hint: "Revenue — interest on SME loans" },
  { key: "loans.interest.mortgage",   label: "Interest Income — Mortgage",       hint: "Revenue — interest on mortgage loans" },
  { key: "loans.interest.agricultural", label: "Interest Income — Agricultural", hint: "Revenue — interest on agricultural loans" },
  { key: "loans.interest.corporate",  label: "Interest Income — Corporate",      hint: "Revenue — interest on corporate loans" },
  { key: "loans.interest.overdraft",  label: "Interest Income — Overdraft",      hint: "Revenue — interest on overdraft facilities" },
  { key: "payments.customer.liability", label: "Customer Deposits (Payments)",   hint: "Liability — debited/credited on transfers, deposits, withdrawals" },
  { key: "payments.cash.asset",       label: "Cash / Nostro",                    hint: "Asset — physical cash or correspondent bank balance" },
  { key: "payments.fee.revenue",      label: "Fee Income",                       hint: "Revenue — transaction and service fees" },
  { key: "payments.insurance.payable", label: "Insurance Premium Payable",       hint: "Liability — premiums collected before remittance to insurer" },
  { key: "loans.interest.general",    label: "Interest Income — General Loans",  hint: "Revenue — interest on general/default loan type; fallback if type-specific key is missing" },
  { key: "escrow.liability",          label: "Escrow Funds Held",                hint: "Liability — funds held in escrow pending contract release" },
  { key: "escrow.fee.revenue",        label: "Escrow Fee Income",                hint: "Revenue — fees earned on escrow contract releases" },
];

export const mappingsApi = {
  list: async (tenantId: string): Promise<COAMapping[]> => {
    const response = await apiClient.get(`/chart-of-accounts/api/v1/mappings`, {
      headers: { "X-Tenant-ID": tenantId },
    });
    return response.data ?? [];
  },

  get: async (tenantId: string, mappingKey: string): Promise<COAMapping> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/mappings/${encodeURIComponent(mappingKey)}`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  upsert: async (
    tenantId: string,
    data: { mapping_key: string; account_id: string; description?: string },
    userRole: string = "bank_admin",
  ): Promise<COAMapping> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/mappings`,
      data,
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  remove: async (
    tenantId: string,
    mappingKey: string,
    userRole: string = "bank_admin",
  ): Promise<void> => {
    await apiClient.delete(
      `/chart-of-accounts/api/v1/mappings/${encodeURIComponent(mappingKey)}`,
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
  },
};

export const tenantsApi = {
  getTenantCoA: async (
    tenantId: string,
    userRole: string = "super_admin",
  ): Promise<any> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/tenants/${tenantId}/coa`,
      { headers: { "X-User-Role": userRole } },
    );
    return response.data;
  },

  createTenantCoA: async (
    tenantId: string,
    data: any,
    userRole: string = "super_admin",
  ): Promise<any> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/tenants/${tenantId}/coa`,
      data,
      { headers: { "X-User-Role": userRole } },
    );
    return response.data;
  },

  cloneCoA: async (
    targetTenantId: string,
    sourceTenantId: string,
    userRole: string = "super_admin",
  ): Promise<any> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/tenants/${targetTenantId}/coa/clone`,
      { source_tenant_id: sourceTenantId },
      { headers: { "X-User-Role": userRole } },
    );
    return response.data;
  },
};

// ── Approval types ────────────────────────────────────────────────────────────

export type ApprovalStatus = "pending" | "approved" | "rejected" | "canceled";

export interface ApprovalWorkflowStep {
  step_order: number;
  approver_role: string;
  approver_user_id?: string;
  is_mandatory: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  tenant_id: string;
  name: string;
  entity_type: string;
  min_amount?: number;
  max_amount?: number;
  steps: ApprovalWorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalAction {
  step_number: number;
  action: string;
  action_by: string;
  action_at: string;
  comments?: string;
}

export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  workflow_id: string;
  entity_type: string;
  entity_id: string;
  current_step: number;
  status: ApprovalStatus;
  requested_by: string;
  requested_at: string;
  completed_at?: string;
  actions?: ApprovalAction[];
  metadata?: Record<string, any>;
}

export interface JournalEntryWithApproval extends JournalEntry {
  approval_request?: ApprovalRequest;
  requires_approval: boolean;
  can_approve: boolean;
  can_reject: boolean;
}

export const approvalsApi = {
  listWorkflows: async (tenantId: string): Promise<ApprovalWorkflow[]> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/approvals/workflows`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data ?? [];
  },

  getWorkflow: async (tenantId: string, workflowId: string): Promise<ApprovalWorkflow> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/approvals/workflows/${workflowId}`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  createWorkflow: async (
    tenantId: string,
    data: Omit<ApprovalWorkflow, "id" | "tenant_id" | "created_at" | "updated_at">,
    userRole: string = "bank_admin",
  ): Promise<ApprovalWorkflow> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/approvals/workflows`,
      data,
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  createDefaultWorkflows: async (
    tenantId: string,
    userRole: string = "bank_admin",
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/approvals/workflows/defaults`,
      {},
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  listRequests: async (
    tenantId: string,
    params?: { entity_type?: string; status?: ApprovalStatus },
  ): Promise<ApprovalRequest[]> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/approvals/requests`,
      { params, headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data ?? [];
  },

  getRequest: async (tenantId: string, requestId: string): Promise<ApprovalRequest> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/approvals/requests/${requestId}`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  approve: async (
    tenantId: string,
    requestId: string,
    comments: string = "",
    userRole: string = "bank_admin",
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/approvals/requests/${requestId}/approve`,
      { comments },
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  reject: async (
    tenantId: string,
    requestId: string,
    comments: string,
    userRole: string = "bank_admin",
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/approvals/requests/${requestId}/reject`,
      { comments },
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  cancel: async (
    tenantId: string,
    requestId: string,
    reason: string,
    userRole: string = "bank_admin",
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/approvals/requests/${requestId}/cancel`,
      { reason },
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  submitJournalForApproval: async (
    tenantId: string,
    entryId: string,
    userRole: string = "bank_admin",
  ): Promise<ApprovalRequest | { message: string }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/journal-entries/${entryId}/submit`,
      {},
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  getJournalWithApproval: async (
    tenantId: string,
    entryId: string,
  ): Promise<JournalEntryWithApproval> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/journal-entries/${entryId}/approval`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },
};

// ── Accounting Period types ───────────────────────────────────────────────────

export type PeriodStatus = "open" | "soft_closed" | "hard_closed" | "locked";

export interface AccountingPeriod {
  id: string;
  tenant_id: string;
  name: string;
  period_type: "monthly" | "quarterly" | "annual" | "adjustment";
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  closed_at?: string;
  closed_by?: string;
  fiscal_year: number;
  period_number: number;
  is_adjustment_period: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeriodCloseResult {
  period_id: string;
  status: PeriodStatus;
  closed_at: string;
  closed_by: string;
  trial_balance_valid: boolean;
  total_debits: number;
  total_credits: number;
  unposted_entries: number;
  warnings?: string[];
  errors?: string[];
  closing_entries?: JournalEntry[];
  retained_earnings?: number;
}

export interface PeriodSummary {
  period: AccountingPeriod;
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  journal_entry_count: number;
  posted_entry_count: number;
}

export const periodsApi = {
  listPeriods: async (
    tenantId: string,
    fiscalYear?: number,
  ): Promise<AccountingPeriod[]> => {
    const params = fiscalYear ? { fiscal_year: fiscalYear } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/periods`,
      { params, headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data ?? [];
  },

  getPeriod: async (tenantId: string, periodId: string): Promise<AccountingPeriod> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/periods/${periodId}`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  getPeriodSummary: async (tenantId: string, periodId: string): Promise<PeriodSummary> => {
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/periods/${periodId}/summary`,
      { headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  createFiscalYear: async (
    tenantId: string,
    year: number,
    startMonth: number = 1,
    userRole: string = "bank_admin",
  ): Promise<{ periods: AccountingPeriod[]; count: number }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/periods/fiscal-year`,
      { year, start_month: startMonth },
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  softClose: async (
    tenantId: string,
    periodId: string,
    userRole: string = "bank_admin",
  ): Promise<PeriodCloseResult> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/periods/${periodId}/soft-close`,
      {},
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  hardClose: async (
    tenantId: string,
    periodId: string,
    userRole: string = "bank_admin",
  ): Promise<PeriodCloseResult> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/periods/${periodId}/hard-close`,
      {},
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  lock: async (
    tenantId: string,
    periodId: string,
    userRole: string = "bank_admin",
  ): Promise<{ success: boolean; period_id: string; status: string }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/periods/${periodId}/lock`,
      {},
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },

  reopen: async (
    tenantId: string,
    periodId: string,
    reason: string,
    userRole: string = "bank_admin",
  ): Promise<{ success: boolean; period_id: string; status: string }> => {
    const response = await apiClient.post(
      `/chart-of-accounts/api/v1/periods/${periodId}/reopen`,
      { reason },
      { headers: { "X-Tenant-ID": tenantId, "X-User-Role": userRole } },
    );
    return response.data;
  },
};

// ── CBN Reporting ─────────────────────────────────────────────────────────────

export interface CBNReportType {
  type: string;
  name: string;
  description: string;
  frequency: string;
}

export const cbnApi = {
  getCBNMapping: async (): Promise<Record<string, any>> => {
    const response = await apiClient.get(`/chart-of-accounts/api/v1/cbn/mapping`);
    return response.data;
  },

  listReportTypes: async (tenantId: string = "default"): Promise<CBNReportType[]> => {
    const response = await apiClient.get(`/chart-of-accounts/api/v1/cbn/reports`, {
      headers: { "X-Tenant-ID": tenantId },
    });
    return response.data?.report_types ?? [];
  },

  generateReturn: async (
    tenantId: string,
    returnType: string,
    reportingDate?: string,
  ): Promise<any> => {
    const params = reportingDate ? { reporting_date: reportingDate } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/cbn/returns/${returnType}`,
      { params, headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },

  generateReport: async (
    tenantId: string,
    reportType: string,
    asOfDate?: string,
  ): Promise<any> => {
    const params = asOfDate ? { as_of_date: asOfDate } : {};
    const response = await apiClient.get(
      `/chart-of-accounts/api/v1/cbn/reports/${reportType}`,
      { params, headers: { "X-Tenant-ID": tenantId } },
    );
    return response.data;
  },
};
