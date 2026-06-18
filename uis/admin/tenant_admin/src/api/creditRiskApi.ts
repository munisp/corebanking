/**
 * Credit & Risk API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix                │ Backend Service              │ Port  │
 * ├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┼───────┤
 * │ /credit-risk                 │ /risk-scoring                │ risk-scoring-rs              │ 8145  │
 * │ /credit-bureau               │ /credit-bureau               │ credit-bureau-rs             │ 8151  │
 * │ /credit-facilities           │ /credit-facility             │ credit-facility-go           │ 8214  │
 * │ /credit-scoring              │ /credit-scoring              │ credit-scoring-py            │ 9249  │
 * │ /syndicated-loans            │ /syndicated-loans            │ syndicated-loans-go          │ 8171  │
 * │ /nirsal-credit-guarantee     │ /nirsal-credit-guarantee     │ nirsal-credit-guarantee-go   │ 9149  │
 * │ /collateral                  │ /collateral                  │ collateral-valuation-rs      │ 8154  │
 * │ /collateral-valuation        │ /collateral                  │ collateral-valuation-rs      │ 8154  │
 * │ /debt-collection             │ /debt-collection             │ debt-collection-go           │ 8333  │
 * │ /limit-management            │ /credit-facility             │ credit-facility-go           │ 8214  │
 * │ /risk-scoring                │ /risk-scoring                │ risk-scoring-rs              │ 8145  │
 * │ /risk-based-approach         │ /risk-based-approach         │ risk-based-approach-py       │ 9315  │
 * │ /contingent-liabilities      │ /contingent-liabilities      │ contingent-liabilities-rs    │ 8174  │
 * │ /cooperative-credit-scoring  │ /cooperative-credit-scoring  │ cooperative-credit-scoring-py│ 9245  │
 * │ /leasing                     │ /leasing                     │ leasing-go                   │ 8000  │
 * │ /equipment-leasing           │ /equipment-leasing           │ equipment-leasing-go         │ 9054  │
 * │ /project-finance             │ /project-finance             │ project-finance-go           │ 8172  │
 * └──────────────────────────────┴──────────────────────────────┴──────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Risk Scoring ─────────────────────────────────────────────────────────────
export interface RiskScore {
  customerId: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  factors: { name: string; impact: number; value: string }[];
  recommendation: string;
  validUntil: string;
  computedAt: string;
}

export const riskScoringApi = {
  score: (customerId: string) =>
    apiClient.post<RiskScore>(`${APISIX.RISK_SCORING}/v1/score`, { customerId }).then((r) => r.data),

  getByCustomer: (customerId: string) =>
    apiClient.get<RiskScore>(`${APISIX.RISK_SCORING}/v1/scores/${customerId}`).then((r) => r.data),

  list: (params?: { page?: number; limit?: number; grade?: string }) =>
    apiClient.get<{ items: RiskScore[]; total: number }>(`${APISIX.RISK_SCORING}/v1/scores`, { params }).then((r) => r.data),

  getDistribution: () =>
    apiClient.get(`${APISIX.RISK_SCORING}/v1/distribution`).then((r) => r.data),
};

// ─── Credit Bureau ────────────────────────────────────────────────────────────
export interface CreditBureauReport {
  id: string;
  customerId: string;
  bvn?: string;
  source: "CRC" | "FirstCentral" | "TransUnion" | "XDS";
  creditScore: number;
  totalActiveLoans: number;
  totalOutstanding: number;
  npls: number;
  performingLoans: number;
  defaultHistory: boolean;
  reportDate: string;
}

export const creditBureauApi = {
  query: (body: { customerId: string; bvn?: string; source?: string }) =>
    apiClient.post<CreditBureauReport>(`${APISIX.CREDIT_BUREAU}/v1/query`, body).then((r) => r.data),

  list: (params?: { page?: number; limit?: number; source?: string }) =>
    apiClient.get<{ items: CreditBureauReport[]; total: number }>(`${APISIX.CREDIT_BUREAU}/v1/reports`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<CreditBureauReport>(`${APISIX.CREDIT_BUREAU}/v1/reports/${id}`).then((r) => r.data),

  getByCustomer: (customerId: string) =>
    apiClient.get<CreditBureauReport[]>(`${APISIX.CREDIT_BUREAU}/v1/reports/customer/${customerId}`).then((r) => r.data),
};

// ─── Credit Facilities ────────────────────────────────────────────────────────
export interface CreditFacility {
  id: string;
  customerId: string;
  facilityType: string;
  approvedAmount: number;
  utilizedAmount: number;
  availableAmount: number;
  currency: string;
  interestRate: number;
  tenor: number;
  status: "active" | "suspended" | "closed";
  expiryDate: string;
}

export interface LimitManagement {
  id: string;
  facilityId: string;
  limitType: string;
  currentLimit: number;
  proposedLimit: number;
  currency: string;
  status: string;
  reviewedBy?: string;
  approvedAt?: string;
}

export const creditFacilityApi = {
  list: (params?: { page?: number; limit?: number; customerId?: string; status?: string }) =>
    apiClient.get<{ items: CreditFacility[]; total: number }>(`${APISIX.CREDIT_FACILITY}/v1/facilities`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<CreditFacility>(`${APISIX.CREDIT_FACILITY}/v1/facilities/${id}`).then((r) => r.data),

  create: (body: Partial<CreditFacility>) =>
    apiClient.post<CreditFacility>(`${APISIX.CREDIT_FACILITY}/v1/facilities`, body).then((r) => r.data),

  update: (id: string, body: Partial<CreditFacility>) =>
    apiClient.put(`${APISIX.CREDIT_FACILITY}/v1/facilities/${id}`, body).then((r) => r.data),

  getLimits: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: LimitManagement[]; total: number }>(`${APISIX.CREDIT_FACILITY}/v1/limits`, { params }).then((r) => r.data),

  updateLimit: (id: string, body: { proposedLimit: number; reason: string }) =>
    apiClient.put(`${APISIX.CREDIT_FACILITY}/v1/limits/${id}`, body).then((r) => r.data),
};

// ─── Credit Scoring ───────────────────────────────────────────────────────────
export interface CreditScoreModel {
  id: string;
  name: string;
  version: string;
  type: "behavioral" | "application" | "hybrid";
  accuracy: number;
  status: "active" | "testing" | "retired";
  updatedAt: string;
}

export const creditScoringApi = {
  scoreCustomer: (customerId: string, modelId?: string) =>
    apiClient.post(`${APISIX.CREDIT_SCORING}/v1/score`, { customerId, modelId }).then((r) => r.data),

  getModels: () =>
    apiClient.get<{ items: CreditScoreModel[] }>(`${APISIX.CREDIT_SCORING}/v1/models`).then((r) => r.data),

  getHistory: (customerId: string) =>
    apiClient.get(`${APISIX.CREDIT_SCORING}/v1/history/${customerId}`).then((r) => r.data),

  getBatchResults: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CREDIT_SCORING}/v1/batch-results`, { params }).then((r) => r.data),
};

// ─── Syndicated Loans ─────────────────────────────────────────────────────────
export interface SyndicatedLoan {
  id: string;
  loanRef: string;
  borrowerId: string;
  totalAmount: number;
  currency: string;
  participants: { bankId: string; bankName: string; share: number; amount: number }[];
  leadArranger: string;
  status: string;
  tenor: number;
  interestRate: number;
  drawdownDate?: string;
}

export const syndicatedLoansApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SyndicatedLoan[]; total: number }>(`${APISIX.SYNDICATED_LOANS}/v1/syndicated-loans`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<SyndicatedLoan>(`${APISIX.SYNDICATED_LOANS}/v1/syndicated-loans/${id}`).then((r) => r.data),

  create: (body: Partial<SyndicatedLoan>) =>
    apiClient.post<SyndicatedLoan>(`${APISIX.SYNDICATED_LOANS}/v1/syndicated-loans`, body).then((r) => r.data),

  getParticipants: (id: string) =>
    apiClient.get(`${APISIX.SYNDICATED_LOANS}/v1/syndicated-loans/${id}/participants`).then((r) => r.data),
};

// ─── Collateral ───────────────────────────────────────────────────────────────
export interface Collateral {
  id: string;
  loanId: string;
  customerId: string;
  collateralType: string;
  description: string;
  estimatedValue: number;
  valuedValue?: number;
  currency: string;
  status: "active" | "released" | "liquidated";
  valuationDate?: string;
  nextRevaluationDate?: string;
}

export const collateralApi = {
  list: (params?: { page?: number; limit?: number; loanId?: string; status?: string }) =>
    apiClient.get<{ items: Collateral[]; total: number }>(`${APISIX.COLLATERAL}/v1/collaterals`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Collateral>(`${APISIX.COLLATERAL}/v1/collaterals/${id}`).then((r) => r.data),

  create: (body: Partial<Collateral>) =>
    apiClient.post<Collateral>(`${APISIX.COLLATERAL}/v1/collaterals`, body).then((r) => r.data),

  valuate: (id: string, body: { valuedValue: number; valuationDate: string; valuerId: string }) =>
    apiClient.post(`${APISIX.COLLATERAL}/v1/collaterals/${id}/valuate`, body).then((r) => r.data),

  release: (id: string) =>
    apiClient.post(`${APISIX.COLLATERAL}/v1/collaterals/${id}/release`, {}).then((r) => r.data),

  getValuations: (id: string) =>
    apiClient.get(`${APISIX.COLLATERAL}/v1/collaterals/${id}/valuations`).then((r) => r.data),
};

// ─── Debt Collection ──────────────────────────────────────────────────────────
export interface DebtAccount {
  id: string;
  loanId: string;
  customerId: string;
  customerName: string;
  principalOutstanding: number;
  interestOutstanding: number;
  penaltyAmount: number;
  currency: string;
  dpd: number;
  bucket: "1-30" | "31-60" | "61-90" | "91-180" | "180+";
  collectionStatus: string;
  assignedAgent?: string;
}

export const debtCollectionApi = {
  list: (params?: { page?: number; limit?: number; bucket?: string; status?: string }) =>
    apiClient.get<{ items: DebtAccount[]; total: number }>(`${APISIX.DEBT_COLLECTION}/v1/debt-accounts`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<DebtAccount>(`${APISIX.DEBT_COLLECTION}/v1/debt-accounts/${id}`).then((r) => r.data),

  assign: (id: string, agentId: string) =>
    apiClient.post(`${APISIX.DEBT_COLLECTION}/v1/debt-accounts/${id}/assign`, { agentId }).then((r) => r.data),

  recordPayment: (id: string, body: { amount: number; paymentRef: string }) =>
    apiClient.post(`${APISIX.DEBT_COLLECTION}/v1/debt-accounts/${id}/payment`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.DEBT_COLLECTION}/v1/stats`).then((r) => r.data),
};

// ─── Contingent Liabilities ───────────────────────────────────────────────────
export interface ContingentLiability {
  id: string;
  type: string;
  customerId: string;
  faceValue: number;
  currency: string;
  expiryDate: string;
  status: string;
  counterparty: string;
  description: string;
}

export const contingentLiabilitiesApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: ContingentLiability[]; total: number }>(`${APISIX.CONTINGENT_LIAB}/v1/contingent-liabilities`, { params }).then((r) => r.data),

  create: (body: Partial<ContingentLiability>) =>
    apiClient.post<ContingentLiability>(`${APISIX.CONTINGENT_LIAB}/v1/contingent-liabilities`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ContingentLiability>(`${APISIX.CONTINGENT_LIAB}/v1/contingent-liabilities/${id}`).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.CONTINGENT_LIAB}/v1/stats`).then((r) => r.data),
};

// ─── Leasing ──────────────────────────────────────────────────────────────────
export interface LeaseAgreement {
  id: string;
  leaseRef: string;
  lesseeId: string;
  assetType: string;
  assetDescription: string;
  leaseType: "finance" | "operating";
  leaseAmount: number;
  currency: string;
  tenor: number;
  monthlyInstalment: number;
  status: string;
  commencementDate: string;
  expiryDate: string;
}

export const leasingApi = {
  list: (params?: { page?: number; limit?: number; status?: string; leaseType?: string }) =>
    apiClient.get<{ items: LeaseAgreement[]; total: number }>(`${APISIX.LEASING}/v1/leases`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<LeaseAgreement>(`${APISIX.LEASING}/v1/leases/${id}`).then((r) => r.data),

  create: (body: Partial<LeaseAgreement>) =>
    apiClient.post<LeaseAgreement>(`${APISIX.LEASING}/v1/leases`, body).then((r) => r.data),

  getSchedule: (id: string) =>
    apiClient.get(`${APISIX.LEASING}/v1/leases/${id}/schedule`).then((r) => r.data),

  equipmentList: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: LeaseAgreement[]; total: number }>(`${APISIX.EQUIPMENT_LEASING}/v1/leases`, { params }).then((r) => r.data),
};

// ─── Project Finance ──────────────────────────────────────────────────────────
export interface ProjectFinance {
  id: string;
  projectRef: string;
  projectName: string;
  sector: string;
  borrowerId: string;
  facilityAmount: number;
  currency: string;
  tenor: number;
  status: string;
  disbursedAmount: number;
  completionDate?: string;
}

export const projectFinanceApi = {
  list: (params?: { page?: number; limit?: number; sector?: string; status?: string }) =>
    apiClient.get<{ items: ProjectFinance[]; total: number }>(`${APISIX.PROJECT_FINANCE}/v1/projects`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ProjectFinance>(`${APISIX.PROJECT_FINANCE}/v1/projects/${id}`).then((r) => r.data),

  create: (body: Partial<ProjectFinance>) =>
    apiClient.post<ProjectFinance>(`${APISIX.PROJECT_FINANCE}/v1/projects`, body).then((r) => r.data),

  getDisbursements: (id: string) =>
    apiClient.get(`${APISIX.PROJECT_FINANCE}/v1/projects/${id}/disbursements`).then((r) => r.data),
};
