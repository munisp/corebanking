export type AccountType = 'savings' | 'current' | 'domiciliary';
export type EnquiryStatus = 'verified' | 'not_found' | 'error';

export interface Beneficiary {
  id: string;
  customerId: string;
  name: string;
  nickname?: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountType: AccountType;
  currency: string;
  verified: boolean;
  verifiedName?: string;
  dailyLimit: number;
  monthlyLimit: number;
  totalSent: number;
  txnCount: number;
  isFavorite: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateBeneficiaryPayload {
  customerId: string;
  name: string;
  nickname?: string;
  bankCode: string;
  accountNumber: string;
  accountType: AccountType;
  currency?: string;
}

export interface BeneficiaryListResponse {
  items: Beneficiary[];
  total: number;
}

export interface NameEnquiryPayload {
  bankCode: string;
  accountNumber: string;
}

export interface NameEnquiryResponse {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  status: EnquiryStatus;
  sessionId: string;
}

export interface SetLimitsPayload {
  beneficiaryId: string;
  dailyLimit: number;
  monthlyLimit: number;
}

export interface Bank {
  code: string;
  name: string;
}

export interface BankDirectoryResponse {
  banks: Bank[];
  total: number;
}
