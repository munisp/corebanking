import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { equipmentLeasingService } from '../services/equipmentLeasingService';
import type { CreateEquipmentLeasingPayload } from '../types/equipmentLeasing';

const EL_KEYS = {
  all: ['equipment-leasing'] as const,
  list: ['equipment-leasing', 'list'] as const,
  stats: ['equipment-leasing', 'stats'] as const,
};

export function useEquipmentLeasingList() {
  return useQuery({ queryKey: EL_KEYS.list, queryFn: equipmentLeasingService.list, staleTime: 60_000 });
}

export function useEquipmentLeasingStats() {
  return useQuery({ queryKey: EL_KEYS.stats, queryFn: equipmentLeasingService.stats, staleTime: 60_000 });
}

export function useCreateEquipmentLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEquipmentLeasingPayload) => equipmentLeasingService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EL_KEYS.all });
      toast.success('Equipment lease created');
    },
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create lease'),
  });
}
