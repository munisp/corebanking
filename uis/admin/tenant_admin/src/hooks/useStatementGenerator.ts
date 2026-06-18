import { useQuery } from '@tanstack/react-query';
import { statementGeneratorService } from '../services/statementGeneratorService';

export const STMT_GEN_KEYS = {
  all: ['statement-generator'] as const,
  list: ['statement-generator', 'list'] as const,
  stats: ['statement-generator', 'stats'] as const,
  detail: (id: string) => ['statement-generator', 'detail', id] as const,
};

export function useStatementGeneratorList() {
  return useQuery({
    queryKey: STMT_GEN_KEYS.list,
    queryFn: statementGeneratorService.list,
    staleTime: 60_000,
  });
}

export function useStatementGeneratorStats() {
  return useQuery({
    queryKey: STMT_GEN_KEYS.stats,
    queryFn: statementGeneratorService.stats,
    staleTime: 60_000,
  });
}

export function useStatementDetail(id: string) {
  return useQuery({
    queryKey: STMT_GEN_KEYS.detail(id),
    queryFn: () => statementGeneratorService.getById(id),
    staleTime: 120_000,
    enabled: !!id,
  });
}
