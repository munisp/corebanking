export type DormancyStage = 'active' | 'inactive' | 'dormant' | 'unclaimed';
export type RestrictionLevel = 'none' | 'alert_only' | 'debit_restricted' | 'fully_restricted';
export type AccountType = 'savings' | 'current' | 'fixed_deposit';

export interface DormantAccount {
  id: string;
  account_number: string;
  account_name: string;
  customer_id: string;
  account_type: AccountType;
  branch: string;
  balance: number;
  currency: string;
  days_inactive: number;
  last_transaction_date: string;
  dormancy_stage: DormancyStage;
  restriction_level: RestrictionLevel;
  notifications_sent: number;
  reactivation_eligible: boolean;
  flagged_for_cbn_sweep: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DormantAccountListResponse {
  items: DormantAccount[];
  total: number;
  page: number;
  limit: number;
}

export interface DormancyStats {
  total: number;
  active: number;
  inactive: number;
  dormant: number;
  unclaimed: number;
  total_dormant_balance: number;
  flagged_for_cbn_sweep: number;
}

export interface CheckDormancyRequest {
  account_id?: string;
  last_txn_days?: number;
}

export interface CheckDormancyResponse {
  account_id?: string;
  account_number?: string;
  days_inactive?: number;
  dormancy_stage: DormancyStage;
  restriction_level: RestrictionLevel;
  reactivation_requirements: string[];
  reactivation_eligible?: boolean;
  flagged_for_cbn_sweep?: boolean;
  cbn_unclaimed_threshold_years?: number;
}

export interface ReactivateRequest {
  id: string;
  verified_by?: string;
  verification_method?: string;
}

export interface NotifyRequest {
  id: string;
  channel?: 'sms' | 'email' | 'letter';
}
