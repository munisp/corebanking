import { apiService } from './api_service';

const BASE = '/carbon/api/v1/carbon';

export interface CarbonCredit {
  id: string;
  project_name?: string;
  vintage_year?: number | string;
  quantity?: number;
  price_per_tonne?: number | string;
  status?: string;
  registry?: string;
  standard?: string;
  [key: string]: unknown;
}

export interface CarbonProject {
  id: string;
  name: string;
  type?: string;
  country?: string;
  methodology?: string;
  annual_credits?: number;
  status?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CarbonTrade {
  id: string;
  credit_id?: string;
  buyer?: string;
  seller?: string;
  quantity?: number;
  price?: number | string;
  total_value?: number | string;
  status?: string;
  traded_at?: string;
  [key: string]: unknown;
}

export interface CarbonFootprint {
  total_emissions?: number | string;
  unit?: string;
  period?: string;
  breakdown?: Record<string, number>;
  [key: string]: unknown;
}

export interface CarbonStats {
  total_credits?: number;
  retired_credits?: number;
  active_projects?: number;
  total_offset?: number | string;
  [key: string]: unknown;
}

interface ApiResult<T> {
  success: boolean;
  data: T | null;
  message: string;
}

async function call<T>(fn: () => Promise<{ data: unknown }>): Promise<ApiResult<T>> {
  try {
    const res = await fn();
    const payload = res.data as { data?: T; results?: T } | T;
    const data =
      payload && typeof payload === 'object' && ('data' in payload || 'results' in payload)
        ? ((payload as { data?: T; results?: T }).data ?? (payload as { results?: T }).results ?? (payload as T))
        : (payload as T);
    return { success: true, data, message: 'OK' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    return { success: false, data: null, message: msg };
  }
}

class CarbonService {
  getCarbonCredits() {
    return call<CarbonCredit[]>(() => apiService.get(BASE));
  }

  getCreditById(id: string) {
    return call<CarbonCredit>(() => apiService.get(`${BASE}/${id}`));
  }

  purchaseCredits(data: Record<string, unknown>) {
    return call<CarbonCredit>(() => apiService.post(`${BASE}/purchase`, data));
  }

  retireCredits(id: string, data: Record<string, unknown>) {
    return call<CarbonCredit>(() => apiService.post(`${BASE}/${id}/retire`, data));
  }

  getFootprint() {
    return call<CarbonFootprint>(() => apiService.get(`${BASE}/footprint`));
  }

  getProjects() {
    return call<CarbonProject[]>(() => apiService.get(`${BASE}/projects`));
  }

  getProjectById(id: string) {
    return call<CarbonProject>(() => apiService.get(`${BASE}/projects/${id}`));
  }

  getTradeHistory() {
    return call<CarbonTrade[]>(() => apiService.get(`${BASE}/trades`));
  }

  getStats() {
    return call<CarbonStats>(() => apiService.get(`${BASE}/stats`));
  }

  offsetEmissions(data: Record<string, unknown>) {
    return call<CarbonCredit>(() => apiService.post(`${BASE}/offset`, data));
  }
}

export const carbonService = new CarbonService();
