import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { collateralValuationService } from '../services/collateralValuationService';
import type { ComputeFSVPayload } from '../types/collateralValuation';

const COL_KEYS = {
  list: ['collateral-valuation', 'list'] as const,
  summary: ['collateral-valuation', 'summary'] as const,
};

export function useValuationList() {
  return useQuery({ queryKey: COL_KEYS.list, queryFn: collateralValuationService.list, staleTime: 60_000 });
}

export function useValuationSummary() {
  return useQuery({ queryKey: COL_KEYS.summary, queryFn: collateralValuationService.summary, staleTime: 60_000 });
}

export function useComputeFSV() {
  return useMutation({
    mutationFn: (payload: ComputeFSVPayload) => collateralValuationService.computeFSV(payload),
    onError: (err: Error) => toast.error(err?.message ?? 'FSV computation failed'),
  });
}
