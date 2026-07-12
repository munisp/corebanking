import { useQuery } from '@tanstack/react-query';
import { mandateService } from '../services/mandateService';

export const MANDATE_KEYS = {
  all: ['mandates'] as const,
  list: ['mandates', 'list'] as const,
  stats: ['mandates', 'stats'] as const,
};

export function useMandateList() {
  return useQuery({
    queryKey: MANDATE_KEYS.list,
    queryFn: mandateService.list,
    staleTime: 30_000,
  });
}

export function useMandateStats() {
  return useQuery({
    queryKey: MANDATE_KEYS.stats,
    queryFn: mandateService.stats,
    staleTime: 60_000,
  });
}
