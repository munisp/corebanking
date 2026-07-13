import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { loanCalculatorService } from '../services/loanCalculatorService';
import type {
  CalculateLoanPayload,
  SchedulePayload,
  ComparePayload,
  AffordabilityPayload,
} from '../types/loanCalculator';

export const LC_KEYS = {
  all: ['loan-calculator'] as const,
  list: ['loan-calculator', 'list'] as const,
};

export function useLoanCalculationList() {
  return useQuery({
    queryKey: LC_KEYS.list,
    queryFn: loanCalculatorService.list,
    staleTime: 30_000,
  });
}

export function useCalculateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CalculateLoanPayload) => loanCalculatorService.calculate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LC_KEYS.all });
      toast.success('Loan calculated successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Calculation failed');
    },
  });
}

export function useAmortizationSchedule() {
  return useMutation({
    mutationFn: (payload: SchedulePayload) => loanCalculatorService.schedule(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to generate schedule');
    },
  });
}

export function useCompareLoanScenarios() {
  return useMutation({
    mutationFn: (payload: ComparePayload) => loanCalculatorService.compare(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Comparison failed');
    },
  });
}

export function useAffordabilityCheck() {
  return useMutation({
    mutationFn: (payload: AffordabilityPayload) => loanCalculatorService.affordability(payload),
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Affordability check failed');
    },
  });
}
