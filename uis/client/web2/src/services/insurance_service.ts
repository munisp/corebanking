import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface InsurancePolicy {
  id: string;
  policy_type: string;
  coverage_amount: number;
  premium: number;
  duration_months: number;
  status: string;
  start_date: string;
  expiry_date: string;
  next_payment_date?: string;
  beneficiaries: string[];
  display_name?: string;
}

export interface InsuranceTemplate {
  id: string;
  policy_id: string;
  display_name: string;
  insurance_type: string;
  coverage_amount: number;
  premium_amount: number;
  duration_days: number;
  duration_months: number;
  status: string;
  trigger_conditions: Record<string, string>;
  smart_contract_address?: string;
  blockchain_tx_hash?: string;
  created_at: string;
}

export interface InsuranceClaim {
  id: string;
  policy_id: string;
  claim_amount: number;
  status: string;
  incident_date: string;
  incident_description: string;
  created_at: string;
  approval_date?: string;
  rejection_reason?: string;
  supporting_documents: string[];
}

export interface PremiumPayment {
  id: string;
  policy_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  transaction_reference?: string;
  next_payment_date?: string;
}

class InsuranceService {
  // My active policies
  async getMyPolicies(): Promise<InsurancePolicy[]> {
    const res = await apiService.get(`${AppConfig.insuranceEndpoint}/policies`);
    return this.extractList(res.data) as InsurancePolicy[];
  }

  // All available policy templates
  async getAllPolicyTemplates(): Promise<InsuranceTemplate[]> {
    const res = await apiService.get(`${AppConfig.insuranceEndpoint}/etherisc/policies`);
    return this.extractList(res.data) as InsuranceTemplate[];
  }

  // Premium payment history
  async getPremiumPayments(): Promise<PremiumPayment[]> {
    const res = await apiService.get(`${AppConfig.insuranceEndpoint}/premium-payments`);
    return this.extractList(res.data) as PremiumPayment[];
  }

  // Claims
  async getClaims(): Promise<InsuranceClaim[]> {
    const res = await apiService.get(`${AppConfig.insuranceEndpoint}/claims`);
    return this.extractList(res.data) as InsuranceClaim[];
  }

  // Apply for a policy
  async applyForPolicy(payload: {
    policy_type: string;
    coverage_amount: number;
    duration_months: number;
    beneficiaries: string[];
    template_id?: string;
  }): Promise<InsurancePolicy> {
    const res = await apiService.post(`${AppConfig.insuranceEndpoint}/policies`, payload);
    return res.data as InsurancePolicy;
  }

  // Submit a claim
  async submitClaim(payload: {
    policy_id: string;
    claim_amount: number;
    incident_date: string;
    incident_description: string;
  }): Promise<InsuranceClaim> {
    const res = await apiService.post(`${AppConfig.insuranceEndpoint}/claims`, payload);
    return res.data as InsuranceClaim;
  }

  private extractList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.data)) return d.data;
      if (Array.isArray(d.policies)) return d.policies;
      if (Array.isArray(d.claims)) return d.claims;
      if (Array.isArray(d.payments)) return d.payments;
    }
    return [];
  }
}

export const insuranceService = new InsuranceService();
