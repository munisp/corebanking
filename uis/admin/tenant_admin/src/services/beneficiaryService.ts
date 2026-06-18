import apiClient from './api';
import type {
  Beneficiary,
  BeneficiaryListResponse,
  CreateBeneficiaryPayload,
  NameEnquiryPayload,
  NameEnquiryResponse,
  SetLimitsPayload,
  BankDirectoryResponse,
} from '../types/beneficiary';

const BASE = '/beneficiaries/v1/beneficiaries';

export const beneficiaryService = {
  list: (customerId?: string): Promise<BeneficiaryListResponse> =>
    apiClient
      .get<BeneficiaryListResponse>(BASE, { params: customerId ? { customerId } : {} })
      .then((r) => r.data),

  create: (payload: CreateBeneficiaryPayload): Promise<Beneficiary> =>
    apiClient.post<Beneficiary>(BASE, payload).then((r) => r.data),

  delete: (beneficiaryId: string): Promise<{ status: string }> =>
    apiClient
      .delete<{ status: string }>(BASE, { data: { beneficiaryId } })
      .then((r) => r.data),

  nameEnquiry: (payload: NameEnquiryPayload): Promise<NameEnquiryResponse> =>
    apiClient
      .post<NameEnquiryResponse>(`${BASE}/verify`, payload)
      .then((r) => r.data),

  toggleFavorite: (beneficiaryId: string): Promise<Beneficiary> =>
    apiClient
      .post<Beneficiary>(`${BASE}/favorite`, { beneficiaryId })
      .then((r) => r.data),

  getBanks: (): Promise<BankDirectoryResponse> =>
    apiClient.get<BankDirectoryResponse>(`${BASE}/banks`).then((r) => r.data),

  setLimits: (payload: SetLimitsPayload): Promise<Beneficiary> =>
    apiClient
      .post<Beneficiary>(`${BASE}/limits`, payload)
      .then((r) => r.data),
};
