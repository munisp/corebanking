/**
 * Regulatory Compliance API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                    │ Backend Service                  │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┼───────┤
 * │ /regulatory-reporting            │ /regulatory-reporting            │ regulatory-reporting-go          │ 9072  │
 * │ /cbn-returns                     │ /cbn-returns                     │ cbn-returns-py                   │ 9236  │
 * │ /ifrs9                           │ /ifrs9                           │ ifrs9-engine-rs                  │ 8164  │
 * │ /ifrs9-ecl                       │ /ifrs9-ecl-engine                │ ifrs9-ecl-engine-rs              │ 1355  │
 * │ /basel-engine                    │ /basel-engine                    │ basel-engine-rs                  │ 9218  │
 * │ /compliance                      │ /compliance                      │ compliance-service               │ 80    │
 * │ /cbn-compliance                  │ /cbn-compliance-checker          │ cbn-compliance-checker-py        │ 9235  │
 * │ /ndpr-compliance                 │ /ndpr-compliance                 │ ndpr-compliance-py               │ 9300  │
 * └──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Regulatory Reporting ─────────────────────────────────────────────────────
export interface RegulatoryReport {
  id: string;
  reportRef: string;
  reportType: string;
  regulator: "CBN" | "NFIU" | "SEC" | "NDIC" | "FIRS";
  period: { from: string; to: string };
  dueDate: string;
  submittedAt?: string;
  status: "pending" | "generating" | "ready" | "submitted" | "accepted" | "rejected";
  generatedBy?: string;
  fileUrl?: string;
}

export const regulatoryReportingApi = {
  list: (params?: { page?: number; limit?: number; regulator?: string; status?: string; reportType?: string }) =>
    apiClient.get<{ items: RegulatoryReport[]; total: number }>(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/list`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<RegulatoryReport>(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/list`).then((r) => r.data),

  generate: (body: { reportType: string; regulator: string; from: string; to: string }) =>
    apiClient.post<RegulatoryReport>(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/create`, body).then((r) => r.data),

  submit: (id: string) =>
    apiClient.post(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/create`, {}).then((r) => r.data),

  download: (id: string) =>
    apiClient.get(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/list`, { responseType: "blob" }).then((r) => r.data),

  getCalendar: () =>
    apiClient.get(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/list`).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.REGULATORY_REPORTING}/v1/regulatory-reporting/stats`).then((r) => r.data),
};

// ─── CBN Returns ──────────────────────────────────────────────────────────────
export interface CBNReturn {
  id: string;
  returnRef: string;
  returnType: string;
  period: string;
  dueDate: string;
  submittedAt?: string;
  status: "pending" | "submitted" | "accepted" | "queried";
  cbnRef?: string;
}

export const cbnReturnsApi = {
  list: (params?: { page?: number; limit?: number; returnType?: string; status?: string }) =>
    apiClient.get<{ items: CBNReturn[]; total: number }>(`${APISIX.CBN_RETURNS}/reports`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<CBNReturn>(`${APISIX.CBN_RETURNS}/reports`).then((r) => r.data),

  generate: (body: { returnType: string; period: string }) =>
    apiClient.post<CBNReturn>(`${APISIX.CBN_RETURNS}/reports`, body).then((r) => r.data),

  submit: (id: string) =>
    apiClient.post(`${APISIX.CBN_RETURNS}/reports/submit`, {}).then((r) => r.data),

  getReturnTypes: () =>
    apiClient.get(`${APISIX.CBN_RETURNS}/reports`).then((r) => r.data),

  getDueDates: () =>
    apiClient.get(`${APISIX.CBN_RETURNS}/reports`).then((r) => r.data),
};

// ─── IFRS 9 ───────────────────────────────────────────────────────────────────
export interface IFRS9Report {
  id: string;
  reportRef: string;
  reportDate: string;
  totalProvisions: number;
  stage1Provisions: number;
  stage2Provisions: number;
  stage3Provisions: number;
  currency: string;
  status: "pending" | "running" | "completed" | "failed";
  completedAt?: string;
}

export interface LoanStageClassification {
  loanId: string;
  loanRef: string;
  stage: 1 | 2 | 3;
  pd: number;
  lgd: number;
  ead: number;
  ecl: number;
  currency: string;
  classifiedAt: string;
}

export const ifrs9Api = {
  listReports: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: IFRS9Report[]; total: number }>(`${APISIX.IFRS9}/api/v1/reports`, { params }).then((r) => r.data),

  getReportById: (id: string) =>
    apiClient.get<IFRS9Report>(`${APISIX.IFRS9}/api/v1/reports/${id}`).then((r) => r.data),

  runReport: (reportDate: string) =>
    apiClient.post<IFRS9Report>(`${APISIX.IFRS9}/api/v1/reports/run`, { reportDate }).then((r) => r.data),

  getLoanClassifications: (params?: { page?: number; limit?: number; stage?: number }) =>
    apiClient.get<{ items: LoanStageClassification[]; total: number }>(`${APISIX.IFRS9}/api/v1/classifications`, { params }).then((r) => r.data),

  getPortfolioSummary: (reportDate?: string) =>
    apiClient.get(`${APISIX.IFRS9}/api/v1/portfolio-summary`, { params: { reportDate } }).then((r) => r.data),
};

// ─── IFRS 9 ECL Engine ────────────────────────────────────────────────────────
export interface ECLResult {
  loanId: string;
  expectedCreditLoss: number;
  lifetimeECL: number;
  twelveMonthECL: number;
  stage: 1 | 2 | 3;
  currency: string;
  computedAt: string;
}

export const ifrs9EclEngineApi = {
  computeECL: (body: { loanId: string; reportDate: string }) =>
    apiClient.post<ECLResult>(`${APISIX.IFRS9_ECL}/api/v1/ecl/compute`, body).then((r) => r.data),

  runBatchECL: (body: { reportDate: string; loanIds?: string[] }) =>
    apiClient.post(`${APISIX.IFRS9_ECL}/api/v1/ecl/batch`, body).then((r) => r.data),

  getBatchStatus: (jobId: string) =>
    apiClient.get(`${APISIX.IFRS9_ECL}/api/v1/ecl/batch/${jobId}`).then((r) => r.data),

  getECLByLoan: (loanId: string) =>
    apiClient.get<ECLResult>(`${APISIX.IFRS9_ECL}/api/v1/ecl/${loanId}`).then((r) => r.data),

  getModelParams: () =>
    apiClient.get(`${APISIX.IFRS9_ECL}/api/v1/model/params`).then((r) => r.data),
};

// ─── Basel Engine ─────────────────────────────────────────────────────────────
export interface BaselReport {
  id: string;
  reportRef: string;
  reportDate: string;
  tier1Capital: number;
  tier2Capital: number;
  totalCapital: number;
  rwa: number;
  car: number;
  minimumCAR: number;
  status: "compliant" | "breach" | "warning";
  currency: string;
  computedAt: string;
}

export interface BaselRWABreakdown {
  creditRisk: number;
  marketRisk: number;
  operationalRisk: number;
  total: number;
  currency: string;
  asOf: string;
}

export const baselEngineApi = {
  listReports: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: BaselReport[]; total: number }>(`${APISIX.BASEL_ENGINE}/v1/basel/exposures`, { params }).then((r) => r.data),

  getReportById: (id: string) =>
    apiClient.get<BaselReport>(`${APISIX.BASEL_ENGINE}/v1/basel/exposures`).then((r) => r.data),

  runReport: (reportDate: string) =>
    apiClient.post<BaselReport>(`${APISIX.BASEL_ENGINE}/v1/basel/calculate-rwa`, { reportDate }).then((r) => r.data),

  getRWABreakdown: (reportDate?: string) =>
    apiClient.get<BaselRWABreakdown>(`${APISIX.BASEL_ENGINE}/v1/basel/calculate-rwa`, { params: { reportDate } }).then((r) => r.data),

  getCapitalAdequacyHistory: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.BASEL_ENGINE}/v1/basel/capital`, { params }).then((r) => r.data),

  getStressTestResults: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.BASEL_ENGINE}/v1/basel/exposures`, { params }).then((r) => r.data),

  runStressTest: (body: { scenario: string; shockParams: Record<string, number> }) =>
    apiClient.post(`${APISIX.BASEL_ENGINE}/v1/basel/calculate-rwa`, body).then((r) => r.data),
};

// ─── Compliance Service ───────────────────────────────────────────────────────
export interface ComplianceCheck {
  id: string;
  checkRef: string;
  customerId: string;
  checkType: string;
  status: "pass" | "fail" | "pending" | "review_required";
  details: string;
  checkedAt: string;
  reviewedBy?: string;
}

export interface CompliancePolicy {
  id: string;
  name: string;
  category: string;
  description: string;
  effectiveDate: string;
  status: "active" | "draft" | "retired";
  version: string;
}

export interface ComplianceAssessment {
  id: string;
  type: string;
  subject: string;
  requestType: string;
  responseTimeDays: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplianceMonitoringRule {
  id: string;
  name: string;
  category: string;
  condition: string;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  createdAt?: string;
}

export const complianceApi = {
  // /api/v1/assessments
  listAssessments: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: ComplianceAssessment[]; total: number }>(`${APISIX.COMPLIANCE}/api/v1/assessments`, { params }).then((r) => r.data),

  getAssessmentById: (id: string) =>
    apiClient.get<ComplianceAssessment>(`${APISIX.COMPLIANCE}/api/v1/assessments/${id}`).then((r) => r.data),

  createAssessment: (body: Partial<ComplianceAssessment>) =>
    apiClient.post<ComplianceAssessment>(`${APISIX.COMPLIANCE}/api/v1/assessments`, body).then((r) => r.data),

  updateAssessment: (id: string, body: Partial<ComplianceAssessment>) =>
    apiClient.put<ComplianceAssessment>(`${APISIX.COMPLIANCE}/api/v1/assessments/${id}`, body).then((r) => r.data),

  deleteAssessment: (id: string) =>
    apiClient.delete(`${APISIX.COMPLIANCE}/api/v1/assessments/${id}`).then((r) => r.data),

  // /api/v1/compliance/monitoring/rules/all
  listMonitoringRules: (params?: { page?: number; limit?: number; category?: string; severity?: string }) =>
    apiClient.get<{ items: ComplianceMonitoringRule[]; total: number }>(`${APISIX.COMPLIANCE}/api/v1/compliance/monitoring/rules`, { params }).then((r) => r.data),

  listChecks: (params?: { page?: number; limit?: number; checkType?: string; status?: string; customerId?: string }) =>
    apiClient.get<{ items: ComplianceCheck[]; total: number }>(`${APISIX.COMPLIANCE}/api/v1/compliance/monitoring/rules`, { params }).then((r) => r.data),

  getCheckById: (id: string) =>
    apiClient.get<ComplianceCheck>(`${APISIX.COMPLIANCE}/api/v1/compliance/alerts/${id}`).then((r) => r.data),

  runCheck: (body: { customerId: string; checkType: string }) =>
    apiClient.post<ComplianceCheck>(`${APISIX.COMPLIANCE}/api/v1/compliance/monitoring/evaluate`, body).then((r) => r.data),

  listPolicies: (params?: { page?: number; limit?: number; category?: string; status?: string }) =>
    apiClient.get<{ items: CompliancePolicy[]; total: number }>(`${APISIX.COMPLIANCE}/api/v1/compliance/reports/tenant/all`, { params }).then((r) => r.data),

  getPolicyById: (id: string) =>
    apiClient.get<CompliancePolicy>(`${APISIX.COMPLIANCE}/api/v1/compliance/reports/${id}`).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.COMPLIANCE}/api/v1/compliance/reports/tenant/all`).then((r) => r.data),
};

// ─── CBN Compliance Checker ───────────────────────────────────────────────────
export interface CBNComplianceResult {
  checkId: string;
  regulationRef: string;
  area: string;
  status: "compliant" | "non_compliant" | "partially_compliant" | "not_applicable";
  findings: string[];
  recommendations: string[];
  checkedAt: string;
}

export const cbnComplianceApi = {
  runCheck: (body?: { areas?: string[] }) =>
    apiClient.post<{ results: CBNComplianceResult[]; overallStatus: string }>(`${APISIX.CBN_COMPLIANCE}/reports`, body).then((r) => r.data),

  getLatestResults: () =>
    apiClient.get<{ results: CBNComplianceResult[]; checkedAt: string }>(`${APISIX.CBN_COMPLIANCE}/reports`).then((r) => r.data),

  getHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CBN_COMPLIANCE}/reports`, { params }).then((r) => r.data),

  getRegulations: () =>
    apiClient.get(`${APISIX.CBN_COMPLIANCE}/reports`).then((r) => r.data),
};

// ─── NDPR Compliance ──────────────────────────────────────────────────────────
export interface NDPRAssessment {
  id: string;
  assessmentRef: string;
  dataCategory: string;
  processingPurpose: string;
  legalBasis: string;
  dataSubjects: string;
  retentionPeriod: string;
  crossBorderTransfer: boolean;
  status: "compliant" | "review_required" | "non_compliant";
  lastReviewedAt: string;
}

export const ndprComplianceApi = {
  listAssessments: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: NDPRAssessment[]; total: number }>(`${APISIX.NDPR_COMPLIANCE}/api/v1/assessments`, { params }).then((r) => r.data),

  getAssessmentById: (id: string) =>
    apiClient.get<NDPRAssessment>(`${APISIX.NDPR_COMPLIANCE}/api/v1/assessments/${id}`).then((r) => r.data),

  createAssessment: (body: Partial<NDPRAssessment>) =>
    apiClient.post<NDPRAssessment>(`${APISIX.NDPR_COMPLIANCE}/api/v1/assessments`, body).then((r) => r.data),

  getDataInventory: () =>
    apiClient.get(`${APISIX.NDPR_COMPLIANCE}/api/v1/data-inventory`).then((r) => r.data),

  getConsentRecords: (params?: { page?: number; limit?: number; customerId?: string }) =>
    apiClient.get(`${APISIX.NDPR_COMPLIANCE}/api/v1/consents`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.NDPR_COMPLIANCE}/api/v1/dashboard`).then((r) => r.data),
};
