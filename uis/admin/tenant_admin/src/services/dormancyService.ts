import apiClient from './api';
import type {
  DormantAccountListResponse,
  DormancyStats,
  CheckDormancyRequest,
  CheckDormancyResponse,
  ReactivateRequest,
  NotifyRequest,
  DormantAccount,
} from '../types/dormancy';

const BASE = '/dormancy/v1';

export const dormancyService = {
  list: (params?: { page?: number; limit?: number; search?: string; stage?: string }): Promise<DormantAccountListResponse> =>
    apiClient.get<DormantAccountListResponse>(`${BASE}/dormant-accounts`, { params }).then((r) => r.data),

  stats: (): Promise<DormancyStats> =>
    apiClient.get<DormancyStats>(`${BASE}/stats`).then((r) => r.data),

  check: (input: CheckDormancyRequest): Promise<CheckDormancyResponse> =>
    apiClient.post<CheckDormancyResponse>(`${BASE}/check`, input).then((r) => r.data),

  reactivate: (input: ReactivateRequest): Promise<{ reactivated: boolean; account: DormantAccount }> =>
    apiClient.post(`${BASE}/reactivate`, input).then((r) => r.data),

  notify: (input: NotifyRequest): Promise<{ notified: boolean; channel: string; notifications_sent: number; account: DormantAccount }> =>
    apiClient.post(`${BASE}/notify`, input).then((r) => r.data),
};
