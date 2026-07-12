import apiClient from './api';
import type { LeaseContractListResponse, LeasingStats } from '../types/leasing';

const BASE = '/leasing/v1/leasing';

export const leasingService = {
  list: () => apiClient.get<LeaseContractListResponse>(`${BASE}/contracts`).then(r => r.data),
  stats: () => apiClient.get<LeasingStats>(`${BASE}/stats`).then(r => r.data),
};
