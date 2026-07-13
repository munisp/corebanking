export type InsuranceRecordType = 'crop_assessment' | 'insurance_claim' | 'price_index';

export interface InsuranceRecord {
  id: string;
  type: InsuranceRecordType;
  status?: string;
  createdAt?: string;
  farmer?: string;
  crop?: string;
  hectares?: number;
  yieldEstimate?: number;
  season?: string;
  lossPercent?: number;
  cause?: string;
  commodity?: string;
  price?: number;
  unit?: string;
  market?: string;
  date?: string;
}

export interface InsuranceRecordListResponse {
  records: InsuranceRecord[];
  total: number;
}

export interface InsuranceAnalyticsStats {
  totalFarmers: number;
  activePolicies: number;
  pendingClaims: number;
  avgYield: number;
  totalHectares: number;
}

export interface CreateInsuranceRecordPayload {
  type: InsuranceRecordType;
  farmer?: string;
  crop?: string;
  hectares?: number;
  yieldEstimate?: number;
  season?: string;
  lossPercent?: number;
  cause?: string;
  commodity?: string;
  price?: number;
  unit?: string;
  market?: string;
  date?: string;
}
