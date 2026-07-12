import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface Savings {
  id: string;
  userId: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  contributionAmount: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
  imageUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  progress: number;
}

export class SavingsService {
  // Get all savings for the current user - matching mobile endpoint
  async getAllSavings(): Promise<Savings[]> {
    try {
      // Updated to match mobile: ${AppConfig.savingsEndpoint}/savings
      // where savingsEndpoint = '/savings/api/v1'
      const response = await apiService.get(`${AppConfig.savingsEndpoint}/savings`);

      if (response.status === 200) {
        const data = response.data as { data?: unknown } | unknown[];
        let savingsData: unknown;
        if (Array.isArray(data)) {
          savingsData = data;
        } else if (data && typeof data === 'object' && 'data' in data) {
          savingsData = (data as { data: unknown }).data;
        } else {
          savingsData = data;
        }
        if (!Array.isArray(savingsData)) {
          if (savingsData && typeof savingsData === 'object') {
            savingsData = [savingsData];
          } else {
            throw new Error('Invalid data format: expected array or object');
          }
        }
        const savingsList = savingsData as Record<string, unknown>[];
        return savingsList.map((json) => this.parseSavings(json));
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to fetch savings');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to fetch savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get a specific savings by ID
  async getSavingsById(id: string): Promise<Savings> {
    try {
      const response = await apiService.get(`${AppConfig.savingsEndpoint}/savings/${id}`);

      if (response.status === 200) {
        const data = response.data as Record<string, unknown>;
        return this.parseSavings(data);
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to fetch savings details');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to fetch savings details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create a new savings - matching mobile API format
  // Accepts: name, target_amount (int), target_date (ISO 8601 string), enable_auto_save (bool)
  async createSavings(data: {
    name: string;
    description?: string;
    targetAmount: number;
    frequency?: string;
    contributionAmount?: number;
    startDate?: Date;
    endDate?: Date;
    targetDate?: Date;
    enableAutoSave?: boolean;
  }): Promise<Savings> {
    try {
      // Use mobile API format if targetDate and enableAutoSave are provided
      if (data.targetDate !== undefined && data.enableAutoSave !== undefined) {
        const requestData = {
          name: data.name,
          target_amount: Math.round(data.targetAmount), // Mobile uses int
          target_date: data.targetDate.toISOString(),
          enable_auto_save: data.enableAutoSave,
        };
        const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings`, requestData);

        if (response.status === 200 || response.status === 201) {
          const responseData = response.data as { data?: any; message?: string };
          const savingsData = responseData.data || responseData;
          return this.parseSavings(savingsData);
        } else {
          const data = response.data as { message?: string };
          throw new Error(data.message || 'Failed to create savings');
        }
      } else {
        // Use web API format (backward compatibility)
        const requestData: Record<string, unknown> = {
          name: data.name,
          description: data.description || '',
          target_amount: data.targetAmount,
          frequency: data.frequency || 'monthly',
          contribution_amount: data.contributionAmount || 0,
          start_date: (data.startDate || new Date()).toISOString(),
        };

        if (data.endDate) {
          requestData.end_date = data.endDate.toISOString();
        }

        const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings`, requestData);

        if (response.status === 200 || response.status === 201) {
          const responseData = response.data as Record<string, unknown>;
          return this.parseSavings(responseData);
        } else {
          const data = response.data as { message?: string };
          throw new Error(data.message || 'Failed to create savings');
        }
      }
    } catch (error: unknown) {
      throw new Error(`Failed to create savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update savings
  async updateSavings(
    id: string,
    data: {
      name?: string;
      description?: string;
      targetAmount?: number;
      frequency?: string;
      contributionAmount?: number;
      endDate?: Date;
      status?: string;
    }
  ): Promise<Savings> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name) updateData.name = data.name;
      if (data.description) updateData.description = data.description;
      if (data.targetAmount) updateData.target_amount = data.targetAmount;
      if (data.frequency) updateData.frequency = data.frequency;
      if (data.contributionAmount) updateData.contribution_amount = data.contributionAmount;
      if (data.endDate) updateData.end_date = data.endDate.toISOString();
      if (data.status) updateData.status = data.status;

      const response = await apiService.put(`${AppConfig.savingsEndpoint}/savings/${id}`, updateData);

      if (response.status === 200) {
        const responseData = response.data as Record<string, unknown>;
        return this.parseSavings(responseData);
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to update savings');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to update savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete savings
  async deleteSavings(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.delete(`${AppConfig.savingsEndpoint}/savings/${id}`);

      const data = response.data as { message?: string };
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'Savings deleted successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to delete savings',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error deleting savings',
      };
    }
  }

  // Pause savings
  async pauseSavings(id: string): Promise<Savings> {
    try {
      const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings/${id}/pause`);

      if (response.status === 200) {
        const data = response.data as Record<string, unknown>;
        return this.parseSavings(data);
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to pause savings');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to pause savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Resume savings
  async resumeSavings(id: string): Promise<Savings> {
    try {
      const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings/${id}/resume`);

      if (response.status === 200) {
        const data = response.data as Record<string, unknown>;
        return this.parseSavings(data);
      } else {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to resume savings');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to resume savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Make contribution to savings
  async makeContribution(data: { savingsId: string; amount: number }): Promise<void> {
    try {
      const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings/${data.savingsId}/contribute`, {
        amount: data.amount,
      });

      if (response.status !== 200 && response.status !== 201) {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to make contribution');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to make contribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Withdraw from savings
  async withdrawFromSavings(data: { savingsId: string; amount: number; reason?: string }): Promise<void> {
    try {
      const requestData: Record<string, unknown> = {
        amount: data.amount,
      };
      if (data.reason) {
        requestData.reason = data.reason;
      }

      const response = await apiService.post(`${AppConfig.savingsEndpoint}/savings/${data.savingsId}/withdraw`, requestData);

      if (response.status !== 200 && response.status !== 201) {
        const data = response.data as { message?: string };
        throw new Error(data.message || 'Failed to withdraw');
      }
    } catch (error: unknown) {
      throw new Error(`Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to parse savings from JSON
  private parseSavings(json: Record<string, unknown>): Savings {
    // Map API response fields - support both snake_case and camelCase
    const goalName = String(json.goal_name || json.goalName || json.name || '');
    const targetAmount = Number(json.target_amount || json.targetAmount || 0);
    
    // Current amount can be from balance, current_amount, or calculated from credits/debits
    const balance = Number(json.balance || 0);
    const creditsPosted = Number(json.credits_posted || json.creditsPosted || 0);
    const debitsPosted = Number(json.debits_posted || json.debitsPosted || 0);
    const currentAmount = Number(json.current_amount || json.currentAmount || balance || (creditsPosted - debitsPosted) || 0);
    
    // Contribution amount might not be in response, use a default or calculate from frequency
    const contributionAmount = Number(json.contribution_amount || json.contributionAmount || 0);
    
    // Frequency might not be in API response, default to monthly
    const frequency = (json.frequency as Savings['frequency']) || 'monthly';
    
    // Calculate progress
    const progress = targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
    
    // Start date - use created_at if start_date is not available
    const startDate = json.start_date || json.startDate || json.created_at || json.createdAt;
    
    // End date - use target_date if end_date is not available (for savings goals)
    const endDateRaw = json.end_date || json.endDate || json.target_date || json.targetDate;

    return {
      id: String(json.goal_id || json.id || json.savings_id || ''),
      userId: String(json.customer_id || json.user_id || json.userId || ''),
      name: goalName, // Use goal_name from API
      description: String(json.description || goalName || ''),
      targetAmount,
      currentAmount,
      frequency,
      contributionAmount,
      startDate: new Date(startDate ? (startDate as string) : new Date()),
      endDate: endDateRaw ? new Date(endDateRaw as string) : undefined,
      status: (json.status as Savings['status']) || 'active',
      imageUrl: json.image_url || json.imageUrl ? String(json.image_url || json.imageUrl) : undefined,
      createdAt: new Date((json.created_at || json.createdAt || new Date()) as string),
      updatedAt: json.updated_at || json.updatedAt ? new Date((json.updated_at || json.updatedAt) as string) : undefined,
      progress,
    };
  }
}

export const savingsService = new SavingsService();
