/**
 * Compliance, Audit & Monitoring API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────┬──────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix            │ Backend Service              │ Port  │
 * ├──────────────────────────────────┼──────────────────────────┼──────────────────────────────┼───────┤
 * │ /dispute                         │ /dispute                 │ dispute-service              │ 80    │
 * │ /dispute-management              │ /dispute-management      │ dispute-management-py        │ 9255  │
 * │ /audit-logs                      │ /audit                   │ audit-service                │ 80    │
 * │ /audit-trail                     │ /audit                   │ audit-service                │ 80    │
 * │ /admin/temporal-access           │ /temporal-access         │ temporal-access-service      │ 80    │
 * │ /my-access                       │ /auth-enforcer           │ auth-enforcer-rs             │ 8314  │
 * │ /monitoring                      │ /ops-dashboard           │ ops-dashboard                │ 8090  │
 * │ /usage-analytics                 │ /analytics-engine        │ analytics-engine-py          │ 9208  │
 * └──────────────────────────────────┴──────────────────────────┴──────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Dispute Service ──────────────────────────────────────────────────────────
export interface Dispute {
  id: string;
  disputeRef: string;
  customerId: string;
  customerName: string;
  transactionRef?: string;
  type: "unauthorized_transaction" | "failed_debit" | "wrong_credit" | "service_failure" | "other";
  amount?: number;
  currency?: string;
  channel?: string;
  status: "open" | "investigating" | "resolved" | "closed" | "escalated";
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  description: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DisputeStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  avgResolutionDays: number;
  totalAmountInDispute: number;
}

export const disputeApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string; priority?: string; customerId?: string }) =>
    apiClient.get<{ items: Dispute[]; total: number }>(`${APISIX.DISPUTE}/api/v1/disputes`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Dispute>(`${APISIX.DISPUTE}/api/v1/disputes/${id}`).then((r) => r.data),

  create: (body: Partial<Dispute>) =>
    apiClient.post<Dispute>(`${APISIX.DISPUTE}/api/v1/disputes`, body).then((r) => r.data),

  assign: (id: string, assignedTo: string) =>
    apiClient.post(`${APISIX.DISPUTE}/api/v1/administration/disputes/${id}/resolve`, { assignedTo }).then((r) => r.data),

  resolve: (id: string, body: { resolution: string; outcome: string }) =>
    apiClient.post(`${APISIX.DISPUTE}/api/v1/administration/disputes/${id}/resolve`, body).then((r) => r.data),

  escalate: (id: string, body: { reason: string; escalateTo: string }) =>
    apiClient.post(`${APISIX.DISPUTE}/api/v1/disputes/${id}`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get<DisputeStats>(`${APISIX.DISPUTE}/api/v1/disputes`).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${APISIX.DISPUTE}/api/v1/disputes/${id}`, { note }).then((r) => r.data),
};

// ─── Dispute Management ───────────────────────────────────────────────────────
export const disputeMgmtApi = {
  getWorkQueue: (params?: { page?: number; limit?: number; assignedTo?: string; priority?: string }) =>
    apiClient.get(`${APISIX.DISPUTE_MANAGEMENT}/api/v1/disputes`, { params }).then((r) => r.data),

  getSLAReport: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.DISPUTE_MANAGEMENT}/api/v1/disputes/tenant`, { params }).then((r) => r.data),

  getDisputeCategories: () =>
    apiClient.get(`${APISIX.DISPUTE_MANAGEMENT}/api/v1/disputes`).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.DISPUTE_MANAGEMENT}/api/v1/disputes`).then((r) => r.data),
};

// ─── Audit Service ────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  eventRef: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  status: "success" | "failure";
  timestamp: string;
}

export const auditApi = {
  listLogs: (params?: { page?: number; limit?: number; actorId?: string; module?: string; action?: string; entityType?: string; from?: string; to?: string }) =>
    apiClient.get<{ items: AuditLog[]; total: number }>(`${APISIX.AUDIT}/audits`, { params }).then((r) => r.data),

  getLogById: (_id: string) =>
    apiClient.get<AuditLog>(`${APISIX.AUDIT}/audits`).then((r) => r.data),

  exportLogs: (params: { from: string; to: string; module?: string; format?: "csv" | "json" }) =>
    apiClient.get(`${APISIX.AUDIT}/audits`, { params, responseType: "blob" }).then((r) => r.data),

  getActivitySummary: (params?: { actorId?: string; from?: string; to?: string }) =>
    apiClient.get(`${APISIX.AUDIT}/audits`, { params }).then((r) => r.data),

  getModuleActivity: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.AUDIT}/audits`, { params }).then((r) => r.data),
};

// ─── Temporal Access Service ──────────────────────────────────────────────────
export interface TemporalAccessGrant {
  id: string;
  grantRef: string;
  userId: string;
  userName: string;
  grantedBy: string;
  permissions: string[];
  reason: string;
  validFrom: string;
  validUntil: string;
  status: "active" | "expired" | "revoked";
  revokedAt?: string;
  revokedBy?: string;
}

export const temporalAccessApi = {
  listGrants: (params?: { page?: number; limit?: number; userId?: string; status?: string }) =>
    apiClient.get<{ items: TemporalAccessGrant[]; total: number }>(`${APISIX.TEMPORAL_ACCESS}/api/v1/grants`, { params }).then((r) => r.data),

  getGrantById: (id: string) =>
    apiClient.get<TemporalAccessGrant>(`${APISIX.TEMPORAL_ACCESS}/api/v1/grants`).then((r) => r.data),

  createGrant: (body: Partial<TemporalAccessGrant>) =>
    apiClient.post<TemporalAccessGrant>(`${APISIX.TEMPORAL_ACCESS}/api/v1/grants`, body).then((r) => r.data),

  revokeGrant: (id: string, reason: string) =>
    apiClient.post(`${APISIX.TEMPORAL_ACCESS}/api/v1/grants`, { reason }).then((r) => r.data),

  checkAccess: (userId: string, permission: string) =>
    apiClient.post(`${APISIX.TEMPORAL_ACCESS}/api/v1/check`, { userId, permission }).then((r) => r.data),
};

// ─── Auth Enforcer (My Access / Permissions) ──────────────────────────────────
export interface AccessPolicy {
  userId: string;
  roles: string[];
  permissions: string[];
  featureFlags: Record<string, boolean>;
  temporalGrants: string[];
  evaluatedAt: string;
}

export const authEnforcerApi = {
  getMyAccess: () =>
    apiClient.get<AccessPolicy>(`${APISIX.AUTH_ENFORCER}/v1/authz/check`).then((r) => r.data),

  checkPermission: (permission: string) =>
    apiClient.post(`${APISIX.AUTH_ENFORCER}/v1/authz/check`, { permission }).then((r) => r.data),

  listAccessPolicies: (params?: { page?: number; limit?: number; roleId?: string }) =>
    apiClient.get(`${APISIX.AUTH_ENFORCER}/v1/authz/policies`, { params }).then((r) => r.data),
};

// ─── Ops Dashboard / Monitoring ───────────────────────────────────────────────
export interface SystemHealthStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency_ms?: number;
  error_rate?: number;
  last_check: string;
}

export interface MonitoringAlert {
  name: string;
  severity: "info" | "warning" | "critical";
  message: string;
  service: string;
  started_at: string;
  labels?: Record<string, string>;
}

export const monitoringApi = {
  getSystemHealth: () =>
    apiClient.get<{ services: SystemHealthStatus[]; total: number }>(`${APISIX.OPS_DASHBOARD}/api/v1/ops/services/health`).then((r) => r.data),

  listAlerts: (params?: { page?: number; limit?: number; severity?: string; status?: string; service?: string }) =>
    apiClient.get<{ alerts: MonitoringAlert[]; total: number }>(`${APISIX.OPS_DASHBOARD}/api/v1/ops/alerts`, { params }).then((r) => r.data),

  acknowledgeAlert: (name: string) =>
    apiClient.post(`${APISIX.OPS_DASHBOARD}/api/v1/ops/alerts/${name}/acknowledge`, {}).then((r) => r.data),

  resolveAlert: (name: string, resolution: string) =>
    apiClient.post(`${APISIX.OPS_DASHBOARD}/api/v1/ops/alerts/${name}/resolve`, { resolution }).then((r) => r.data),

  getMetrics: (params?: { service?: string; from?: string; to?: string }) =>
    apiClient.get(`${APISIX.OPS_DASHBOARD}/api/v1/ops/metrics`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.OPS_DASHBOARD}/api/v1/ops/services/health`).then((r) => r.data),
};

// ─── Analytics Engine ─────────────────────────────────────────────────────────
export interface AnalyticsReport {
  id: string;
  reportType: string;
  period: { from: string; to: string };
  data: Record<string, unknown>;
  generatedAt: string;
}

export const analyticsEngineApi = {
  getUsageAnalytics: (params?: { from?: string; to?: string; module?: string }) =>
    apiClient.get(`${APISIX.ANALYTICS_ENGINE}/v1/usage`, { params }).then((r) => r.data),

  getTransactionAnalytics: (params?: { from?: string; to?: string; channel?: string }) =>
    apiClient.get(`${APISIX.ANALYTICS_ENGINE}/v1/transactions`, { params }).then((r) => r.data),

  getCustomerAnalytics: (params?: { from?: string; to?: string; segment?: string }) =>
    apiClient.get(`${APISIX.ANALYTICS_ENGINE}/v1/customers`, { params }).then((r) => r.data),

  generateReport: (body: { reportType: string; from: string; to: string; filters?: Record<string, unknown> }) =>
    apiClient.post<AnalyticsReport>(`${APISIX.ANALYTICS_ENGINE}/v1/reports`, body).then((r) => r.data),

  getReportById: (id: string) =>
    apiClient.get<AnalyticsReport>(`${APISIX.ANALYTICS_ENGINE}/v1/reports/${id}`).then((r) => r.data),

  listReports: (params?: { page?: number; limit?: number; reportType?: string }) =>
    apiClient.get<{ items: AnalyticsReport[]; total: number }>(`${APISIX.ANALYTICS_ENGINE}/v1/reports`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.ANALYTICS_ENGINE}/v1/dashboard`).then((r) => r.data),
};
