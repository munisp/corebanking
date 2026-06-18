import apiClient from './api';
import type { CoopCreditListResponse, CoopCreditStats, CreateMLRecordPayload } from '../types/cooperativeCreditScoring';

const BASE = '/credit/v1/cooperative-credit-scoring';

export const cooperativeCreditScoringService = {
  list: () => apiClient.get<CoopCreditListResponse>(`${BASE}/list`).then(r => r.data),
  stats: () => apiClient.get<CoopCreditStats>(`${BASE}/stats`).then(r => r.data),
  create: (payload: CreateMLRecordPayload) => apiClient.post(`${BASE}/create`, payload).then(r => r.data),
};
