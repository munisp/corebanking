import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cooperativeCreditScoringService } from '../services/cooperativeCreditScoringService';
import type { CreateMLRecordPayload } from '../types/cooperativeCreditScoring';

const COOP_KEYS = {
  all: ['coop-credit-scoring'] as const,
  list: ['coop-credit-scoring', 'list'] as const,
  stats: ['coop-credit-scoring', 'stats'] as const,
};

export function useCoopCreditList() {
  return useQuery({ queryKey: COOP_KEYS.list, queryFn: cooperativeCreditScoringService.list, staleTime: 60_000 });
}

export function useCoopCreditStats() {
  return useQuery({ queryKey: COOP_KEYS.stats, queryFn: cooperativeCreditScoringService.stats, staleTime: 60_000 });
}

export function useCreateMLRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMLRecordPayload) => cooperativeCreditScoringService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COOP_KEYS.all });
      toast.success('ML record created');
    },
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create record'),
  });
}
