import type { EducationLoan, EducationLoanApplicationRequest } from '../models/education_loan';
import { apiService } from './api_service';

class EducationLoanService {
  async getEducationLoans(): Promise<EducationLoan[]> {
    try {
      const response = await apiService.get('/education-loan/applications');
      const data = response.data as Record<string, unknown> | Record<string, unknown>[] | null;
      const items = Array.isArray(data) ? data : (data as Record<string, unknown>)?.applications as Record<string, unknown>[] ?? [];
      return items.map((item) => this.parseEducationLoan(item as Record<string, unknown>));
    } catch (error) {
      console.error('Error fetching education loans:', error);
      return [];
    }
  }

  async getEducationLoanById(id: string): Promise<EducationLoan> {
    try {
      const response = await apiService.get(`/education-loan/applications/${id}`);
      return this.parseEducationLoan(response.data as Record<string, unknown>);
    } catch (error) {
      console.error('Error fetching education loan:', error);
      throw new Error('Education loan not found');
    }
  }

  async applyForEducationLoan(request: EducationLoanApplicationRequest): Promise<{ success: boolean; message: string; loan?: EducationLoan }> {
    try {
      const response = await apiService.post('/education-loan/applications', request);

      return {
        success: true,
        message: 'Education loan application submitted successfully',
        loan: this.parseEducationLoan(response.data as Record<string, unknown>),
      };
    } catch (error) {
      console.error('Error applying for education loan:', error);
      return {
        success: false,
        message: 'Failed to submit education loan application',
      };
    }
  }

  async acceptOffer(id: string): Promise<void> {
    await apiService.post(`/education-loan/applications/${id}/accept-offer`);
  }

  async rejectOffer(id: string): Promise<void> {
    await apiService.post(`/education-loan/applications/${id}/reject-offer`);
  }

  private parseEducationLoan(data: Record<string, unknown>): EducationLoan {
    // Backend field names (snake_case). institution is a nested object.
    const inst = data.institution as Record<string, unknown> | undefined;
    const institutionName = inst?.name ? String(inst.name) : String(data.institution || '');

    const safeDate = (v: unknown) => v ? new Date(v as string) : undefined;

    return {
      id: String(data.id || data._id || ''),
      institution: institutionName,
      courseOfStudy: String(data.program_name || data.courseOfStudy || ''),
      studyLevel: String(data.loan_type || data.studyLevel || ''),
      tuitionFees: Number(data.tuition_fee_per_year || data.tuitionFees || 0),
      livingExpenses: Number(data.living_expenses || data.livingExpenses || 0),
      booksMaterials: Number(data.books_and_materials || data.booksMaterials || 0),
      totalAmount: Number(data.requested_amount || data.total_cost_per_year || data.totalAmount || 0),
      loanTerm: Math.round(Number(data.repayment_tenor_months || 0) / 12) || Number(data.loanTerm || 0),
      interestRate: Number(data.interest_rate || data.interestRate || 0),
      status: String(data.status || ''),
      applicationDate: safeDate(data.created_at || data.submitted_at || data.applicationDate) ?? new Date(),
      approvalDate: safeDate(data.approved_at || data.approvalDate),
      courseStartDate: safeDate(data.first_disbursement_at || data.courseStartDate) ?? new Date(),
      courseEndDate: safeDate(data.maturity_date || data.expected_graduation || data.courseEndDate) ?? new Date(),
      description: data.description ? String(data.description) : undefined,
    };
  }
}

export const educationLoanService = new EducationLoanService();
