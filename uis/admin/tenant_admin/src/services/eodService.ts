import apiClient from './api';
import type {
  EodRun,
  EodRunsResponse,
  EodPipeline,
  TriggerEodRequest,
  TriggerEodResponse,
} from '../types/eod';

const BASE = '/eod/v1/eod';

export const eodService = {
  listRuns: (): Promise<EodRunsResponse> =>
    apiClient.get<EodRunsResponse>(`${BASE}/runs`).then((r) => r.data),

  getRun: (id: number): Promise<EodRun> =>
    apiClient.get<EodRun>(`${BASE}/runs/${id}`).then((r) => r.data),

  trigger: (input: TriggerEodRequest): Promise<TriggerEodResponse> =>
    apiClient.post<TriggerEodResponse>(`${BASE}/trigger`, input).then((r) => r.data),

  getPipeline: (): Promise<EodPipeline> =>
    apiClient.get<EodPipeline>(`${BASE}/pipeline`).then((r) => r.data),
};
