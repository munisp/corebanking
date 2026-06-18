import apiClient from './api';
import type {
  OBConsent,
  OBConsentListResponse,
  TPPListResponse,
  OBAPIEndpointListResponse,
  OpenBankingStats,
  CreateConsentPayload,
} from '../types/openBanking';

const BASE = '/open-banking/v1/open-banking';

export const openBankingService = {
  listConsents: (): Promise<OBConsentListResponse> =>
    apiClient.get<OBConsentListResponse>(`${BASE}/consents`).then((r) => r.data),

  createConsent: (payload: CreateConsentPayload): Promise<OBConsent> =>
    apiClient.post<OBConsent>(`${BASE}/consents`, payload).then((r) => r.data),

  listTPPs: (): Promise<TPPListResponse> =>
    apiClient.get<TPPListResponse>(`${BASE}/tpps`).then((r) => r.data),

  apiCatalog: (): Promise<OBAPIEndpointListResponse> =>
    apiClient.get<OBAPIEndpointListResponse>(`${BASE}/api-catalog`).then((r) => r.data),

  stats: (): Promise<OpenBankingStats> =>
    apiClient.get<OpenBankingStats>(`${BASE}/stats`).then((r) => r.data),
};
