export interface Mortgage {
  id: string;
  propertyAddress: string;
  propertyType: string;
  propertyValue: number;
  loanAmount: number;
  downPayment: number;
  loanTerm: number; // in years
  interestRate: number;
  monthlyPayment: number;
  status: string;
  applicationDate: Date;
  approvalDate?: Date;
  description?: string;
}

export interface MortgageApplicationRequest {
  productType: string;
  propertyAddress: string;
  propertyType: string;
  propertyValue: number;
  loanAmount: number;
  downPayment: number;
  loanTerm: number;
  interestRate: number;
  employmentType?: string;
  monthlyGrossIncome?: number;
  description?: string;
}

export function calculateMonthlyPayment(
  loanAmount: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = years * 12;
  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
  );
}
