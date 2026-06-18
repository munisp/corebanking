import { apiService } from './api_service';

const BASE = '/pension/v1/pension-py';

export interface PensionAccount {
  id: string;
  customer_name: string;
  account_type: 'individual' | 'employer';
  pfa: string;
  rsa_number: string;
  total_contributions: number;
  employer_contribution: number;
  employee_contribution: number;
  currency: string;
  status: 'active' | 'inactive' | 'withdrawn';
  created_at?: string;
}

export interface PensionContribution {
  id: string;
  account_id: string;
  date: string;
  employer: number;
  employee: number;
  total: number;
  status: 'posted' | 'pending' | 'failed';
}

export interface CreatePensionPayload {
  customer_name: string;
  account_type: 'individual' | 'employer';
  pfa: string;
  rsa_number: string;
  currency: string;
  status?: string;
  employer_contribution?: number;
  employee_contribution?: number;
}

export class PensionService {
  async listAccounts(): Promise<PensionAccount[]> {
    try {
      const res = await apiService.get(`${BASE}/pension_accounts`);
      const data = res.data as { items?: unknown[]; data?: unknown[] } | unknown[];
      const items = Array.isArray(data) ? data : (data as Record<string, unknown>).items ?? (data as Record<string, unknown>).data ?? [];
      return items as PensionAccount[];
    } catch (e) {
      throw new Error(`Failed to load pension accounts: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async getStats(): Promise<{
    total: number;
    active?: number;
    inactive?: number;
    withdrawn?: number;
    employers?: number;
    individuals?: number;
    total_contributions?: number;
  }> {
    try {
      const res = await apiService.get(`${BASE}/stats`);
      return res.data as Record<string, number>;
    } catch (e) {
      throw new Error(`Failed to load pension stats: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async createAccount(payload: CreatePensionPayload): Promise<PensionAccount> {
    try {
      const res = await apiService.post(`${BASE}/pension_accounts`, {
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
      });
      const data = res.data as { item?: PensionAccount };
      return (data.item ?? data) as PensionAccount;
    } catch (e) {
      throw new Error(`Failed to create pension account: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async pause(id: string): Promise<PensionAccount> {
    try {
      const res = await apiService.post(`${BASE}/pension_accounts/${id}/pause`, {});
      const data = res.data as { item?: PensionAccount };
      return (data.item ?? data) as PensionAccount;
    } catch (e) {
      throw new Error(`Failed to pause pension account: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async resume(id: string): Promise<PensionAccount> {
    try {
      const res = await apiService.post(`${BASE}/pension_accounts/${id}/resume`, {});
      const data = res.data as { item?: PensionAccount };
      return (data.item ?? data) as PensionAccount;
    } catch (e) {
      throw new Error(`Failed to resume pension account: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async withdraw(id: string): Promise<PensionAccount> {
    try {
      const res = await apiService.post(`${BASE}/pension_accounts/${id}/withdraw`, {});
      const data = res.data as { item?: PensionAccount };
      return (data.item ?? data) as PensionAccount;
    } catch (e) {
      throw new Error(`Failed to withdraw pension account: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async getContributions(id: string): Promise<PensionContribution[]> {
    try {
      const res = await apiService.get(`${BASE}/pension_accounts/${id}/contributions`);
      const data = res.data as { items?: unknown[] } | unknown[];
      const items = Array.isArray(data) ? data : (data as Record<string, unknown>).items ?? [];
      return items as PensionContribution[];
    } catch (e) {
      throw new Error(`Failed to load contributions: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
}

export const pensionService = new PensionService();
