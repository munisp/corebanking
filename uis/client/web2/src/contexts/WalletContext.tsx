import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { walletService } from '../services/wallet_service';

interface Wallet {
  id: string;
  accountNumber: string;
  balance: number;
  currency: string;
  formattedBalance: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  status: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  transactions: Transaction[];
  isLoading: boolean;
  fetchWallet: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      setIsLoading(true);
      const data = await walletService.getMyWallet();
      setWallet({
        id: data.id,
        accountNumber: data.accountNumber,
        balance: data.balance,
        currency: data.currency,
        formattedBalance: new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: data.currency,
        }).format(data.balance),
      });
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await walletService.getTransactions({ page: 1, limit: 20 });
      setTransactions(
        data.map((txn) => ({
          id: txn.id,
          type: txn.type,
          amount: txn.amount,
          description: txn.description,
          date: txn.createdAt.toISOString(),
          status: txn.status,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchWallet(), fetchTransactions()]);
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      refreshAll();
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        transactions,
        isLoading,
        fetchWallet,
        fetchTransactions,
        refreshAll,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
