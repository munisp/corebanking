import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

// W12-A4B: scheduled payments are served by standing-orders-go
// (AppConfig.scheduledPaymentEndpoint = /standing-orders/v1/standing-orders).
// The backend model is a recurring StandingOrder { accountId, beneficiaryId,
// beneficiaryName, amount, frequency, startDate, endDate, maxExecutions,
// narration } — payload mapping happens here, not in the backend.

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
        accountId: data.accountId,
        beneficiaryName: data.recipientName,
        beneficiaryId: data.recipientAccount,
        amount: data.amount,
        // standing-orders-go accepts daily|weekly|biweekly|monthly|quarterly|annually
        frequency: data.frequency === 'yearly' ? 'annually' : data.frequency,
        startDate: data.startDate.toISOString().slice(0, 10),
        narration: data.description || `Scheduled payment to ${data.recipientName}`,
      };

      if (data.endDate) requestData.endDate = data.endDate.toISOString().slice(0, 10);
      if (data.maxExecutions) requestData.maxExecutions = data.maxExecutions;

      const response = await apiService.post(AppConfig.scheduledPaymentEndpoint, requestData);
      const respData = response.data as Record<string, unknown>;
      if (response.status === 201 && respData && respData.id) {
        return {
          success: true,
          message: 'Scheduled payment created successfully',
          data: this.parseScheduledPayment(respData),
        };
      } else {
        return {
          success: false,
          message: (respData?.error as string) || 'Failed to create scheduled payment',
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
      // W12-A4B: standing-orders-go GET /v1/standing-orders ->
      // { items: [...], total }. It does not filter server-side; filter the
      // real result set client-side by accountId/status when requested.
      const response = await apiService.get(AppConfig.scheduledPaymentEndpoint);
      const data = response.data as { items?: Record<string, unknown>[]; data?: Record<string, unknown>[] };
      const items = data.items || data.data || [];
      let payments = items.map((json) => this.parseScheduledPayment(json));
      if (accountId) payments = payments.filter((p) => p.accountId === accountId);
      if (status) payments = payments.filter((p) => p.status === status);
      return payments;
    } catch {
      return [];
    }
  }

  // Get scheduled payment by ID
  async getScheduledPaymentById(id: string): Promise<ScheduledPayment | null> {
    try {
      // W12-A4B: item fetch via the new standing-orders-go
      // GET /v1/standing-orders/order?id=... handler (raw StandingOrder JSON).
      const response = await apiService.get(`${AppConfig.scheduledPaymentEndpoint}/order`, { id });
      const data = response.data as Record<string, unknown>;
      if (response.status === 200 && data && data.id) {
        return this.parseScheduledPayment(data);
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
      // W12-A4B: update via the new standing-orders-go
      // PUT /v1/standing-orders/order handler (id in the body; returns the
      // updated StandingOrder).
      const updateData: Record<string, unknown> = { id };
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.frequency) updateData.frequency = data.frequency === 'yearly' ? 'annually' : data.frequency;
      if (data.endDate) updateData.endDate = data.endDate.toISOString().slice(0, 10);
      if (data.description) updateData.narration = data.description;
      if (data.maxExecutions) updateData.maxExecutions = data.maxExecutions;

      const response = await apiService.put(`${AppConfig.scheduledPaymentEndpoint}/order`, updateData);
      const respData = response.data as Record<string, unknown>;
      if (response.status === 200 && respData && respData.id) {
        return {
          success: true,
          message: 'Scheduled payment updated successfully',
        };
      } else {
        return {
          success: false,
          message: (respData?.error as string) || 'Failed to update scheduled payment',
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
      // W12-A4B: standing-orders-go POST /v1/standing-orders/pause takes the
      // id in the body ({orderId}) and returns {id, status}.
      const response = await apiService.post(`${AppConfig.scheduledPaymentEndpoint}/pause`, { orderId: id });
      const data = response.data as { status?: string; error?: string };
      if (response.status === 200 && data.status === 'paused') {
        return {
          success: true,
          message: 'Scheduled payment paused successfully',
        };
      } else {
        return {
          success: false,
          message: data.error || 'Failed to pause scheduled payment',
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
      // W12-A4B: standing-orders-go POST /v1/standing-orders/resume,
      // {orderId} body -> {id, status}.
      const response = await apiService.post(`${AppConfig.scheduledPaymentEndpoint}/resume`, { orderId: id });
      const data = response.data as { status?: string; error?: string };
      if (response.status === 200 && data.status === 'active') {
        return {
          success: true,
          message: 'Scheduled payment resumed successfully',
        };
      } else {
        return {
          success: false,
          message: data.error || 'Failed to resume scheduled payment',
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
      // W12-A4B: cancel via the new standing-orders-go
      // DELETE /v1/standing-orders/order?id=... handler (soft-cancel,
      // status='cancelled' — same pattern as the pause handler).
      const response = await apiService.delete(`${AppConfig.scheduledPaymentEndpoint}/order`, { id });
      const data = response.data as { status?: string; error?: string };
      if (response.status === 200 && data.status === 'cancelled') {
        return {
          success: true,
          message: 'Scheduled payment cancelled successfully',
        };
      } else {
        return {
          success: false,
          message: data.error || 'Failed to cancel scheduled payment',
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
      // W12-A4B: standing-orders-go uses beneficiaryName/beneficiaryId/
      // narration/nextExecutionAt and the 'annually' frequency token.
      recipientName: (json.recipient_name || json.recipientName || json.beneficiaryName) as string,
      recipientAccount: (json.recipient_account || json.recipientAccount || json.beneficiaryId) as string,
      recipientBank: (json.recipient_bank || json.recipientBank) as string,
      amount: json.amount as number,
      frequency: (json.frequency === 'annually' ? 'yearly' : json.frequency) as ScheduledPayment['frequency'],
      startDate: new Date((json.start_date || json.startDate) as string),
      endDate: json.end_date || json.endDate ? new Date((json.end_date || json.endDate) as string) : undefined,
      description: (json.description ?? json.narration) as string | undefined,
      status: json.status as ScheduledPayment['status'],
      nextExecutionDate: new Date((json.next_execution_date || json.nextExecutionDate || json.nextExecutionAt) as string),
      executionCount: (json.execution_count || json.executionCount || 0) as number,
      maxExecutions: (json.max_executions || json.maxExecutions) as number | undefined,
      createdAt: new Date((json.created_at || json.createdAt) as string),
      updatedAt: json.updated_at || json.updatedAt ? new Date((json.updated_at || json.updatedAt) as string) : undefined,
    };
  }
}

export const scheduledPaymentService = new ScheduledPaymentService();
