import apiClient, { clearAuthHeaders } from "../api";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  access_token?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  message?: string;
  keycloak_id?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_number?: string;
  user_role?: string;
  tenant_id?: string;
  status?: string;
  kyc_verification_status?: string;
  kyc_verification_url?: string | null;
  is_verified?: boolean;
  kyc_url?: string | null;
  uin?: string;
  keycloak_id?: string;
  is_suspended?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

class AuthService {
  private readonly AUTH_TOKEN_KEY = "auth_token";
  private readonly AUTH_USER_KEY = "auth_user";
  private readonly KEYCLOAK_ID_KEY = "keycloak_id";

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        "/auth/auth/login",
        credentials,
      );

      const { token, access_token, user, keycloak_id } = response.data;

      // Store token (support both 'token' and 'access_token' field names)
      const authToken = token || access_token;
      if (authToken) {
        this.setToken(authToken);
        // Set authentication flag for App.tsx router check
        localStorage.setItem("54link-dev_auth", "true");
      }

      // Store keycloak_id from login response
      if (keycloak_id) {
        this.setKeycloakId(keycloak_id);
      }

      // Store user info
      if (user) {
        this.setUser(user);
      }

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout current user
   */
  logout(): void {
    localStorage.clear();
    clearAuthHeaders();
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Set auth token
   */
  setToken(token: string): void {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
  }

  /**
   * Remove auth token
   */
  removeToken(): void {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Get current user
   */
  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(this.AUTH_USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Set user info
   */
  setUser(user: AuthUser): void {
    localStorage.setItem(this.AUTH_USER_KEY, JSON.stringify(user));
  }

  /**
   * Remove user info
   */
  removeUser(): void {
    localStorage.removeItem(this.AUTH_USER_KEY);
  }

  /**
   * Get keycloak_id from localStorage
   */
  getKeycloakId(): string | null {
    return localStorage.getItem(this.KEYCLOAK_ID_KEY);
  }

  /**
   * Set keycloak_id in localStorage
   */
  setKeycloakId(keycloakId: string): void {
    localStorage.setItem(this.KEYCLOAK_ID_KEY, keycloakId);
  }

  /**
   * Remove keycloak_id from localStorage
   */
  removeKeycloakId(): void {
    localStorage.removeItem(this.KEYCLOAK_ID_KEY);
  }

  /**
   * Get user role from stored user data
   */
  getUserRole(): string | null {
    const user = this.getUser();
    return user?.user_role || user?.role || null;
  }

  /**
   * Fetch user details from the user endpoint using keycloak_id
   */
  async fetchUserDetails(): Promise<AuthUser | null> {
    try {
      const keycloakId = this.getKeycloakId();
      if (!keycloakId) {
        throw new Error("Keycloak ID not found");
      }

      const response = await apiClient.get<{ message: string; user?: AuthUser; admin?: AuthUser }>(
        `/admin/admin/keycloak/${keycloakId}`,
      );

      // Handle both 'user' and 'admin' response fields
      const userData = response.data?.admin || response.data?.user;
      
      if (userData) {
        this.setUser(userData);
        return userData;
      }

      return null;
    } catch (error: any) {
      console.error("Failed to fetch user details:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Change password for the currently authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    try {
      await apiClient.post("/auth/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data;
      let message = "An error occurred during authentication";

      // Try multiple paths to extract error message
      if (data?.detail?.message) {
        message = data.detail.message;
      } else if (data?.detail && typeof data.detail === "string") {
        message = data.detail;
      } else if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = data.error;
      }

      console.error("Auth error details:", { data, extractedMessage: message });
      return new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      return new Error("Network error. Please check your connection.");
    } else {
      // Something else happened
      return new Error(error.message || "An unexpected error occurred");
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
