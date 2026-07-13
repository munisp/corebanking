import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { openBankingService } from '../services/openBankingService';
import type { CreateConsentPayload } from '../types/openBanking';

export const OB_KEYS = {
  all: ['open-banking'] as const,
  consents: ['open-banking', 'consents'] as const,
  tpps: ['open-banking', 'tpps'] as const,
  catalog: ['open-banking', 'catalog'] as const,
  stats: ['open-banking', 'stats'] as const,
};

export function useOBConsents() {
  return useQuery({
    queryKey: OB_KEYS.consents,
    queryFn: openBankingService.listConsents,
    staleTime: 30_000,
  });
}

export function useCreateOBConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConsentPayload) => openBankingService.createConsent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OB_KEYS.consents });
      queryClient.invalidateQueries({ queryKey: OB_KEYS.stats });
      toast.success('Consent created — awaiting authorization');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create consent');
    },
  });
}

export function useOBTPPs() {
  return useQuery({
    queryKey: OB_KEYS.tpps,
    queryFn: openBankingService.listTPPs,
    staleTime: 120_000,
  });
}

export function useOBAPICatalog() {
  return useQuery({
    queryKey: OB_KEYS.catalog,
    queryFn: openBankingService.apiCatalog,
    staleTime: 300_000,
  });
}

export function useOpenBankingStats() {
  return useQuery({
    queryKey: OB_KEYS.stats,
    queryFn: openBankingService.stats,
    staleTime: 60_000,
  });
}
