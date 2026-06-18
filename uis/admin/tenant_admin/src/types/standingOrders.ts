export type SOFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
export type SOStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type MandateStatus = 'pending_consent' | 'active' | 'suspended' | 'revoked' | 'expired';
export type PaymentType = 'transfer' | 'bill_payment' | 'loan_repayment';
export type PaymentStatus = 'scheduled' | 'executed' | 'failed' | 'cancelled';

export interface StandingOrder {
  id: string;
  accountId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  frequency: SOFrequency;
  nextExecutionAt: string;
  lastExecutedAt?: string;
  startDate: string;
  endDate?: string;
  executionCount: number;
  maxExecutions?: number;
  narration: string;
  status: SOStatus;
  failureReason?: string;
  createdAt: string;
}

export interface CreateStandingOrderPayload {
  accountId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  amount: number;
  frequency: SOFrequency;
  startDate?: string;
  endDate?: string;
  maxExecutions?: number;
  narration: string;
}

export interface DirectDebitMandate {
  id: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  accountId: string;
  maxAmount: number;
  frequency: SOFrequency;
  status: MandateStatus;
  consentRef: string;
  mandateRef: string;
  expiryDate: string;
  lastDebitDate?: string;
  totalDebited: number;
  createdAt: string;
}

export interface CreateMandatePayload {
  merchantId: string;
  merchantName: string;
  customerId: string;
  accountId: string;
  maxAmount: number;
  frequency: SOFrequency;
  expiryDate: string;
}

export interface ScheduledPayment {
  id: string;
  accountId: string;
  paymentType: PaymentType;
  amount: number;
  scheduledAt: string;
  status: PaymentStatus;
  reference: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface CreateScheduledPaymentPayload {
  accountId: string;
  paymentType: PaymentType;
  amount: number;
  scheduledAt: string;
  metadata?: Record<string, string>;
}

export interface StandingOrderListResponse {
  items: StandingOrder[];
  total: number;
}

export interface MandateListResponse {
  items: DirectDebitMandate[];
  total: number;
}

export interface ScheduledPaymentListResponse {
  scheduledPayments: ScheduledPayment[];
  total: number;
}
