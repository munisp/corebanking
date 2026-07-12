import apiClient from './api';
import type { FacilityListResponse, Facility, FacilityStats } from '../types/creditFacility';

const BASE = '/credit/v1';

export const creditFacilityService = {
  list: () => apiClient.get<FacilityListResponse>(`${BASE}/facilities`).then(r => r.data),
  getById: (id: string) => apiClient.get<Facility>(`${BASE}/facilities/${id}`).then(r => r.data),
  stats: () => apiClient.get<FacilityStats>(`${BASE}/stats`).then(r => r.data),
};
