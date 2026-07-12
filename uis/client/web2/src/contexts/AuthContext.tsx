import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth_service';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  accountNumber?: string;
  hasCompletedOnboarding?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<void>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = authService.isAuthenticated();
        if (isAuth) {
          const userData = await authService.getCurrentUser();
          if (userData) {
            const onboardingCompleted = localStorage.getItem('hasCompletedOnboarding');
            setUser({
              id: userData.id,
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              phoneNumber: userData.phoneNumber,
              hasCompletedOnboarding: onboardingCompleted === 'true',
            });
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const userData = await authService.login(email, password);
    setUser({
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber,
      hasCompletedOnboarding: false,
    });
  }, []);

  const register = useCallback(async (userData: any) => {
    const response = await authService.register(userData);
    setUser({
      id: '',
      email: response.email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      phoneNumber: userData.phoneNumber || '',
      hasCompletedOnboarding: false,
    });
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    localStorage.removeItem('hasCompletedOnboarding');
    
    // Clear encrypted card data and encryption salt
    try {
      const { offlineCardService } = await import('../services/offline_card_service');
      await offlineCardService.clearCachedCards();
      const { clearEncryptionSalt } = await import('../utils/encryption');
      clearEncryptionSalt();
    } catch (error) {
      console.error('Failed to clear offline data on logout:', error);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    if (user) {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      setUser({ ...user, hasCompletedOnboarding: true });
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      hasCompletedOnboarding: user?.hasCompletedOnboarding || false,
      login,
      logout,
      register,
      completeOnboarding,
    }),
    [user, isLoading, login, logout, register, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
