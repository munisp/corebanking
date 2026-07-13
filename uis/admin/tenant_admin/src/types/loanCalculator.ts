export type LoanType = 'mortgage' | 'education' | 'agriculture' | 'personal' | 'auto' | 'murabaha' | 'ijara';
export type RepaymentType = 'equal_installment' | 'reducing_balance' | 'bullet' | 'balloon';

export interface Installment {
  month: number;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

export interface LoanCalculation {
  id: string;
  customerName?: string;
  loanType: LoanType;
  principal: number;
  annualRate: number;
  tenorMonths: number;
  repaymentType: RepaymentType;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  effectiveRate: number;
  status: string;
  schedule?: Installment[];
  createdAt: string;
}

export interface CalculateLoanPayload {
  customerName?: string;
  loanType: LoanType;
  principal: number;
  annualRate: number;
  tenorMonths: number;
  repaymentType: RepaymentType;
}

export interface SchedulePayload {
  principal: number;
  annualRate: number;
  tenorMonths: number;
  repaymentType: RepaymentType;
}

export interface ScheduleResponse {
  principal: number;
  annualRate: number;
  tenorMonths: number;
  repaymentType: string;
  totalInterest: number;
  totalRepayment: number;
  installments: Installment[];
}

export interface ComparisonScenario {
  loanType: string;
  annualRate: number;
  repaymentType: RepaymentType;
}

export interface ComparisonResult {
  loanType: string;
  annualRate: number;
  repaymentType: string;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  savings: number;
}

export interface ComparePayload {
  principal: number;
  tenorMonths: number;
  scenarios: ComparisonScenario[];
}

export interface CompareResponse {
  principal: number;
  tenorMonths: number;
  comparisons: ComparisonResult[];
}

export interface AffordabilityPayload {
  monthlyIncome: number;
  monthlyExpense: number;
  existingEmi: number;
  desiredTenor: number;
  annualRate: number;
  dtiLimit?: number;
}

export interface AffordabilityResponse {
  maxEMI: number;
  maxPrincipal: number;
  currentDTI: number;
  dtiLimit: number;
  disposableIncome: number;
  eligible: boolean;
}

export interface LoanCalculationListResponse {
  items: LoanCalculation[];
  total: number;
}
