import apiClient from './api';
import type {
  RiskAssessmentListResponse, ScoreEntityPayload, ScoreEntityResult, RiskPortfolio,
} from '../types/riskScoring';

const BASE = '/credit/v1/risk';

export const riskScoringService = {
  listAssessments: () => apiClient.get<RiskAssessmentListResponse>(`${BASE}/assessments`).then(r => r.data),
  scoreEntity: (payload: ScoreEntityPayload) => apiClient.post<ScoreEntityResult>(`${BASE}/score`, payload).then(r => r.data),
  portfolio: () => apiClient.get<RiskPortfolio>(`${BASE}/portfolio`).then(r => r.data),
};
