import { useQuery } from '@tanstack/react-query';
import { cifService } from '../services/cifService';

export const CIF_KEYS = {
  all: ['cif'] as const,
  list: ['cif', 'list'] as const,
  stats: ['cif', 'stats'] as const,
  detail: (id: string) => ['cif', 'detail', id] as const,
};

export function useCIFList() {
  return useQuery({
    queryKey: CIF_KEYS.list,
    queryFn: cifService.list,
    staleTime: 60_000,
  });
}

export function useCIFStats() {
  return useQuery({
    queryKey: CIF_KEYS.stats,
    queryFn: cifService.stats,
    staleTime: 60_000,
  });
}

export function useCIFDetail(id: string) {
  return useQuery({
    queryKey: CIF_KEYS.detail(id),
    queryFn: () => cifService.getById(id),
    staleTime: 120_000,
    enabled: !!id,
  });
}
