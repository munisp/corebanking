export type LeaseType = 'finance_lease' | 'operating_lease' | 'sale_leaseback';
export type LeaseStatus = 'active' | 'terminated' | 'expired' | 'pending';

export interface LeaseContract {
  id: string;
  lease_type: LeaseType;
  lessee: string;
  asset_description: string;
  asset_value: number;
  currency: string;
  monthly_rental: number;
  tenor_months: number;
  residual_value: number;
  status: LeaseStatus;
}

export interface LeasingStats {
  total_contracts: number;
  total_asset_value: number;
}

export interface LeaseContractListResponse { items: LeaseContract[]; total: number; }
