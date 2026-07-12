import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agricultureService } from '../services/agricultureService';
import type {
  CreateSeasonLoanPayload,
  CreateVoucherPayload,
  CreateWarehouseLoanPayload,
  CreateGroupLendingPayload,
  CreatePolicyPayload,
} from '../types/agriculture';

const KEYS = {
  cropCalendars: ['agriculture', 'crop-calendars'] as const,
  farmerCreditHistory: (id: string) => ['agriculture', 'farmer-credit-history', id] as const,
  farmerDashboard: (id: string) => ['agriculture', 'dashboard', 'farmer', id] as const,
  cooperativeDashboard: (id: string) => ['agriculture', 'dashboard', 'cooperative', id] as const,
  achievements: (id: string) => ['agriculture', 'achievements', id] as const,
  insuranceProducts: ['agriculture', 'insurance', 'products'] as const,
  insuranceGuarantees: ['agriculture', 'insurance', 'guarantees'] as const,
  weather: (state: string, lga?: string) => ['agriculture', 'weather', 'current', state, lga ?? ''] as const,
  weatherForecast: (state: string) => ['agriculture', 'weather', 'forecast', state] as const,
  weatherRisk: (state: string, cropType: string) => ['agriculture', 'weather', 'risk', state, cropType] as const,
};

export function useCropCalendars() {
  return useQuery({ queryKey: KEYS.cropCalendars, queryFn: agricultureService.cropCalendars, staleTime: 300_000 });
}

export function useCreateSeasonLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSeasonLoanPayload) => agricultureService.createSeasonLoan(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agriculture'] }); toast.success('Season loan created'); },
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create season loan'),
  });
}

export function useCreateVoucher() {
  return useMutation({
    mutationFn: (payload: CreateVoucherPayload) => agricultureService.createVoucher(payload),
    onSuccess: () => toast.success('Input voucher created'),
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create voucher'),
  });
}

export function useRedeemVoucher() {
  return useMutation({
    mutationFn: (payload: { voucher_id: string; merchant_id: string; amount: number }) =>
      agricultureService.redeemVoucher(payload),
    onSuccess: () => toast.success('Voucher redeemed'),
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to redeem voucher'),
  });
}

export function useCreateWarehouseLoan() {
  return useMutation({
    mutationFn: (payload: CreateWarehouseLoanPayload) => agricultureService.createWarehouseLoan(payload),
    onSuccess: () => toast.success('Warehouse receipt loan created'),
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create warehouse loan'),
  });
}

export function useCreateGroupLending() {
  return useMutation({
    mutationFn: (payload: CreateGroupLendingPayload) => agricultureService.createGroupLending(payload),
    onSuccess: () => toast.success('Group lending created'),
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create group lending'),
  });
}

export function useFarmerCreditHistory(farmerId: string) {
  return useQuery({
    queryKey: KEYS.farmerCreditHistory(farmerId),
    queryFn: () => agricultureService.farmerCreditHistory(farmerId),
    enabled: !!farmerId,
    staleTime: 60_000,
  });
}

export function useFarmerDashboard(farmerId: string) {
  return useQuery({
    queryKey: KEYS.farmerDashboard(farmerId),
    queryFn: () => agricultureService.farmerDashboard(farmerId),
    enabled: !!farmerId,
    staleTime: 60_000,
  });
}

export function useCooperativeDashboard(coopId: string) {
  return useQuery({
    queryKey: KEYS.cooperativeDashboard(coopId),
    queryFn: () => agricultureService.cooperativeDashboard(coopId),
    enabled: !!coopId,
    staleTime: 60_000,
  });
}

export function useAchievements(farmerId: string) {
  return useQuery({
    queryKey: KEYS.achievements(farmerId),
    queryFn: () => agricultureService.achievements(farmerId),
    enabled: !!farmerId,
    staleTime: 60_000,
  });
}

export function useInsuranceProducts() {
  return useQuery({ queryKey: KEYS.insuranceProducts, queryFn: agricultureService.insuranceProducts, staleTime: 300_000 });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePolicyPayload) => agricultureService.createPolicy(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEYS.insuranceProducts }); toast.success('Insurance policy created'); },
    onError: (err: Error) => toast.error(err?.message ?? 'Failed to create policy'),
  });
}

export function useInsuranceGuarantees() {
  return useQuery({ queryKey: KEYS.insuranceGuarantees, queryFn: agricultureService.insuranceGuarantees, staleTime: 120_000 });
}

export function useCurrentWeather(state: string, lga?: string) {
  return useQuery({
    queryKey: KEYS.weather(state, lga),
    queryFn: () => agricultureService.currentWeather(state, lga),
    enabled: !!state,
    staleTime: 300_000,
  });
}

export function useWeatherForecast(state: string) {
  return useQuery({
    queryKey: KEYS.weatherForecast(state),
    queryFn: () => agricultureService.weatherForecast(state),
    enabled: !!state,
    staleTime: 300_000,
  });
}

export function useWeatherRisk(state: string, cropType: string) {
  return useQuery({
    queryKey: KEYS.weatherRisk(state, cropType),
    queryFn: () => agricultureService.weatherRisk(state, cropType),
    enabled: !!(state && cropType),
    staleTime: 300_000,
  });
}
