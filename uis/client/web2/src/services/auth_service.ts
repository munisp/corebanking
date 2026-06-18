import { AppConfig } from '../config/app_config';
import { User } from '../models/user';
import { apiService } from './api_service';
import { userService } from './user_service';

export class AuthService {
  // Login
  async login(email: string, password: string): Promise<User> {
    const response = await apiService.post(`${AppConfig.authEndpoint}/auth/login`, {
      email,
      password,
    });

    if (response.status === 200) {
      // Defensive: response.data is unknown, so cast after checking
      const data = response.data as Record<string, unknown>;

      if (typeof data === 'object' && data !== null) {
        // Store tokens
        if ('access_token' in data && typeof data.access_token === 'string') {
          localStorage.setItem(AppConfig.accessTokenKey, data.access_token);
        }
        if ('refresh_token' in data && typeof data.refresh_token === 'string') {
          localStorage.setItem(AppConfig.refreshTokenKey, data.refresh_token);
        }

        // Store keycloak_id if available in token
        let keycloakId: string | null = null;
        if ('access_token' in data && typeof data.access_token === 'string') {
          try {
            // Decode JWT to get keycloak_id
            const tokenParts = data.access_token.split('.');
            if (tokenParts.length === 3) {
              let payloadBase64 = tokenParts[1];
              while (payloadBase64.length % 4) {
                payloadBase64 += '=';
              }
              const payload = JSON.parse(atob(payloadBase64));
              keycloakId = payload.sub || payload.keycloak_id || null;
              if (keycloakId) {
                localStorage.setItem('keycloak_id', keycloakId);
              }
            }
          } catch (e) {
            console.error('Failed to decode token:', e);
          }
        }

        // Try to fetch user profile - but don't fail login if it doesn't exist yet
        if (keycloakId) {
          try {
            // Try /user endpoint first
            const user = await userService.getUserProfile(keycloakId);
            localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user));
            return User.fromJson(user as unknown as Record<string, unknown>);
          } catch (profileError) {
            console.warn('User profile not found, trying /me endpoint:', profileError);
            // try {
            //   const meResponse = await apiService.get(`${AppConfig.authEndpoint}/me`);
            //   if (
            //     meResponse.status === 200 &&
            //     typeof meResponse.data === 'object' &&
            //     meResponse.data !== null &&
            //     'data' in meResponse.data &&
            //     typeof (meResponse.data as { data?: unknown }).data === 'object' &&
            //     (meResponse.data as { data?: unknown }).data !== null
            //   ) {
            //     const user = User.fromJson((meResponse.data as { data: Record<string, unknown> }).data);
            //     localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user.toJson()));
            //     return user;
            //   }
            // } catch (meError) {
            //   console.warn('Failed to fetch user from /me endpoint:', meError);
            // }
            // If both fail, return a minimal user object - login should still succeed
            console.warn('User profile not available, creating minimal user object');
                const minimalUser = User.fromJson({
                  id: keycloakId,
                  email: email,
                  firstName: '',
                  lastName: '',
                  status: 'active',
                  isVerified: false,
                  createdAt: new Date().toISOString(),
                });
                localStorage.setItem('keycloak_id', keycloakId);
                localStorage.setItem(AppConfig.userDataKey, JSON.stringify(minimalUser.toJson()));
                return minimalUser;
          }
        }

        // If we can't decode keycloak_id, still allow login but with minimal user
        console.warn('Could not extract keycloak_id from token, proceeding with minimal user');
        const minimalUser = User.fromJson({
          id: email, // Use email as fallback ID
          email: email,
          firstName: '',
          lastName: '',
          status: 'active',
          isVerified: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(AppConfig.userDataKey, JSON.stringify(minimalUser.toJson()));
        return minimalUser;
      }
    }
    throw new Error('Login failed');
  }

  // Register - Just store data (all setup happens at customer creation)
  async register(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    uin?: string;
  }): Promise<{ email: string }> {
    // Store onboarding data for later use (will be sent to orchestrator at PIN creation)
    localStorage.setItem('onboarding_data', JSON.stringify({
      email: params.email,
      password: params.password,
      firstName: params.firstName,
      lastName: params.lastName,
      phoneNumber: params.phoneNumber,
      uin: params.uin,
    }));

    return { email: params.email };
  }

  // Get current user from API or storage fallback
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await apiService.get(`${AppConfig.authEndpoint}/me`);
      if (response.status === 200) {
        const data = response.data as { data: Record<string, unknown> };
        const user = User.fromJson(data.data);
        // Extract and store keycloak_id if available in user data
        const keycloakId = (user as { keycloakId?: string; keycloak_id?: string }).keycloakId || (user as { keycloak_id?: string }).keycloak_id || (data.data && typeof data.data === 'object' ? (data.data as { keycloak_id?: string; keycloakId?: string }).keycloak_id ?? (data.data as { keycloakId?: string }).keycloakId : undefined);
        if (keycloakId) {
          localStorage.setItem('keycloak_id', keycloakId);
        }
        // Store user data
        localStorage.setItem(AppConfig.userDataKey, JSON.stringify(user.toJson()));
        return user;
      }
      return null;
    } catch {
      // Fallback to stored user
      const userData = localStorage.getItem(AppConfig.userDataKey);
      if (userData) {
        const user = User.fromJson(JSON.parse(userData));
        // Try to extract keycloak_id from stored user
        const storedUser = JSON.parse(userData);
        const keycloakId = storedUser.keycloakId || storedUser.keycloak_id;
        if (keycloakId && !localStorage.getItem('keycloak_id')) {
          localStorage.setItem('keycloak_id', keycloakId);
        }
        return user;
      }
      return null;
    }
  }



// Add this new method
getUser(): User | null {
  return this.getStoredUser();
}


  // Logout
  async logout(): Promise<void> {
    try {
      await apiService.post(`${AppConfig.authEndpoint}/logout`);
    } catch {
      // Continue with local logout even if API fails
    } finally {
      localStorage.removeItem(AppConfig.accessTokenKey);
      localStorage.removeItem(AppConfig.refreshTokenKey);
      localStorage.removeItem(AppConfig.userDataKey);
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem(AppConfig.accessTokenKey);
    return !!token;
  }

  // Get stored user
  getStoredUser(): User | null {
    const userData = localStorage.getItem(AppConfig.userDataKey);
    if (userData) return User.fromJson(JSON.parse(userData));
    return null;
  }

  // Forgot password
  async forgotPassword(email: string): Promise<{ keycloak_id: string; otp_expires_at: string }> {
    const response = await apiService.post(`${AppConfig.authEndpoint}/auth/forgot-password`, { email });
    return response.data as { keycloak_id: string; otp_expires_at: string };
  }

  // Reset password
  async resetPassword(params: {
    keycloakId: string;
    otpCode: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/auth/reset-password`, {
      keycloak_id: params.keycloakId,
      otp_code: params.otpCode,
      new_password: params.newPassword,
      confirm_password: params.confirmPassword,
    });
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  }

  // create PIN
  async createPin(currentPin: string, newPin: string): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/create-pin`, {
      current_pin: currentPin,
      new_pin: newPin,
    });
  }

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/verify-email`, { token });
  }

  // Resend verification email
  async resendVerificationEmail(): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/resend-verification`);
  }

  // Verify OTP
  async verifyOtp(otp: string): Promise<void> {
    const response = await apiService.post(`${AppConfig.authEndpoint}/verify-otp`, { otp });
    if (response.status === 200) {
      let data: unknown;
      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        data = (response.data as { data: Record<string, unknown> }).data;
      } else {
        data = response.data;
      }
      if (typeof data === 'object' && data !== null && 'access_token' in data) {
        const tokenData = data as { access_token: string; refresh_token?: string };
        localStorage.setItem(AppConfig.accessTokenKey, tokenData.access_token);
        if (tokenData.refresh_token) {
          localStorage.setItem(AppConfig.refreshTokenKey, tokenData.refresh_token);
        }
        // Decode JWT to get keycloak_id
        try {
          const tokenParts = tokenData.access_token.split('.');
          if (tokenParts.length === 3) {
            let payloadBase64 = tokenParts[1];
            while (payloadBase64.length % 4) {
              payloadBase64 += '=';
            }
            const payload = JSON.parse(atob(payloadBase64));
            const keycloakId = payload.sub || payload.keycloak_id;
            if (keycloakId) {
              localStorage.setItem('keycloak_id', keycloakId);
            }
          }
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }
    }
  }

  // Resend OTP
  async resendOtp(): Promise<void> {
    await apiService.post(`${AppConfig.authEndpoint}/resend-otp`);
  }
}

export const authService = new AuthService();
