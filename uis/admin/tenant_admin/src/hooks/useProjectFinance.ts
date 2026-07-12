import { useQuery } from '@tanstack/react-query';
import { projectFinanceService } from '../services/projectFinanceService';

export function useProjectDealList() {
  return useQuery({ queryKey: ['project-finance', 'list'], queryFn: projectFinanceService.list, staleTime: 60_000 });
}

export function useProjectFinanceStats() {
  return useQuery({ queryKey: ['project-finance', 'stats'], queryFn: projectFinanceService.stats, staleTime: 60_000 });
}
