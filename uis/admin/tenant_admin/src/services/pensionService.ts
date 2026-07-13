import apiClient from './api';
import type {
  PensionAccount,
  PensionListResponse,
  PensionStats,
  CreatePensionPayload,
  PensionContributionListResponse,
} from '../types/pension';

const BASE = '/pension/v1/pension-py';

export const pensionService = {
  list: (): Promise<PensionListResponse> =>
    apiClient.get<PensionListResponse>(`${BASE}/pension_accounts`).then((r) => r.data),

  stats: (): Promise<PensionStats> =>
    apiClient.get<PensionStats>(`${BASE}/stats`).then((r) => r.data),

  getById: (id: string): Promise<PensionAccount> =>
    apiClient
      .get<{ item: PensionAccount }>(`${BASE}/pension_accounts/${id}`)
      .then((r) => r.data.item),

  create: (payload: CreatePensionPayload): Promise<PensionAccount> =>
    apiClient
      .post<{ item: PensionAccount }>(`${BASE}/pension_accounts`, {
        customer_name: payload.customer_name,
        account_type: payload.account_type,
        pfa: payload.pfa,
        rsa_number: payload.rsa_number,
        currency: payload.currency,
        status: payload.status ?? 'active',
        employer_contribution: payload.employer_contribution ?? 0,
        employee_contribution: payload.employee_contribution ?? 0,
        total_contributions:
          (payload.employer_contribution ?? 0) + (payload.employee_contribution ?? 0),
      })
      .then((r) => r.data.item),

  pause: (id: string): Promise<PensionAccount> =>
    apiClient
      .post<{ item: PensionAccount }>(`${BASE}/pension_accounts/${id}/pause`, {})
      .then((r) => r.data.item),

  resume: (id: string): Promise<PensionAccount> =>
    apiClient
      .post<{ item: PensionAccount }>(`${BASE}/pension_accounts/${id}/resume`, {})
      .then((r) => r.data.item),

  withdraw: (id: string): Promise<PensionAccount> =>
    apiClient
      .post<{ item: PensionAccount }>(`${BASE}/pension_accounts/${id}/withdraw`, {})
      .then((r) => r.data.item),

  getContributions: (id: string): Promise<PensionContributionListResponse> =>
    apiClient
      .get<PensionContributionListResponse>(`${BASE}/pension_accounts/${id}/contributions`)
      .then((r) => r.data),
};
