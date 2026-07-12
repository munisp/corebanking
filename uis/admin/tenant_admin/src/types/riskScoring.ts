export type RiskType = 'credit' | 'market' | 'operational';
export type IFRS9Stage = 0 | 1 | 2 | 3;

export interface RiskAssessment {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  risk_type: RiskType;
  pd: number;
  lgd: number;
  ead: number;
  expected_loss: number;
  risk_weight: number;
  rwa: number;
  rating: string;
  ifrs9_stage: IFRS9Stage;
  assessment_date: string;
  next_review: string;
  status: string;
}

export interface ScoreEntityPayload {
  entity_id: string;
  entity_name: string;
  exposure: number;
  collateral_value: number;
  days_past_due: number;
  annual_revenue: number;
  years_in_business: number;
  sector: string;
}

export interface ScoreEntityResult {
  entityId: string;
  entityName: string;
  pd: number;
  lgd: number;
  ead: number;
  expectedLoss: number;
  riskWeight: number;
  rwa: number;
  rating: string;
  ifrs9Stage: number;
  sector: string;
  collateralCoverage: number;
}

export interface RiskPortfolio {
  totalAssessments: number;
  totalEAD: number;
  totalRWA: number;
  totalExpectedLoss: number;
  rwaByType: Record<string, number>;
  countByIFRS9Stage: Record<string, number>;
}

export interface RiskAssessmentListResponse { items: RiskAssessment[]; total: number; }
