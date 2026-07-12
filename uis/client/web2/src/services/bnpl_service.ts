import type { BNPLApplication, BNPLApplicationRequest, BNPLRepayment } from '../models/bnpl';
import { apiService } from './api_service';

class BNPLService {
  private parseApplication(data: Record<string, unknown>): BNPLApplication {
    return {
      applicationId: String(data.application_id || ''),
      tenantId: String(data.tenant_id || ''),
      applicantId: String(data.applicant_id || ''),
      merchantId: String(data.merchant_id || ''),
      purchaseAmount: Number(data.purchase_amount || 0),
      installmentCount: Number(data.installment_count || 1),
      installmentAmount: Number(data.installment_amount || 0),
      interestRate: Number(data.interest_rate || 0),
      productDescription: String(data.product_description || ''),
      status: String(data.status || 'pending'),
      creditScore: Number(data.credit_score || 0),
      bvnVerified: Boolean(data.bvn_verified),
      createdAt: String(data.created_at || ''),
      updatedAt: String(data.updated_at || ''),
    };
  }

  async getApplications(): Promise<BNPLApplication[]> {
    try {
      const response = await apiService.get('/bnpl/v1/applications');
      const data = response.data as Record<string, unknown>;
      const items = (data.items as Record<string, unknown>[]) ?? [];
      return items.map((item) => this.parseApplication(item));
    } catch (error) {
      console.error('Error fetching BNPL applications:', error);
      return [];
    }
  }

  async getApplicationById(id: string): Promise<BNPLApplication> {
    const response = await apiService.get(`/bnpl/v1/applications/${id}`);
    return this.parseApplication(response.data as Record<string, unknown>);
  }

  async createApplication(request: BNPLApplicationRequest): Promise<{ success: boolean; message: string; application?: BNPLApplication }> {
    try {
      const response = await apiService.post('/bnpl/v1/applications', request);
      return {
        success: true,
        message: 'BNPL application submitted successfully',
        application: this.parseApplication(response.data as Record<string, unknown>),
      };
    } catch (error) {
      console.error('Error creating BNPL application:', error);
      return { success: false, message: 'Failed to submit BNPL application' };
    }
  }

  async getRepaymentSchedule(id: string): Promise<BNPLRepayment[]> {
    try {
      const response = await apiService.get(`/bnpl/v1/applications/${id}/schedule`);
      const data = response.data as Record<string, unknown>;
      const items = (data.items as Record<string, unknown>[]) ?? [];
      return items.map((item) => ({
        id: Number(item.id || 0),
        applicationId: String(item.application_id || ''),
        installmentNo: Number(item.installment_no || 0),
        dueDate: String(item.due_date || ''),
        amount: Number(item.amount || 0),
        paidAt: item.paid_at ? String(item.paid_at) : null,
        status: String(item.status || 'pending'),
      }));
    } catch (error) {
      console.error('Error fetching repayment schedule:', error);
      return [];
    }
  }
}

export const bnplService = new BNPLService();
