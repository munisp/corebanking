import { useQuery } from '@tanstack/react-query';
import { leasingService } from '../services/leasingService';

export function useLeaseContractList() {
  return useQuery({ queryKey: ['leasing', 'list'], queryFn: leasingService.list, staleTime: 60_000 });
}

export function useLeasingStats() {
  return useQuery({ queryKey: ['leasing', 'stats'], queryFn: leasingService.stats, staleTime: 60_000 });
}
