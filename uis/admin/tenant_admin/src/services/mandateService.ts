import apiClient from './api';
import type { MandateListResponse, MandateStats } from '../types/mandate';

const BASE = '/mandates/v1';

export const mandateService = {
  list: (): Promise<MandateListResponse> =>
    apiClient.get<MandateListResponse>(`${BASE}/mandates`).then((r) => r.data),

  stats: (): Promise<MandateStats> =>
    apiClient.get<MandateStats>(`${BASE}/stats`).then((r) => r.data),
};
