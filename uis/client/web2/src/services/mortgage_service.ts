import type { Mortgage, MortgageApplicationRequest } from "../models/mortgage";
import { calculateMonthlyPayment } from "../models/mortgage";
import { apiService } from "./api_service";

class MortgageService {
  async getMortgages(): Promise<Mortgage[]> {
    try {
      const response = await apiService.get(
        "/mortgage/api/v1/mortgages/applications",
      );
      // Handle API response with 'applications' array
      const data = response.data as Record<string, unknown> | null;
      if (data && Array.isArray(data.applications)) {
        return data.applications.map((item: unknown) => this.parseMortgage(item as Record<string, unknown>));
      } else {
        console.error("Unexpected mortgage response format:", data);
        return [];
      }
    } catch (error) {
      console.error("Error fetching mortgages:", error);
      return [];
    }
  }

  async getMortgageById(id: string): Promise<Mortgage> {
    try {
      const response = await apiService.get(
        `/mortgage/api/v1/mortgages/applications/${id}`,
      );
      // If the response is wrapped, e.g. { application: {...} }
      const data = response.data as Record<string, unknown> | null;
      if (data && data.application) {
        return this.parseMortgage(data.application as Record<string, unknown>);
      } else {
        return this.parseMortgage(data as Record<string, unknown>);
      }
    } catch (error) {
      console.error("Error fetching mortgage:", error);
      throw new Error("Mortgage not found");
    }
  }

  async applyForMortgage(
    request: MortgageApplicationRequest,
  ): Promise<{ success: boolean; message: string; mortgage?: Mortgage }> {
    try {
      // Read applicant from localStorage
      let applicantId = '';
      let applicantName = '';
      try {
        const userData = JSON.parse(localStorage.getItem('user_data') || localStorage.getItem('user') || '{}');
        applicantId = userData.id || userData._id || '';
        applicantName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || userData.name || '';
      } catch { /* ignore */ }

      // Backend create endpoint only accepts these fields — property details go via separate update
      const requestData: Record<string, unknown> = {
        product_type: request.productType || 'fixed_rate',
        primary_applicant_id: applicantId,
        primary_applicant_name: applicantName,
        requested_amount: request.loanAmount,
        requested_tenor_months: request.loanTerm * 12,
        down_payment: request.downPayment,
      };
      if (request.employmentType) requestData['employment_type'] = request.employmentType;
      if (request.monthlyGrossIncome) requestData['monthly_gross_income'] = request.monthlyGrossIncome;

      const response = await apiService.post(
        "/mortgage/api/v1/mortgages/applications",
        requestData,
      );

      return {
        success: true,
        message: "Mortgage application submitted successfully",
        mortgage: this.parseMortgage(response.data as Record<string, unknown>),
      };
    } catch (error) {
      console.error("Error applying for mortgage:", error);
      return {
        success: false,
        message: "Failed to submit mortgage application",
      };
    }
  }

  calculateMonthlyPayment(
    loanAmount: number,
    annualRate: number,
    years: number,
  ): number {
    return calculateMonthlyPayment(loanAmount, annualRate, years);
  }

  async getRepaymentSchedule(id: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`/mortgage/api/v1/mortgages/applications/${id}/schedule`);
      const data = response.data as Record<string, unknown>[] | { schedule: Record<string, unknown>[] } | null;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray((data as { schedule: unknown }).schedule)) return (data as { schedule: Record<string, unknown>[] }).schedule;
      return [];
    } catch {
      return [];
    }
  }

  private parseMortgage(data: Record<string, unknown>): Mortgage {
    const property = data.property as Record<string, unknown> | undefined;
    const requestedTenorMonths = Number(data.requested_tenor_months || data.approved_tenor_months || 0);

    // property_address may be flat or nested inside property.address
    const propertyAddress = String(
      data.property_address || property?.address || data.propertyAddress || ""
    );

    return {
      id: String(data.id || data._id || ""),
      propertyAddress,
      propertyType: String(data.property_type || data.propertyType || ""),
      propertyValue: Number(data.property_value || data.propertyValue || 0),
      loanAmount: Number(data.requested_amount || data.approved_amount || data.loanAmount || 0),
      downPayment: Number(data.down_payment || data.downPayment || 0),
      loanTerm: requestedTenorMonths ? Math.round(requestedTenorMonths / 12) : Number(data.loanTerm || 0),
      interestRate: Number(data.interest_rate || data.interestRate || 0),
      monthlyPayment: Number(data.monthly_payment || data.monthlyPayment || 0),
      status: String(data.status || ""),
      applicationDate: data.created_at
        ? new Date(data.created_at as string)
        : data.applicationDate
          ? new Date(data.applicationDate as string)
          : new Date(),
      approvalDate: data.approved_at
        ? new Date(data.approved_at as string)
        : data.approvalDate
          ? new Date(data.approvalDate as string)
          : undefined,
      description: data.description ? String(data.description) : undefined,
    };
  }

}

export const mortgageService = new MortgageService();
