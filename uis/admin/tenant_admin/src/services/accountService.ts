import apiClient from './api';
import type {
  AccountApplicationListResponse,
  AccountOpeningStats,
  AccountApplication,
  CreateAccountApplicationPayload,
  ClosureListResponse,
  ClosureStats,
  ClosureRequest,
  CreateClosureRequestPayload,
  StatementAccountListResponse,
  StatementTransactionListResponse,
  StatementResponse,
  StatementSummary,
  BalanceTrendResponse,
  GenerateStatementPayload,
  LedgerTransactionListResponse,
} from '../types/account';

// ─── Accounts (direct via account-service GET /account/account/all) ──────────

const ACCOUNT_BASE = '/account/account';

export const accountService = {
  list: (page = 1, limit = 25): Promise<AccountApplicationListResponse> =>
    apiClient
      .get<{ items: AccountApplication[]; total: number; page: number; limit: number }>(
        `${ACCOUNT_BASE}/all`,
        { params: { page, limit } },
      )
      .then((r) => r.data),

  listAll: (): Promise<AccountApplication[]> =>
    apiClient
      .get<{ items: AccountApplication[]; total: number }>(`${ACCOUNT_BASE}/all`, { params: { page: 1, limit: 100 } })
      .then((r) => r.data.items ?? []),

  getById: (id: string): Promise<AccountApplication> =>
    apiClient.get<{ message: string; account: AccountApplication }>(`${ACCOUNT_BASE}/${id}`)
      .then((r) => r.data.account),

  create: (payload: CreateAccountApplicationPayload): Promise<{ message: string; data: AccountApplication }> =>
    apiClient
      .post<{ message: string; account: AccountApplication }>(ACCOUNT_BASE, payload)
      .then((r) => ({ message: r.data.message, data: r.data.account })),
};

// keep alias so existing hook references still compile
export const accountOpeningService = accountService;

// ─── Account Closure ──────────────────────────────────────────────────────────

const CLOSURE_BASE = '/account/account-closure';

export const accountClosureService = {
  list: (page = 1, limit = 25): Promise<ClosureListResponse> =>
    apiClient
      .get<ClosureListResponse>(`${CLOSURE_BASE}/list`, { params: { page, limit } })
      .then((r) => r.data),

  stats: (): Promise<ClosureStats> =>
    apiClient.get<ClosureStats>(`${CLOSURE_BASE}/stats`).then((r) => r.data),

  getById: (id: string): Promise<ClosureRequest> =>
    apiClient.get<{ message: string; data: ClosureRequest }>(`${CLOSURE_BASE}/${id}`)
      .then((r) => r.data.data ?? r.data as unknown as ClosureRequest),

  create: (payload: CreateClosureRequestPayload): Promise<{ message: string; data: ClosureRequest }> =>
    apiClient
      .post<{ message: string; data: ClosureRequest }>(CLOSURE_BASE, payload)
      .then((r) => r.data),

  approve: (id: string): Promise<ClosureRequest> =>
    apiClient.patch<{ message: string; data: ClosureRequest }>(`${CLOSURE_BASE}/${id}/approve`, {})
      .then((r) => r.data.data),

  complete: (id: string): Promise<ClosureRequest> =>
    apiClient.patch<{ message: string; data: ClosureRequest }>(`${CLOSURE_BASE}/${id}/complete`, {})
      .then((r) => r.data.data),

  reject: (id: string): Promise<ClosureRequest> =>
    apiClient.patch<{ message: string; data: ClosureRequest }>(`${CLOSURE_BASE}/${id}/reject`, {})
      .then((r) => r.data.data),
};

// ─── Ledger Transactions ──────────────────────────────────────────────────────

const LEDGER_BASE = '/ledger/txn';

export const ledgerTransactionService = {
  getByLedgerId: (ledgerId: string, page = 1, limit = 50): Promise<LedgerTransactionListResponse> =>
    apiClient
      .get<LedgerTransactionListResponse>(`${LEDGER_BASE}/account/${ledgerId}`, { params: { page, limit } })
      .then((r) => r.data),
};

// ─── Account Statements ───────────────────────────────────────────────────────

const STATEMENT_BASE = '/account';

export const accountStatementService = {
  listAccounts: (): Promise<StatementAccountListResponse> =>
    apiClient.get<StatementAccountListResponse>(`${STATEMENT_BASE}/statements/accounts`).then((r) => r.data),

  listTransactions: (accountNumber?: string): Promise<StatementTransactionListResponse> =>
    apiClient
      .get<StatementTransactionListResponse>(`${STATEMENT_BASE}/transactions`, {
        params: accountNumber ? { accountNumber } : {},
      })
      .then((r) => r.data),

  generate: (payload: GenerateStatementPayload): Promise<StatementResponse> =>
    apiClient.post<StatementResponse>(`${STATEMENT_BASE}/generate`, payload).then((r) => r.data),

  getSummary: (payload: GenerateStatementPayload): Promise<StatementSummary> =>
    apiClient.post<StatementSummary>(`${STATEMENT_BASE}/summary`, payload).then((r) => r.data),

  getBalanceTrend: (accountNumber: string): Promise<BalanceTrendResponse> =>
    apiClient
      .post<BalanceTrendResponse>(`${STATEMENT_BASE}/balance-trend`, { accountNumber })
      .then((r) => r.data),
};
