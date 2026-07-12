export type StatementFormat = 'pdf' | 'mt940' | 'mt942' | 'csv' | 'excel';
export type StatementType = 'monthly' | 'on-demand';
export type StatementStatus = 'delivered' | 'generated' | 'failed' | 'pending';
export type DeliveryChannel = 'email' | 'swift' | 'download' | 'branch-print' | 'mobile-push';

export interface StatementSummary {
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  transactionCount: number;
  interestEarned: number;
  feesCharged: number;
}

export interface StatementTransaction {
  date: string;
  reference: string;
  narrative: string;
  credit: number;
  debit: number;
  balance: number;
}

export interface Statement {
  id: string;
  accountNumber: string;
  accountName: string;
  type: StatementType;
  format: StatementFormat;
  period: string;
  status: StatementStatus;
  generatedAt: string;
  deliveredAt: string | null;
  deliveryChannel: DeliveryChannel;
  summary: StatementSummary;
  transactions?: StatementTransaction[];
  errorReason?: string;
  mt940?: string;
}

export interface StatementListResponse {
  items: Statement[];
  total: number;
}

export interface StatementStats {
  totalStatements: number;
  byFormat: Record<string, number>;
  byStatus: Record<string, number>;
  byDeliveryChannel: Record<string, number>;
  totalTransactionsRendered: number;
  supportedFormats: string[];
  deliveryChannels: string[];
}
