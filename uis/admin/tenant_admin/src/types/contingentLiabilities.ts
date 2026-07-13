export type LiabilityType = 'letter_of_credit' | 'performance_guarantee' | 'loan_commitment' | 'litigation' | 'acceptance';
export type LiabilityStatus = 'active' | 'provision_raised' | 'expired' | 'cancelled';

export interface ContingentLiability {
  id: string;
  liability_type: LiabilityType;
  counterparty: string;
  description: string;
  max_exposure: number;
  probability: number;
  expected_loss: number;
  currency: string;
  expiry_date: string;
  status: LiabilityStatus;
}

export interface ContingentLiabilityListResponse { items: ContingentLiability[]; total: number; }
