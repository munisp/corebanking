import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { nirsalGuaranteeService } from '../services/nirsalGuaranteeService';
import type { CreateNIRSALPayload } from '../types/nirsalGuarantee';

const NIRSAL_KEYS = {
  all: ['nirsal-guarantee'] as const,
  list: ['nirsal-guarantee', 'list'] as const,
  stats: ['nirsal-guarantee', 'stats'] as const,
};

export function useNIRSALList() {
  return useQuery({ queryKey: NIRSAL_KEYS.list, queryFn: nirsalGuaranteeService.list, staleTime: 60_000 });
}

export function useNIRSALStats() {
  return useQuery({ queryKey: NIRSAL_KEYS.stats, queryFn: nirsalGuaranteeService.stats, staleTime: 60_000 });
}

export function useCreateNIRSAL() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNIRSALPayload) => nirsalGuaranteeService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NIRSAL_KEYS.all });
      toast.success('NIRSAL record created');
    },
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create record'),
  });
}
