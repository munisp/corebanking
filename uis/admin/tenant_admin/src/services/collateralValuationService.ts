import apiClient from './api';
import type {
  ValuationListResponse, ValuationSummary,
  ComputeFSVPayload, FSVResult,
} from '../types/collateralValuation';

const BASE = '/credit/v1/valuations';

export const collateralValuationService = {
  list: () => apiClient.get<ValuationListResponse>(BASE).then(r => r.data),
  computeFSV: (payload: ComputeFSVPayload) => apiClient.post<FSVResult>(`${BASE}/compute-fsv`, payload).then(r => r.data),
  summary: () => apiClient.get<ValuationSummary>(`${BASE}/summary`).then(r => r.data),
};
