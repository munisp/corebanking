export type NIRSALRecordType = 'active_facility' | 'insurance_claim' | 'guarantee';
export type NIRSALStatus = 'disbursed' | 'under_assessment' | 'active' | 'initiated' | 'completed' | 'rejected';

export interface NIRSALRecord {
  id: string;
  type: NIRSALRecordType;
  farmer: string;
  crop?: string;
  hectares?: number;
  amount?: number;
  status: NIRSALStatus;
  season?: string;
  lossPercent?: number;
  cause?: string;
  guaranteeAmount?: number;
  guarantor?: string;
}

export interface CreateNIRSALPayload {
  type: NIRSALRecordType;
  farmer: string;
  crop?: string;
  hectares?: number;
  amount?: number;
  season?: string;
  lossPercent?: number;
  cause?: string;
  guaranteeAmount?: number;
}

export interface NIRSALStats {
  totalFarmers: number;
  activeFacilities: number;
  totalDisbursed: number;
  avgLoanSize: number;
  repaymentRate: number;
  season: string;
}

export interface NIRSALListResponse { records: NIRSALRecord[]; total: number; }
