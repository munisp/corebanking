export interface EducationLoan {
  id: string;
  institution: string;
  courseOfStudy: string;
  studyLevel: string;
  tuitionFees: number;
  livingExpenses: number;
  booksMaterials: number;
  totalAmount: number;
  loanTerm: number; // in years
  interestRate: number;
  status: string;
  applicationDate: Date;
  approvalDate?: Date;
  courseStartDate: Date;
  courseEndDate: Date;
  description?: string;
}

export interface EducationLoanApplicationRequest {
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  student_bvn?: string;
  student_nin?: string;
  loan_type: string;
  institution_id: string;
  program_name: string;
  program_duration_years: number;
  current_year?: number;
  tuition_fee_per_year: number;
  accommodation_per_year?: number;
  books_and_materials?: number;
  living_expenses?: number;
  requested_amount: number;
  repayment_type?: string;
  repayment_tenor_months?: number;
}
