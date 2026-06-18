export type POSTerminalStatus = 'active' | 'inactive' | 'suspended';
export type POSTransactionStatus = 'approved' | 'declined' | 'pending' | 'reversed';
export type POSTransactionType = 'purchase' | 'refund' | 'reversal' | 'balance_inquiry';
export type CardScheme = 'Visa' | 'Mastercard' | 'Verve' | 'Amex' | string;

export interface POSTerminal {
  id: string;
  terminalId: string;
  merchantName: string;
  merchantId: string;
  location: string;
  state: string;
  category: string;
  model: string;
  status: POSTerminalStatus;
  dailyTransactionCount: number;
  dailyVolume: number;
  monthlyVolume: number;
  lastTransaction: string;
  commissionRate: number;
  deployedDate: string;
}

export interface POSTerminalListResponse {
  items: POSTerminal[];
  total: number;
}

export interface POSTransaction {
  id: string;
  terminalId: string;
  merchantName: string;
  type: POSTransactionType;
  amount: number;
  currency: string;
  cardScheme: CardScheme;
  responseCode: string;
  rrn: string;
  timestamp: string;
  status: POSTransactionStatus;
}

export interface POSTransactionListResponse {
  items: POSTransaction[];
  total: number;
}

export interface POSStats {
  totalTerminals: number;
  dailyTransactions: number;
  dailyVolume: number;
  approvedTxns: number;
  declinedTxns: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface CreatePOSTerminalPayload {
  terminalId: string;
  merchantName: string;
  merchantId: string;
  location: string;
  state: string;
  category: string;
  model: string;
  status?: POSTerminalStatus;
  commissionRate: number;
  deployedDate?: string;
}

export interface CreatePOSTransactionPayload {
  terminalId: string;
  merchantName: string;
  type: POSTransactionType;
  amount: number;
  currency?: string;
  cardScheme: CardScheme;
  responseCode: string;
  rrn: string;
  status?: POSTransactionStatus;
}
