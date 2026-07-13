export type CollateralType = 'property' | 'vehicle' | 'equipment' | 'securities' | 'cash_deposit' | 'guarantee';
export type LienStatus = 'perfected' | 'unperfected' | 'released';
export type ValuationStatus = 'current' | 'expiring_soon' | 'expired';
export type LocationGrade = 'prime' | 'good' | 'average' | 'poor';
export type Condition = 'excellent' | 'good' | 'fair' | 'poor';

export interface Valuation {
  id: string;
  collateral_id: string;
  collateral_type: CollateralType;
  description: string;
  owner: string;
  market_value: number;
  forced_sale_value: number;
  haircut_pct: number;
  net_realizable_value: number;
  currency: string;
  valuer: string;
  valuation_date: string;
  expiry_date: string;
  insurance_value: number;
  insurance_expiry: string;
  lien_status: LienStatus;
  status: ValuationStatus;
}

export interface ComputeFSVPayload {
  collateral_type: CollateralType;
  market_value: number;
  age_years: number;
  location_grade: LocationGrade;
  condition: Condition;
}

export interface FSVResult {
  collateralType: string;
  marketValue: number;
  haircutPct: number;
  forcedSaleValue: number;
  ageAdjustment: number;
  locationAdjustment: number;
  conditionAdjustment: number;
}

export interface ValuationSummary {
  totalValuations: number;
  totalMarketValue: number;
  totalFSV: number;
  avgHaircut: number;
  marketValueByType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface ValuationListResponse { items: Valuation[]; total: number; }
