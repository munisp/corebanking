import { apiService } from './api_service';

export interface ScheduledPayment {
  id: string;
  userId: string;
  accountId: string;
  recipientName: string;
  recipientAccount: string;
  recipientBank: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  nextExecutionDate: Date;
  executionCount: number;
  maxExecutions?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export class ScheduledPaymentService {
  // Create scheduled payment
  async createScheduledPayment(data: {
    accountId: string;
    recipientName: string;
    recipientAccount: string;
    recipientBank: string;
    amount: number;
    frequency: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
    maxExecutions?: number;
  }): Promise<{ success: boolean; message: string; data?: ScheduledPayment }> {
    try {
      const requestData: Record<string, unknown> = {
        account_id: data.accountId,
        recipient_name: data.recipientName,
        recipient_account: data.recipientAccount,
        recipient_bank: data.recipientBank,
        amount: data.amount,
        frequency: data.frequency,
        start_date: data.startDate.toISOString(),
      };

      if (data.endDate) requestData.end_date = data.endDate.toISOString();
      if (data.description) requestData.description = data.description;
      if (data.maxExecutions) requestData.max_executions = data.maxExecutions;

      const response = await apiService.post('/payment-processing/scheduled-payments', requestData);
      const respData = response.data as { success: boolean; message?: string; data?: ScheduledPayment };
      if (respData.success === true) {
        return {
          success: true,
          message: respData.message || 'Scheduled payment created successfully',
          data: respData.data,
        };
      } else {
        return {
          success: false,
          message: respData.message || 'Failed to create scheduled payment',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error creating scheduled payment',
      };
    }
  }

  // Get all scheduled payments
  async getScheduledPayments(accountId?: string, status?: string): Promise<ScheduledPayment[]> {
    try {
      let endpoint = '/payment-processing/scheduled-payments';
      const params: string[] = [];

      if (accountId) params.push(`account_id=${accountId}`);
      if (status) params.push(`status=${status}`);

      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const response = await apiService.get(endpoint);
      const data = response.data as { success: boolean; data?: Record<string, unknown>[] };
      if (data.success === true && Array.isArray(data.data)) {
        return data.data.map((json) => this.parseScheduledPayment(json));
      }
      return [];
    } catch {
      return [];
    }
  }

  // Get scheduled payment by ID
  async getScheduledPaymentById(id: string): Promise<ScheduledPayment | null> {
    try {
      const response = await apiService.get(`/payment-processing/scheduled-payments/${id}`);
      const data = response.data as { success: boolean; data?: Record<string, unknown> };
      if (data.success === true && data.data) {
        return this.parseScheduledPayment(data.data);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Update scheduled payment
  async updateScheduledPayment(
    id: string,
    data: {
      amount?: number;
      frequency?: string;
      endDate?: Date;
      description?: string;
      maxExecutions?: number;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.frequency) updateData.frequency = data.frequency;
      if (data.endDate) updateData.end_date = data.endDate.toISOString();
      if (data.description) updateData.description = data.description;
      if (data.maxExecutions) updateData.max_executions = data.maxExecutions;

      const response = await apiService.put(`/payment-processing/scheduled-payments/${id}`, updateData);
      const respData = response.data as { success: boolean; message?: string };
      if (respData.success === true) {
        return {
          success: true,
          message: respData.message || 'Scheduled payment updated successfully',
        };
      } else {
        return {
          success: false,
          message: respData.message || 'Failed to update scheduled payment',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error updating scheduled payment',
      };
    }
  }

  // Pause scheduled payment
  async pauseScheduledPayment(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`/payment-processing/scheduled-payments/${id}/pause`);
      const data = response.data as { success: boolean; message?: string };
      if (data.success === true) {
        return {
          success: true,
          message: data.message || 'Scheduled payment paused successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to pause scheduled payment',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error pausing scheduled payment',
      };
    }
  }

  // Resume scheduled payment
  async resumeScheduledPayment(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`/payment-processing/scheduled-payments/${id}/resume`);
      const data = response.data as { success: boolean; message?: string };
      if (data.success === true) {
        return {
          success: true,
          message: data.message || 'Scheduled payment resumed successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to resume scheduled payment',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error resuming scheduled payment',
      };
    }
  }

  // Cancel scheduled payment
  async cancelScheduledPayment(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.delete(`/payment-processing/scheduled-payments/${id}`);
      const data = response.data as { success: boolean; message?: string };
      if (data.success === true) {
        return {
          success: true,
          message: data.message || 'Scheduled payment cancelled successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to cancel scheduled payment',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error cancelling scheduled payment',
      };
    }
  }

  // Helper method to parse scheduled payment from JSON
  private parseScheduledPayment(json: Record<string, unknown>): ScheduledPayment {
    return {
      id: (json.id || json.payment_id) as string,
      userId: (json.user_id || json.userId) as string,
      accountId: (json.account_id || json.accountId) as string,
      recipientName: (json.recipient_name || json.recipientName) as string,
      recipientAccount: (json.recipient_account || json.recipientAccount) as string,
      recipientBank: (json.recipient_bank || json.recipientBank) as string,
      amount: json.amount as number,
      frequency: json.frequency as ScheduledPayment['frequency'],
      startDate: new Date((json.start_date || json.startDate) as string),
      endDate: json.end_date || json.endDate ? new Date((json.end_date || json.endDate) as string) : undefined,
      description: json.description as string | undefined,
      status: json.status as ScheduledPayment['status'],
      nextExecutionDate: new Date((json.next_execution_date || json.nextExecutionDate) as string),
      executionCount: (json.execution_count || json.executionCount || 0) as number,
      maxExecutions: (json.max_executions || json.maxExecutions) as number | undefined,
      createdAt: new Date((json.created_at || json.createdAt) as string),
      updatedAt: json.updated_at || json.updatedAt ? new Date((json.updated_at || json.updatedAt) as string) : undefined,
    };
  }
}

export const scheduledPaymentService = new ScheduledPaymentService();
