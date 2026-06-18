import apiClient from './api';
import type { CIF, CIFListResponse, CIFStats } from '../types/cif';

const BASE = '/cif/v1';

export const cifService = {
  list: (): Promise<CIFListResponse> =>
    apiClient.get<CIFListResponse>(`${BASE}/customers`).then((r) => r.data),

  getById: (id: string): Promise<CIF> =>
    apiClient.get<CIF>(`${BASE}/customers/${id}`).then((r) => r.data),

  stats: (): Promise<CIFStats> =>
    apiClient.get<CIFStats>(`${BASE}/stats`).then((r) => r.data),
};
