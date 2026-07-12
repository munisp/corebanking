import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

const BASE = `${AppConfig.baseUrl}/islamic-banking/api/v1`;

export interface IslamicProduct {
  id: string;
  status: string;
  application_date: string;
  approval_date?: string;
  created_at: string;
  [key: string]: unknown;
}

class IslamicBankingService {
  // ── Murabaha ──────────────────────────────────────────────────────────────
  async getMurabahaList(): Promise<IslamicProduct[]> {
    const res = await apiService.get(`${BASE}/murabaha`);
    return this.extractList(res.data);
  }

  async getMurabahaById(id: string): Promise<IslamicProduct> {
    const res = await apiService.get(`${BASE}/murabaha/${id}`);
    return res.data as IslamicProduct;
  }

  async applyMurabaha(payload: {
    asset_name: string;
    cost_price: number;
    profit_margin: number;
    tenure_months: number;
  }): Promise<IslamicProduct> {
    const res = await apiService.post(`${BASE}/murabaha`, payload);
    return res.data as IslamicProduct;
  }

  // ── Musharaka ─────────────────────────────────────────────────────────────
  async getMushараkaList(): Promise<IslamicProduct[]> {
    const res = await apiService.get(`${BASE}/musharaka`);
    return this.extractList(res.data);
  }

  async getMusharakaById(id: string): Promise<IslamicProduct> {
    const res = await apiService.get(`${BASE}/musharaka/${id}`);
    return res.data as IslamicProduct;
  }

  async applyMusharaka(payload: {
    business_name: string;
    customer_contribution: number;
    bank_contribution: number;
    customer_profit_share: number;
  }): Promise<IslamicProduct> {
    const res = await apiService.post(`${BASE}/musharaka`, payload);
    return res.data as IslamicProduct;
  }

  // ── Ijara ─────────────────────────────────────────────────────────────────
  async getIjaraList(): Promise<IslamicProduct[]> {
    const res = await apiService.get(`${BASE}/ijara`);
    return this.extractList(res.data);
  }

  async getIjaraById(id: string): Promise<IslamicProduct> {
    const res = await apiService.get(`${BASE}/ijara/${id}`);
    return res.data as IslamicProduct;
  }

  async applyIjara(payload: {
    asset_name: string;
    asset_value: number;
    tenure_months: number;
    lease_type: 'operating' | 'finance';
  }): Promise<IslamicProduct> {
    const res = await apiService.post(`${BASE}/ijara`, payload);
    return res.data as IslamicProduct;
  }

  // ── Takaful ───────────────────────────────────────────────────────────────
  async getTakafulList(): Promise<IslamicProduct[]> {
    const res = await apiService.get(`${BASE}/takaful`);
    return this.extractList(res.data);
  }

  async getTakafulById(id: string): Promise<IslamicProduct> {
    const res = await apiService.get(`${BASE}/takaful/${id}`);
    return res.data as IslamicProduct;
  }

  async applyTakaful(payload: {
    policy_type: string;
    policy_name: string;
    coverage_amount: number;
    frequency: 'monthly' | 'quarterly' | 'annually';
  }): Promise<IslamicProduct> {
    const res = await apiService.post(`${BASE}/takaful`, payload);
    return res.data as IslamicProduct;
  }

  // ── Sukuk ─────────────────────────────────────────────────────────────────
  async getSukukList(): Promise<IslamicProduct[]> {
    const res = await apiService.get(`${BASE}/sukuk`);
    return this.extractList(res.data);
  }

  async getSukukById(id: string): Promise<IslamicProduct> {
    const res = await apiService.get(`${BASE}/sukuk/${id}`);
    return res.data as IslamicProduct;
  }

  async applySukuk(payload: {
    sukuk_type: string;
    sukuk_name: string;
    investment_amount: number;
    tenure_months: number;
  }): Promise<IslamicProduct> {
    const res = await apiService.post(`${BASE}/sukuk`, payload);
    return res.data as IslamicProduct;
  }

  // ── Cancel any product ─────────────────────────────────────────────────────
  async cancelProduct(productType: string, productId: string): Promise<void> {
    await apiService.delete(`${BASE}/${productType}/${productId}`);
  }

  // ── All products dashboard ─────────────────────────────────────────────────
  async getAllProducts(): Promise<{
    murabaha: IslamicProduct[];
    musharaka: IslamicProduct[];
    ijara: IslamicProduct[];
    takaful: IslamicProduct[];
    sukuk: IslamicProduct[];
  }> {
    const res = await apiService.get(`${BASE}/products`);
    const d = res.data as Record<string, unknown>;
    return {
      murabaha: this.extractList(d.murabaha),
      musharaka: this.extractList(d.musharaka),
      ijara: this.extractList(d.ijara),
      takaful: this.extractList(d.takaful),
      sukuk: this.extractList(d.sukuk),
    };
  }

  private extractList(data: unknown): IslamicProduct[] {
    if (Array.isArray(data)) return data as IslamicProduct[];
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.data)) return d.data as IslamicProduct[];
    }
    return [];
  }
}

export const islamicBankingService = new IslamicBankingService();
