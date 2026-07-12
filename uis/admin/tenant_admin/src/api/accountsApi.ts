/**
 * Accounts API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬─────────────────────────────┬──────────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix               │ Backend Service              │ Port  │
 * ├──────────────────────────────┼─────────────────────────────┼──────────────────────────────┼───────┤
 * │ /account-opening             │ /account-opening            │ account-opening-go           │ 8114  │
 * │ /account-closure             │ /account-closure            │ account-closure-go           │ 8334  │
 * │ /account-statements          │ /account-statements         │ account-statement-go         │ 8138  │
 * │ /statement-generator         │ /statement-gen              │ statement-generator-py       │ 8215  │
 * │ /beneficiary-management      │ /beneficiaries              │ beneficiary-management-go    │ 8116  │
 * │ /dormancy-management         │ /dormancy                   │ dormancy-management-rs       │ 8335  │
 * │ /standing-orders             │ /standing-orders            │ standing-orders-go           │ 8115  │
 * │ /mandate-management          │ /mandates                   │ mandate-management-go        │ 8221  │
 * │ /safe-deposit                │ /safe-deposit               │ safe-deposit-go              │ 9305  │
 * │ /cif-management              │ /cif                        │ cif-management-go            │ 8222  │
 * └──────────────────────────────┴─────────────────────────────┴──────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Account Opening ──────────────────────────────────────────────────────────
export interface AccountOpeningApplication {
  id: string;
  applicationRef: string;
  customerId: string;
  customerName: string;
  accountType: string;
  currency: string;
  status: string;
  submittedAt: string;
  processedAt?: string;
  reviewedBy?: string;
}

export interface AccountOpeningStats {
  totalApplications: number;
  pending: number;
  approved: number;
  rejected: number;
  today: number;
}

export const accountOpeningApi = {
  list: (params?: { page?: number; limit?: number; status?: string; accountType?: string }) =>
    apiClient.get<{ items: AccountOpeningApplication[]; total: number }>(`${APISIX.ACCOUNT_OPENING}/v1/applications`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<AccountOpeningApplication>(`${APISIX.ACCOUNT_OPENING}/v1/applications/${id}`).then((r) => r.data),

  create: (body: { customerId: string; accountType: string; currency: string; initialDeposit?: number }) =>
    apiClient.post<AccountOpeningApplication>(`${APISIX.ACCOUNT_OPENING}/v1/applications`, body).then((r) => r.data),

  approve: (id: string, notes?: string) =>
    apiClient.post(`${APISIX.ACCOUNT_OPENING}/v1/applications/${id}/approve`, { notes }).then((r) => r.data),

  reject: (id: string, reason: string) =>
    apiClient.post(`${APISIX.ACCOUNT_OPENING}/v1/applications/${id}/reject`, { reason }).then((r) => r.data),

  getStats: () =>
    apiClient.get<AccountOpeningStats>(`${APISIX.ACCOUNT_OPENING}/v1/applications/stats`).then((r) => r.data),
};

// ─── Account Closure ──────────────────────────────────────────────────────────
export interface AccountClosureRequest {
  id: string;
  requestRef: string;
  accountId: string;
  accountNumber: string;
  customerId: string;
  reason: string;
  status: string;
  requestedAt: string;
  closedAt?: string;
  refundAccount?: string;
}

export const accountClosureApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: AccountClosureRequest[]; total: number }>(`${APISIX.ACCOUNT_CLOSURE}/v1/closure-requests`, { params }).then((r) => r.data),

  create: (body: { accountId: string; reason: string; refundAccount?: string }) =>
    apiClient.post<AccountClosureRequest>(`${APISIX.ACCOUNT_CLOSURE}/v1/closure-requests`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<AccountClosureRequest>(`${APISIX.ACCOUNT_CLOSURE}/v1/closure-requests/${id}`).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post(`${APISIX.ACCOUNT_CLOSURE}/v1/closure-requests/${id}/approve`, {}).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.post(`${APISIX.ACCOUNT_CLOSURE}/v1/closure-requests/${id}/cancel`, {}).then((r) => r.data),
};

// ─── Account Statements ───────────────────────────────────────────────────────
export interface Statement {
  id: string;
  accountId: string;
  accountNumber: string;
  period: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  currency: string;
  transactionCount: number;
  generatedAt: string;
  format: "pdf" | "csv" | "json";
  downloadUrl?: string;
}

export const accountStatementsApi = {
  list: (params?: { page?: number; limit?: number; accountId?: string }) =>
    apiClient.get<{ items: Statement[]; total: number }>(`${APISIX.ACCOUNT_STATEMENTS}/v1/statements`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Statement>(`${APISIX.ACCOUNT_STATEMENTS}/v1/statements/${id}`).then((r) => r.data),

  getForAccount: (accountId: string, params?: { from?: string; to?: string; format?: string }) =>
    apiClient.get(`${APISIX.ACCOUNT_STATEMENTS}/v1/accounts/${accountId}/statement`, { params }).then((r) => r.data),
};

// ─── Statement Generator ──────────────────────────────────────────────────────
export interface StatementRequest {
  accountId: string;
  from: string;
  to: string;
  format: "pdf" | "csv";
  sendEmail?: boolean;
  email?: string;
}

export interface StatementGenerationResult {
  jobId: string;
  status: string;
  downloadUrl?: string;
  estimatedTime?: number;
}

export const statementGeneratorApi = {
  generate: (body: StatementRequest) =>
    apiClient.post<StatementGenerationResult>(`${APISIX.STATEMENT_GENERATOR}/v1/generate`, body).then((r) => r.data),

  getStatus: (jobId: string) =>
    apiClient.get<StatementGenerationResult>(`${APISIX.STATEMENT_GENERATOR}/v1/jobs/${jobId}`).then((r) => r.data),

  download: (jobId: string) =>
    apiClient.get(`${APISIX.STATEMENT_GENERATOR}/v1/jobs/${jobId}/download`, { responseType: "blob" }).then((r) => r.data),

  getHistory: (params?: { page?: number; limit?: number; accountId?: string }) =>
    apiClient.get(`${APISIX.STATEMENT_GENERATOR}/v1/jobs`, { params }).then((r) => r.data),
};

// ─── Beneficiary Management ───────────────────────────────────────────────────
export interface Beneficiary {
  id: string;
  ownerId: string;
  name: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  type: "domestic" | "international";
  status: "active" | "inactive";
  createdAt: string;
}

export const beneficiaryApi = {
  list: (params?: { page?: number; limit?: number; ownerId?: string; type?: string }) =>
    apiClient.get<{ items: Beneficiary[]; total: number }>(`${APISIX.BENEFICIARIES}/v1/beneficiaries`, { params }).then((r) => r.data),

  create: (body: Partial<Beneficiary>) =>
    apiClient.post<Beneficiary>(`${APISIX.BENEFICIARIES}/v1/beneficiaries`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Beneficiary>(`${APISIX.BENEFICIARIES}/v1/beneficiaries/${id}`).then((r) => r.data),

  update: (id: string, body: Partial<Beneficiary>) =>
    apiClient.put<Beneficiary>(`${APISIX.BENEFICIARIES}/v1/beneficiaries/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`${APISIX.BENEFICIARIES}/v1/beneficiaries/${id}`).then((r) => r.data),
};

// ─── Dormancy Management ──────────────────────────────────────────────────────
export interface DormantAccount {
  id: string;
  accountId: string;
  accountNumber: string;
  customerId: string;
  customerName: string;
  balance: number;
  currency: string;
  lastTransactionDate: string;
  dormancyDate: string;
  status: "pre_dormant" | "dormant" | "unclaimed";
  noticesSent: number;
}

export interface DormancyStats {
  total: number;
  preDormant: number;
  dormant: number;
  unclaimed: number;
  totalBalance: number;
}

export const dormancyApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: DormantAccount[]; total: number }>(`${APISIX.DORMANCY}/v1/dormant-accounts`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<DormantAccount>(`${APISIX.DORMANCY}/v1/dormant-accounts/${id}`).then((r) => r.data),

  reactivate: (id: string, notes: string) =>
    apiClient.post(`${APISIX.DORMANCY}/v1/dormant-accounts/${id}/reactivate`, { notes }).then((r) => r.data),

  getStats: () =>
    apiClient.get<DormancyStats>(`${APISIX.DORMANCY}/v1/stats`).then((r) => r.data),

  runDormancyCheck: () =>
    apiClient.post(`${APISIX.DORMANCY}/v1/run-check`, {}).then((r) => r.data),
};

// ─── Standing Orders ──────────────────────────────────────────────────────────
export interface StandingOrder {
  id: string;
  sourceAccountId: string;
  beneficiaryId: string;
  amount: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
  nextExecutionDate: string;
  endDate?: string;
  status: "active" | "paused" | "expired" | "cancelled";
  narration: string;
  createdAt: string;
}

export const standingOrdersApi = {
  list: (params?: { page?: number; limit?: number; accountId?: string; status?: string }) =>
    apiClient.get<{ items: StandingOrder[]; total: number }>(`${APISIX.STANDING_ORDERS}/v1/standing-orders`, { params }).then((r) => r.data),

  create: (body: Partial<StandingOrder>) =>
    apiClient.post<StandingOrder>(`${APISIX.STANDING_ORDERS}/v1/standing-orders`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<StandingOrder>(`${APISIX.STANDING_ORDERS}/v1/standing-orders/${id}`).then((r) => r.data),

  update: (id: string, body: Partial<StandingOrder>) =>
    apiClient.put(`${APISIX.STANDING_ORDERS}/v1/standing-orders/${id}`, body).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete(`${APISIX.STANDING_ORDERS}/v1/standing-orders/${id}`).then((r) => r.data),

  pause: (id: string) =>
    apiClient.post(`${APISIX.STANDING_ORDERS}/v1/standing-orders/${id}/pause`, {}).then((r) => r.data),

  resume: (id: string) =>
    apiClient.post(`${APISIX.STANDING_ORDERS}/v1/standing-orders/${id}/resume`, {}).then((r) => r.data),
};

// ─── Mandate Management ───────────────────────────────────────────────────────
export interface Mandate {
  id: string;
  mandateRef: string;
  type: string;
  debtorAccount: string;
  creditorAccount: string;
  amount: number;
  currency: string;
  frequency: string;
  status: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
}

export const mandateApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: Mandate[]; total: number }>(`${APISIX.MANDATE_MANAGEMENT}/v1/mandates`, { params }).then((r) => r.data),

  create: (body: Partial<Mandate>) =>
    apiClient.post<Mandate>(`${APISIX.MANDATE_MANAGEMENT}/v1/mandates`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Mandate>(`${APISIX.MANDATE_MANAGEMENT}/v1/mandates/${id}`).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post(`${APISIX.MANDATE_MANAGEMENT}/v1/mandates/${id}/approve`, {}).then((r) => r.data),

  revoke: (id: string, reason: string) =>
    apiClient.post(`${APISIX.MANDATE_MANAGEMENT}/v1/mandates/${id}/revoke`, { reason }).then((r) => r.data),
};

// ─── Safe Deposit ─────────────────────────────────────────────────────────────
export interface SafeDepositBox {
  id: string;
  boxNumber: string;
  branchId: string;
  size: "small" | "medium" | "large";
  status: "available" | "rented" | "suspended";
  customerId?: string;
  customerName?: string;
  rentalFee: number;
  currency: string;
  startDate?: string;
  endDate?: string;
}

export const safeDepositApi = {
  list: (params?: { page?: number; limit?: number; branchId?: string; status?: string; size?: string }) =>
    apiClient.get<{ items: SafeDepositBox[]; total: number }>(`${APISIX.SAFE_DEPOSIT}/v1/boxes`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<SafeDepositBox>(`${APISIX.SAFE_DEPOSIT}/v1/boxes/${id}`).then((r) => r.data),

  rent: (id: string, body: { customerId: string; startDate: string; endDate: string }) =>
    apiClient.post(`${APISIX.SAFE_DEPOSIT}/v1/boxes/${id}/rent`, body).then((r) => r.data),

  release: (id: string) =>
    apiClient.post(`${APISIX.SAFE_DEPOSIT}/v1/boxes/${id}/release`, {}).then((r) => r.data),

  getStats: (params?: { branchId?: string }) =>
    apiClient.get(`${APISIX.SAFE_DEPOSIT}/v1/stats`, { params }).then((r) => r.data),
};

// ─── CIF Management ───────────────────────────────────────────────────────────
export interface CIFRecord {
  id: string;
  cifNumber: string;
  customerId: string;
  customerType: "individual" | "corporate";
  fullName: string;
  email: string;
  phone: string;
  kycStatus: string;
  riskRating: string;
  accountCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CIFStats {
  total: number;
  individual: number;
  corporate: number;
  kycComplete: number;
  kycPending: number;
}

export const cifApi = {
  list: (params?: { page?: number; limit?: number; customerType?: string; kycStatus?: string; q?: string }) =>
    apiClient.get<{ items: CIFRecord[]; total: number }>(`${APISIX.CIF}/v1/cif`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<CIFRecord>(`${APISIX.CIF}/v1/cif/${id}`).then((r) => r.data),

  getByCustomer: (customerId: string) =>
    apiClient.get<CIFRecord>(`${APISIX.CIF}/v1/cif/customer/${customerId}`).then((r) => r.data),

  update: (id: string, body: Partial<CIFRecord>) =>
    apiClient.put(`${APISIX.CIF}/v1/cif/${id}`, body).then((r) => r.data),

  getAccounts: (id: string) =>
    apiClient.get(`${APISIX.CIF}/v1/cif/${id}/accounts`).then((r) => r.data),

  getStats: () =>
    apiClient.get<CIFStats>(`${APISIX.CIF}/v1/cif/stats`).then((r) => r.data),
};
