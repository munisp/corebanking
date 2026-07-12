import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insuranceAnalyticsService } from '../services/insuranceAnalyticsService';
import type { CreateInsuranceRecordPayload } from '../types/insuranceAnalytics';

export const INS_KEYS = {
  all: ['insurance-analytics'] as const,
  list: ['insurance-analytics', 'list'] as const,
  stats: ['insurance-analytics', 'stats'] as const,
};

export function useInsuranceAnalyticsList() {
  return useQuery({
    queryKey: INS_KEYS.list,
    queryFn: insuranceAnalyticsService.list,
    staleTime: 60_000,
  });
}

export function useInsuranceAnalyticsStats() {
  return useQuery({
    queryKey: INS_KEYS.stats,
    queryFn: insuranceAnalyticsService.stats,
    staleTime: 60_000,
  });
}

export function useCreateInsuranceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInsuranceRecordPayload) => insuranceAnalyticsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INS_KEYS.all });
      toast.success('Record created successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create record');
    },
  });
}
