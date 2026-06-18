import { AppConfig } from '../config/app_config';
import { getErrorMessage } from '../utils/error_utils';
import { apiService } from './api_service';

export interface LPOSupplier {
  id: number;
  supplier_id: string;
  business_name: string;
  registration_number: string;
  total_lpos_financed: number;
  total_amount_financed: number;
  successful_repayments: number;
  defaulted_repayments: number;
  credit_score: number;
  created_at: string;
  updated_at: string;
}

export class LPOService {
  // =================== APPLY FOR LPO ===================
  async applyForLPO(params: {
    supplierId: string;
    tenantId: string;
    lpoNumber: string;
    issuingOrganization: string;
    lpoAmount: number;
    financingAmount: number;
    repaymentDays: number;
    lpoDocumentUrl?: string;
  }): Promise<Record<string, any>> {
    try {
      const response = await apiService.post(`${AppConfig.lpoEndpoint}/lpo/apply`, {
        supplier_id: params.supplierId,
        tenant_id: params.tenantId,
        lpo_number: params.lpoNumber,
        issuing_organization: params.issuingOrganization,
        lpo_amount: params.lpoAmount,
        financing_amount: params.financingAmount,
        repayment_days: params.repaymentDays,
        lpo_document_url: params.lpoDocumentUrl ?? '',
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data as { data?: any; message?: string };
        return data.data;
      } else {
        const data = response.data as { message?: string };
        throw new Error(getErrorMessage(data, 'LPO application failed'));
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'LPO application failed'));
    }
  }

  // =================== FETCH LPO DETAILS ===================
  async fetchLPODetails(lpoId: string): Promise<Record<string, any>> {
    try {
      const response = await apiService.get(`${AppConfig.lpoEndpoint}/lpo/${lpoId}`);
      if (response.status === 200) {
        return response.data as Record<string, any>;
      } else {
        const data = response.data as { message?: string };
        throw new Error(getErrorMessage(data, 'Fetching LPO details failed'));
      }
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Failed to fetch LPO details'));
    }
  }

  // =================== GET ALL LPOs ===================
  async getAllLPOs(): Promise<any[]> {
    try {
      const response = await apiService.get(`${AppConfig.lpoEndpoint}/lpo`);
      if (response.status === 200) {
        return (response.data as any[]) || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch LPOs:', error);
      return [];
    }
  }

  // =================== REPAY LPO ===================
  async repayLPO(lpoId: string, amount: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.lpoEndpoint}/${lpoId}/repay`, {
        amount,
      });

      if (response.status === 200) {
        return {
          success: true,
          message: getErrorMessage(response.data, 'LPO repayment successful'),
        };
      } else {
        return {
          success: false,
          message: getErrorMessage(response.data, 'LPO repayment failed'),
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: getErrorMessage(error, 'LPO repayment error'),
      };
    }
  }

  // =================== GET ALL SUPPLIERS ===================
  async getSuppliers(): Promise<LPOSupplier[]> {
    try {
      const response = await apiService.get(`${AppConfig.lpoEndpoint}/suppliers`);
      
      // Handle both direct array response and wrapped response
      const data = response.data as { success?: boolean; data?: any[] } | any[];
      if (Array.isArray(data)) {
        return data as LPOSupplier[];
      } else if ((data as any).success && Array.isArray((data as any).data)) {
        return (data as any).data as LPOSupplier[];
      } else if (Array.isArray((data as any).data)) {
        return (data as any).data as LPOSupplier[];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      return [];
    }
  }
}

export const lpoService = new LPOService();
