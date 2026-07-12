/**
 * Customers API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────┬────────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix            │ Backend Service                │ Port  │
 * ├──────────────────────────────────┼──────────────────────────┼────────────────────────────────┼───────┤
 * │ /users                           │ /user                    │ user-service                   │ 80    │
 * │ /business-management             │ /kyb                     │ kyb-service                    │ 80    │
 * │ /communication-hub               │ /communication           │ communication-hub              │ 80    │
 * │ /salary-processing               │ /salary                  │ salary-processing-go           │ 8150  │
 * │ /relationship-manager            │ /rm                      │ relationship-manager-service   │ 80    │
 * └──────────────────────────────────┴──────────────────────────┴────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── User / Customer Management ───────────────────────────────────────────────
export interface CustomerUser {
  id: string;
  userId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  userType: "individual" | "corporate" | "agent";
  kycStatus: "pending" | "verified" | "failed" | "expired";
  kycTier: 1 | 2 | 3;
  status: "active" | "inactive" | "suspended" | "blocked";
  createdAt: string;
  lastLogin?: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  individual: number;
  corporate: number;
  kycPending: number;
  kycVerified: number;
  newThisMonth: number;
}

export const customerUserApi = {
  list: (params?: { page?: number; limit?: number; userType?: string; kycStatus?: string; status?: string; q?: string }) =>
    apiClient.get<{ items: CustomerUser[]; total: number }>(`${APISIX.USER}/user`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<CustomerUser>(`${APISIX.USER}/v1/users/${id}`).then((r) => r.data),

  update: (id: string, body: Partial<CustomerUser>) =>
    apiClient.put(`${APISIX.USER}/v1/users/${id}`, body).then((r) => r.data),

  updateStatus: (id: string, status: "active" | "inactive" | "suspended" | "blocked", reason?: string) =>
    apiClient.patch(`${APISIX.USER}/v1/users/${id}/status`, { status, reason }).then((r) => r.data),

  getProfile: (id: string) =>
    apiClient.get(`${APISIX.USER}/user/${id}`).then((r) => r.data),

  getAccounts: (id: string) =>
    apiClient.get(`${APISIX.USER}/user/${id}`).then((r) => r.data),

  getStats: () =>
    apiClient.get<CustomerStats>(`${APISIX.USER}/user/metrics`).then((r) => r.data),
};

// ─── KYB (Business Management) ────────────────────────────────────────────────
export interface BusinessEntity {
  id: string;
  businessRef: string;
  customerId: string;
  businessName: string;
  rcNumber: string;
  businessType: string;
  sector: string;
  incorporationDate: string;
  directors: { name: string; bvn?: string; sharePercent: number }[];
  kybStatus: "pending" | "verified" | "failed" | "review_required";
  address: string;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
}

export interface BeneficialOwnership {
  id: string;
  businessId: string;
  ownerName: string;
  ownerType: "individual" | "corporate";
  ownershipPercent: number;
  nationality: string;
  bvn?: string;
  pepStatus: boolean;
  verificationStatus: "pending" | "verified" | "failed";
}

export const kybApi = {
  listBusinesses: (params?: { page?: number; limit?: number; kybStatus?: string; sector?: string; q?: string }) =>
    apiClient.get<{ items: BusinessEntity[]; total: number }>(`${APISIX.KYB}/v1/kyb/applications`, { params }).then((r) => r.data),

  getBusinessById: (id: string) =>
    apiClient.get<BusinessEntity>(`${APISIX.KYB}/v1/kyb/applications/${id}`).then((r) => r.data),

  verifyBusiness: (id: string) =>
    apiClient.post(`${APISIX.KYB}/v1/kyb/applications/${id}`, {}).then((r) => r.data),

  updateKYBStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`${APISIX.KYB}/v1/kyb/applications/${id}`, { status, notes }).then((r) => r.data),

  getBeneficialOwners: (businessId: string) =>
    apiClient.get<{ items: BeneficialOwnership[] }>(`${APISIX.KYB}/v1/kyb/applications/${businessId}`).then((r) => r.data),

  addBeneficialOwner: (businessId: string, body: Partial<BeneficialOwnership>) =>
    apiClient.post<BeneficialOwnership>(`${APISIX.KYB}/v1/kyb/applications/${businessId}`, body).then((r) => r.data),

  cacLookup: (rcNumber: string) =>
    apiClient.post(`${APISIX.KYB}/v1/kyb/applications`, { rcNumber }).then((r) => r.data),
};

// ─── Communication Hub ────────────────────────────────────────────────────────
export interface CommunicationMessage {
  id: string;
  messageRef: string;
  customerId: string;
  channel: "email" | "sms" | "push" | "in_app" | "whatsapp";
  subject?: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  sentAt?: string;
  deliveredAt?: string;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables: string[];
  status: "active" | "inactive";
}

export const communicationHubApi = {
  listMessages: (params?: { page?: number; limit?: number; channel?: string; status?: string; customerId?: string }) =>
    apiClient.get<{ items: CommunicationMessage[]; total: number }>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/list`, { params }).then((r) => r.data),

  getMessageById: (_id: string) =>
    apiClient.get<CommunicationMessage>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/list`).then((r) => r.data),

  send: (body: { customerId: string; channel: string; templateId?: string; subject?: string; body?: string; params?: Record<string, string> }) =>
    apiClient.post<CommunicationMessage>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/send`, body).then((r) => r.data),

  sendBulk: (body: { customerIds: string[]; channel: string; templateId: string; params?: Record<string, string> }) =>
    apiClient.post(`${APISIX.COMMUNICATION_HUB}/v1/notifications/send`, body).then((r) => r.data),

  listTemplates: (params?: { page?: number; limit?: number; channel?: string; status?: string }) =>
    apiClient.get<{ items: CommunicationTemplate[]; total: number }>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/list`, { params }).then((r) => r.data),

  getTemplateById: (_id: string) =>
    apiClient.get<CommunicationTemplate>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/list`).then((r) => r.data),

  createTemplate: (body: Partial<CommunicationTemplate>) =>
    apiClient.post<CommunicationTemplate>(`${APISIX.COMMUNICATION_HUB}/v1/notifications/send`, body).then((r) => r.data),

  updateTemplate: (_id: string, body: Partial<CommunicationTemplate>) =>
    apiClient.post(`${APISIX.COMMUNICATION_HUB}/v1/notifications/send`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.COMMUNICATION_HUB}/v1/notifications/stats`).then((r) => r.data),
};

// ─── Salary Processing ────────────────────────────────────────────────────────
export interface SalaryPayroll {
  id: string;
  payrollRef: string;
  employerId: string;
  employerName: string;
  totalEmployees: number;
  totalAmount: number;
  currency: string;
  payPeriod: string;
  status: "pending" | "processing" | "completed" | "failed" | "partially_completed";
  processedAt?: string;
  disbursedAt?: string;
}

export interface SalaryRecord {
  id: string;
  payrollId: string;
  employeeId: string;
  employeeName: string;
  accountNumber: string;
  bankCode: string;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
}

export const salaryProcessingApi = {
  listPayrolls: (params?: { page?: number; limit?: number; employerId?: string; status?: string; period?: string }) =>
    apiClient.get<{ items: SalaryPayroll[]; total: number }>(`${APISIX.SALARY_PROCESSING}/v1/salary/batches`, { params }).then((r) => r.data),

  getPayrollById: (_id: string) =>
    apiClient.get<SalaryPayroll>(`${APISIX.SALARY_PROCESSING}/v1/salary/batches`).then((r) => r.data),

  uploadPayroll: (body: { employerId: string; payPeriod: string; employees: Partial<SalaryRecord>[] }) =>
    apiClient.post<SalaryPayroll>(`${APISIX.SALARY_PROCESSING}/v1/salary/instructions`, body).then((r) => r.data),

  processPayroll: (_id: string) =>
    apiClient.post(`${APISIX.SALARY_PROCESSING}/v1/salary/instructions`, {}).then((r) => r.data),

  approvePayroll: (_id: string) =>
    apiClient.post(`${APISIX.SALARY_PROCESSING}/v1/salary/instructions`, {}).then((r) => r.data),

  getRecords: (_payrollId: string, params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SalaryRecord[]; total: number }>(`${APISIX.SALARY_PROCESSING}/v1/salary/batches`, { params }).then((r) => r.data),
};

// ─── Relationship Manager ─────────────────────────────────────────────────────
export interface RMAssignment {
  id: string;
  rmId: string;
  rmName: string;
  customerId: string;
  customerName: string;
  customerSegment: string;
  assignedAt: string;
  status: "active" | "transferred" | "inactive";
}

export interface RMPerformance {
  rmId: string;
  rmName: string;
  customerCount: number;
  totalAUM: number;
  totalLoans: number;
  newCustomers: number;
  retentionRate: number;
  period: string;
}

export const relationshipManagerApi = {
  listAssignments: (params?: { page?: number; limit?: number; rmId?: string; status?: string; segment?: string }) =>
    apiClient.get<{ items: RMAssignment[]; total: number }>(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers`, { params }).then((r) => r.data),

  assign: (body: { rmId: string; customerId: string }) =>
    apiClient.post<RMAssignment>(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers`, body).then((r) => r.data),

  transfer: (id: string, body: { newRmId: string; reason: string }) =>
    apiClient.post(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers/${id}`, body).then((r) => r.data),

  getPerformance: (rmId: string, params?: { period?: string }) =>
    apiClient.get<RMPerformance>(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers/${rmId}`, { params }).then((r) => r.data),

  listPerformance: (params?: { page?: number; limit?: number; period?: string }) =>
    apiClient.get<{ items: RMPerformance[]; total: number }>(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers`, { params }).then((r) => r.data),

  getCustomersByRM: (_rmId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers`, { params }).then((r) => r.data),

  getActivityLog: (_rmId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.RELATIONSHIP_MANAGER}/api/v1/customers/activities`, { params }).then((r) => r.data),
};
