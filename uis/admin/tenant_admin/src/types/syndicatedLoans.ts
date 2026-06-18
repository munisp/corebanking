export type LoanStatus = 'active' | 'disbursing' | 'closed' | 'restructured';

export interface SyndicatedLoan {
  id: string;
  facility_name: string;
  borrower: string;
  total_amount: number;
  currency: string;
  lead_arranger: string;
  participant_count: number;
  interest_rate: number;
  tenor: string;
  status: LoanStatus;
}

export interface SyndicatedLoanStats {
  total_facilities: number;
  total_committed: number;
}

export interface SyndicatedLoanListResponse { items: SyndicatedLoan[]; total: number; }
