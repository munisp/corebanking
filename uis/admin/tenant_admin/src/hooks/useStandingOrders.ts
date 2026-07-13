import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { standingOrdersService } from '../services/standingOrdersService';
import type {
  CreateStandingOrderPayload,
  CreateMandatePayload,
  CreateScheduledPaymentPayload,
} from '../types/standingOrders';

export const SO_KEYS = {
  all: ['standing-orders'] as const,
  orders: ['standing-orders', 'orders'] as const,
  mandates: ['standing-orders', 'mandates'] as const,
  payments: ['standing-orders', 'payments'] as const,
};

export function useStandingOrderList() {
  return useQuery({
    queryKey: SO_KEYS.orders,
    queryFn: standingOrdersService.listOrders,
    staleTime: 30_000,
  });
}

export function useCreateStandingOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStandingOrderPayload) =>
      standingOrdersService.createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.orders });
      toast.success('Standing order created');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create standing order');
    },
  });
}

export function usePauseStandingOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => standingOrdersService.pauseOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.orders });
      toast.success('Standing order paused');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to pause order');
    },
  });
}

export function useResumeStandingOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => standingOrdersService.resumeOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.orders });
      toast.success('Standing order resumed');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to resume order');
    },
  });
}

export function useSODirectDebitList() {
  return useQuery({
    queryKey: SO_KEYS.mandates,
    queryFn: standingOrdersService.listMandates,
    staleTime: 30_000,
  });
}

export function useCreateSOMandate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMandatePayload) => standingOrdersService.createMandate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.mandates });
      toast.success('Direct debit mandate created');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to create mandate');
    },
  });
}

export function useRevokeSOMandate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mandateId: string) => standingOrdersService.revokeMandate(mandateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.mandates });
      toast.success('Mandate revoked');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to revoke mandate');
    },
  });
}

export function useScheduledPaymentList() {
  return useQuery({
    queryKey: SO_KEYS.payments,
    queryFn: standingOrdersService.listScheduledPayments,
    staleTime: 30_000,
  });
}

export function useCreateScheduledPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScheduledPaymentPayload) =>
      standingOrdersService.createScheduledPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SO_KEYS.payments });
      toast.success('Scheduled payment created');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to schedule payment');
    },
  });
}
