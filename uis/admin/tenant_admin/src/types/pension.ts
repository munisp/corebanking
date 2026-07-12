export type PensionAccountType = 'individual' | 'employer';
export type PensionStatus = 'active' | 'inactive' | 'withdrawn';

export interface PensionAccount {
  id: string;
  customer_name: string;
  account_type: PensionAccountType;
  pfa: string;
  rsa_number: string;
  total_contributions: number;
  employer_contribution: number;
  employee_contribution: number;
  currency: string;
  status: PensionStatus;
  created_at?: string;
}

export interface PensionListResponse {
  items: PensionAccount[];
  total: number;
}

export interface PensionStats {
  total: number;
  active?: number;
  inactive?: number;
  withdrawn?: number;
  employers?: number;
  individuals?: number;
  total_contributions?: number;
}

export interface CreatePensionPayload {
  customer_name: string;
  account_type: PensionAccountType;
  pfa: string;
  rsa_number: string;
  currency: string;
  status?: PensionStatus;
  employer_contribution?: number;
  employee_contribution?: number;
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

export interface PensionContributionListResponse {
  items: PensionContribution[];
  total: number;
}
