import apiClient from './api';
import type {
  InsuranceRecordListResponse,
  InsuranceAnalyticsStats,
  CreateInsuranceRecordPayload,
  InsuranceRecord,
} from '../types/insuranceAnalytics';

const BASE = '/insurance-portfolio-analytics/v1/insurance-portfolio-analytics';

export const insuranceAnalyticsService = {
  list: (): Promise<InsuranceRecordListResponse> =>
    apiClient.get<InsuranceRecordListResponse>(`${BASE}/list`).then((r) => r.data),

  stats: (): Promise<InsuranceAnalyticsStats> =>
    apiClient.get<InsuranceAnalyticsStats>(`${BASE}/stats`).then((r) => r.data),

  create: (payload: CreateInsuranceRecordPayload): Promise<{ created: boolean; record: InsuranceRecord }> =>
    apiClient
      .post<{ created: boolean; record: InsuranceRecord }>(`${BASE}/create`, payload)
      .then((r) => r.data),
};
