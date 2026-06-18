import { toTitleCase } from '../utils/textCaseUtils';

/**
 * Standardized transaction type (credit/debit direction).
 */
export type TransactionType = 'credit' | 'debit';

/**
 * Standardized transaction categories aligned with backend payment types.
 * Each category maps to a standardized payment type from the backend system.
 * 
 * This ensures consistent labeling across UI and backend:
 * - "Transfer": Bank transfers (P2P, intra-bank, inter-bank)
 * - "Deposit": Money deposit into account
 * - "Withdrawal": Cash/money withdrawal from account
 * - "Loan Repayment": Loan repayment by customer
 * - "Loan Disbursement": Loan disbursement to customer
 * - "LPO Issuance": LPO (Letter of Payment Obligation) issuance
 * - "LPO Payment": LPO payment/settlement
 * - "Supply Chain Financing": Supply chain financing transaction
 * - "Insurance Premium": Insurance premium payment
 * - "Card Payment": Card-based payment
 * - "Bill Payment": Bill payment transaction
 * - "FX": Foreign exchange/currency conversion
 * - "Commission": Agent/partner commission payment
 * - "Float Top Up": Agent float top up
 * - "Airtime Purchase": Airtime/mobile credit purchase
 * - "Data Bundle": Data bundle/internet purchase
 * - "System Payout": System-initiated payout
 */
export type TransactionCategory = 
  | 'Transfer'
  | 'Deposit'
  | 'Withdrawal'
  | 'Loan Repayment'
  | 'Loan Disbursement'
  | 'LPO Issuance'
  | 'LPO Payment'
  | 'Supply Chain Financing'
  | 'Insurance Premium'
  | 'Card Payment'
  | 'Bill Payment'
  | 'FX'
  | 'Commission'
  | 'Float Top Up'
  | 'Airtime Purchase'
  | 'Data Bundle'
  | 'System Payout'
  | string;  // Allow for future extensions

/**
 * Standardized transaction status values.
 */
export type TransactionStatus = 'pending' | 'completed' | 'failed';

/**
 * Category groupings for filtering and reporting.
 */
export enum TransactionCategoryGroup {
  TRANSFERS = 'transfers',
  LENDING = 'lending',
  SUPPLY_CHAIN = 'supply_chain',
  SPECIAL_SERVICES = 'special_services',
  CARDS_PAYMENTS = 'cards_payments',
  AGENT_OPERATIONS = 'agent_operations',
  UTILITIES = 'utilities',
  SYSTEM = 'system',
}

/**
 * Mapping of transaction categories to their groups.
 */
export const CATEGORY_TO_GROUP: Record<TransactionCategory, TransactionCategoryGroup> = {
  'Transfer': TransactionCategoryGroup.TRANSFERS,
  'Deposit': TransactionCategoryGroup.TRANSFERS,
  'Withdrawal': TransactionCategoryGroup.TRANSFERS,
  
  'Loan Repayment': TransactionCategoryGroup.LENDING,
  'Loan Disbursement': TransactionCategoryGroup.LENDING,
  
  'LPO Issuance': TransactionCategoryGroup.SUPPLY_CHAIN,
  'LPO Payment': TransactionCategoryGroup.SUPPLY_CHAIN,
  'Supply Chain Financing': TransactionCategoryGroup.SUPPLY_CHAIN,
  
  'Insurance Premium': TransactionCategoryGroup.SPECIAL_SERVICES,
  
  'Card Payment': TransactionCategoryGroup.CARDS_PAYMENTS,
  'Bill Payment': TransactionCategoryGroup.CARDS_PAYMENTS,
  
  'FX': TransactionCategoryGroup.TRANSFERS,
  
  'Commission': TransactionCategoryGroup.AGENT_OPERATIONS,
  'Float Top Up': TransactionCategoryGroup.AGENT_OPERATIONS,
  
  'Airtime Purchase': TransactionCategoryGroup.UTILITIES,
  'Data Bundle': TransactionCategoryGroup.UTILITIES,
  
  'System Payout': TransactionCategoryGroup.SYSTEM,
};

export interface TransactionJson {
  id?: string;
  transaction_id?: string;
  wallet_id?: string;
  walletId?: string;
  type?: TransactionType;
  category?: TransactionCategory;
  amount?: number;
  balance_before?: number;
  balanceBefore?: number;
  balance_after?: number;
  balanceAfter?: number;
  currency?: string;
  status?: TransactionStatus;
  reference?: string;
  description?: string;
  narration?: string;
  recipient_name?: string;
  recipientName?: string;
  recipient_account?: string;
  recipientAccount?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export class Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  status: TransactionStatus;
  reference?: string;
  description?: string;
  recipientName?: string;
  recipientAccount?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;

  constructor(data: {
    id: string;
    walletId: string;
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    currency: string;
    status: TransactionStatus;
    reference?: string;
    description?: string;
    recipientName?: string;
    recipientAccount?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.walletId = data.walletId;
    this.type = data.type;
    this.category = data.category;
    this.amount = data.amount;
    this.balanceBefore = data.balanceBefore;
    this.balanceAfter = data.balanceAfter;
    this.currency = data.currency;
    this.status = data.status;
    this.reference = data.reference;
    this.description = data.description;
    this.recipientName = data.recipientName;
    this.recipientAccount = data.recipientAccount;
    this.metadata = data.metadata;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;  
  }

  static fromJson(json: TransactionJson): Transaction {
    return new Transaction({
      id: json.id ?? json.transaction_id ?? '',
      walletId: json.wallet_id ?? json.walletId ?? '',
      type: json.type ?? 'debit',
      category: json.category ?? 'Transfer',
      amount: Number(json.amount ?? 0),
      balanceBefore: Number(json.balance_before ?? json.balanceBefore ?? 0),
      balanceAfter: Number(json.balance_after ?? json.balanceAfter ?? 0),
      currency: json.currency ?? 'NGN',
      status: json.status ?? 'pending',
      reference: json.reference,
      description: json.description ?? json.narration,
      recipientName: json.recipient_name ?? json.recipientName,
      recipientAccount: json.recipient_account ?? json.recipientAccount,
      metadata: json.metadata ? { ...json.metadata } : undefined,
      createdAt: new Date(json.created_at ?? json.createdAt ?? new Date().toISOString()),
      updatedAt: json.updated_at || json.updatedAt ? new Date(json.updated_at ?? json.updatedAt!) : undefined,
    });
  }

  toJson(): TransactionJson {
    return {
      id: this.id,
      wallet_id: this.walletId,
      type: this.type,
      category: this.category,
      amount: this.amount,
      balance_before: this.balanceBefore,
      balance_after: this.balanceAfter,
      currency: this.currency,
      status: this.status,
      reference: this.reference,
      description: this.description,
      recipient_name: this.recipientName,
      recipient_account: this.recipientAccount,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt?.toISOString(),
    };
  }

  get formattedAmount(): string {
    const sign = this.type === 'credit' ? '+' : '-';
    return `${sign}₦${this.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  get displayTitle(): string {
    if (this.recipientName && this.recipientName.trim()) {
      return this.recipientName;
    }
    // Use toTitleCase from textCaseUtils (imported at top)
    return toTitleCase(this.category.replace(/_/g, ' '));
  }

  get isCredit(): boolean {
    return this.type === 'credit';
  }

  get isDebit(): boolean {
    return this.type === 'debit';
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }
}
