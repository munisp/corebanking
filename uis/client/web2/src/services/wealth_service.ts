import { apiService } from './api_service';

const BASE = '/wealth/v1';

export interface WealthPortfolio {
  id: string;
  client?: string;
  client_name?: string;
  aum?: number | string;
  strategy?: string;
  ytd_return?: number | string;
  ytdReturn?: string;
  risk_profile?: string;
  riskProfile?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PortfolioHolding {
  id: string;
  asset_name: string;
  ticker?: string;
  quantity: number;
  current_value: number | string;
  weight_pct?: number;
  [key: string]: unknown;
}

export interface PortfolioPerformance {
  portfolio_id: string;
  ytd_return?: number;
  one_year_return?: number;
  three_year_return?: number;
  since_inception?: number;
  [key: string]: unknown;
}

export interface WealthClient {
  id: string;
  name: string;
  tier?: string;
  relationship_manager?: string;
  [key: string]: unknown;
}

export interface InvestmentOption {
  id: string;
  name: string;
  strategy: string;
  min_investment?: number | string;
  expected_return?: string;
  risk_level?: string;
  [key: string]: unknown;
}

export interface WealthDashboard {
  total_aum?: number | string;
  total_portfolios?: number;
  active_clients?: number;
  avg_ytd_return?: number | string;
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

class WealthService {
  getPortfolios() {
    return call<WealthPortfolio[]>(() => apiService.get(`${BASE}/portfolios`));
  }

  getPortfolioById(id: string) {
    return call<WealthPortfolio>(() => apiService.get(`${BASE}/portfolios/${id}`));
  }

  createPortfolio(data: Record<string, unknown>) {
    return call<WealthPortfolio>(() => apiService.post(`${BASE}/portfolios`, data));
  }

  updatePortfolio(id: string, data: Record<string, unknown>) {
    return call<WealthPortfolio>(() => apiService.put(`${BASE}/portfolios/${id}`, data));
  }

  getPortfolioHoldings(id: string) {
    return call<PortfolioHolding[]>(() => apiService.get(`${BASE}/portfolios/${id}/holdings`));
  }

  getPortfolioPerformance(id: string) {
    return call<PortfolioPerformance>(() => apiService.get(`${BASE}/portfolios/${id}/performance`));
  }

  getClients() {
    return call<WealthClient[]>(() => apiService.get(`${BASE}/clients`));
  }

  getInvestmentOptions() {
    return call<InvestmentOption[]>(() => apiService.get(`${BASE}/investment-options`));
  }

  getDashboard() {
    return call<WealthDashboard>(() => apiService.get(`${BASE}/dashboard`));
  }
}

export const wealthService = new WealthService();
