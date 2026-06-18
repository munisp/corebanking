export interface CropCalendar {
  id: string;
  crop_type: string;
  region: string;
  season: string;
  planting_start: string;
  planting_end: string;
  harvest_start: string;
  harvest_end: string;
  recommended_varieties?: string[];
  notes?: string;
}

export interface SeasonAlignedLoan {
  id: string;
  farmer_id: string;
  cooperative_id?: string;
  crop_type: string;
  region: string;
  loan_type: string;
  principal: number;
  interest_rate: number;
  grace_period_days: number;
  repayment_start_date: string;
  maturity_date: string;
  expected_harvest_date: string;
  pay_at_harvest: boolean;
  linked_warehouse_receipt?: string;
  linked_insurance_policy?: string;
  disbursement_method?: string;
  status: string;
}

export interface CreateSeasonLoanPayload {
  farmer_id: string;
  crop_type: string;
  region: string;
  loan_type: string;
  principal: number;
  interest_rate: number;
  expected_harvest_date: string;
  grace_period_days?: number;
  pay_at_harvest?: boolean;
  cooperative_id?: string;
  disbursement_method?: string;
}

export interface VoucherRedemption {
  id: string;
  voucher_id: string;
  merchant_id: string;
  merchant_name: string;
  amount: number;
  redeemed_at: string;
}

export interface InputVoucher {
  id: string;
  farmer_id: string;
  loan_id?: string;
  voucher_code: string;
  input_type: string;
  amount: number;
  remaining_balance: number;
  valid_from: string;
  valid_until: string;
  approved_merchants?: string[];
  redemptions?: VoucherRedemption[];
  status: string;
}

export interface CreateVoucherPayload {
  farmer_id: string;
  input_type: string;
  amount: number;
  valid_until: string;
  loan_id?: string;
  approved_merchants?: string[];
}

export interface WarehouseReceiptLoan {
  id: string;
  farmer_id: string;
  warehouse_receipt_id: string;
  warehouse_id: string;
  warehouse_name: string;
  commodity_type: string;
  quantity_tonnes: number;
  current_market_price: number;
  collateral_value: number;
  loan_to_value_ratio: number;
  loan_amount: number;
  interest_rate: number;
  storage_fee_per_day: number;
  maturity_date: string;
  status: string;
}

export interface CreateWarehouseLoanPayload {
  farmer_id: string;
  warehouse_receipt_id: string;
  commodity_type: string;
  quantity_tonnes: number;
  loan_to_value_ratio?: number;
}

export interface GroupMember {
  member_id: string;
  name: string;
  share?: number;
}

export interface GroupLending {
  id: string;
  group_name: string;
  group_type: string;
  cooperative_id?: string;
  members: GroupMember[];
  total_loan_amount: number;
  individual_cap: number;
  repayment_rate: number;
  collective_guarantee: boolean;
  meeting_schedule?: string;
  status: string;
}

export interface CreateGroupLendingPayload {
  group_name: string;
  group_type: string;
  total_loan_amount: number;
  members: GroupMember[];
  cooperative_id?: string;
  individual_cap?: number;
  collective_guarantee?: boolean;
  meeting_schedule?: string;
}

export interface SeasonPerformance {
  season: string;
  loan_amount: number;
  repaid_amount: number;
  on_time: boolean;
  crop_type?: string;
}

export interface FarmerCreditHistory {
  farmer_id: string;
  total_seasons_financed: number;
  on_time_repayments: number;
  late_repayments: number;
  defaults: number;
  repayment_streak: number;
  credit_score: number;
  credit_limit: number;
  next_season_eligible: boolean;
  season_history: SeasonPerformance[];
}

export interface FarmerImpactDashboard {
  farmer_id: string;
  total_financed: number;
  seasons_supported: number;
  yield_improvement?: number;
  income_growth?: number;
  credit_score: number;
  next_season_eligible: boolean;
}

export interface CooperativeImpactDashboard {
  cooperative_id: string;
  total_members: number;
  active_loans: number;
  total_disbursed: number;
  repayment_rate: number;
  avg_credit_score?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned_at?: string;
  points?: number;
  badge_url?: string;
}

export interface ParametricTrigger {
  trigger_type: string;
  threshold: number;
  unit: string;
  payout_percent: number;
}

export interface InsuranceProduct {
  id: string;
  name: string;
  type: string;
  description: string;
  coverage_types: string[];
  premium_rate_min: number;
  premium_rate_max: number;
  max_coverage_amount: number;
  parametric_triggers?: ParametricTrigger[];
  eligible_crops?: string[];
  eligible_regions?: string[];
  subsidy_available: boolean;
  subsidy_percent: number;
  subsidy_source?: string;
  is_active: boolean;
}

export interface InsuranceClaim {
  id: string;
  policy_id: string;
  claim_type: string;
  claim_amount: number;
  status: string;
  filed_at?: string;
  settled_at?: string;
}

export interface InsurancePolicy {
  id: string;
  farmer_id: string;
  loan_id?: string;
  product_id: string;
  product_name: string;
  policy_type: string;
  crop_type: string;
  farm_location: string;
  farm_size_hectares: number;
  coverage_amount: number;
  premium_amount: number;
  subsidy_amount: number;
  farmer_premium: number;
  policy_start_date: string;
  policy_end_date: string;
  season: string;
  status: string;
  linked_triggers?: string[];
  claim_history?: InsuranceClaim[];
}

export interface CreatePolicyPayload {
  farmer_id: string;
  product_id: string;
  crop_type: string;
  farm_location: string;
  farm_size_hectares: number;
  coverage_amount: number;
  season: string;
  loan_id?: string;
}

export interface PortfolioGuarantee {
  id: string;
  program: string;
  available_amount: number;
  used_amount: number;
  currency: string;
  status: string;
}

export interface DayForecast {
  date: string;
  temperature_min: number;
  temperature_max: number;
  rainfall_probability: number;
  rainfall_mm?: number;
  conditions: string;
}

export interface WeatherData {
  state: string;
  lga?: string;
  temperature: number;
  humidity: number;
  rainfall_mm: number;
  wind_speed?: number;
  conditions: string;
  timestamp: string;
}

export interface WeatherForecast {
  state: string;
  days: DayForecast[];
}

export interface LoanWeatherRisk {
  state: string;
  crop_type: string;
  risk_level: string;
  risk_score: number;
  factors: string[];
  recommendation?: string;
}
