import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pensionService } from '../services/pensionService';
import type { CreatePensionPayload } from '../types/pension';

export const PENSION_KEYS = {
  list: ['pension', 'list'] as const,
  stats: ['pension', 'stats'] as const,
  detail: (id: string) => ['pension', 'detail', id] as const,
  contributions: (id: string) => ['pension', 'contributions', id] as const,
};

export function usePensionList() {
  return useQuery({
    queryKey: PENSION_KEYS.list,
    queryFn: pensionService.list,
    staleTime: 60_000,
  });
}

export function usePensionStats() {
  return useQuery({
    queryKey: PENSION_KEYS.stats,
    queryFn: pensionService.stats,
    staleTime: 60_000,
  });
}

export function usePensionContributions(id: string) {
  return useQuery({
    queryKey: PENSION_KEYS.contributions(id),
    queryFn: () => pensionService.getContributions(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

function useAccountMutation(
  fn: (id: string) => Promise<unknown>,
  successMsg: string,
  errorMsg: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENSION_KEYS.list });
      qc.invalidateQueries({ queryKey: PENSION_KEYS.stats });
      toast.success(successMsg);
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? errorMsg);
    },
  });
}

export function useCreatePension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePensionPayload) => pensionService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENSION_KEYS.list });
      qc.invalidateQueries({ queryKey: PENSION_KEYS.stats });
      toast.success('Pension account registered successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create pension account');
    },
  });
}

export function usePausePension() {
  return useAccountMutation(pensionService.pause, 'Pension account paused', 'Failed to pause account');
}

export function useResumePension() {
  return useAccountMutation(pensionService.resume, 'Pension account resumed', 'Failed to resume account');
}

export function useWithdrawPension() {
  return useAccountMutation(pensionService.withdraw, 'Pension account withdrawn', 'Failed to process withdrawal');
}
