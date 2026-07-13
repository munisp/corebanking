import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface CreateBusinessParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  uin?: string;
  businessName: string;
  tin: string;
  cac: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Business {
  id: string;
  name: string;
  registration_number: string;
  verification_status: string;
  email_address?: string;
}

export class BusinessService {
  async getBusinesses(): Promise<Business[]> {
    try {
      const response = await apiService.get(
        `${AppConfig.businessEndpoint}/businesses?limit=100`,
      );
      const data = response.data as { businesses?: Business[] };
      return data.businesses ?? [];
    } catch {
      return [];
    }
  }

  async createBusiness(
    params: CreateBusinessParams,
  ): Promise<{ success: boolean; data?: any; kybUrl?: string; message?: string }> {
    try {
      const response = await apiService.post(
        `${AppConfig.orchestratorEndpoint}/business`,
        {
          email: params.email,
          password: params.password,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phoneNumber,
          uin: params.uin || undefined,
          businessName: params.businessName,
          tin: params.tin,
          cac: params.cac,
          address: params.address || '',
          city: params.city || '',
          state: params.state || '',
          postalCode: params.postalCode || '',
        },
      );

      if (response.status === 201 || response.status === 200) {
        const data = response.data as { message?: string; verification?: string; data?: any };
        return {
          success: true,
          data: data.data ?? data,
          kybUrl: data.verification,
          message: data.message || 'Business account created successfully',
        };
      }

      const data = response.data as { message?: string };
      return {
        success: false,
        message: data.message || 'Failed to create business account',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error creating business account',
      };
    }
  }
}

export const businessService = new BusinessService();
