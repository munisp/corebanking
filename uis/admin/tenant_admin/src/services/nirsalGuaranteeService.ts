import apiClient from './api';
import type { NIRSALListResponse, NIRSALStats, CreateNIRSALPayload } from '../types/nirsalGuarantee';

const BASE = '/credit/v1/nirsal-credit-guarantee';

export const nirsalGuaranteeService = {
  list: () => apiClient.get<NIRSALListResponse>(`${BASE}/list`).then(r => r.data),
  create: (payload: CreateNIRSALPayload) => apiClient.post(`${BASE}/create`, payload).then(r => r.data),
  stats: () => apiClient.get<NIRSALStats>(`${BASE}/stats`).then(r => r.data),
};
