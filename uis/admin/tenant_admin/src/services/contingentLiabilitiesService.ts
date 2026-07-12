import apiClient from './api';
import type { ContingentLiabilityListResponse } from '../types/contingentLiabilities';

const BASE = '/contingent-liabilities/v1/contingent-liabilities-rs';

export const contingentLiabilitiesService = {
  list: () => apiClient.get<ContingentLiabilityListResponse>(`${BASE}/list`).then(r => r.data),
};
