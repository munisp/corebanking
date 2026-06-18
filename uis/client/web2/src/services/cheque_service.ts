import { apiService } from './api_service';

export interface Cheque {
  id: string;
  userId: string;
  accountId: string;
  chequeNumber: string;
  status: 'requested' | 'issued' | 'delivered' | 'stopped' | 'used';
  requestDate: Date;
  issueDate?: Date;
  deliveryDate?: Date;
  numberOfLeaves: number;
  deliveryMethod: 'branch' | 'courier';
  deliveryAddress?: string;
  branchName?: string;
  stopReason?: string;
  stopDate?: Date;
}

export class ChequeService {
  // Request new cheque book
  async requestChequeBook(data: {
    accountId: string;
    numberOfLeaves: number;
    deliveryMethod: string;
    deliveryAddress?: string;
    branchName?: string;
  }): Promise<{ success: boolean; message: string; data?: Cheque }> {
    try {
      const req = {
        account_id: data.accountId,
        number_of_leaves: data.numberOfLeaves,
        delivery_method: data.deliveryMethod,
        delivery_address: data.deliveryAddress,
        branch_name: data.branchName,
      };
      const response = await apiService.post('/payment-processing/cheques/request', req);
      const respData = response.data as { success?: boolean; message?: string; data?: any };
      if (respData.success === true) {
        return {
          success: true,
          message: respData.message || 'Cheque book requested successfully',
          data: respData.data,
        };
      } else {
        return {
          success: false,
          message: respData.message || 'Failed to request cheque book',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error requesting cheque book',
      };
    }
  }

  // Get all cheques for user
  async getCheques(accountId?: string): Promise<Cheque[]> {
    try {
      const endpoint = accountId
        ? `/payment-processing/cheques?account_id=${accountId}`
        : '/payment-processing/cheques';

      const response = await apiService.get(endpoint);

      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success === true) {
        const chequesData = data.data as Record<string, unknown>[];
        return chequesData.map((json) => ({
          id: json.id as string,
          userId: json.user_id as string,
          accountId: json.account_id as string,
          chequeNumber: json.cheque_number as string,
          status: json.status as Cheque['status'],
          requestDate: new Date(json.request_date as string),
          issueDate: json.issue_date ? new Date(json.issue_date as string) : undefined,
          deliveryDate: json.delivery_date ? new Date(json.delivery_date as string) : undefined,
          numberOfLeaves: json.number_of_leaves as number,
          deliveryMethod: json.delivery_method as Cheque['deliveryMethod'],
          deliveryAddress: json.delivery_address as string | undefined,
          branchName: json.branch_name as string | undefined,
          stopReason: json.stop_reason as string | undefined,
          stopDate: json.stop_date ? new Date(json.stop_date as string) : undefined,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  // Stop cheque
  async stopCheque(chequeId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`/payment-processing/cheques/${chequeId}/stop`, {
        reason,
      });

      const data = response.data as { success?: boolean; message?: string };
      if (data.success === true) {
        return {
          success: true,
          message: data.message || 'Cheque stopped successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to stop cheque',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error stopping cheque',
      };
    }
  }

  // Get cheque details
  async getChequeDetails(chequeId: string): Promise<Cheque | null> {
    try {
      const response = await apiService.get(`/payment-processing/cheques/${chequeId}`);

      const data = response.data as { success?: boolean; data?: any };
      if (data.success === true) {
        const json = data.data;
        return {
          id: json.id,
          userId: json.user_id,
          accountId: json.account_id,
          chequeNumber: json.cheque_number,
          status: json.status,
          requestDate: new Date(json.request_date),
          issueDate: json.issue_date ? new Date(json.issue_date) : undefined,
          deliveryDate: json.delivery_date ? new Date(json.delivery_date) : undefined,
          numberOfLeaves: json.number_of_leaves,
          deliveryMethod: json.delivery_method,
          deliveryAddress: json.delivery_address,
          branchName: json.branch_name,
          stopReason: json.stop_reason,
          stopDate: json.stop_date ? new Date(json.stop_date) : undefined,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch cheque details:', error);
      return null;
    }
  }
}

export const chequeService = new ChequeService();
