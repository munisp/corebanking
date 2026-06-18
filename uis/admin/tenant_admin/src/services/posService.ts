import apiClient from './api';
import type {
  POSTerminal,
  POSTerminalListResponse,
  POSTransaction,
  POSTransactionListResponse,
  POSStats,
  CreatePOSTerminalPayload,
  CreatePOSTransactionPayload,
} from '../types/pos';

const BASE = '/pos/v1/pos';

export const posService = {
  listTerminals: (): Promise<POSTerminalListResponse> =>
    apiClient.get<POSTerminalListResponse>(`${BASE}/terminals`).then((r) => r.data),

  createTerminal: (payload: CreatePOSTerminalPayload): Promise<POSTerminal> =>
    apiClient.post<POSTerminal>(`${BASE}/terminals`, payload).then((r) => r.data),

  listTransactions: (): Promise<POSTransactionListResponse> =>
    apiClient.get<POSTransactionListResponse>(`${BASE}/transactions`).then((r) => r.data),

  createTransaction: (payload: CreatePOSTransactionPayload): Promise<POSTransaction> =>
    apiClient.post<POSTransaction>(`${BASE}/transactions`, payload).then((r) => r.data),

  getStats: (): Promise<POSStats> =>
    apiClient.get<POSStats>(`${BASE}/stats`).then((r) => r.data),
};
