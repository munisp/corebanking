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
      // W12-A4B: InitiatePaymentSchema (payment-processing schemas/payment.py:50)
      // requires integer amount_kobo — convert from major units here.
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/transfer`, {
        payer: Number(localStorage.getItem('account_id')),
        payee: Number(params.payeeAccountId),
        amount_kobo: Math.round(params.amount * 100),
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
      // W12-A4B: map to InitiatePaymentSchema (payer/payee/amount_kobo/note/pin).
      // pin is schema-required; this screen collects none, so send empty string.
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/transfer`, {
        payer: Number(localStorage.getItem('account_id')),
        payee: params.recipientAccount,
        amount_kobo: Math.round(params.amount * 100),
        note: params.narration,
        pin: '',
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
      // W12-A4B: account verification = name enquiry, served by
      // beneficiary-management-go POST /v1/beneficiaries/verify
      // (camelCase body; returns the enquiry object directly, no envelope).
      const response = await apiService.post('/beneficiaries/v1/beneficiaries/verify', {
        accountNumber: accountNumber,
        bankCode: bankCode,
      });

      if (response.status === 200) {
        const data = response.data as { data?: any };
        return data.data ?? data;
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
      // W12-A4B: bank directory is served by beneficiary-management-go
      // GET /v1/beneficiaries/banks -> { banks: [{code,name}], total }.
      const response = await apiService.get('/beneficiaries/v1/beneficiaries/banks');

      if (response.status === 200) {
        const data = response.data as { data?: any[]; banks?: any[] };
        return data.banks || data.data || [];
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
      // W12-A4B: no categories endpoint exists; mobile-bff
      // GET /api/v1/billers returns billers tagged with `category`, so the
      // category list is derived client-side from the real biller list.
      const response = await apiService.get('/mobile-bff/api/v1/billers');

      if (response.status === 200) {
        const data = response.data as { data?: any[]; billers?: any[] } | any[];
        const billers: any[] = Array.isArray(data)
          ? data
          : data.billers || data.data || [];
        const seen = new Set<string>();
        const categories: { id: string; name: string }[] = [];
        for (const b of billers) {
          const c = String(b?.category ?? '').trim();
          if (c && !seen.has(c)) {
            seen.add(c);
            categories.push({ id: c, name: c });
          }
        }
        return categories;
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
      // W12-A4B: mobile-bff GET /api/v1/billers/:category ->
      // { category, billers: [...] } (fallback-tagged when upstream is down).
      const response = await apiService.get(`/mobile-bff/api/v1/billers/${encodeURIComponent(categoryId)}`);

      if (response.status === 200) {
        const data = response.data as { data?: any[]; billers?: any[] } | any[];
        const billers: any[] = Array.isArray(data)
          ? data
          : data.billers || data.data || [];
        return billers.map((b) => ({
          ...b,
          id: String(b?.id ?? b?.biller_id ?? b?.name ?? ''),
          name: String(b?.name ?? b?.biller_name ?? ''),
        }));
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
      // W12-A4B: mobile-bff POST /api/v1/bills/pay (payload forwarded to the
      // bill-pay upstream; bff returns 202 Accepted with payment receipt).
      const response = await apiService.post(`${AppConfig.billEndpoint}/pay`, {
        biller_id: params.billerId,
        customer_id: params.customerId,
        amount: params.amount,
        ...params.additionalData,
      });

      if (response.status === 200 || response.status === 201 || response.status === 202) {
        const data = response.data as { data?: any };
        return data.data ?? data;
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
      // W12-A4B: mobile-bff POST /api/v1/bills/validate -> validation result
      // object (status/customer_name/amount_due), no {data} envelope.
      const response = await apiService.post(`${AppConfig.billEndpoint}/validate`, {
        biller_id: billerId,
        customer_id: customerId,
      });

      if (response.status === 200) {
        const data = response.data as { data?: any };
        return data.data ?? data;
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
      // W12-A4B: beneficiary-management-go GET /v1/beneficiaries ->
      // { items: [...], total } (gateway prefix /beneficiaries/*).
      const response = await apiService.get('/beneficiaries/v1/beneficiaries');

      if (response.status === 200) {
        const data = response.data as { data?: any[]; items?: any[] };
        return data.items || data.data || [];
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
      // W12-A4B: beneficiary-management-go POST /v1/beneficiaries requires
      // camelCase { customerId, accountNumber, bankCode }; it validates
      // 10-digit accountNumber and known bankCode, and returns the created
      // Beneficiary object directly (201, no envelope).
      const response = await apiService.post('/beneficiaries/v1/beneficiaries', {
        customerId: localStorage.getItem('keycloak_id') || localStorage.getItem('account_id') || '',
        accountNumber: params.accountNumber,
        name: params.accountName,
        bankCode: params.bankCode,
        bankName: params.bankName,
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data as { data?: any };
        return data.data ?? data;
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
      // W12-A4B: beneficiary-management-go DELETE /v1/beneficiaries takes the
      // id in the request body ({beneficiaryId}), not as a path segment.
      const response = await apiService.delete('/beneficiaries/v1/beneficiaries', undefined, {
        beneficiaryId,
      });

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
      // W12-A4B: /payment-processing/payment/deposit now rewrites to
      // payment-processing-service POST /payment/deposit
      // (InitiateDepositSchema: recipient:int, amount|amount_kobo, note).
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/deposit`, {
        recipient: Number(params.accountId),
        amount: params.amount,
        note: 'Deposit',
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
      // W12-A4B: /payment-processing/payment/withdraw rewrites to the NEW
      // payment-processing-service POST /payment/withdraw handler (added in
      // the same batch; InitiateWithdrawalSchema mirrors the deposit schema).
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/withdraw`, {
        recipient: Number(params.accountId),
        amount: params.amount,
        note: 'Withdrawal',
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
      // W12-A4B: InitiateLoanPaymentSchema (schemas/payment.py:122) requires
      // integer amount_kobo — convert from major units here.
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/payment/loan`, {
        loan_id: params.loanId,
        payer: Number(params.payer),
        amount_kobo: Math.round(params.amount * 100),
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
      // W12-A4B: ValidateQRSchema (schemas/qr.py:10) requires expiry and
      // signature as strings — default them instead of dropping undefined.
      const response = await apiService.post(`${AppConfig.paymentEndpoint}/qr/validate`, {
        recipient: qrData.recipient,
        amount: qrData.amount,
        currency: qrData.currency,
        note: qrData.note || '',
        expiry: qrData.expiry ?? '',
        signature: qrData.signature ?? '',
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

  // =================== BULK PAYMENT ===================
  // W12-A4B: removed a stray class-closing brace that preceded this section —
  // bulkPayment/getBulkPaymentHistory are PaymentService methods (the file did
  // not parse: 43 pre-existing TS1xxx errors at this boundary).
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
