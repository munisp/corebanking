import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { posService } from '../services/posService';
import type { CreatePOSTerminalPayload, CreatePOSTransactionPayload } from '../types/pos';

export const POS_KEYS = {
  all: ['pos'] as const,
  terminals: ['pos', 'terminals'] as const,
  transactions: ['pos', 'transactions'] as const,
  stats: ['pos', 'stats'] as const,
};

export function usePosTerminals() {
  return useQuery({
    queryKey: POS_KEYS.terminals,
    queryFn: posService.listTerminals,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useCreatePosTerminal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePOSTerminalPayload) => posService.createTerminal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POS_KEYS.terminals });
      queryClient.invalidateQueries({ queryKey: POS_KEYS.stats });
      toast.success('Terminal deployed successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to deploy terminal');
    },
  });
}

export function usePosTransactions() {
  return useQuery({
    queryKey: POS_KEYS.transactions,
    queryFn: posService.listTransactions,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCreatePosTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePOSTransactionPayload) => posService.createTransaction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POS_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: POS_KEYS.stats });
      toast.success('Transaction recorded successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to record transaction');
    },
  });
}

export function usePosStats() {
  return useQuery({
    queryKey: POS_KEYS.stats,
    queryFn: posService.getStats,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
