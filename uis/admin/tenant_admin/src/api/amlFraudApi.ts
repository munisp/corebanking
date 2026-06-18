/**
 * AML & Fraud API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                    │ Backend Service                  │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┼───────┤
 * │ /aml-dashboard                   │ /aml-compliance-dashboard        │ aml-compliance-dashboard-py      │ 9207  │
 * │ /aml-case-manager                │ /aml-case-manager                │ aml-case-manager-go              │ 9163  │
 * │ /aml-engine                      │ /aml-engine                      │ aml-engine-rs                    │ 8701  │
 * │ /aml-risk-scoring                │ /aml-risk-scoring                │ aml-risk-scoring-rs              │ 9203  │
 * │ /aml-training-tracker            │ /aml-training-tracker            │ aml-training-tracker-go          │ 9073  │
 * │ /fraud-detection                 │ /fraud-detection                 │ fraud-detection-rs               │ 9269  │
 * │ /ai-fraud-scoring                │ /ai-fraud-scoring                │ ai-fraud-scoring-rs              │ 8103  │
 * │ /fraudfusion-ensemble            │ /fraudfusion-ensemble            │ fraudfusion-ensemble-rs          │ 8303  │
 * │ /gnn-fraud-detection             │ /gnn-fraud-detection             │ gnn-fraud-detection-py           │ 9271  │
 * │ /goaml-integration               │ /goaml-integration               │ goaml-integration-go             │ 9158  │
 * │ /sar-filing                      │ /sar-filing-engine               │ sar-filing-engine-go             │ 9159  │
 * │ /ctr-str-filing                  │ /ctr                             │ nfiu-ctr-str-filing-py           │ 8283  │
 * │ /kyc-aml-screening               │ /kyc-aml-screening               │ kyc-aml-screening-py             │ 9287  │
 * └──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

const getTenantId = (): string => {
  try {
    const cfg = JSON.parse(localStorage.getItem("tenant_config") || "{}");
    return cfg.tenantId || cfg.id || "default";
  } catch {
    return "default";
  }
};

// ─── AML Compliance Dashboard ─────────────────────────────────────────────────
export interface AMLDashboardStats {
  openCases: number;
  closedCases: number;
  sarsFiled: number;
  highRiskCustomers: number;
  pendingReview: number;
  alertsToday: number;
  asOf: string;
}

export const amlDashboardApi = {
  getStats: () =>
    apiClient.get<AMLDashboardStats>(`${APISIX.AML_COMPLIANCE_DASH}/api/v1/compliance/alerts/tenant/${getTenantId()}`).then((r) => r.data),

  getAlertTrend: (params?: { days?: number }) =>
    apiClient.get(`${APISIX.AML_COMPLIANCE_DASH}/api/v1/compliance/monitoring/rules/${getTenantId()}`, { params }).then((r) => r.data),

  getTopRisks: () =>
    apiClient.get(`${APISIX.AML_COMPLIANCE_DASH}/api/v1/compliance/alerts/tenant/${getTenantId()}`).then((r) => r.data),

  getComplianceScore: () =>
    apiClient.get(`${APISIX.AML_COMPLIANCE_DASH}/api/v1/compliance/reports/tenant/${getTenantId()}`).then((r) => r.data),
};

// ─── AML Case Manager ─────────────────────────────────────────────────────────
export interface AMLCase {
  id: string;
  caseRef: string;
  type: "suspicious_activity" | "high_risk_customer" | "pep_match" | "sanctions_hit" | "structuring";
  customerId: string;
  customerName: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "under_review" | "escalated" | "closed" | "filed";
  assignedTo?: string;
  description: string;
  alertIds: string[];
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface AMLAlert {
  id: string;
  alertRef: string;
  ruleId: string;
  ruleName: string;
  customerId: string;
  customerName: string;
  transactionRef?: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "reviewed" | "dismissed" | "escalated";
  score: number;
  triggeredAt: string;
}

export const amlCaseManagerApi = {
  listCases: (params?: { page?: number; limit?: number; type?: string; status?: string; priority?: string }) =>
    apiClient.get<{ items: AMLCase[]; total: number }>(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/tenant/${getTenantId()}`, { params }).then((r) => r.data),

  getCaseById: (id: string) =>
    apiClient.get<AMLCase>(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}`).then((r) => r.data),

  createCase: (body: Partial<AMLCase>) =>
    apiClient.post<AMLCase>(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts`, body).then((r) => r.data),

  updateCase: (id: string, body: Partial<AMLCase>) =>
    apiClient.put(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}`, body).then((r) => r.data),

  escalate: (id: string, body: { reason: string; escalateTo: string }) =>
    apiClient.post(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}/resolve`, body).then((r) => r.data),

  close: (id: string, body: { resolution: string; outcome: string }) =>
    apiClient.post(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}/resolve`, body).then((r) => r.data),

  listAlerts: (params?: { page?: number; limit?: number; severity?: string; status?: string }) =>
    apiClient.get<{ items: AMLAlert[]; total: number }>(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/tenant/${getTenantId()}`, { params }).then((r) => r.data),

  getAlertById: (id: string) =>
    apiClient.get<AMLAlert>(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}`).then((r) => r.data),

  dismissAlert: (id: string, reason: string) =>
    apiClient.post(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}/resolve`, { reason }).then((r) => r.data),

  escalateAlert: (id: string, body: { reason: string }) =>
    apiClient.post(`${APISIX.AML_CASE_MANAGER}/api/v1/compliance/alerts/${id}/resolve`, body).then((r) => r.data),
};

// ─── AML Engine ───────────────────────────────────────────────────────────────
export interface AMLRule {
  id: string;
  name: string;
  description: string;
  ruleType: "threshold" | "pattern" | "behavioral" | "network";
  status: "active" | "inactive" | "testing";
  alertCount: number;
  falsePositiveRate: number;
  updatedAt: string;
}

export const amlEngineApi = {
  listRules: (params?: { page?: number; limit?: number; ruleType?: string; status?: string }) =>
    apiClient.get<{ items: AMLRule[]; total: number }>(`${APISIX.AML_ENGINE}/api/v1/compliance/monitoring/rules/${getTenantId()}`, { params }).then((r) => r.data),

  getRuleById: (_id: string) =>
    apiClient.get<AMLRule>(`${APISIX.AML_ENGINE}/api/v1/compliance/monitoring/rules/${getTenantId()}`).then((r) => r.data),

  updateRule: (id: string, body: Partial<AMLRule>) =>
    apiClient.put(`${APISIX.AML_ENGINE}/api/v1/compliance/monitoring/rules/${id}/toggle`, body).then((r) => r.data),

  runScreening: (body: { customerId?: string; transactionId?: string }) =>
    apiClient.post(`${APISIX.AML_ENGINE}/api/v1/compliance/monitoring/evaluate`, body).then((r) => r.data),

  getMetrics: () =>
    apiClient.get(`${APISIX.AML_ENGINE}/api/v1/compliance/reports/tenant/${getTenantId()}`).then((r) => r.data),
};

// ─── AML Risk Scoring ─────────────────────────────────────────────────────────
export interface AMLRiskScore {
  customerId: string;
  score: number;
  riskLevel: "low" | "medium" | "high" | "very_high";
  factors: { factor: string; weight: number; value: string }[];
  lastUpdated: string;
  nextReviewDate: string;
}

export const amlRiskScoringApi = {
  scoreCustomer: (customerId: string) =>
    apiClient.post<AMLRiskScore>(`${APISIX.AML_RISK_SCORING}/api/v1/compliance/aml/assess`, { customerId }).then((r) => r.data),

  getByCustomer: (customerId: string) =>
    apiClient.get<AMLRiskScore>(`${APISIX.AML_RISK_SCORING}/api/v1/compliance/aml/entity/${customerId}`).then((r) => r.data),

  listHighRisk: (params?: { page?: number; limit?: number; riskLevel?: string }) =>
    apiClient.get<{ items: AMLRiskScore[]; total: number }>(`${APISIX.AML_RISK_SCORING}/api/v1/compliance/alerts/tenant/${getTenantId()}`, { params }).then((r) => r.data),

  runBatchScoring: () =>
    apiClient.post(`${APISIX.AML_RISK_SCORING}/api/v1/compliance/aml/assess`, {}).then((r) => r.data),

  getDistribution: () =>
    apiClient.get(`${APISIX.AML_RISK_SCORING}/api/v1/compliance/reports/tenant/${getTenantId()}`).then((r) => r.data),
};

// ─── AML Training Tracker ─────────────────────────────────────────────────────
export interface TrainingRecord {
  id: string;
  staffId: string;
  staffName: string;
  course: string;
  completedAt?: string;
  score?: number;
  status: "enrolled" | "in_progress" | "completed" | "failed" | "overdue";
  dueDate: string;
  certExpiry?: string;
}

export const amlTrainingApi = {
  list: (params?: { page?: number; limit?: number; status?: string; staffId?: string }) =>
    apiClient.get<{ items: TrainingRecord[]; total: number }>(`${APISIX.AML_TRAINING}/api/v1/compliance/reports/tenant/${getTenantId()}`, { params }).then((r) => r.data),

  getByStaff: (staffId: string) =>
    apiClient.get<TrainingRecord[]>(`${APISIX.AML_TRAINING}/api/v1/compliance/aml/entity/${staffId}`).then((r) => r.data),

  enroll: (body: { staffId: string; course: string; dueDate: string }) =>
    apiClient.post<TrainingRecord>(`${APISIX.AML_TRAINING}/api/v1/compliance/monitoring/rules`, body).then((r) => r.data),

  getComplianceReport: () =>
    apiClient.get(`${APISIX.AML_TRAINING}/api/v1/compliance/reports/tenant/${getTenantId()}`).then((r) => r.data),
};

// ─── Fraud Detection ──────────────────────────────────────────────────────────
export interface FraudAlert {
  id: string;
  alertRef: string;
  transactionId: string;
  accountId: string;
  customerId: string;
  fraudType: string;
  riskScore: number;
  amount: number;
  currency: string;
  channel: string;
  status: "new" | "investigating" | "confirmed" | "false_positive" | "resolved";
  detectedAt: string;
}

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  ruleType: string;
  threshold?: number;
  status: "active" | "inactive";
  triggeredCount: number;
  truePositiveRate: number;
}

export const fraudDetectionApi = {
  listAlerts: (params?: { page?: number; limit?: number; fraudType?: string; status?: string }) =>
    apiClient.get<{ items: FraudAlert[]; total: number }>(`${APISIX.FRAUD_DETECTION}/v1/alerts/${getTenantId()}`, { params }).then((r) => r.data),

  getAlertById: (id: string) =>
    apiClient.get<FraudAlert>(`${APISIX.FRAUD_DETECTION}/v1/alerts/${id}`).then((r) => r.data),

  updateAlertStatus: (id: string, status: string, notes?: string) =>
    apiClient.post(`${APISIX.FRAUD_DETECTION}/v1/rules`, { alertId: id, status, notes }).then((r) => r.data),

  listRules: (params?: { page?: number; limit?: number; ruleType?: string; status?: string }) =>
    apiClient.get<{ items: FraudRule[]; total: number }>(`${APISIX.FRAUD_DETECTION}/v1/rules`, { params }).then((r) => r.data),

  updateRule: (_id: string, body: Partial<FraudRule>) =>
    apiClient.post(`${APISIX.FRAUD_DETECTION}/v1/rules`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.FRAUD_DETECTION}/v1/cases/${getTenantId()}`).then((r) => r.data),
};

// ─── AI Fraud Scoring ─────────────────────────────────────────────────────────
export const aiFraudScoringApi = {
  scoreTransaction: (body: { transactionId: string; features?: Record<string, unknown> }) =>
    apiClient.post(`${APISIX.AI_FRAUD_SCORING}/v1/check`, body).then((r) => r.data),

  getModelInfo: () =>
    apiClient.get(`${APISIX.AI_FRAUD_SCORING}/v1/rules`).then((r) => r.data),

  getMetrics: () =>
    apiClient.get(`${APISIX.AI_FRAUD_SCORING}/v1/cases/${getTenantId()}`).then((r) => r.data),

  getExplanation: (transactionId: string) =>
    apiClient.get(`${APISIX.AI_FRAUD_SCORING}/v1/alerts/${transactionId}`).then((r) => r.data),
};

// ─── FraudFusion Ensemble ─────────────────────────────────────────────────────
export const fraudFusionApi = {
  scoreTransaction: (body: { transactionId: string; accountId: string; amount: number; currency: string; channel: string }) =>
    apiClient.post(`${APISIX.FRAUDFUSION}/v1/ensemble/score`, body).then((r) => r.data),

  getEnsembleMetrics: () =>
    apiClient.get(`${APISIX.FRAUDFUSION}/v1/ensemble/metrics`).then((r) => r.data),

  getModelWeights: () =>
    apiClient.get(`${APISIX.FRAUDFUSION}/v1/ensemble/weights`).then((r) => r.data),
};

// ─── GNN Fraud Detection ──────────────────────────────────────────────────────
export const gnnFraudApi = {
  analyzeNetwork: (body: { accountId: string; depth?: number }) =>
    apiClient.post(`${APISIX.GNN_FRAUD}/v1/analyze`, body).then((r) => r.data),

  getRiskGraph: (accountId: string) =>
    apiClient.get(`${APISIX.GNN_FRAUD}/v1/graph/${accountId}`).then((r) => r.data),

  getNetworkAlerts: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.GNN_FRAUD}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── goAML Integration ────────────────────────────────────────────────────────
export interface GoAMLSubmission {
  id: string;
  submissionRef: string;
  reportType: "STR" | "CTR" | "SAR";
  customerId: string;
  transactionRefs: string[];
  submittedAt?: string;
  status: "draft" | "pending" | "submitted" | "accepted" | "rejected";
  nfiuRef?: string;
}

export const goAmlApi = {
  listSubmissions: (params?: { page?: number; limit?: number; reportType?: string; status?: string }) =>
    apiClient.get<{ items: GoAMLSubmission[]; total: number }>(`${APISIX.GOAML}/api/v1/compliance/sar/tenant/${getTenantId()}`, { params }).then((r) => r.data),

  getSubmissionById: (id: string) =>
    apiClient.get<GoAMLSubmission>(`${APISIX.GOAML}/api/v1/compliance/sar/${id}`).then((r) => r.data),

  createSubmission: (body: Partial<GoAMLSubmission>) =>
    apiClient.post<GoAMLSubmission>(`${APISIX.GOAML}/api/v1/compliance/sar/file`, body).then((r) => r.data),

  submit: (id: string) =>
    apiClient.post(`${APISIX.GOAML}/api/v1/compliance/sar/${id}/submit`, {}).then((r) => r.data),

  getStatus: (id: string) =>
    apiClient.get(`${APISIX.GOAML}/api/v1/compliance/sar/${id}`).then((r) => r.data),
};

// ─── SAR Filing ───────────────────────────────────────────────────────────────
export interface SARFiling {
  id: string;
  sarRef: string;
  caseId: string;
  customerId: string;
  activityType: string;
  amount: number;
  currency: string;
  filingOfficer: string;
  status: "draft" | "pending_approval" | "approved" | "filed" | "rejected";
  filedAt?: string;
  nfiuRef?: string;
}

export const sarFilingApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SARFiling[]; total: number }>(`${APISIX.SAR_FILING}/v1/sar-filing-engine/list`, { params }).then((r) => r.data),

  getById: (_id: string) =>
    apiClient.get<SARFiling>(`${APISIX.SAR_FILING}/v1/sar-filing-engine/list`).then((r) => r.data),

  create: (body: Partial<SARFiling>) =>
    apiClient.post<SARFiling>(`${APISIX.SAR_FILING}/v1/sar-filing-engine/create`, body).then((r) => r.data),

  submit: (_id: string) =>
    apiClient.post(`${APISIX.SAR_FILING}/v1/sar-filing-engine/create`, {}).then((r) => r.data),

  approve: (_id: string, notes?: string) =>
    apiClient.post(`${APISIX.SAR_FILING}/v1/sar-filing-engine/create`, { notes }).then((r) => r.data),
};

// ─── CTR / STR Filing ─────────────────────────────────────────────────────────
export interface CTRFiling {
  id: string;
  reportRef: string;
  reportType: "CTR" | "STR";
  customerId: string;
  transactionRef: string;
  amount: number;
  currency: string;
  status: "pending" | "filed" | "rejected";
  filedAt?: string;
  nfiuRef?: string;
}

export const ctrStrFilingApi = {
  list: (params?: { page?: number; limit?: number; reportType?: string; status?: string }) =>
    apiClient.get<{ items: CTRFiling[]; total: number }>(`${APISIX.NFIU_CTR_STR}/api/ctrs`, { params }).then((r) => r.data),

  getById: (_id: string) =>
    apiClient.get<CTRFiling>(`${APISIX.NFIU_CTR_STR}/api/ctrs`).then((r) => r.data),

  submit: (body: Partial<CTRFiling>) =>
    apiClient.post<CTRFiling>(`${APISIX.NFIU_CTR_STR}/api/ctrs`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.NFIU_CTR_STR}/api/dashboard`).then((r) => r.data),
};

// ─── KYC AML Screening ────────────────────────────────────────────────────────
export interface KYCAMLScreeningResult {
  customerId: string;
  screeningRef: string;
  pepMatch: boolean;
  sanctionsMatch: boolean;
  adverseMediaMatch: boolean;
  riskScore: number;
  status: "clear" | "match" | "potential_match" | "review_required";
  matchDetails: { source: string; matchType: string; confidence: number; details: string }[];
  screenedAt: string;
}

export const kycAmlScreeningApi = {
  screen: (body: { customerId: string; force?: boolean }) =>
    apiClient.post<KYCAMLScreeningResult>(`${APISIX.KYC_AML}/v1/screen`, body).then((r) => r.data),

  getByCustomer: (customerId: string) =>
    apiClient.get<KYCAMLScreeningResult>(`${APISIX.KYC_AML}/v1/results/${customerId}`).then((r) => r.data),

  listResults: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: KYCAMLScreeningResult[]; total: number }>(`${APISIX.KYC_AML}/v1/results`, { params }).then((r) => r.data),

  runBatch: (customerIds: string[]) =>
    apiClient.post(`${APISIX.KYC_AML}/v1/batch/screen`, { customerIds }).then((r) => r.data),
};
