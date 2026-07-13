/**
 * Operations API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬─────────────────────────────┬──────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix               │ Backend Service          │ Port  │
 * ├──────────────────────────────┼─────────────────────────────┼──────────────────────────┼───────┤
 * │ /transactions                │ /account                    │ account-service          │ 80    │
 * │ /transfer                    │ /payment-processing         │ payment-processing-svc   │ 80    │
 * │ /teller-operations           │ /teller-operations          │ teller-operations-go     │ 8080  │
 * │ /teller                      │ /teller                     │ teller-service           │ 80    │
 * │ /branches                    │ /branch-manager             │ branch-manager-service   │ 80    │
 * │ /branch-performance-map      │ /branch-operations          │ branch-operations-go     │ 8250  │
 * │ /atm-management              │ /atm                        │ atm-management-go        │ 8147  │
 * │ /card-dashboard              │ /card                       │ card-service             │ 80    │
 * │ /admin/cards                 │ /card-management            │ card-management-go       │ 9233  │
 * │ /card-fraud-rules            │ /fraud-detection            │ fraud-detection-rs       │ 9269  │
 * │ /pos-terminal                │ /pos                        │ pos-terminal-go          │ 8901  │
 * └──────────────────────────────┴─────────────────────────────┴──────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Account / Transactions ───────────────────────────────────────────────────
export interface Transaction {
  id: string;
  accountId: string;
  transactionRef: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  narration: string;
  valueDate: string;
  createdAt: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface AccountSummary {
  accountId: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  status: string;
  accountType: string;
}

export const transactionApi = {
  list: (params?: { page?: number; limit?: number; accountId?: string; status?: string; from?: string; to?: string }) =>
    apiClient.get<TransactionListResponse>(`${APISIX.ACCOUNT}/v1/transactions`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Transaction>(`${APISIX.ACCOUNT}/v1/transactions/${id}`).then((r) => r.data),

  reverse: (id: string, reason: string) =>
    apiClient.post(`${APISIX.ACCOUNT}/v1/transactions/${id}/reverse`, { reason }).then((r) => r.data),

  getAccountSummary: (accountId: string) =>
    apiClient.get<AccountSummary>(`${APISIX.ACCOUNT}/v1/accounts/${accountId}/summary`).then((r) => r.data),
};

// ─── Payment Processing / Transfer ────────────────────────────────────────────
export interface TransferRequest {
  sourceAccountId: string;
  destinationAccountId?: string;
  destinationAccount?: string;
  destinationBankCode?: string;
  amount: number;
  currency: string;
  narration: string;
  channel?: string;
}

export interface TransferResponse {
  transferId: string;
  status: string;
  transactionRef: string;
  fee: number;
  createdAt: string;
}

export const transferApi = {
  initiate: (body: TransferRequest) =>
    apiClient.post<TransferResponse>(`/ledger/txn/?page=1&limit=50`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<TransferResponse>(`/ledger/txn/?page=1&limit=50}`).then((r) => r.data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`/ledger/txn/?page=1&limit=50`, { params }).then((r) => r.data),
};

// ─── Teller Operations ────────────────────────────────────────────────────────
export interface TellerSession {
  sessionId: string;
  tellerId: string;
  branchId: string;
  windowId: string;
  status: string;
  cashBalance: number;
  currency: string;
  openedAt: string;
}

export interface CashTransaction {
  transactionId: string;
  type: "deposit" | "withdrawal" | "check_deposit";
  accountId: string;
  amount: number;
  currency: string;
  narration: string;
  status: string;
  processedAt: string;
}

export const tellerOperationsApi = {
  getSessions: (params?: { branchId?: string; status?: string }) =>
    apiClient.get<{ items: TellerSession[]; total: number }>(`${APISIX.TELLER_OPERATIONS}/v1/sessions`, { params }).then((r) => r.data),

  openSession: (body: { branchId: string; windowId: string; openingCash: number; currency: string }) =>
    apiClient.post<TellerSession>(`${APISIX.TELLER_OPERATIONS}/v1/sessions`, body).then((r) => r.data),

  closeSession: (sessionId: string, body: { closingCash: number }) =>
    apiClient.post(`${APISIX.TELLER_OPERATIONS}/v1/sessions/${sessionId}/close`, body).then((r) => r.data),

  deposit: (body: { sessionId: string; accountId: string; amount: number; currency: string; narration: string }) =>
    apiClient.post<CashTransaction>(`${APISIX.TELLER_OPERATIONS}/v1/cash/deposit`, body).then((r) => r.data),

  withdraw: (body: { sessionId: string; accountId: string; amount: number; currency: string; narration: string }) =>
    apiClient.post<CashTransaction>(`${APISIX.TELLER_OPERATIONS}/v1/cash/withdrawal`, body).then((r) => r.data),

  getTransactions: (sessionId: string) =>
    apiClient.get<{ items: CashTransaction[]; total: number }>(`${APISIX.TELLER_OPERATIONS}/v1/sessions/${sessionId}/transactions`).then((r) => r.data),
};

// ─── Branch Management ────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  status: string;
  managerId: string;
  phone: string;
  email: string;
}

export interface BranchPerformance {
  branchId: string;
  branchName: string;
  transactionCount: number;
  transactionVolume: number;
  newAccounts: number;
  activeCustomers: number;
  loanDisbursements: number;
  period: string;
}

export const branchApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: Branch[]; total: number }>(`${APISIX.BRANCH_MANAGER}/v1/branches`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Branch>(`${APISIX.BRANCH_MANAGER}/v1/branches/${id}`).then((r) => r.data),

  create: (body: Partial<Branch>) =>
    apiClient.post<Branch>(`${APISIX.BRANCH_MANAGER}/v1/branches`, body).then((r) => r.data),

  update: (id: string, body: Partial<Branch>) =>
    apiClient.put<Branch>(`${APISIX.BRANCH_MANAGER}/v1/branches/${id}`, body).then((r) => r.data),

  getPerformance: (branchId: string, params?: { period?: string }) =>
    apiClient.get<BranchPerformance>(`${APISIX.BRANCH_OPERATIONS}/v1/branches/${branchId}/performance`, { params }).then((r) => r.data),

  getPerformanceMap: (params?: { period?: string }) =>
    apiClient.get<{ branches: BranchPerformance[] }>(`${APISIX.BRANCH_OPERATIONS}/v1/performance-map`, { params }).then((r) => r.data),
};

// ─── ATM Management ───────────────────────────────────────────────────────────
export interface ATMDevice {
  id: string;
  terminalId: string;
  location: string;
  branchId: string;
  status: string;
  cashLevel: number;
  currency: string;
  lastMaintenance: string;
  model: string;
}

export interface ATMStats {
  totalAtms: number;
  online: number;
  offline: number;
  lowCash: number;
  totalTransactions: number;
}

export const atmApi = {
  list: (params?: { page?: number; limit?: number; branchId?: string; status?: string }) =>
    apiClient.get<{ items: ATMDevice[]; total: number }>(`${APISIX.ATM}/v1/atms`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ATMDevice>(`${APISIX.ATM}/v1/atms/${id}`).then((r) => r.data),

  getStats: () =>
    apiClient.get<ATMStats>(`${APISIX.ATM}/v1/atms/stats`).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`${APISIX.ATM}/v1/atms/${id}/status`, { status }).then((r) => r.data),

  replenish: (id: string, body: { amount: number; currency: string }) =>
    apiClient.post(`${APISIX.ATM}/v1/atms/${id}/replenish`, body).then((r) => r.data),

  getTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.ATM}/v1/atms/${id}/transactions`, { params }).then((r) => r.data),
};

// ─── Card Management ──────────────────────────────────────────────────────────
export interface Card {
  id: string;
  cardNumber: string;
  accountId: string;
  customerId: string;
  cardType: string;
  status: string;
  expiryDate: string;
  createdAt: string;
}

export interface CardStats {
  totalCards: number;
  active: number;
  blocked: number;
  expired: number;
  issued: number;
}

export const cardApi = {
  list: (params?: { page?: number; limit?: number; status?: string; accountId?: string }) =>
    apiClient.get<{ items: Card[]; total: number }>(`${APISIX.CARD}/v1/cards`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Card>(`${APISIX.CARD}/v1/cards/${id}`).then((r) => r.data),

  issue: (body: { accountId: string; cardType: string; deliveryAddress?: string }) =>
    apiClient.post<Card>(`${APISIX.CARD}/v1/cards`, body).then((r) => r.data),

  updateStatus: (id: string, status: "block" | "unblock" | "cancel") =>
    apiClient.patch(`${APISIX.CARD}/v1/cards/${id}/status`, { status }).then((r) => r.data),

  resetPin: (id: string) =>
    apiClient.post(`${APISIX.CARD}/v1/cards/${id}/reset-pin`, {}).then((r) => r.data),

  getStats: () =>
    apiClient.get<CardStats>(`${APISIX.CARD}/v1/cards/stats`).then((r) => r.data),

  managedList: (params?: { page?: number; limit?: number }) =>
    apiClient.get<{ items: Card[]; total: number }>(`${APISIX.CARD_MANAGEMENT}/v1/cards`, { params }).then((r) => r.data),

  getFraudRules: () =>
    apiClient.get(`${APISIX.FRAUD_DETECTION}/v1/rules/card`).then((r) => r.data),

  updateFraudRule: (id: string, body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.FRAUD_DETECTION}/v1/rules/card/${id}`, body).then((r) => r.data),
};

// ─── POS Terminal ─────────────────────────────────────────────────────────────
export interface POSTerminal {
  id: string;
  terminalId: string;
  merchantId: string;
  location: string;
  status: string;
  lastTransaction: string;
  model: string;
}

export const posApi = {
  list: (params?: { page?: number; limit?: number; merchantId?: string; status?: string }) =>
    apiClient.get<{ items: POSTerminal[]; total: number }>(`${APISIX.POS}/v1/terminals`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<POSTerminal>(`${APISIX.POS}/v1/terminals/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`${APISIX.POS}/v1/terminals/${id}/status`, { status }).then((r) => r.data),

  getTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.POS}/v1/terminals/${id}/transactions`, { params }).then((r) => r.data),
};
