import { useQuery } from '@tanstack/react-query';
import { contingentLiabilitiesService } from '../services/contingentLiabilitiesService';

export function useContingentLiabilityList() {
  return useQuery({
    queryKey: ['contingent-liabilities', 'list'],
    queryFn: contingentLiabilitiesService.list,
    staleTime: 60_000,
  });
}
