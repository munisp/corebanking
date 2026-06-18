import { AppConfig } from '../config/app_config';
import { getErrorMessage } from '../utils/error_utils';
import { apiService } from './api_service';

export class LoanService {
  // =================== APPLY FOR LOAN ===================
  async applyForLoan(params: {
    amount: number;
    termInMonths: number;
    purpose: string;
    monthlyIncome?: number;
    existingDebt?: number;
    collateralValue?: number;
    creditScore?: number;
    employmentStatus?: string;
    employmentDuration?: number;
    bankStatementScore?: number;
    bvnVerified?: boolean;
    ninVerified?: boolean;
  }): Promise<Record<string, any>> {
    try {
      const response = await apiService.post(`${AppConfig.loanEndpoint}/applications`, {
        loan_amount: params.amount,
        loan_purpose: params.purpose,
        requested_term: params.termInMonths,
        monthly_income: params.monthlyIncome ?? 1000,
        existing_debt: params.existingDebt ?? 0,
        collateral_value: params.collateralValue ?? 5000,
        credit_score: params.creditScore ?? 1100,
        employment_status: params.employmentStatus ?? 'employed',
        employment_duration: params.employmentDuration ?? 24,
        bank_statement_score: params.bankStatementScore ?? 90,
        bvn_verified: params.bvnVerified ?? true,
        nin_verified: params.ninVerified ?? true,
      });

      if (response.status === 200 || response.status === 201) {
        return response.data as Record<string, any>;
      } else {
        const data = response.data as { message?: string };
        throw new Error(getErrorMessage(data, 'Loan application failed'));
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Loan application failed'));
    }
  }

  // =================== FETCH LOAN DETAILS ===================
  async fetchLoanDetails(loanId: string): Promise<Record<string, any>> {
    try {
      const response = await apiService.get(`${AppConfig.loanEndpoint}/application/${loanId}`);
      if (response.status === 200) {
        const data = response.data as { data?: any; message?: string };
        return data.data;
      } else {
        const data = response.data as { message?: string };
        throw new Error(getErrorMessage(data, 'Failed to fetch loan details'));
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Failed to fetch loan details'));
    }
  }

  // =================== GET ALL LOANS ===================
  async getAllLoans(): Promise<any[]> {
    try {
      const response = await apiService.get(`${AppConfig.loanEndpoint}/applications`);
      if (response.status === 200) {
        return (response.data as any[]) || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      return [];
    }
  }

  // =================== GET LOAN BY ID ===================
  async getLoanById(loanId: string): Promise<any> {
    try {
      const response = await apiService.get(`${AppConfig.loanEndpoint}/applications/${loanId}`);
      if (response.status === 200) {
        return response.data as Record<string, any>;
      }
      const data = response.data as { message?: string };
      throw new Error(getErrorMessage(data, 'Loan not found'));
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Failed to fetch loan details'));
    }
  }

  // =================== REPAY LOAN ===================
  async repayLoan(loanId: string, amount: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.loanEndpoint}/${loanId}/repay`, {
        amount,
      });

      const data = response.data as { message?: string };
      if (response.status === 200) {
        return {
          success: true,
          message: getErrorMessage(data, 'Loan repayment successful'),
        };
      } else {
        return {
          success: false,
          message: getErrorMessage(data, 'Loan repayment failed'),
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error, 'Loan repayment error'),
      };
    }
  }

  // =================== GET REPAYMENT SCHEDULE ===================
  async getRepaymentSchedule(loanId: string): Promise<any[]> {
    try {
      const response = await apiService.get(`${AppConfig.loanEndpoint}/loans/${loanId}/schedule`);
      if (response.status === 200) {
        return (response.data as any[]) || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch repayment schedule:', error);
      return [];
    }
  }
}

export const loanService = new LoanService();
