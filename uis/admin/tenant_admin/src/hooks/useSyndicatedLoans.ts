import { useQuery } from '@tanstack/react-query';
import { syndicatedLoansService } from '../services/syndicatedLoansService';

export function useSyndicatedLoanList() {
  return useQuery({ queryKey: ['syndicated-loans', 'list'], queryFn: syndicatedLoansService.list, staleTime: 60_000 });
}

export function useSyndicatedLoanStats() {
  return useQuery({ queryKey: ['syndicated-loans', 'stats'], queryFn: syndicatedLoansService.stats, staleTime: 60_000 });
}
