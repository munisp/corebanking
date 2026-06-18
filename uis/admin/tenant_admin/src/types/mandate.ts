export type MandateType = 'direct-debit' | 'standing-order';
export type MandateStatus = 'active' | 'suspended' | 'cancelled' | 'expired';

export interface Mandate {
  id: string;
  accountNumber: string;
  accountName: string;
  beneficiary: string;
  nibssMandateRef: string;
  type: MandateType;
  amount: number;
  currency: string;
  frequency: string;
  status: MandateStatus;
  startDate: string;
  endDate: string;
  nextExecutionDate: string;
  totalExecutions: number;
  totalDebited: number;
}

export interface MandateListResponse {
  items: Mandate[];
  total: number;
}

export interface MandateStats {
  totalMandates: number;
  active: number;
  suspended: number;
  totalDebited: number;
  totalExecutions: number;
  types: Record<string, number>;
}
