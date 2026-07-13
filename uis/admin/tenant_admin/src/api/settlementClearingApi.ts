/**
 * Settlement & Clearing API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬──────────────────────────┬───────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix            │ Backend Service           │ Port  │
 * ├──────────────────────────────┼──────────────────────────┼───────────────────────────┼───────┤
 * │ /cheque-clearing             │ /cheque-clearing         │ cheque-clearing-go        │ 9240  │
 * │ /interbank-settlement        │ /banking-clearing-ops    │ banking-clearing-ops-rs   │ 1105  │
 * │ /eod-processor               │ /eod                     │ eod-processor-go          │ 8207  │
 * │ /batch-eod                   │ /batch-processing        │ batch-processing-py       │ 9219  │
 * │ /batch-processing            │ /batch-processing        │ batch-processing-py       │ 9219  │
 * │ /batch-aggregator            │ /batch-processing        │ batch-aggregator-go       │ 9099  │
 * └──────────────────────────────┴──────────────────────────┴───────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Cheque Clearing ──────────────────────────────────────────────────────────
export interface ChequeItem {
  id: string;
  chequeRef: string;
  drawerAccountId: string;
  drawerBankCode: string;
  payeeAccountId?: string;
  amount: number;
  currency: string;
  chequeDate: string;
  presentedDate: string;
  status: "pending" | "clearing" | "cleared" | "returned" | "stopped";
  returnReason?: string;
}

export interface ClearingSession {
  id: string;
  sessionRef: string;
  clearingDate: string;
  totalItems: number;
  totalValue: number;
  currency: string;
  status: "open" | "submitted" | "settled" | "reconciled";
  nibssRef?: string;
}

export const chequeClearingApi = {
  listItems: (params?: { page?: number; limit?: number; status?: string; from?: string; to?: string }) =>
    apiClient.get<{ items: ChequeItem[]; total: number }>(`${APISIX.CHEQUE_CLEARING}/api/v1/cheques`, { params }).then((r) => r.data),

  getItemById: (id: string) =>
    apiClient.get<ChequeItem>(`${APISIX.CHEQUE_CLEARING}/api/v1/cheques/${id}`).then((r) => r.data),

  present: (body: Partial<ChequeItem>) =>
    apiClient.post<ChequeItem>(`${APISIX.CHEQUE_CLEARING}/api/v1/cheques`, body).then((r) => r.data),

  return: (id: string, reason: string) =>
    apiClient.post(`${APISIX.CHEQUE_CLEARING}/api/v1/cheques/${id}/return`, { reason }).then((r) => r.data),

  stop: (id: string, reason: string) =>
    apiClient.post(`${APISIX.CHEQUE_CLEARING}/api/v1/cheques/${id}/stop`, { reason }).then((r) => r.data),

  listSessions: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: ClearingSession[]; total: number }>(`${APISIX.CHEQUE_CLEARING}/api/v1/sessions`, { params }).then((r) => r.data),

  submitSession: (sessionId: string) =>
    apiClient.post(`${APISIX.CHEQUE_CLEARING}/api/v1/sessions/${sessionId}/submit`, {}).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.CHEQUE_CLEARING}/api/v1/stats`).then((r) => r.data),
};

// ─── Banking / Clearing Operations (Interbank Settlement) ─────────────────────
export interface SettlementInstruction {
  id: string;
  instructionRef: string;
  type: "debit" | "credit";
  counterpartyBankCode: string;
  amount: number;
  currency: string;
  valueDate: string;
  status: "pending" | "submitted" | "settled" | "failed";
  nibssRef?: string;
  createdAt: string;
}

export interface SettlementWindow {
  id: string;
  windowRef: string;
  openTime: string;
  closeTime: string;
  totalDebits: number;
  totalCredits: number;
  netPosition: number;
  currency: string;
  status: "open" | "closed" | "settled";
}

export const bankingClearingOpsApi = {
  listInstructions: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: SettlementInstruction[]; total: number }>(`${APISIX.BANKING_CLEARING_OPS}/v1/mojaloop-settlement-mgr/list`, { params }).then((r) => r.data),

  getInstructionById: (_id: string) =>
    apiClient.get<SettlementInstruction>(`${APISIX.BANKING_CLEARING_OPS}/v1/mojaloop-settlement-mgr/list`).then((r) => r.data),

  listWindows: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SettlementWindow[]; total: number }>(`${APISIX.BANKING_CLEARING_OPS}/v1/mojaloop-settlement-mgr/list`, { params }).then((r) => r.data),

  getNetPosition: (date?: string) =>
    apiClient.get(`${APISIX.BANKING_CLEARING_OPS}/v1/mojaloop-settlement-mgr/stats`, { params: { date } }).then((r) => r.data),

  runReconciliation: (_windowId: string) =>
    apiClient.post(`${APISIX.BANKING_CLEARING_OPS}/v1/mojaloop-settlement-mgr/process`, {}).then((r) => r.data),
};

// ─── EOD Processor ────────────────────────────────────────────────────────────
export interface EODJob {
  id: string;
  jobRef: string;
  businessDate: string;
  status: "pending" | "running" | "completed" | "failed";
  steps: { name: string; status: string; startedAt?: string; completedAt?: string; error?: string }[];
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
}

export const eodProcessorApi = {
  listJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: EODJob[]; total: number }>(`${APISIX.EOD_PROCESSOR}/v1/eod/runs`, { params }).then((r) => r.data),

  getJobById: (id: string) =>
    apiClient.get<EODJob>(`${APISIX.EOD_PROCESSOR}/v1/eod/runs/${id}`).then((r) => r.data),

  triggerEOD: (businessDate: string) =>
    apiClient.post<EODJob>(`${APISIX.EOD_PROCESSOR}/v1/eod/trigger`, { businessDate }).then((r) => r.data),

  getCurrentStatus: () =>
    apiClient.get(`${APISIX.EOD_PROCESSOR}/v1/eod/pipeline`).then((r) => r.data),

  retryStep: (_jobId: string, _stepName: string) =>
    apiClient.post(`${APISIX.EOD_PROCESSOR}/v1/eod/trigger`, {}).then((r) => r.data),
};

// ─── Batch Processing ─────────────────────────────────────────────────────────
export interface BatchJob {
  id: string;
  jobRef: string;
  jobType: string;
  totalRecords: number;
  processed: number;
  succeeded: number;
  failed: number;
  status: "queued" | "running" | "completed" | "failed" | "paused";
  submittedBy: string;
  startedAt?: string;
  completedAt?: string;
}

export const batchProcessingApi = {
  listJobs: (params?: { page?: number; limit?: number; jobType?: string; status?: string }) =>
    apiClient.get<{ items: BatchJob[]; total: number }>(`${APISIX.BATCH_PROCESSING}/v1/eod/runs`, { params }).then((r) => r.data),

  getJobById: (id: string) =>
    apiClient.get<BatchJob>(`${APISIX.BATCH_PROCESSING}/v1/eod/runs/${id}`).then((r) => r.data),

  submitJob: (body: { jobType: string; params?: Record<string, unknown> }) =>
    apiClient.post<BatchJob>(`${APISIX.BATCH_PROCESSING}/v1/eod/trigger`, body).then((r) => r.data),

  pauseJob: (_id: string) =>
    apiClient.post(`${APISIX.BATCH_PROCESSING}/v1/eod/trigger`, {}).then((r) => r.data),

  resumeJob: (_id: string) =>
    apiClient.post(`${APISIX.BATCH_PROCESSING}/v1/eod/trigger`, {}).then((r) => r.data),

  cancelJob: (_id: string, _reason: string) =>
    apiClient.post(`${APISIX.BATCH_PROCESSING}/v1/eod/trigger`, {}).then((r) => r.data),

  getJobErrors: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.BATCH_PROCESSING}/v1/eod/runs/${id}`, { params }).then((r) => r.data),

  getScheduledJobs: () =>
    apiClient.get(`${APISIX.BATCH_PROCESSING}/v1/eod/runs`).then((r) => r.data),
};
