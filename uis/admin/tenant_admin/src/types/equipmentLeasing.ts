export interface EquipmentLeasingRecord {
  id: string;
  type: string;
  amount: number;
  currency: string;
  tenor: number;
  interestRate: number;
  status: string;
  disbursedAt?: string;
  applicant?: string;
  originalRate?: number;
}

export interface EquipmentLeasingStats {
  totalActive: number;
  totalAmount: number;
  nplRatio: number;
  avgTenor: number;
  avgRate: number;
  currency: string;
}

export interface CreateEquipmentLeasingPayload {
  type: string;
  amount: number;
  currency: string;
  tenor: number;
  interestRate: number;
  applicant?: string;
}

export interface EquipmentLeasingListResponse { records: EquipmentLeasingRecord[]; total: number; }
