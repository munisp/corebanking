import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export class OrchestratorService {
  // Create customer (with full onboarding data)
  async createCustomer(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    pin: string;
    accountType?: string;
    bvn?: string;
    uin?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await apiService.post(`${AppConfig.orchestratorEndpoint}/customer`, {
        email: params.email,
        password: params.password,
        firstName: params.firstName,
        lastName: params.lastName,
        phone: params.phoneNumber,
        pin: params.pin,
        accountType: params.accountType,
        bvn: params.bvn,
        uin: params.uin,
        address: params.address || '',
        city: params.city || '',
        state: params.state || '',
        postalCode: params.postalCode || '',
        country: params.country || 'Nigeria',
      });

      // const pinsetupresponse = await apiService.post(`${AppConfig.accountEndpoint}/account/setup-pin`, {
      //   pin: params.pin,
      // });

      if (response.status === 201 || response.status === 200) {
        const data = response.data as { customer?: unknown; message?: string };
        return {
          success: true,
          data: data.customer ?? data,
          message: data.message || 'Customer created successfully',
        };
      }
      const data = response.data as { message?: string };
      return {
        success: false,
        message: data.message || 'Failed to create customer',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error creating customer',
      };
    }
  }

  // Get customer by ID
  async getCustomer(customerId: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await apiService.get(`${AppConfig.orchestratorEndpoint}/customer/${customerId}`);
      if (response.status === 200) {
        const data = response.data as { data?: unknown; customer?: unknown; message?: string };
        return {
          success: true,
          data: data.data ?? data.customer,
        };
      }
      const data = response.data as { message?: string };
      return {
        success: false,
        message: data.message || 'Failed to fetch customer',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error fetching customer',
      };
    }
  }

  // Update customer
  async updateCustomer(customerId: string, params: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const updateData: Record<string, any> = {};
      if (params.firstName) updateData.first_name = params.firstName;
      if (params.lastName) updateData.last_name = params.lastName;
      if (params.phoneNumber) updateData.phone_number = params.phoneNumber;
      if (params.address) updateData.address = params.address;
      if (params.city) updateData.city = params.city;
      if (params.state) updateData.state = params.state;
      if (params.country) updateData.country = params.country;

      const response = await apiService.put(`${AppConfig.orchestratorEndpoint}/customer/${customerId}`, updateData);
      if (response.status === 200) {
        const data = response.data as { data?: unknown; customer?: unknown; message?: string };
        return {
          success: true,
          data: data.data ?? data.customer,
          message: data.message || 'Customer updated successfully',
        };
      }
      const data = response.data as { message?: string };
      return {
        success: false,
        message: data.message || 'Failed to update customer',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error updating customer',
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.get(`${AppConfig.orchestratorEndpoint}/health`);
      const data = response.data as { message?: string };
      return {
        success: response.status === 200,
        message: data.message || 'Service is healthy',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}

export const orchestratorService = new OrchestratorService();
