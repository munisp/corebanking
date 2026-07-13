import apiClient from './api';
import type { SyndicatedLoanListResponse, SyndicatedLoanStats } from '../types/syndicatedLoans';

const BASE = '/syndicated-loans/v1/syndicated-loans';

export const syndicatedLoansService = {
  list: () => apiClient.get<SyndicatedLoanListResponse>(`${BASE}/facilities`).then(r => r.data),
  stats: () => apiClient.get<SyndicatedLoanStats>(`${BASE}/stats`).then(r => r.data),
};
