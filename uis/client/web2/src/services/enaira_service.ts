import { apiService } from './api_service';

const BASE = '/enaira-cbdc/v1';

export interface ENairaWallet {
  id: string;
  wallet_address?: string;
  wallet?: string;
  tier?: string;
  balance?: number | string;
  status?: string;
  created_at?: string;
  last_activity?: string;
  lastActivity?: string;
  [key: string]: unknown;
}

export interface ENairaTransfer {
  id: string;
  sender_wallet?: string;
  recipient_wallet?: string;
  amount: number | string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface ENairaStats {
  total_wallets?: number;
  active_wallets?: number;
  total_volume?: number | string;
  tier1_count?: number;
  tier2_count?: number;
  tier3_count?: number;
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

class ENairaService {
  getWallets() {
    return call<ENairaWallet[]>(() => apiService.get(`${BASE}/wallets`));
  }

  getWalletById(id: string) {
    return call<ENairaWallet>(() => apiService.get(`${BASE}/wallets/${id}`));
  }

  createWallet(data: Record<string, unknown>) {
    return call<ENairaWallet>(() => apiService.post(`${BASE}/wallets`, data));
  }

  fundWallet(id: string, data: Record<string, unknown>) {
    return call<ENairaWallet>(() => apiService.post(`${BASE}/wallets/${id}/fund`, data));
  }

  transfer(data: Record<string, unknown>) {
    return call<ENairaTransfer>(() => apiService.post(`${BASE}/transfers`, data));
  }

  getStats() {
    return call<ENairaStats>(() => apiService.get(`${BASE}/stats`));
  }

  getTransactions() {
    return call<ENairaTransfer[]>(() => apiService.get(`${BASE}/transactions`));
  }
}

export const enairaService = new ENairaService();
