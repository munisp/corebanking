import { useCallback, useEffect, useState } from "react";
import { authService, type AuthUser } from "./authService";

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  kycVerificationStatus: string | null;
  kycVerificationUrl: string | null;
  isKycVerified: boolean;
}

/**
 * React hook for authentication
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const token = authService.getToken();
      const userData = authService.getUser();

      setIsAuthenticated(!!token);
      setUser(userData);
      setIsLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login function
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.login({ email, password });

      // Update state with user data from login response
      let userData = response.user || authService.getUser();
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
      }

      // Fetch full user details from the user endpoint using keycloak_id
      try {
        const fullUserData = await authService.fetchUserDetails();
        if (fullUserData) {
          setUser(fullUserData);
          userData = fullUserData;
        }
      } catch (err: any) {
        console.warn(
          "Failed to fetch user details from endpoint:",
          err.message,
        );
        // Don't throw error here - user is already logged in with basic info
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
      setIsAuthenticated(false);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    error,
    kycVerificationStatus: user?.kyc_verification_status || null,
    kycVerificationUrl: user?.kyc_url || user?.kyc_verification_url || null,
    isKycVerified:
      user?.is_verified === true ||
      user?.kyc_verification_status === "verified",
  };
}
