export interface AgricultureStats {
  totalLoansOutstanding: number;
  totalActiveFarmers: number;
  totalCropValue: number;
  portfolioHealth: number;
  nplRatio: number;
  avgLoanSize: number;
  totalDisbursed: number;
  totalRepaid: number;
}

export interface CropBreakdown {
  cropType: string;
  loanAmount: number;
  numberOfFarmers: number;
  hectares: number;
  yield: number;
}

export interface RiskAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  farmerId: string;
  farmerName: string;
  cropType: string;
  loanAmount: number;
  createdAt: Date;
  acknowledged: boolean;
}

export interface AgricultureLoan {
  id: string;
  farmerName: string;
  farmSize: number;
  cropType: string;
  loanAmount: number;
  purpose: string;
  term: number;
  interestRate: number;
  status: string;
  disbursementDate?: Date;
  applicationDate: Date;
}
