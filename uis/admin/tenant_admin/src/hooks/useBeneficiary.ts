import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beneficiaryService } from '../services/beneficiaryService';
import type {
  CreateBeneficiaryPayload,
  NameEnquiryPayload,
  SetLimitsPayload,
} from '../types/beneficiary';

export const BEN_KEYS = {
  all: ['beneficiaries'] as const,
  list: (customerId?: string) => ['beneficiaries', 'list', customerId] as const,
  banks: ['beneficiaries', 'banks'] as const,
};

export function useBeneficiaryList(customerId?: string) {
  return useQuery({
    queryKey: BEN_KEYS.list(customerId),
    queryFn: () => beneficiaryService.list(customerId),
    staleTime: 30_000,
  });
}

export function useBankDirectory() {
  return useQuery({
    queryKey: BEN_KEYS.banks,
    queryFn: beneficiaryService.getBanks,
    staleTime: 3_600_000,
  });
}

export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBeneficiaryPayload) => beneficiaryService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEN_KEYS.all });
      toast.success('Beneficiary added successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to add beneficiary');
    },
  });
}

export function useDeleteBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beneficiaryId: string) => beneficiaryService.delete(beneficiaryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEN_KEYS.all });
      toast.success('Beneficiary removed');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to remove beneficiary');
    },
  });
}

export function useNameEnquiry() {
  return useMutation({
    mutationFn: (payload: NameEnquiryPayload) => beneficiaryService.nameEnquiry(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Name enquiry failed');
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beneficiaryId: string) => beneficiaryService.toggleFavorite(beneficiaryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEN_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to update favorite');
    },
  });
}

export function useSetLimits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetLimitsPayload) => beneficiaryService.setLimits(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BEN_KEYS.all });
      toast.success('Transfer limits updated');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to update limits');
    },
  });
}
