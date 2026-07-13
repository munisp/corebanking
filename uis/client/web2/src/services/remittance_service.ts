import { apiService } from './api_service';

const BASE = '/remittance/v1';

export interface RemittanceTransfer {
  id: string;
  sender_name?: string;
  beneficiary_name?: string;
  amount: number | string;
  currency?: string;
  corridor?: string;
  status?: string;
  created_at?: string;
  fee?: number | string;
  exchange_rate?: number | string;
  [key: string]: unknown;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at?: string;
}

export interface RemittanceCorridor {
  id: string;
  name: string;
  from_country: string;
  to_country: string;
  currencies: string[];
  enabled: boolean;
}

export interface RemittanceBeneficiary {
  id: string;
  name: string;
  account_number: string;
  bank_name?: string;
  country?: string;
  currency?: string;
}

export interface RemittanceStats {
  total_transfers: number;
  total_volume: number | string;
  completed: number;
  pending: number;
  failed: number;
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

class RemittanceService {
  getTransfers() {
    return call<RemittanceTransfer[]>(() => apiService.get(`${BASE}/transfers`));
  }

  getTransferById(id: string) {
    return call<RemittanceTransfer>(() => apiService.get(`${BASE}/transfers/${id}`));
  }

  initiateTransfer(data: Record<string, unknown>) {
    return call<RemittanceTransfer>(() => apiService.post(`${BASE}/transfers`, data));
  }

  getExchangeRate(fromCurrency: string, toCurrency: string) {
    return call<ExchangeRate>(() =>
      apiService.get(`${BASE}/exchange-rates`, { from_currency: fromCurrency, to_currency: toCurrency })
    );
  }

  getCorridors() {
    return call<RemittanceCorridor[]>(() => apiService.get(`${BASE}/corridors`));
  }

  getStats() {
    return call<RemittanceStats>(() => apiService.get(`${BASE}/stats`));
  }

  getBeneficiaries() {
    return call<RemittanceBeneficiary[]>(() => apiService.get(`${BASE}/beneficiaries`));
  }
}

export const remittanceService = new RemittanceService();
