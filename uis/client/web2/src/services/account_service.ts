import { AxiosError } from 'axios';
import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'savings' | 'current' | 'fixed_deposit' | 'domiciliary' | 'mint';
  currency: string;
  balance: number;
  status: 'active' | 'inactive' | 'frozen';
  isPrimary: boolean;
  createdAt: Date;
}

export interface CreateAccountParams {
  userId: string;
  accountName: string;
  accountType: Account['accountType'];
  currency: string;
}

class AccountService {
  /**
   * Get all accounts for a user
   */
  async getUserAccounts(userId: string): Promise<Account[]> {
    try {
      const response = await apiService.get(`${AppConfig.accountEndpoint}?user_id=${userId}`);
      
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success) {
        const accountsData = data.data as Record<string, unknown>[];
        return accountsData.map((acc) => ({
          id: acc.id as string,
          userId: acc.user_id as string,
          accountNumber: acc.account_number as string,
          accountName: acc.account_name as string,
          accountType: acc.account_type as Account['accountType'],
          currency: acc.currency as string,
          balance: acc.balance as number,
          status: acc.status as Account['status'],
          isPrimary: acc.is_primary as boolean,
          createdAt: new Date(acc.created_at as string),
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to load accounts:', error);
      throw error;
    }
  }

  /**
   * Create a new account
   */
  async createAccount(params: CreateAccountParams): Promise<{ success: boolean; message: string; data?: Account }> {
    try {
      const response = await apiService.post(`${AppConfig.accountEndpoint}/account`, {
        user_id: params.userId,
        account_name: params.accountName,
        account_type: params.accountType,
        currency: params.currency,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success) {
        return {
          success: true,
          message: data.message || 'Account created successfully',
          data: data.data ? {
            id: data.data.id,
            userId: data.data.user_id,
            accountNumber: data.data.account_number,
            accountName: data.data.account_name,
            accountType: data.data.account_type,
            currency: data.data.currency,
            balance: data.data.balance || 0,
            status: data.data.status || 'active',
            isPrimary: data.data.is_primary || false,
            createdAt: new Date(data.data.created_at),
          } : undefined,
        };
      }
      return {
        success: false,
        message: data.message || 'Failed to create account',
      };
    } catch (error: unknown) {
      console.error('Error creating account:', error);
      
      // Extract error message from axios error response
      let errorMessage = 'Error creating account';
      
      if (error instanceof AxiosError && error.response) {
        const errorData = error.response.data;
        if (errorData && typeof errorData === 'object') {
          if ('message' in errorData && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if ('error' in errorData && typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        
        // Check if it's a 401 error
        if (error.response.status === 401) {
          errorMessage = 'Unauthorized: Please ensure you are logged in and your session is valid. ' + 
                        (errorMessage !== 'Error creating account' ? errorMessage : '');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Set an account as primary
   */
  async setPrimaryAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.accountEndpoint}/${accountId}/set-primary`);
      
      const data = response.data as { success?: boolean; message?: string };
      return {
        success: !!data.success,
        message: data.message || (data.success ? 'Primary account updated' : 'Failed to set primary account'),
      };
    } catch (error) {
      console.error('Error setting primary account:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error setting primary account',
      };
    }
  }

  /**
   * Freeze an account
   */
  async freezeAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.accountEndpoint}/${accountId}/freeze`);
      
      const data = response.data as { success?: boolean; message?: string };
      return {
        success: !!data.success,
        message: data.message || (data.success ? 'Account frozen successfully' : 'Failed to freeze account'),
      };
    } catch (error) {
      console.error('Error freezing account:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error freezing account',
      };
    }
  }

  /**
   * Unfreeze an account
   */
  async unfreezeAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.accountEndpoint}/${accountId}/unfreeze`);
      
      const data = response.data as { success?: boolean; message?: string };
      return {
        success: !!data.success,
        message: data.message || (data.success ? 'Account unfrozen successfully' : 'Failed to unfreeze account'),
      };
    } catch (error) {
      console.error('Error unfreezing account:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error unfreezing account',
      };
    }
  }

  /**
   * Get a single account by ID
   */
  async getAccountByKeycloakId(): Promise<Account | null> {
    try {
      const keycloak_id = localStorage.getItem('keycloak_id');
      const response = await apiService.get(`${AppConfig.accountEndpoint}/account/keycloak/${keycloak_id}`);
      
      const data = response.data as { success?: boolean; account?: any };
      if (data.success && data.account) {
        const acc = data.account;
        localStorage.setItem('account', JSON.stringify(acc));
        return {
          id: acc.id,
          userId: acc.user_id,
          accountNumber: acc.account_number,
          accountName: acc.account_name,
          accountType: acc.account_type,
          currency: acc.currency,
          balance: acc.balance,
          status: acc.status,
          isPrimary: acc.is_primary,
          createdAt: new Date(acc.created_at),
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to load account:', error);
      throw error;
    }
  }
}

export const accountService = new AccountService();
