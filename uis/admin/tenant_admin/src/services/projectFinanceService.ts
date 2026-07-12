import apiClient from './api';
import type { ProjectDealListResponse, ProjectFinanceStats } from '../types/projectFinance';

const BASE = '/project-finance/v1/project-finance';

export interface CreateProjectDealPayload {
  project_name: string;
  sponsor: string;
  business_id?: string;
  sector: string;
  total_cost: number;
  currency?: string;
  tenor?: string;
  debt_equity_ratio?: string;
}

export const projectFinanceService = {
  list: () => apiClient.get<ProjectDealListResponse>(`${BASE}/deals`).then(r => r.data),
  stats: () => apiClient.get<ProjectFinanceStats>(`${BASE}/stats`).then(r => r.data),
  create: (payload: CreateProjectDealPayload) => apiClient.post(`${BASE}/deals`, payload).then(r => r.data),
};
