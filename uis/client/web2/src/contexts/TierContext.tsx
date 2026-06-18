import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type TierLevel = 1 | 2 | 3;

export interface TierStatus {
  tier: TierLevel;
  hasBVN: boolean;
  hasDocuments: boolean;
  hasAddress: boolean;
  hasFaceVerification: boolean;
}

interface TierContextType {
  tierStatus: TierStatus;
  updateTierStatus: (updates: Partial<TierStatus>) => void;
  upgradeTier: () => void;
  resetTier: () => void;
}

const defaultTierStatus: TierStatus = {
  tier: 1,
  hasBVN: false,
  hasDocuments: false,
  hasAddress: false,
  hasFaceVerification: false,
};

const TierContext = createContext<TierContextType | undefined>(undefined);

export const TierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tierStatus, setTierStatus] = useState<TierStatus>(() => {
    const stored = localStorage.getItem('tierStatus');
    return stored ? JSON.parse(stored) : defaultTierStatus;
  });

  useEffect(() => {
    localStorage.setItem('tierStatus', JSON.stringify(tierStatus));
  }, [tierStatus]);

  const updateTierStatus = useCallback((updates: Partial<TierStatus>) => {
    setTierStatus(prev => {
      const newStatus = { ...prev, ...updates };
      
      // Auto-upgrade tier based on completed verifications
      if (newStatus.hasBVN && newStatus.hasDocuments && newStatus.hasFaceVerification && newStatus.tier < 2) {
        newStatus.tier = 2;
      }
      if (newStatus.tier === 2 && newStatus.hasAddress && newStatus.tier < 3) {
        newStatus.tier = 3;
      }
      
      return newStatus;
    });
  }, []);

  const upgradeTier = useCallback(() => {
    setTierStatus(prev => ({
      ...prev,
      tier: Math.min(3, prev.tier + 1) as TierLevel,
    }));
  }, []);

  const resetTier = useCallback(() => {
    setTierStatus(defaultTierStatus);
    localStorage.removeItem('tierStatus');
  }, []);

  const value = useMemo(
    () => ({ tierStatus, updateTierStatus, upgradeTier, resetTier }),
    [tierStatus, updateTierStatus, upgradeTier, resetTier]
  );

  return (
    <TierContext.Provider value={value}>
      {children}
    </TierContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTier = () => {
  const context = useContext(TierContext);
  if (!context) {
    throw new Error('useTier must be used within a TierProvider');
  }
  return context;
};

// Helper function to get tier display info
// Fast refresh: utility function
// eslint-disable-next-line react-refresh/only-export-components
export const getTierInfo = (tier: TierLevel) => {
  const tierInfo = {
    1: {
      name: 'Basic',
      color: 'bg-gray-500',
      textColor: 'text-gray-700',
      description: 'Complete your profile to unlock more features',
    },
    2: {
      name: 'Verified',
      color: 'bg-[var(--primary-color)]',
      textColor: 'text-[var(--primary-color)]',
      description: 'Your identity has been verified',
    },
    3: {
      name: 'Full Access',
      color: 'bg-green-500',
      textColor: 'text-green-700',
      description: 'All features unlocked',
    },
  };
  
  return tierInfo[tier];
};
