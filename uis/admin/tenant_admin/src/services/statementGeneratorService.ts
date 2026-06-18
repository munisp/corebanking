import apiClient from './api';
import type {
  Statement,
  StatementListResponse,
  StatementStats,
} from '../types/statementGenerator';

const BASE = '/statement-gen/v1';

export const statementGeneratorService = {
  list: (): Promise<StatementListResponse> =>
    apiClient.get<StatementListResponse>(`${BASE}/statements`).then((r) => r.data),

  getById: (id: string): Promise<Statement> =>
    apiClient.get<Statement>(`${BASE}/statements/${id}`).then((r) => r.data),

  stats: (): Promise<StatementStats> =>
    apiClient.get<StatementStats>(`${BASE}/stats`).then((r) => r.data),
};
