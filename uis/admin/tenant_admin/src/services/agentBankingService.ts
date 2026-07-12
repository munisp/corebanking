import apiClient from './api';
import type {
  AgentTransactionListResponse,
  AgentBankingStats,
  AgentTransaction,
  CreateAgentTransactionPayload,
} from '../types/agentBanking';

const BASE = '/agent-banking/v1/agent-banking';

export const agentBankingService = {
  list: (params: { page?: number; limit?: number; search?: string } = {}): Promise<AgentTransactionListResponse> =>
    apiClient
      .get<AgentTransactionListResponse>(`${BASE}/list`, { params })
      .then((r) => r.data),

  stats: (): Promise<AgentBankingStats> =>
    apiClient.get<AgentBankingStats>(`${BASE}/stats`).then((r) => r.data),

  getById: (id: string): Promise<AgentTransaction> =>
    apiClient.get<AgentTransaction>(`${BASE}/${id}`).then((r) => r.data),

  create: (payload: CreateAgentTransactionPayload): Promise<{ created: boolean; data: AgentTransaction }> =>
    apiClient
      .post<{ created: boolean; data: AgentTransaction }>(BASE, payload)
      .then((r) => r.data),
};
