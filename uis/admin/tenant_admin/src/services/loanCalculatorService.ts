import apiClient from './api';
import type {
  LoanCalculation,
  LoanCalculationListResponse,
  CalculateLoanPayload,
  SchedulePayload,
  ScheduleResponse,
  ComparePayload,
  CompareResponse,
  AffordabilityPayload,
  AffordabilityResponse,
} from '../types/loanCalculator';

const BASE = '/loan/api/v1/loans/calculator';

export const loanCalculatorService = {
  list: (): Promise<LoanCalculationListResponse> =>
    apiClient.get<LoanCalculationListResponse>(BASE).then((r) => r.data),

  calculate: (payload: CalculateLoanPayload): Promise<LoanCalculation> =>
    apiClient.post<LoanCalculation>(BASE, payload).then((r) => r.data),

  schedule: (payload: SchedulePayload): Promise<ScheduleResponse> =>
    apiClient.post<ScheduleResponse>(`${BASE}/schedule`, payload).then((r) => r.data),

  compare: (payload: ComparePayload): Promise<CompareResponse> =>
    apiClient.post<CompareResponse>(`${BASE}/compare`, payload).then((r) => r.data),

  affordability: (payload: AffordabilityPayload): Promise<AffordabilityResponse> =>
    apiClient.post<AffordabilityResponse>(`${BASE}/affordability`, payload).then((r) => r.data),
};
