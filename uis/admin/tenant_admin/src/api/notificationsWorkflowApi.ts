/**
 * Notifications, Workflow & Documents API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────┬──────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                │ Backend Service              │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────┼──────────────────────────────┼───────┤
 * │ /notification-center             │ /notification                │ notification-service-go      │ 9302  │
 * │ /notification-preferences        │ /notification                │ notification-service-go      │ 9302  │
 * │ /webhook-engine                  │ /webhooks                    │ webhook-engine-go            │ 8238  │
 * │ /webhook-deliveries              │ /webhooks                    │ webhook-engine-go            │ 8238  │
 * │ /webhook-subscriptions           │ /webhooks                    │ webhook-engine-go            │ 8238  │
 * │ /sms-alert-notification          │ /sms-alert-notification      │ sms-alert-notification-py    │ 9321  │
 * │ /approval-workflow               │ /approval-workflow           │ approval-workflow-go         │ 9213  │
 * │ /workflow-engine                 │ /workflows                   │ workflow-engine-py           │ 8123  │
 * │ /workflow-definitions            │ /workflows                   │ workflow-engine-py           │ 8123  │
 * │ /workflow-instances              │ /workflows                   │ workflow-engine-py           │ 8123  │
 * │ /maker-checker                   │ /approvals                   │ maker-checker-go             │ 8210  │
 * │ /document-management             │ /document-management         │ document-management-py       │ 8152  │
 * └──────────────────────────────────┴──────────────────────────────┴──────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Notification Service ─────────────────────────────────────────────────────
export interface Notification {
  id: string;
  notificationRef: string;
  customerId?: string;
  recipientType: "customer" | "staff" | "all";
  channel: "email" | "sms" | "push" | "in_app";
  title: string;
  body: string;
  category: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface NotificationPreference {
  customerId: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  categories: Record<string, boolean>;
  updatedAt: string;
}

export const notificationApi = {
  list: (params?: { page?: number; limit?: number; channel?: string; category?: string; status?: string; customerId?: string }) =>
    apiClient.get<{ items: Notification[]; total: number }>(`${APISIX.NOTIFICATION}/api/v1/notifications`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Notification>(`${APISIX.NOTIFICATION}/api/v1/notifications/${id}`).then((r) => r.data),

  send: (body: Partial<Notification>) =>
    apiClient.post<Notification>(`${APISIX.NOTIFICATION}/api/v1/notifications`, body).then((r) => r.data),

  sendBroadcast: (body: { recipientType: string; channel: string; title: string; body: string; category: string }) =>
    apiClient.post(`${APISIX.NOTIFICATION}/api/v1/notifications`, body).then((r) => r.data),

  getPreferences: (customerId: string) =>
    apiClient.get<NotificationPreference>(`${APISIX.NOTIFICATION}/api/v1/notifications/${customerId}`).then((r) => r.data),

  updatePreferences: (customerId: string, body: Partial<NotificationPreference>) =>
    apiClient.put(`${APISIX.NOTIFICATION}/api/v1/notifications/${customerId}`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.NOTIFICATION}/api/v1/tickets`).then((r) => r.data),
};

// ─── SMS Alert Notification ───────────────────────────────────────────────────
export interface SMSAlert {
  id: string;
  alertRef: string;
  msisdn: string;
  customerId?: string;
  message: string;
  alertType: string;
  status: "sent" | "delivered" | "failed";
  providerRef?: string;
  sentAt: string;
}

export const smsAlertApi = {
  list: (params?: { page?: number; limit?: number; alertType?: string; status?: string; customerId?: string }) =>
    apiClient.get<{ items: SMSAlert[]; total: number }>(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/alerts`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<SMSAlert>(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/alerts/${id}`).then((r) => r.data),

  send: (body: { msisdn: string; message: string; alertType: string; customerId?: string }) =>
    apiClient.post<SMSAlert>(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/alerts`, body).then((r) => r.data),

  getDeliveryStats: () =>
    apiClient.get(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/stats`).then((r) => r.data),

  getProviderConfig: () =>
    apiClient.get(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/config`).then((r) => r.data),

  updateProviderConfig: (body: { provider: string; apiKey?: string; senderId?: string }) =>
    apiClient.put(`${APISIX.SMS_ALERT_NOTIFICATION}/api/v1/config`, body).then((r) => r.data),
};

// ─── Webhook Engine ───────────────────────────────────────────────────────────
export interface WebhookSubscription {
  id: string;
  subscriptionRef: string;
  tenantId: string;
  url: string;
  events: string[];
  secret?: string;
  status: "active" | "inactive" | "suspended";
  failureCount: number;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  status: "pending" | "success" | "failed" | "retrying";
  attempts: number;
  sentAt: string;
  deliveredAt?: string;
}

export const webhookEngineApi = {
  listSubscriptions: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: WebhookSubscription[]; total: number }>(`${APISIX.WEBHOOKS}/api/v1/subscriptions`, { params }).then((r) => r.data),

  getSubscriptionById: (id: string) =>
    apiClient.get<WebhookSubscription>(`${APISIX.WEBHOOKS}/api/v1/subscriptions/${id}`).then((r) => r.data),

  createSubscription: (body: Partial<WebhookSubscription>) =>
    apiClient.post<WebhookSubscription>(`${APISIX.WEBHOOKS}/api/v1/subscriptions`, body).then((r) => r.data),

  updateSubscription: (id: string, body: Partial<WebhookSubscription>) =>
    apiClient.put(`${APISIX.WEBHOOKS}/api/v1/subscriptions/${id}`, body).then((r) => r.data),

  deleteSubscription: (id: string) =>
    apiClient.delete(`${APISIX.WEBHOOKS}/api/v1/subscriptions/${id}`).then((r) => r.data),

  listDeliveries: (params?: { page?: number; limit?: number; subscriptionId?: string; status?: string; event?: string }) =>
    apiClient.get<{ items: WebhookDelivery[]; total: number }>(`${APISIX.WEBHOOKS}/api/v1/deliveries`, { params }).then((r) => r.data),

  getDeliveryById: (id: string) =>
    apiClient.get<WebhookDelivery>(`${APISIX.WEBHOOKS}/api/v1/deliveries/${id}`).then((r) => r.data),

  retryDelivery: (id: string) =>
    apiClient.post(`${APISIX.WEBHOOKS}/api/v1/deliveries/${id}/retry`, {}).then((r) => r.data),

  getAvailableEvents: () =>
    apiClient.get(`${APISIX.WEBHOOKS}/api/v1/events`).then((r) => r.data),
};

// ─── Approval Workflow ────────────────────────────────────────────────────────
export interface ApprovalRequest {
  id: string;
  requestRef: string;
  workflowType: string;
  initiatorId: string;
  initiatorName: string;
  entityType: string;
  entityId: string;
  currentLevel: number;
  totalLevels: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvers: { level: number; approverId: string; approverName: string; status: string; actionAt?: string; comments?: string }[];
  submittedAt: string;
  completedAt?: string;
  payload: Record<string, unknown>;
}

export const approvalWorkflowApi = {
  list: (params?: { page?: number; limit?: number; workflowType?: string; status?: string; initiatorId?: string }) =>
    apiClient.get<{ items: ApprovalRequest[]; total: number }>(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ApprovalRequest>(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals/${id}`).then((r) => r.data),

  approve: (id: string, body: { comments?: string }) =>
    apiClient.post(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals/${id}/approve`, body).then((r) => r.data),

  reject: (id: string, body: { reason: string }) =>
    apiClient.post(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals/${id}/reject`, body).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    apiClient.post(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals/${id}/cancel`, { reason }).then((r) => r.data),

  getPendingForApprover: (approverId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.APPROVAL_WORKFLOW}/v1/approvals`, { params: { ...params, checkerId: approverId } }).then((r) => r.data),
};

// ─── Workflow Engine ──────────────────────────────────────────────────────────
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  trigger: string;
  steps: { id: string; name: string; type: string; config: Record<string, unknown> }[];
  status: "active" | "inactive" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstance {
  id: string;
  instanceRef: string;
  definitionId: string;
  definitionName: string;
  currentStep: string;
  status: "running" | "completed" | "failed" | "suspended" | "cancelled";
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

export const workflowEngineApi = {
  listDefinitions: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: WorkflowDefinition[]; total: number }>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows/templates`, { params }).then((r) => r.data),

  getDefinitionById: (id: string) =>
    apiClient.get<WorkflowDefinition>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows/${id}`).then((r) => r.data),

  createDefinition: (body: Partial<WorkflowDefinition>) =>
    apiClient.post<WorkflowDefinition>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows`, body).then((r) => r.data),

  updateDefinition: (id: string, body: Partial<WorkflowDefinition>) =>
    apiClient.post(`${APISIX.WORKFLOW_ENGINE}/v1/workflows/${id}/advance`, body).then((r) => r.data),

  listInstances: (params?: { page?: number; limit?: number; definitionId?: string; status?: string }) =>
    apiClient.get<{ items: WorkflowInstance[]; total: number }>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows`, { params }).then((r) => r.data),

  getInstanceById: (id: string) =>
    apiClient.get<WorkflowInstance>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows/${id}`).then((r) => r.data),

  triggerWorkflow: (definitionId: string, context: Record<string, unknown>) =>
    apiClient.post<WorkflowInstance>(`${APISIX.WORKFLOW_ENGINE}/v1/workflows`, { definitionId, context }).then((r) => r.data),

  cancelInstance: (id: string, reason: string) =>
    apiClient.post(`${APISIX.WORKFLOW_ENGINE}/v1/workflows/${id}/cancel`, { reason }).then((r) => r.data),
};

// ─── Maker-Checker ────────────────────────────────────────────────────────────
export interface MakerCheckerEntry {
  id: string;
  entryRef: string;
  operationType: string;
  module: string;
  entityType: string;
  entityId?: string;
  makerId: string;
  makerName: string;
  checkerId?: string;
  checkerName?: string;
  status: "pending" | "approved" | "rejected" | "expired";
  payload: Record<string, unknown>;
  checkerComments?: string;
  createdAt: string;
  reviewedAt?: string;
}

export const makerCheckerApi = {
  list: (params?: { page?: number; limit?: number; module?: string; status?: string; makerId?: string }) =>
    apiClient.get<{ items: MakerCheckerEntry[]; total: number }>(`${APISIX.MAKER_CHECKER}/v1/approvals`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<MakerCheckerEntry>(`${APISIX.MAKER_CHECKER}/v1/approvals/${id}`).then((r) => r.data),

  approve: (id: string, comments?: string) =>
    apiClient.post(`${APISIX.MAKER_CHECKER}/v1/approvals/${id}/approve`, { comments }).then((r) => r.data),

  reject: (id: string, comments: string) =>
    apiClient.post(`${APISIX.MAKER_CHECKER}/v1/approvals/${id}/reject`, { comments }).then((r) => r.data),

  getPendingCount: () =>
    apiClient.get(`${APISIX.MAKER_CHECKER}/v1/stats`).then((r) => r.data),
};

// ─── Document Management ──────────────────────────────────────────────────────
export interface Document {
  id: string;
  documentRef: string;
  entityType: string;
  entityId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  tags?: string[];
  status: "active" | "archived" | "deleted";
  expiryDate?: string;
  uploadedAt: string;
  downloadUrl?: string;
}

export const documentMgmtApi = {
  list: (params?: { page?: number; limit?: number; entityType?: string; entityId?: string; documentType?: string }) =>
    apiClient.get<{ items: Document[]; total: number }>(`${APISIX.DOCUMENT_MANAGEMENT}/upload`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Document>(`${APISIX.DOCUMENT_MANAGEMENT}/upload`).then((r) => r.data),

  upload: (body: FormData) =>
    apiClient.post<Document>(`${APISIX.DOCUMENT_MANAGEMENT}/upload`, body, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),

  download: (id: string) =>
    apiClient.get(`${APISIX.DOCUMENT_MANAGEMENT}/upload`, { responseType: "blob" }).then((r) => r.data),

  delete: (id: string, reason: string) =>
    apiClient.delete(`${APISIX.DOCUMENT_MANAGEMENT}/upload`, { data: { id, reason } }).then((r) => r.data),

  getByEntity: (entityType: string, entityId: string) =>
    apiClient.get<{ items: Document[] }>(`${APISIX.DOCUMENT_MANAGEMENT}/upload`, { params: { entityType, entityId } }).then((r) => r.data),
};
