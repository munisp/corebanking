export type FacilityStatus = 'active' | 'near-breach' | 'breached' | 'expired' | 'suspended';

export interface SubFacility {
  id: string;
  type: string;
  limit: number;
  utilized: number;
  linkedAccounts: string[];
}

export interface CollateralLink {
  id: string;
  type: string;
  description: string;
  marketValue: number;
  forcedSaleValue: number;
  haircutPct: number;
}

export interface Facility {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  limit: number;
  currency: string;
  utilized: number;
  available: number;
  utilizationPct: number;
  status: FacilityStatus;
  expiryDate: string;
  subFacilities: SubFacility[];
  collaterals: CollateralLink[];
  collateralCoveragePct: number;
  approvedBy: string;
  riskRating: string;
}

export interface FacilityStats {
  totalFacilities: number;
  totalLimit: number;
  totalUtilized: number;
  totalAvailable: number;
  avgUtilization: number;
  breached: number;
  nearBreach: number;
  byType: Record<string, number>;
}

export interface FacilityListResponse { items: Facility[]; total: number; }
