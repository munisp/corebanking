import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

// Type definitions
export interface Wallet {
  id: string;
  userId: string;
  accountNumber: string;
  balance: number;
  availableBalance: number;
  currency: string;
  status: string;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  status: string;
  reference: string;
  description: string;
  recipientName?: string;
  recipientAccount?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
}

export class WalletService {
  // =================== GET WALLET ===================
  async getMyWallet(): Promise<Wallet> {
    try {
      const response = await apiService.get(`${AppConfig.accountEndpoint}/account/keycloak/${localStorage.getItem('keycloak_id')}`);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { account: any };
        const data = respData.account;
        localStorage.setItem('account', JSON.stringify(data));
        localStorage.setItem('account_id', data.id)
        return {
          id: data.id || data.wallet_id,
          userId: data.user_id || data.userId,
          accountNumber: data.account_number || data.accountNumber,
          balance: data.balance,
          availableBalance: data.available_balance || data.availableBalance,
          currency: data.currency,
          status: data.status,
          createdAt: new Date(data.created_at || data.createdAt),
        };
      }
      throw new Error('Failed to fetch wallet');
    } catch (error: any) {
      throw new Error(`Failed to fetch wallet: ${error.message}`);
    }
  }

  // =================== DEPOSIT FUNDS ===================
  async depositFunds(amount: number, method: string): Promise<Wallet> {
    try {
      const response = await apiService.post(`${AppConfig.walletEndpoint}/my-wallet/deposit`, {
        amount,
        method,
      });

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { data: any };
        const data = respData.data;
        return {
          id: data.id || data.wallet_id,
          userId: data.user_id || data.userId,
          accountNumber: data.account_number || data.accountNumber,
          balance: data.balance,
          availableBalance: data.available_balance || data.availableBalance,
          currency: data.currency,
          status: data.status,
          createdAt: new Date(data.created_at || data.createdAt),
        };
      }
      throw new Error('Failed to deposit funds');
    } catch (error: any) {
      throw new Error(`Failed to deposit funds: ${error.message}`);
    }
  }

  // =================== GET BALANCE ===================
  async getBalance(): Promise<number> {
    try {
      const response = await apiService.get(`${AppConfig.walletEndpoint}/my-wallet/balance`);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { data: { balance: number } };
        return respData.data.balance;
      }
      throw new Error('Failed to fetch balance');
    } catch (error: any) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  // =================== GET TRANSACTIONS ===================
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: 'credit' | 'debit';
    category?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Transaction[]> {
    try {
      const queryParams: any = {
        page: params?.page || 1,
        limit: params?.limit || 20,
      };

      if (params?.type) queryParams.type = params.type;
      if (params?.category) queryParams.category = params.category;
      if (params?.status) queryParams.status = params.status;
      if (params?.startDate) queryParams.start_date = params.startDate.toISOString();
      if (params?.endDate) queryParams.end_date = params.endDate.toISOString();

      const response = await apiService.get(`${AppConfig.transactionEndpoint}/account/${localStorage.getItem('account_id')}`, queryParams);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { transactions: any[] };
        const transactionsData = respData.transactions || [];
        return transactionsData;
      }

      return [];
    } catch (error: any) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  // =================== GET SINGLE TRANSACTION ===================
  async getTransaction(transactionId: string): Promise<Transaction> {
    try {
      const response = await apiService.get(`${AppConfig.transactionEndpoint}/${transactionId}`);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { data: any };
        const json = respData.data;
        return {
          id: json.id || json.transaction_id,
          walletId: json.wallet_id || json.walletId,
          type: json.type,
          category: json.category,
          amount: json.amount,
          balanceBefore: json.balance_before || json.balanceBefore,
          balanceAfter: json.balance_after || json.balanceAfter,
          currency: json.currency,
          status: json.status,
          reference: json.reference,
          description: json.description,
          recipientName: json.recipient_name || json.recipientName,
          recipientAccount: json.recipient_account || json.recipientAccount,
          metadata: json.metadata,
          createdAt: new Date(json.created_at || json.createdAt),
          updatedAt: json.updated_at ? new Date(json.updated_at) : undefined,
        };
      }

      throw new Error('Transaction not found');
    } catch (error: any) {
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
  }

  // =================== GET STATEMENT ===================
  async getStatement(params: { startDate: Date; endDate: Date; format?: 'json' | 'pdf' }): Promise<Transaction[]> {
    try {
      const queryParams: any = {
        start_date: params.startDate.toISOString(),
        end_date: params.endDate.toISOString(),
        format: params.format || 'json',
      };

      const response = await apiService.get(`${AppConfig.walletEndpoint}/my-wallet/statement`, queryParams);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { data: any[] };
        const transactionsData = respData.data || [];
        return transactionsData.map((json) => ({
          id: json.id || json.transaction_id,
          walletId: json.wallet_id || json.walletId,
          type: json.type,
          category: json.category,
          amount: json.amount,
          balanceBefore: json.balance_before || json.balanceBefore,
          balanceAfter: json.balance_after || json.balanceAfter,
          currency: json.currency,
          status: json.status,
          reference: json.reference,
          description: json.description,
          recipientName: json.recipient_name || json.recipientName,
          recipientAccount: json.recipient_account || json.recipientAccount,
          metadata: json.metadata,
          createdAt: new Date(json.created_at || json.createdAt),
          updatedAt: json.updated_at ? new Date(json.updated_at) : undefined,
        }));
      }

      return [];
    } catch (error: any) {
      throw new Error(`Failed to fetch statement: ${error.message}`);
    }
  }

  // =================== GET STATISTICS ===================
  async getStatistics(params?: { startDate?: Date; endDate?: Date }): Promise<Record<string, number>> {
    try {
      const queryParams: any = {};
      if (params?.startDate) queryParams.start_date = params.startDate.toISOString();
      if (params?.endDate) queryParams.end_date = params.endDate.toISOString();

      const response = await apiService.get(`${AppConfig.walletEndpoint}/my-wallet/statistics`, queryParams);

      if (response.data && (response.data as any).success === true || response.status === 200) {
        const respData = response.data as { data: Record<string, number> };
        return respData.data;
      }

      return {
        total_credits: 0,
        total_debits: 0,
        pending_transactions: 0,
        completed_transactions: 0,
        failed_transactions: 0,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }
  }
}

export const walletService = new WalletService();
