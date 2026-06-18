export interface WalletJson {
  id?: string;
  wallet_id?: string;
  user_id?: string;
  userId?: string;
  account_number?: string;
  accountNumber?: string;
  balance?: number;
  available_balance?: number;
  availableBalance?: number;
  currency?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export class Wallet {
  id: string;
  userId: string;
  accountNumber: string;
  balance: number;
  availableBalance: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;

  constructor(data: {
    id: string;
    userId: string;
    accountNumber: string;
    balance: number;
    availableBalance: number;
    currency: string;
    status: string;
    createdAt: Date;
    updatedAt?: Date;
  }) {
   this.id = data.id;
   this.userId = data.userId;
   this.accountNumber = data.accountNumber;
   this.balance = data.balance;
   this.availableBalance = data.availableBalance;
   this.currency = data.currency;
   this.status = data.status;
   this.createdAt = data.createdAt;
   this.updatedAt = data.updatedAt;
  }

  static fromJson(json: WalletJson): Wallet {
    return new Wallet({
      id: json.id ?? json.wallet_id ?? '',
      userId: json.user_id ?? json.userId ?? '',
      accountNumber: json.account_number ?? json.accountNumber ?? '',
      balance: Number(json.balance ?? 0),
      availableBalance: Number(json.available_balance ?? json.availableBalance ?? 0),
      currency: json.currency ?? 'NGN',
      status: json.status ?? 'active',
      createdAt: new Date(json.created_at ?? json.createdAt ?? new Date().toISOString()),
      updatedAt: json.updated_at || json.updatedAt ? new Date(json.updated_at ?? json.updatedAt!) : undefined,
    });
  }

  toJson(): WalletJson {
    return {
      id: this.id,
      user_id: this.userId,
      account_number: this.accountNumber,
      balance: this.balance,
      available_balance: this.availableBalance,
      currency: this.currency,
      status: this.status,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt?.toISOString(),
    };
  }

  get formattedBalance(): string {
    return `₦${this.balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  get formattedAvailableBalance(): string {
    return `₦${this.availableBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}
