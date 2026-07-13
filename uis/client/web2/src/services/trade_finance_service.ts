import { apiService } from './api_service';
import { getErrorMessage } from '../utils/error_utils';
import type { LetterOfCredit, BankGuarantee, FactoringApplication } from '../models/trade_finance';
import { lcFromJson, bgFromJson, factoringFromJson } from '../models/trade_finance';

const LC_BASE = '/trade-finance/api';
const BG_BASE = '/bank-guarantees/v1/bank-guarantees';
const FACTORING_BASE = '/factoring/v1/factoring/deals';

export class TradeFinanceService {
  // ── Letters of Credit ──────────────────────────────────────────────
  async getLCs(page = 1, limit = 20): Promise<LetterOfCredit[]> {
    try {
      const res = await apiService.get(`${LC_BASE}/list`, { params: { page, limit } });
      if (res.status === 200) {
        const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return raw.map(lcFromJson);
      }
      return [];
    } catch (err) {
      console.error('getLCs failed:', err);
      return [];
    }
  }

  async getLCById(id: string): Promise<LetterOfCredit | null> {
    try {
      const res = await apiService.get(`${LC_BASE}/get`, { params: { id } });
      if (res.status === 200) {
        const raw = res.data?.data ?? res.data;
        return lcFromJson(raw);
      }
      return null;
    } catch (err) {
      console.error('getLCById failed:', err);
      return null;
    }
  }

  async createLC(data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(`${LC_BASE}/create`, data);
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Letter of Credit application submitted!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to submit LC application') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to submit LC application') };
    }
  }

  async amendLC(id: string, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(`${LC_BASE}/update`, { id, ...data });
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'LC amended successfully!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to amend LC') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to amend LC') };
    }
  }

  // ── Bank Guarantees ─────────────────────────────────────────────────
  async getBankGuarantees(page = 1, limit = 20): Promise<BankGuarantee[]> {
    try {
      const res = await apiService.get(`${BG_BASE}/list`, { params: { page, limit } });
      if (res.status === 200) {
        const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return raw.map(bgFromJson);
      }
      return [];
    } catch (err) {
      console.error('getBankGuarantees failed:', err);
      return [];
    }
  }

  async createBankGuarantee(data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(`${BG_BASE}/create`, data);
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Bank guarantee request submitted!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to submit guarantee request') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to submit guarantee request') };
    }
  }

  async extendBankGuarantee(id: string, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(`${BG_BASE}/update`, { id, action: 'extend', ...data });
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Bank guarantee extended!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to extend guarantee') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to extend guarantee') };
    }
  }

  async cancelBankGuarantee(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(`${BG_BASE}/update`, { id, action: 'cancel' });
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Bank guarantee cancelled!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to cancel guarantee') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to cancel guarantee') };
    }
  }

  // ── Factoring ────────────────────────────────────────────────────────
  async getFactoringApplications(page = 1, limit = 20): Promise<FactoringApplication[]> {
    try {
      const res = await apiService.get(FACTORING_BASE, { params: { page, limit } });
      if (res.status === 200) {
        const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return raw.map(factoringFromJson);
      }
      return [];
    } catch (err) {
      console.error('getFactoringApplications failed:', err);
      return [];
    }
  }

  async createFactoringApplication(data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiService.post(FACTORING_BASE, data);
      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Factoring application submitted!' };
      }
      return { success: false, message: getErrorMessage(res.data, 'Failed to submit factoring application') };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Failed to submit factoring application') };
    }
  }

  async getFactoringInvoices(id: string): Promise<any[]> {
    try {
      const res = await apiService.get(`${FACTORING_BASE}/${id}/invoices`);
      if (res.status === 200) {
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      }
      return [];
    } catch (err) {
      console.error('getFactoringInvoices failed:', err);
      return [];
    }
  }
}

export const tradeFinanceService = new TradeFinanceService();
