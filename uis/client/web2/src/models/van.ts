export type VANPurpose = 'collections' | 'payroll' | 'subscriptions' | 'invoices' | 'donations' | 'other';

export const VANPurpose = {
  Collections: 'collections' as const,
  Payroll: 'payroll' as const,
  Subscriptions: 'subscriptions' as const,
  Invoices: 'invoices' as const,
  Donations: 'donations' as const,
  Other: 'other' as const,
};

export type VANStatus = 'active' | 'inactive' | 'expired' | 'suspended';

export const VANStatus = {
  Active: 'active' as const,
  Inactive: 'inactive' as const,
  Expired: 'expired' as const,
  Suspended: 'suspended' as const,
};

export type PaymentStatus = 'completed' | 'pending' | 'failed';

export const PaymentStatus = {
  Completed: 'completed' as const,
  Pending: 'pending' as const,
  Failed: 'failed' as const,
};

export interface VirtualAccount {
  id: string;
  accountNumber: string;
  purpose: VANPurpose;
  label: string;
  balance: number;
  totalReceived: number;
  status: VANStatus;
  createdAt: Date;
  expiresAt?: Date;
  isSingleUse: boolean;
}

export interface VANPayment {
  id: string;
  vanId: string;
  amount: number;
  senderName: string;
  senderBank: string;
  reference: string;
  status: PaymentStatus;
  receivedAt: Date;
}

export interface CreateVANRequest {
  purpose: VANPurpose;
  label: string;
  isSingleUse: boolean;
  expiresAt?: Date;
}
