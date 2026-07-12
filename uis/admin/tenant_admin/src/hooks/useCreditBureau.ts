import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { creditBureauService } from '../services/creditBureauService';
import type { ScoreCheckPayload } from '../types/creditBureau';

export const CB_KEYS = {
  reports: ['credit-bureau', 'reports'] as const,
  facilities: ['credit-bureau', 'facilities'] as const,
  stats: ['credit-bureau', 'stats'] as const,
};

export function useCreditReports() {
  return useQuery({ queryKey: CB_KEYS.reports, queryFn: creditBureauService.listReports, staleTime: 60_000 });
}

export function useCreditFacilityRecords() {
  return useQuery({ queryKey: CB_KEYS.facilities, queryFn: creditBureauService.listFacilities, staleTime: 60_000 });
}

export function useCreditBureauStats() {
  return useQuery({ queryKey: CB_KEYS.stats, queryFn: creditBureauService.stats, staleTime: 60_000 });
}

export function useScoreCheck() {
  return useMutation({
    mutationFn: (payload: ScoreCheckPayload) => creditBureauService.scoreCheck(payload),
    onError: (err: Error) => toast.error(err?.message ?? 'Score check failed'),
  });
}
