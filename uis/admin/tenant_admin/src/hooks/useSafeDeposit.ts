import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safeDepositService } from '../services/safeDepositService';
import type { CreateBoxInput, AssignBoxInput, UpdateBoxInput, VacateBoxInput } from '../types/safeDeposit';

export const SAFE_DEPOSIT_KEYS = {
  list: ['safe-deposit', 'list'] as const,
  stats: ['safe-deposit', 'stats'] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SAFE_DEPOSIT_KEYS.list });
  qc.invalidateQueries({ queryKey: SAFE_DEPOSIT_KEYS.stats });
}

export function useSafeDepositList() {
  return useQuery({
    queryKey: SAFE_DEPOSIT_KEYS.list,
    queryFn: safeDepositService.list,
    staleTime: 60_000,
  });
}

export function useSafeDepositStats() {
  return useQuery({
    queryKey: SAFE_DEPOSIT_KEYS.stats,
    queryFn: safeDepositService.stats,
    staleTime: 60_000,
  });
}

export function useCreateBox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoxInput) => safeDepositService.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAssignBox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignBoxInput) => safeDepositService.assign(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateBox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBoxInput) => safeDepositService.update(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useVacateBox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VacateBoxInput) => safeDepositService.vacate(input),
    onSuccess: () => invalidateAll(qc),
  });
}
