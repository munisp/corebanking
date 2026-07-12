import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dormancyService } from '../services/dormancyService';
import type { CheckDormancyRequest, ReactivateRequest, NotifyRequest } from '../types/dormancy';

export const DORMANCY_KEYS = {
  list: (params?: object) => ['dormancy', 'list', params] as const,
  stats: ['dormancy', 'stats'] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['dormancy', 'list'] });
  qc.invalidateQueries({ queryKey: DORMANCY_KEYS.stats });
}

export function useDormantAccountList(params?: { page?: number; limit?: number; search?: string; stage?: string }) {
  return useQuery({
    queryKey: DORMANCY_KEYS.list(params),
    queryFn: () => dormancyService.list(params),
    staleTime: 60_000,
  });
}

export function useDormancyStats() {
  return useQuery({
    queryKey: DORMANCY_KEYS.stats,
    queryFn: dormancyService.stats,
    staleTime: 60_000,
  });
}

export function useCheckDormancy() {
  return useMutation({
    mutationFn: (input: CheckDormancyRequest) => dormancyService.check(input),
  });
}

export function useReactivateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReactivateRequest) => dormancyService.reactivate(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useNotifyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotifyRequest) => dormancyService.notify(input),
    onSuccess: () => invalidateAll(qc),
  });
}
