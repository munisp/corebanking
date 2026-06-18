export interface BNPLApplication {
  applicationId: string;
  tenantId: string;
  applicantId: string;
  merchantId: string;
  purchaseAmount: number;
  installmentCount: number;
  installmentAmount: number;
  interestRate: number;
  productDescription: string;
  status: string;
  creditScore: number;
  bvnVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BNPLApplicationRequest {
  purchase_amount: number;
  installment_count: number;
  merchant_id?: string;
  product_description?: string;
  credit_score?: number;
  bvn_verified?: boolean;
}

export interface BNPLRepayment {
  id: number;
  applicationId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAt: string | null;
  status: string;
}
