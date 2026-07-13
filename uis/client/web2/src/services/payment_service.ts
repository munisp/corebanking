import { AppConfig } from '../config/app_config';
import { getErrorMessage } from '../utils/error_utils';
import { apiService } from './api_service';

export class PaymentService {
  // =================== TRANSFER MONEY ===================
  async transfer(params: {
    payerAccountId: string | number;
    payeeAccountId: string | number;
    amount: number;
    note: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/transfer`, {
        payer: Number(localStorage.getItem('account_id')),
        payee: Number(params.payeeAccountId),
        amount: params.amount,
        note: params.note,
        pin: params.pin,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200) {
        return {
          success: true,
          message: data.message || 'Transfer successful',
          data: data.data,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Transfer failed',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error, 'Transfer error'),
      };
    }
  }

  // =================== INITIATE TRANSFER ===================
  async initiateTransfer(params: {
    recipientAccount: string;
    amount: number;
    narration: string;
    recipientName?: string;
    recipientBank?: string;
  }) {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/transfer`, {
        recipient_account: params.recipientAccount,
        amount: params.amount,
        narration: params.narration,
        recipient_name: params.recipientName,
        recipient_bank: params.recipientBank,
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data as { data?: any };
        return data.data;
      } else {
        throw new Error('Transfer failed');
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Transfer failed'));
    }
  }

  // =================== VERIFY ACCOUNT ===================
  async verifyAccount(accountNumber: string, bankCode?: string) {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/verify-account`, {
        account_number: accountNumber,
        bank_code: bankCode,
      });

      if (response.status === 200) {
        const data = response.data as { data?: any };
        return data.data;
      } else {
        throw new Error('Account verification failed');
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Account verification failed'));
    }
  }

  // =================== GET BANKS ===================
  async getBanks() {
    try {
      const response = await apiService.get(`${AppConfig.paymentEndpoint}/banks`);

      if (response.status === 200) {
        const data = response.data as { data?: any[] };
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      return [];
    }
  }

  // =================== GET BILLER CATEGORIES ===================
  async getBillerCategories() {
    try {
      const response = await apiService.get(`${AppConfig.paymentEndpoint}/billers/categories`);

      if (response.status === 200) {
        const data = response.data as { data?: any[] };
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch biller categories:', error);
      return [];
    }
  }

  // =================== GET BILLERS BY CATEGORY ===================
  async getBillers(categoryId: string) {
    try {
      const response = await apiService.get(`${AppConfig.paymentEndpoint}/billers?category_id=${categoryId}`);

      if (response.status === 200) {
        const data = response.data as { data?: any[] };
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch billers:', error);
      return [];
    }
  }

  // =================== PAY BILL ===================
  async payBill(params: {
    billerId: string;
    customerId: string;
    amount: number;
    additionalData?: Record<string, any>;
  }) {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/bills/pay`, {
        biller_id: params.billerId,
        customer_id: params.customerId,
        amount: params.amount,
        ...params.additionalData,
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data as { data?: any };
        return data.data;
      } else {
        throw new Error('Bill payment failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Bill payment failed');
    }
  }

  // =================== VALIDATE CUSTOMER ===================
  async validateCustomer(billerId: string, customerId: string) {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/bills/validate`, {
        biller_id: billerId,
        customer_id: customerId,
      });

      if (response.status === 200) {
        const data = response.data as { data?: any };
        return data.data;
      } else {
        throw new Error('Customer validation failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Customer validation failed');
    }
  }

  // =================== GET BENEFICIARIES ===================
  async getBeneficiaries() {
    try {
      const response = await apiService.get(`${AppConfig.paymentEndpoint}/beneficiaries`);

      if (response.status === 200) {
        const data = response.data as { data?: any[] };
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch beneficiaries:', error);
      return [];
    }
  }

  // =================== ADD BENEFICIARY ===================
  async addBeneficiary(params: {
    accountNumber: string;
    accountName: string;
    bankCode?: string;
    bankName?: string;
  }) {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/beneficiaries`, {
        account_number: params.accountNumber,
        account_name: params.accountName,
        bank_code: params.bankCode,
        bank_name: params.bankName,
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data as { data?: any };
        return data.data;
      } else {
        throw new Error('Failed to add beneficiary');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to add beneficiary');
    }
  }

  // =================== DELETE BENEFICIARY ===================
  async deleteBeneficiary(beneficiaryId: string) {
    try {
      const response = await apiService.delete(`${AppConfig.paymentEndpoint}/beneficiaries/${beneficiaryId}`);

      if (response.status === 200) {
        return { success: true, message: 'Beneficiary deleted successfully' };
      } else {
        throw new Error('Failed to delete beneficiary');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete beneficiary');
    }
  }

  // =================== DEPOSIT MONEY ===================
  async deposit(params: {
    accountId: string;
    amount: number;
    pin: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/deposit`, {
        account_id: params.accountId,
        amount: params.amount,
        pin: params.pin,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200) {
        return {
          success: true,
          message: data.message || 'Deposit successful',
          data: data.data,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Deposit failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Deposit error',
      };
    }
  }

  // =================== WITHDRAW MONEY ===================
  async withdraw(params: {
    accountId: string;
    amount: number;
    pin: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/withdraw`, {
        account_id: params.accountId,
        amount: params.amount,
        pin: params.pin,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200) {
        return {
          success: true,
          message: data.message || 'Withdrawal successful',
          data: data.data,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Withdrawal failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Withdrawal error',
      };
    }
  }

  // =================== PROCESS QR PAYMENT ===================
  async processQRPayment(params: { qrData: string; amount: number; narration?: string }) {
    await new Promise((res) => setTimeout(res, 1000));
    return {
      qr_payment_id: 'qr_001',
      qr_data: params.qrData,
      amount: params.amount,
      narration: params.narration,
      status: 'completed',
      paid_at: new Date().toISOString(),
    };
  }

  // =================== GENERATE PAYMENT QR CODE ===================
  async generateQR(
    recipient: string,
    amount: number,
    currency: string,
    note?: string
  ): Promise<{ success: boolean; message: string; qrCodeData?: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/qr/generate`, {
        recipient: String(recipient),
        amount: String(amount),
        currency,
        note: note || '',
      });

      const data = response.data as { message?: string; qr_code_data?: string; data?: { qr_code_data?: string } };
      if (data.message === 'success' || response.status === 200 || response.status === 201) {
        const qrCodeData = data.qr_code_data || data.data?.qr_code_data;
        return {
          success: true,
          message: data.message || 'QR code generated',
          qrCodeData: qrCodeData,
          data: data,
        };
      } else {
        return {
          success: false,
          message: data.message || 'QR generation failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Error generating QR code',
      };
    }
  }

  // =================== PAY LOAN ===================
  async payLoan(params: {
    loanId: string;
    payer: string | number;
    amount: number;
    pin: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/loan`, {
        loan_id: params.loanId,
        payer: Number(params.payer),
        amount: params.amount,
        pin: params.pin,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: data.message || 'Loan payment successful',
          data: data.data || data,
        };
      } else {
        return {
          success: false,
          message: getErrorMessage(data, 'Loan payment failed'),
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error, 'Error processing loan payment'),
      };
    }
  }

  // =================== PAY LPO ===================
  async payLPO(params: {
    lpoId: string;
    payer: string | number;
    pin: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/lpo`, {
        lpo_id: params.lpoId,
        payer: Number(params.payer),
        pin: params.pin,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: data.message || 'LPO payment successful',
          data: data.data || data,
        };
      } else {
        return {
          success: false,
          message: getErrorMessage(data, 'LPO payment failed'),
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error, 'Error processing LPO payment'),
      };
    }
  }

  // =================== VALIDATE QR CODE ===================
  async validateQR(qrData: {
    recipient: string;
    amount: string;
    currency: string;
    note?: string;
    expiry?: string;
    signature?: string;
    tenant?: string;
    ledger?: number;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/qr/validate`, {
        recipient: qrData.recipient,
        amount: qrData.amount,
        currency: qrData.currency,
        note: qrData.note || '',
        expiry: qrData.expiry,
        signature: qrData.signature,
        tenant: qrData.tenant,
        ledger: qrData.ledger,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success === true || response.status === 200 || response.status === 201) {
        const validationData = data.data || data;
        return {
          success: true,
          message: data.message || 'QR code validated',
          data: validationData,
        };
      } else {
        return {
          success: false,
          message: data.message || 'QR validation failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Error validating QR code',
      };
    }
  }
}

  // =================== BULK PAYMENT ===================
  async bulkPayment(params: {
    batchId?: string;
    pin: string;
    transfers: Array<{
      accountNumber: string;
      amount: string;
      narration: string;
      accountName?: string;
      bankCode?: string;
    }>;
  }): Promise<{
    success: boolean;
    message: string;
    data?: {
      batch_id: string;
      total: number;
      succeeded: number;
      failed: number;
      success_rate_pct: number;
      results: Array<{ index: number; status: string; response?: any; error?: string }>;
    };
  }> {
    try {
      const fromAccountId = localStorage.getItem('account_id') || '';
      const transfers = params.transfers.map((t) => ({
        switch_name: 'vfd',
        fromAccountId,
        toAccount: {
          number: t.accountNumber,
          id: t.accountNumber,
          name: t.accountName || t.accountNumber,
          status: 'active',
        },
        toBank: t.bankCode || '999999',
        amount: t.amount,
        remark: t.narration,
      }));

      const response = await apiService.post(`/bulk-payments/v1/bulk-payments`, {
        batch_id: params.batchId,
        pin: params.pin,
        transfers,
      });

      const data = response.data as any;
      if (response.status === 200 || response.status === 201) {
        return { success: true, message: 'Batch submitted', data };
      }
      return { success: false, message: data?.error || 'Bulk payment failed' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Bulk payment error') };
    }
  }

  // =================== GET BULK PAYMENT HISTORY ===================
  async getBulkPaymentHistory(page = 1, limit = 20): Promise<any[]> {
    try {
      const response = await apiService.get(`/bulk-payments/v1/bulk-payments?page=${page}&limit=${limit}`);
      if (response.status === 200) {
        const data = response.data as { items?: any[] };
        return data.items || [];
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const paymentService = new PaymentService();
