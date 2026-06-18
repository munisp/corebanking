import { useQuery } from '@tanstack/react-query';
import { creditFacilityService } from '../services/creditFacilityService';

export const FAC_KEYS = {
  all: ['credit-facility'] as const,
  list: ['credit-facility', 'list'] as const,
  detail: (id: string) => ['credit-facility', 'detail', id] as const,
  stats: ['credit-facility', 'stats'] as const,
};

export function useFacilityList() {
  return useQuery({ queryKey: FAC_KEYS.list, queryFn: creditFacilityService.list, staleTime: 30_000 });
}

export function useFacilityDetail(id: string) {
  return useQuery({
    queryKey: FAC_KEYS.detail(id),
    queryFn: () => creditFacilityService.getById(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useFacilityStats() {
  return useQuery({ queryKey: FAC_KEYS.stats, queryFn: creditFacilityService.stats, staleTime: 30_000 });
}
