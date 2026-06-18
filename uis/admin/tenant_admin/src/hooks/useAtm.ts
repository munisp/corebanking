import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { atmService } from '../services/atmService';
import type { ReportFaultPayload, CreateATMPayload } from '../types/atm';

export const ATM_KEYS = {
  all: ['atm'] as const,
  terminals: ['atm', 'terminals'] as const,
  faults: ['atm', 'faults'] as const,
  stats: ['atm', 'stats'] as const,
};

export function useAtmTerminals() {
  return useQuery({
    queryKey: ATM_KEYS.terminals,
    queryFn: atmService.listTerminals,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useAtmFaults() {
  return useQuery({
    queryKey: ATM_KEYS.faults,
    queryFn: atmService.listFaults,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAtmStats() {
  return useQuery({
    queryKey: ATM_KEYS.stats,
    queryFn: atmService.getStats,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useCreateAtmTerminal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateATMPayload) => atmService.createTerminal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATM_KEYS.terminals });
      queryClient.invalidateQueries({ queryKey: ATM_KEYS.stats });
      toast.success('ATM terminal created successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create ATM terminal');
    },
  });
}

export function useReportFault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReportFaultPayload) => atmService.reportFault(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATM_KEYS.faults });
      queryClient.invalidateQueries({ queryKey: ATM_KEYS.stats });
      toast.success('Fault reported successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to report fault');
    },
  });
}
