import apiClient from '../api';

/**
 * Branch Feature Configuration (for API response)
 */
export interface BranchFeatureFlag {
  id: string;
  name: string;
  is_enabled: boolean;
  config: Record<string, any>;
}

/**
 * Branch Feature Configuration (for payload)
 */
export interface BranchFeature {
  flag: string;
  config: Record<string, any>;
}

/**
 * Branch Contact Information
 */
export interface BranchContact {
  id?: string;
  email: string;
  name: string;
  phone: string;
}

/**
 * Branch Onboarding Payload
 */
export interface BranchOnboardingPayload {
  name: string;
  code: string;
  location: string;
  webhookUrl: string;
  callbackUrl: string;
  contact: BranchContact;
  features: BranchFeature[];
}

/**
 * Branch Response from API
 */
export interface Branch {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  code: string;
  webhook_url: string;
  callback_url: string;
  location: string;
  status: string;
  tenant_id: string;
  contact: BranchContact;
  feature_flags: BranchFeatureFlag[];
}

/**
 * Branch List Response
 */
export interface BranchListResponse {
  status: string;
  branches?: Branch[];
  data?: Branch[];
  message?: string;
}

/**
 * Branch Service
 * Handles all branch-related API calls
 */
class BranchService {
  /**
   * Create a new branch
   * POST /tenant-management/tenant/branch
   */
  async createBranch(payload: BranchOnboardingPayload): Promise<Branch> {
    try {
      const response = await apiClient.post<{ status?: string; message?: string; branch?: Branch; data?: Branch }>(
        '/tenant-management/tenant/branch',
        payload
      );

      // Handle different response structures
      if (response.data.branch) {
        return response.data.branch;
      } else if (response.data.data) {
        return response.data.data;
      } else if (response.data.status === 'success' || response.data.message === 'success') {
        // API returned success but no branch data - return a minimal branch object
        // with the data from the payload since the API doesn't return the created branch
        // Note: This is a temporary object that matches the Branch interface structure
        return {
          id: 0, // Temporary ID, will be updated when branch is fetched
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          name: payload.name,
          code: payload.code,
          location: payload.location,
          webhook_url: payload.webhookUrl,
          callback_url: payload.callbackUrl,
          status: 'active',
          tenant_id: '', // Will be populated from tenant context
          contact: {
            ...payload.contact,
            id: '', // Temporary ID
          },
          feature_flags: payload.features.map(f => ({
            id: '', // Temporary ID
            name: f.flag,
            is_enabled: true,
            config: f.config || {},
          })),
        };
      }

      // If we get success but no branch data, throw error
      throw new Error(response.data.message || 'Failed to create branch: No branch data returned');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create branch';
      throw new Error(errorMessage);
    }
  }

  /**
   * Get all branches
   * GET /tenant-management/tenant/branch
   */
  async getAllBranches(): Promise<Branch[]> {
    try {
      const response = await apiClient.get<BranchListResponse>(
        '/tenant-management/tenant/branch'
      );

      // Handle different response structures
      if (response.data.branches && Array.isArray(response.data.branches)) {
        return response.data.branches;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }

      // If response is just success message with no branches
      return [];
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to fetch branches';
      throw new Error(errorMessage);
    }
  }
}

export const branchService = new BranchService();

