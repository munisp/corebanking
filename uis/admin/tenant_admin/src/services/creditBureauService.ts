import apiClient from './api';
import type {
  CreditReportListResponse, FacilityRecordListResponse,
  ScoreCheckPayload, ScoreCheckResult, CreditBureauStats,
} from '../types/creditBureau';

const BASE = '/credit/v1/credit-bureau';

export const creditBureauService = {
  listReports: () => apiClient.get<CreditReportListResponse>(`${BASE}/reports`).then(r => r.data),
  listFacilities: () => apiClient.get<FacilityRecordListResponse>(`${BASE}/facilities`).then(r => r.data),
  scoreCheck: (payload: ScoreCheckPayload) => apiClient.post<ScoreCheckResult>(`${BASE}/score-check`, payload).then(r => r.data),
  stats: () => apiClient.get<CreditBureauStats>(`${BASE}/stats`).then(r => r.data),
};
