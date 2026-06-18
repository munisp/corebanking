/**
 * B3: Loan lifecycle management — origination to closure.
 * Handles credit scoring, amortization, repayment tracking, NPL classification,
 * restructuring, and write-off.
 */

export interface LoanProduct {
  id: string;
  name: string;
  type: "personal" | "mortgage" | "auto" | "education" | "agriculture" | "sme" | "corporate";
  minAmount: number;
  maxAmount: number;
  minTenor: number;
  maxTenor: number;
  baseRate: number;
  processingFee: number;
  insuranceFee: number;
  currency: string;
  requiresCollateral: boolean;
  maxDTI: number;
  status: "active" | "suspended";
}

export interface LoanAccount {
  id: string;
  productId: string;
  customerId: string;
  customerName: string;
  principalAmount: number;
  disbursedAmount: number;
  outstandingBalance: number;
  interestRate: number;
  tenorMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayable: number;
  totalPaid: number;
  daysInArrears: number;
  classification: "performing" | "substandard" | "doubtful" | "lost";
  provisionRate: number;
  status: "active" | "completed" | "restructured" | "written_off" | "npl";
  disbursementDate: string;
  maturityDate: string;
  nextPaymentDate: string;
  collateral?: { type: string; value: number; description: string };
  currency: string;
}

const loanProducts: LoanProduct[] = [
  { id: "LP-001", name: "54Bank Personal Loan", type: "personal", minAmount: 100_000, maxAmount: 10_000_000, minTenor: 3, maxTenor: 60, baseRate: 24, processingFee: 1, insuranceFee: 0.5, currency: "NGN", requiresCollateral: false, maxDTI: 40, status: "active" },
  { id: "LP-002", name: "54Bank Mortgage", type: "mortgage", minAmount: 5_000_000, maxAmount: 150_000_000, minTenor: 60, maxTenor: 300, baseRate: 12, processingFee: 1.5, insuranceFee: 1, currency: "NGN", requiresCollateral: true, maxDTI: 33, status: "active" },
  { id: "LP-003", name: "54Bank Auto Loan", type: "auto", minAmount: 1_000_000, maxAmount: 30_000_000, minTenor: 12, maxTenor: 72, baseRate: 18, processingFee: 1, insuranceFee: 2, currency: "NGN", requiresCollateral: true, maxDTI: 35, status: "active" },
  { id: "LP-004", name: "54Bank Agric Loan", type: "agriculture", minAmount: 500_000, maxAmount: 50_000_000, minTenor: 6, maxTenor: 36, baseRate: 9, processingFee: 0.5, insuranceFee: 1.5, currency: "NGN", requiresCollateral: false, maxDTI: 50, status: "active" },
  { id: "LP-005", name: "54Bank SME Loan", type: "sme", minAmount: 500_000, maxAmount: 100_000_000, minTenor: 6, maxTenor: 60, baseRate: 20, processingFee: 1.5, insuranceFee: 0.5, currency: "NGN", requiresCollateral: true, maxDTI: 45, status: "active" },
];

const loanAccounts: LoanAccount[] = [
  {
    id: "LA-001", productId: "LP-001", customerId: "CUST-001", customerName: "Aisha Mohammed",
    principalAmount: 5_000_000, disbursedAmount: 5_000_000, outstandingBalance: 3_250_000,
    interestRate: 24, tenorMonths: 36, monthlyPayment: 195_800, totalInterest: 2_048_800,
    totalRepayable: 7_048_800, totalPaid: 3_798_800, daysInArrears: 0,
    classification: "performing", provisionRate: 1, status: "active",
    disbursementDate: "2025-06-15", maturityDate: "2028-06-15", nextPaymentDate: "2026-06-15",
    currency: "NGN",
  },
  {
    id: "LA-002", productId: "LP-002", customerId: "CUST-002", customerName: "Ibrahim Musa",
    principalAmount: 45_000_000, disbursedAmount: 45_000_000, outstandingBalance: 42_500_000,
    interestRate: 12, tenorMonths: 240, monthlyPayment: 495_450, totalInterest: 73_908_000,
    totalRepayable: 118_908_000, totalPaid: 2_477_250, daysInArrears: 0,
    classification: "performing", provisionRate: 1, status: "active",
    disbursementDate: "2026-01-01", maturityDate: "2046-01-01", nextPaymentDate: "2026-06-01",
    collateral: { type: "real_estate", value: 65_000_000, description: "3-bedroom flat, Lekki Phase 1" },
    currency: "NGN",
  },
  {
    id: "LA-003", productId: "LP-005", customerId: "CUST-003", customerName: "Chukwuemeka Obi",
    principalAmount: 15_000_000, disbursedAmount: 15_000_000, outstandingBalance: 15_000_000,
    interestRate: 20, tenorMonths: 24, monthlyPayment: 762_500, totalInterest: 3_300_000,
    totalRepayable: 18_300_000, totalPaid: 0, daysInArrears: 95,
    classification: "substandard", provisionRate: 10, status: "npl",
    disbursementDate: "2025-11-01", maturityDate: "2027-11-01", nextPaymentDate: "2026-02-01",
    collateral: { type: "equipment", value: 20_000_000, description: "Industrial printing machines" },
    currency: "NGN",
  },
];

export function classifyLoan(daysInArrears: number): { classification: string; provisionRate: number } {
  if (daysInArrears <= 30) return { classification: "performing", provisionRate: 1 };
  if (daysInArrears <= 90) return { classification: "substandard", provisionRate: 10 };
  if (daysInArrears <= 180) return { classification: "doubtful", provisionRate: 50 };
  return { classification: "lost", provisionRate: 100 };
}

export function computeAmortization(principal: number, annualRate: number, tenorMonths: number): Array<{ month: number; payment: number; principalPortion: number; interestPortion: number; balance: number }> {
  const monthlyRate = annualRate / 100 / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, tenorMonths)) / (Math.pow(1 + monthlyRate, tenorMonths) - 1);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= Math.min(tenorMonths, 12); month++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = payment - interestPortion;
    balance -= principalPortion;
    schedule.push({
      month,
      payment: Math.round(payment * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      balance: Math.round(Math.max(0, balance) * 100) / 100,
    });
  }

  return schedule;
}

export function getLoanProducts() { return loanProducts; }
export function getLoanAccounts() { return loanAccounts; }
