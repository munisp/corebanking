import type { CreateVANRequest, VANPayment, VirtualAccount } from '../models/van';
import { PaymentStatus, VANPurpose, VANStatus } from '../models/van';
import { apiService } from './api_service';

class VANService {
  async getVirtualAccounts(): Promise<VirtualAccount[]> {
    try {
      const response = await apiService.get('/van/accounts');
      return (response.data as Record<string, unknown>[]).map((item) => this.parseVirtualAccount(item as Record<string, unknown>));
    } catch (error) {
      console.error('Error fetching virtual accounts:', error);
      return [];
    }
  }

  async getVirtualAccountById(id: string): Promise<VirtualAccount> {
    try {
      const response = await apiService.get(`/van/accounts/${id}`);
      return this.parseVirtualAccount(response.data as Record<string, unknown>);
    } catch (error) {
      console.error('Error fetching virtual account:', error);
      throw new Error('Virtual account not found');
    }
  }

  async getPayments(vanId?: string): Promise<VANPayment[]> {
    try {
      const url = vanId ? `/van/payments?vanId=${vanId}` : '/van/payments';
      const response = await apiService.get(url);
      return (response.data as Record<string, unknown>[]).map((item) => this.parsePayment(item as Record<string, unknown>));
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }

  async createVirtualAccount(request: CreateVANRequest): Promise<{ success: boolean; message: string; account?: VirtualAccount }> {
    try {
      const response = await apiService.post('/van/accounts', request);
      return {
        success: true,
        message: 'Virtual account created successfully',
        account: this.parseVirtualAccount(response.data as Record<string, unknown>),
      };
    } catch (error) {
      console.error('Error creating virtual account:', error);
      return {
        success: false,
        message: 'Failed to create virtual account',
      };
    }
  }

  async deactivateAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiService.post(`/van/accounts/${id}/deactivate`);
      return {
        success: true,
        message: 'Virtual account deactivated successfully',
      };
    } catch (error) {
      console.error('Error deactivating account:', error);
      return {
        success: false,
        message: 'Failed to deactivate virtual account',
      };
    }
  }

  async activateAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiService.post(`/van/accounts/${id}/activate`);
      return {
        success: true,
        message: 'Virtual account activated successfully',
      };
    } catch (error) {
      console.error('Error activating account:', error);
      return {
        success: false,
        message: 'Failed to activate virtual account',
      };
    }
  }

  private parseVirtualAccount(data: Record<string, unknown>): VirtualAccount {
    return {
      id: String(data.id || ''),
      accountNumber: String(data.accountNumber || ''),
      purpose: data.purpose as VANPurpose,
      label: String(data.label || ''),
      balance: Number(data.balance || 0),
      totalReceived: Number(data.totalReceived || 0),
      status: data.status as VANStatus,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
      isSingleUse: Boolean(data.isSingleUse),
    };
  }

  private parsePayment(data: Record<string, unknown>): VANPayment {
    return {
      id: String(data.id || ''),
      vanId: String(data.vanId || ''),
      amount: Number(data.amount || 0),
      senderName: String(data.senderName || ''),
      senderBank: String(data.senderBank || ''),
      reference: String(data.reference || ''),
      status: data.status as PaymentStatus,
      receivedAt: data.receivedAt ? new Date(data.receivedAt as string) : new Date(),
    };
  }
}

export const vanService = new VANService();
