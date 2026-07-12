import apiClient from './api';
import type {
  CropCalendar,
  SeasonAlignedLoan, CreateSeasonLoanPayload,
  InputVoucher, CreateVoucherPayload, VoucherRedemption,
  WarehouseReceiptLoan, CreateWarehouseLoanPayload,
  GroupLending, CreateGroupLendingPayload,
  FarmerCreditHistory,
  FarmerImpactDashboard, CooperativeImpactDashboard, Achievement,
  InsuranceProduct, InsurancePolicy, CreatePolicyPayload, PortfolioGuarantee,
  WeatherData, WeatherForecast, LoanWeatherRisk,
} from '../types/agriculture';

const AGRI = '/agricultural/api/v1/agriculture';

export const agricultureService = {
  cropCalendars: () =>
    apiClient.get<{ calendars: CropCalendar[]; count: number }>(`${AGRI}/crop-calendars`).then(r => r.data),

  createSeasonLoan: (payload: CreateSeasonLoanPayload) =>
    apiClient.post<SeasonAlignedLoan>(`${AGRI}/season-aligned-loans`, payload).then(r => r.data),

  createVoucher: (payload: CreateVoucherPayload) =>
    apiClient.post<InputVoucher>(`${AGRI}/input-vouchers`, payload).then(r => r.data),

  redeemVoucher: (payload: { voucher_id: string; merchant_id: string; amount: number }) =>
    apiClient.post<VoucherRedemption>(`${AGRI}/input-vouchers/redeem`, payload).then(r => r.data),

  createWarehouseLoan: (payload: CreateWarehouseLoanPayload) =>
    apiClient.post<WarehouseReceiptLoan>(`${AGRI}/warehouse-receipt-loans`, payload).then(r => r.data),

  createGroupLending: (payload: CreateGroupLendingPayload) =>
    apiClient.post<GroupLending>(`${AGRI}/group-lending`, payload).then(r => r.data),

  farmerCreditHistory: (farmerId: string) =>
    apiClient.get<FarmerCreditHistory>(`${AGRI}/farmer-credit-history?farmer_id=${farmerId}`).then(r => r.data),

  farmerDashboard: (farmerId: string) =>
    apiClient.get<{ dashboard: FarmerImpactDashboard }>(`${AGRI}/dashboard/farmer?farmer_id=${farmerId}`).then(r => r.data),

  cooperativeDashboard: (coopId: string) =>
    apiClient.get<{ dashboard: CooperativeImpactDashboard }>(`${AGRI}/dashboard/cooperative?cooperative_id=${coopId}`).then(r => r.data),

  achievements: (farmerId: string) =>
    apiClient.get<{ achievements: Achievement[]; next_achievements: Achievement[] }>(`${AGRI}/achievements?farmer_id=${farmerId}`).then(r => r.data),

  insuranceProducts: () =>
    apiClient.get<{ products: InsuranceProduct[]; count: number }>(`${AGRI}/insurance/products`).then(r => r.data),

  createPolicy: (payload: CreatePolicyPayload) =>
    apiClient.post<InsurancePolicy>(`${AGRI}/insurance/policies`, payload).then(r => r.data),

  insuranceGuarantees: () =>
    apiClient.get<{ guarantees: PortfolioGuarantee[]; count: number; total_available: number }>(`${AGRI}/insurance/guarantees`).then(r => r.data),

  currentWeather: (state: string, lga?: string) =>
    apiClient.get<WeatherData>(`${AGRI}/weather/current?state=${encodeURIComponent(state)}${lga ? `&lga=${encodeURIComponent(lga)}` : ''}`).then(r => r.data),

  weatherForecast: (state: string) =>
    apiClient.get<WeatherForecast>(`${AGRI}/weather/forecast?state=${encodeURIComponent(state)}`).then(r => r.data),

  weatherRisk: (state: string, cropType: string) =>
    apiClient.get<LoanWeatherRisk>(`${AGRI}/weather/risk?state=${encodeURIComponent(state)}&crop_type=${encodeURIComponent(cropType)}`).then(r => r.data),
};
