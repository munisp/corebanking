import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  accountService,
  accountOpeningService,
  accountClosureService,
  accountStatementService,
  ledgerTransactionService,
} from '../services/accountService';
import type {
  CreateAccountApplicationPayload,
  CreateClosureRequestPayload,
  GenerateStatementPayload,
} from '../types/account';

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const ACCOUNT_KEYS = {
  opening: {
    all: ['account-opening'] as const,
    list: (page: number, limit: number) => ['account-opening', 'list', page, limit] as const,
    stats: ['account-opening', 'stats'] as const,
    detail: (id: string) => ['account-opening', 'detail', id] as const,
  },
  closure: {
    all: ['account-closure'] as const,
    list: (page: number, limit: number) => ['account-closure', 'list', page, limit] as const,
    stats: ['account-closure', 'stats'] as const,
    detail: (id: string) => ['account-closure', 'detail', id] as const,
  },
  statement: {
    accounts: ['account-statement', 'accounts'] as const,
    transactions: (acctNum?: string) => ['account-statement', 'transactions', acctNum] as const,
  },
};

// ─── All Accounts ─────────────────────────────────────────────────────────────

export function useAccountList(page = 1, limit = 25) {
  return useQuery({
    queryKey: ['accounts', 'list', page, limit] as const,
    queryFn: () => accountService.list(page, limit),
    staleTime: 30_000,
  });
}

export function useAllAccounts() {
  return useQuery({
    queryKey: ['accounts', 'all'] as const,
    queryFn: () => accountService.listAll(),
    staleTime: 60_000,
  });
}

// ─── Account Opening ──────────────────────────────────────────────────────────

export function useAccountOpeningList(page = 1, limit = 50) {
  return useQuery({
    queryKey: ACCOUNT_KEYS.opening.list(page, limit),
    queryFn: () => accountOpeningService.list(page, limit),
    staleTime: 30_000,
  });
}

export function useAccountOpeningStats() {
  return useQuery({
    queryKey: ACCOUNT_KEYS.opening.stats,
    queryFn: accountOpeningService.stats,
    staleTime: 60_000,
  });
}

export function useCreateAccountApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAccountApplicationPayload) =>
      accountOpeningService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.opening.all });
      toast.success('Account application submitted successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to submit application');
    },
  });
}

// ─── Account Closure ──────────────────────────────────────────────────────────

export function useAccountClosureList(page = 1, limit = 50) {
  return useQuery({
    queryKey: ACCOUNT_KEYS.closure.list(page, limit),
    queryFn: () => accountClosureService.list(page, limit),
    staleTime: 30_000,
  });
}

export function useAccountClosureStats() {
  return useQuery({
    queryKey: ACCOUNT_KEYS.closure.stats,
    queryFn: accountClosureService.stats,
    staleTime: 60_000,
  });
}

export function useCreateClosureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClosureRequestPayload) =>
      accountClosureService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.closure.all });
      toast.success('Closure request submitted successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to submit closure request');
    },
  });
}

export function useApproveClosureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountClosureService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.closure.all });
      toast.success('Closure request approved');
    },
    onError: (err: Error) => { toast.error(err?.message ?? 'Failed to approve'); },
  });
}

export function useCompleteClosureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountClosureService.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.closure.all });
      toast.success('Account closure completed');
    },
    onError: (err: Error) => { toast.error(err?.message ?? 'Failed to complete closure'); },
  });
}

export function useRejectClosureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountClosureService.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.closure.all });
      toast.success('Closure request rejected');
    },
    onError: (err: Error) => { toast.error(err?.message ?? 'Failed to reject'); },
  });
}

// ─── Ledger Transactions ──────────────────────────────────────────────────────

export function useLedgerTransactions(ledgerId?: string, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['ledger-transactions', ledgerId, page, limit] as const,
    queryFn: () => ledgerTransactionService.getByLedgerId(ledgerId!, page, limit),
    enabled: !!ledgerId,
    staleTime: 30_000,
  });
}

// ─── Account Statements ───────────────────────────────────────────────────────

export function useStatementAccounts() {
  return useQuery({
    queryKey: ACCOUNT_KEYS.statement.accounts,
    queryFn: accountStatementService.listAccounts,
    staleTime: 120_000,
  });
}

export function useStatementTransactions(accountNumber?: string) {
  return useQuery({
    queryKey: ACCOUNT_KEYS.statement.transactions(accountNumber),
    queryFn: () => accountStatementService.listTransactions(accountNumber),
    staleTime: 30_000,
    enabled: true,
  });
}

export function useGenerateStatement() {
  return useMutation({
    mutationFn: (payload: GenerateStatementPayload) =>
      accountStatementService.generate(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to generate statement');
    },
  });
}

export function useStatementSummary() {
  return useMutation({
    mutationFn: (payload: GenerateStatementPayload) =>
      accountStatementService.getSummary(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to load summary');
    },
  });
}

export function useBalanceTrend() {
  return useMutation({
    mutationFn: (accountNumber: string) =>
      accountStatementService.getBalanceTrend(accountNumber),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to load balance trend');
    },
  });
}
