export type ScoreBand = 'Excellent' | 'Good' | 'Fair' | 'Poor';
export type ReportStatus = 'current' | 'watch_list' | 'non_performing';
export type Classification = 'performing' | 'sub_standard' | 'doubtful' | 'lost';

export interface CreditReport {
  id: string;
  customer_id: string;
  customer_name: string;
  bvn: string;
  bureau: string;
  credit_score: number;
  score_band: string;
  total_facilities: number;
  active_facilities: number;
  total_outstanding: number;
  total_overdue: number;
  max_days_past_due: number;
  performing_percentage: number;
  enquiry_count_6m: number;
  report_date: string;
  next_refresh: string;
  status: ReportStatus;
}

export interface FacilityRecord {
  id: string;
  report_id: string;
  institution: string;
  facility_type: string;
  original_amount: number;
  outstanding_balance: number;
  overdue_amount: number;
  classification: Classification;
  start_date: string;
  maturity_date: string;
  days_past_due: number;
}

export interface ScoreCheckPayload {
  bvn: string;
  customer_name: string;
  bureau?: string;
}

export interface ScoreCheckResult {
  found: boolean;
  bvn: string;
  bureau: string;
  creditScore: number | null;
  scoreBand?: string;
  totalOutstanding?: number;
  totalOverdue?: number;
  performingPercentage?: number;
  recommendation: 'APPROVE' | 'REFER' | 'DECLINE';
  message?: string;
}

export interface CreditBureauStats {
  totalReports: number;
  averageScore: number;
  totalOutstanding: number;
  totalOverdue: number;
  byScoreBand: Record<string, number>;
  byBureau: Record<string, number>;
}

export interface CreditReportListResponse { items: CreditReport[]; total: number; }
export interface FacilityRecordListResponse { items: FacilityRecord[]; total: number; }
