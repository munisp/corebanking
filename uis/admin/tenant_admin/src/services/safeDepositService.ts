import apiClient from './api';
import type {
  DepositBoxListResponse,
  DepositBoxStats,
  CreateBoxInput,
  AssignBoxInput,
  UpdateBoxInput,
  VacateBoxInput,
  DepositBox,
} from '../types/safeDeposit';

const BASE = '/safe-deposit/v1/safe-deposit';

export const safeDepositService = {
  list: (): Promise<DepositBoxListResponse> =>
    apiClient.get<DepositBoxListResponse>(`${BASE}/list`).then((r) => r.data),

  stats: (): Promise<DepositBoxStats> =>
    apiClient.get<DepositBoxStats>(`${BASE}/stats`).then((r) => r.data),

  create: (input: CreateBoxInput): Promise<{ created: boolean; box: DepositBox }> =>
    apiClient.post(`${BASE}/create`, input).then((r) => r.data),

  assign: (input: AssignBoxInput): Promise<{ updated: boolean; box: DepositBox }> =>
    apiClient.post(`${BASE}/assign`, input).then((r) => r.data),

  update: (input: UpdateBoxInput): Promise<{ updated: boolean; box: DepositBox }> =>
    apiClient.post(`${BASE}/update`, input).then((r) => r.data),

  vacate: (input: VacateBoxInput): Promise<{ updated: boolean; box: DepositBox }> =>
    apiClient.post(`${BASE}/vacate`, input).then((r) => r.data),
};
