import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface User {
  id: string;
  keycloakId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string;
  profileImageUrl?: string;
  status: string;
  accountType: string;
  tier: string;
  createdAt: Date;
  updatedAt?: Date;
}

export class UserService {
  // Get current user from API
  async getCurrentUser(keycloakId: string): Promise<User | null> {
    try {
      const response = await apiService.get(`${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}`);

      if (response.status === 200) {
        const respData = response.data as { user?: Record<string, unknown> };
        const user = this.parseUser(respData.user!);
        if (user.keycloakId) {
          localStorage.setItem('keycloak_id', user.keycloakId);
        }
        localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user));
        localStorage.setItem('uesr_data', JSON.stringify(user));
        return user;
      }
      return null;
    } catch {
      // Try to get from storage
      const userData = localStorage.getItem(AppConfig.userDataKey);
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    }
  }

  // Get stored user from local storage
  async getStoredUser(): Promise<User | null> {
    const userData = localStorage.getItem(AppConfig.userDataKey);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  }

  // Get user profile
  async getUserProfile(keycloakId: string): Promise<User> {
    const response = await apiService.get(`${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}`);

    if (response.status === 200) {
      const respData = response.data as { data?: Record<string, unknown> };
      const user = this.parseUser(respData.data!);
      if (user.keycloakId) {
        localStorage.setItem('keycloak_id', user.keycloakId);
      }
      localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user));
      return user;
    } else {
      throw new Error('Failed to fetch user profile');
    }
  }

  // Update user profile
  async updateUserProfile(keycloakId: string, data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    dateOfBirth?: string;
  }): Promise<User> {
    const updateData: Record<string, unknown> = {};
    if (data.firstName) updateData.first_name = data.firstName;
    if (data.lastName) updateData.last_name = data.lastName;
    if (data.phoneNumber) updateData.phone_number = data.phoneNumber;
    if (data.email) updateData.email = data.email;
    if (data.address) updateData.address = data.address;
    if (data.city) updateData.city = data.city;
    if (data.state) updateData.state = data.state;
    if (data.country) updateData.country = data.country;
    if (data.postalCode) updateData.postal_code = data.postalCode;
    if (data.dateOfBirth) updateData.date_of_birth = data.dateOfBirth;

    const response = await apiService.put(`${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}`, updateData);

    if (response.status === 200) {
      const respData = response.data as { data?: Record<string, unknown> };
      const user = this.parseUser(respData.data!);

      // Ensure keycloak_id is stored in localStorage
      if (user.keycloakId) {
        localStorage.setItem('keycloak_id', user.keycloakId);
      }

      // Update stored user data
      localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user));

      return user;
    } else {
      throw new Error('Failed to update user profile');
    }
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.authEndpoint}/change-password`, {
        old_password: oldPassword,
        new_password: newPassword,
      });

      const data = response.data as { message?: string };
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'Password changed successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to change password',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error changing password',
      };
    }
  }

  // Upload profile image
  async uploadProfileImage(keycloakId: string, imageFile: File): Promise<{ success: boolean; message: string; imageUrl?: string }> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await apiService.post(`${AppConfig.userEndpoint}/user/profile-image?keycloak_id=${keycloakId}`, formData);

      const data = response.data as { message?: string; data?: { image_url?: string } };
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'Profile image uploaded successfully',
          imageUrl: data.data?.image_url,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to upload profile image',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error uploading profile image',
      };
    }
  }

  // Verify BVN
  async verifyBvn(keycloakId: string, bvn: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post(`${AppConfig.authEndpoint}/verify-bvn`, {
        keycloak_id: keycloakId,
        bvn: bvn,
      });

      const data = response.data as { message?: string };
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'BVN verified successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'BVN verification failed',
        };
      }
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'BVN verification failed');
    }
  }

  // Delete user account
  async deleteAccount(keycloakId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.delete(`${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}`);

      const data = response.data as { message?: string };
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'Account deleted successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to delete account',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error deleting account',
      };
    }
  }

  // Helper method to parse user from JSON
  private parseUser(json: Record<string, unknown>): User {
    return {
      id: (json.id || json.user_id) as string,
      keycloakId: (json.keycloak_id || json.keycloakId) as string,
      firstName: (json.first_name || json.firstName) as string,
      lastName: (json.last_name || json.lastName) as string,
      email: json.email as string,
      phoneNumber: (json.phone_number || json.phoneNumber) as string,
      address: json.address as string | undefined,
      city: json.city as string | undefined,
      state: json.state as string | undefined,
      country: json.country as string | undefined,
      postalCode: (json.postal_code || json.postalCode) as string | undefined,
      dateOfBirth: (json.date_of_birth || json.dateOfBirth) as string | undefined,
      profileImageUrl: (json.profile_image_url || json.profileImageUrl) as string | undefined,
      status: json.status as string,
      accountType: (json.account_type || json.accountType) as string,
      tier: json.tier as string,
      createdAt: new Date((json.created_at || json.createdAt) as string),
      updatedAt: json.updated_at || json.updatedAt ? new Date((json.updated_at || json.updatedAt) as string) : undefined,
    };
  }
}

export const userService = new UserService();
