/**
 * G2: Webhook delivery engine for event-driven integrations.
 * Supports retry with exponential backoff, HMAC signing, delivery tracking,
 * and configurable event subscriptions.
 */

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  status: "active" | "paused" | "failed";
  retryPolicy: { maxRetries: number; backoffMs: number; backoffMultiplier: number };
  headers?: Record<string, string>;
  createdAt: string;
  lastDeliveryAt?: string;
  successCount: number;
  failureCount: number;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "retrying";
  httpStatus?: number;
  attempts: number;
  nextRetryAt?: string;
  createdAt: string;
  deliveredAt?: string;
  responseBody?: string;
  durationMs?: number;
}

const subscriptions: WebhookSubscription[] = [
  {
    id: "WH-001", name: "ERP Integration", url: "https://erp.54bank.io/webhooks/banking",
    events: ["transaction.completed", "transaction.failed", "account.created", "loan.disbursed"],
    secret: "whsec_*****", status: "active",
    retryPolicy: { maxRetries: 5, backoffMs: 1000, backoffMultiplier: 2 },
    createdAt: "2026-01-01T00:00:00Z", lastDeliveryAt: "2026-05-09T14:30:00Z",
    successCount: 45_230, failureCount: 12,
  },
  {
    id: "WH-002", name: "Fraud Monitoring", url: "https://fraud.54bank.io/api/events",
    events: ["transaction.completed", "transaction.failed", "login.suspicious", "card.blocked"],
    secret: "whsec_*****", status: "active",
    retryPolicy: { maxRetries: 3, backoffMs: 500, backoffMultiplier: 2 },
    createdAt: "2026-01-15T00:00:00Z", lastDeliveryAt: "2026-05-09T14:59:00Z",
    successCount: 128_450, failureCount: 3,
  },
  {
    id: "WH-003", name: "SMS Gateway", url: "https://sms.provider.ng/api/deliver",
    events: ["otp.generated", "transaction.completed", "loan.payment.due"],
    secret: "whsec_*****", status: "active",
    retryPolicy: { maxRetries: 3, backoffMs: 2000, backoffMultiplier: 3 },
    createdAt: "2026-02-01T00:00:00Z", lastDeliveryAt: "2026-05-09T14:55:00Z",
    successCount: 320_100, failureCount: 45,
  },
  {
    id: "WH-004", name: "CBN Regulatory Feed", url: "https://api.cbn.gov.ng/reports/receive",
    events: ["ctr.generated", "suspicious.activity.reported"],
    secret: "whsec_*****", status: "active",
    retryPolicy: { maxRetries: 10, backoffMs: 5000, backoffMultiplier: 2 },
    createdAt: "2026-03-01T00:00:00Z", lastDeliveryAt: "2026-05-09T00:05:00Z",
    successCount: 1_250, failureCount: 0,
  },
];

const deliveries: WebhookDelivery[] = [
  { id: "WD-001", subscriptionId: "WH-001", event: "transaction.completed", payload: { transactionId: "TXN-001", amount: 500000, currency: "NGN" }, status: "delivered", httpStatus: 200, attempts: 1, createdAt: "2026-05-09T14:30:00Z", deliveredAt: "2026-05-09T14:30:01Z", durationMs: 245 },
  { id: "WD-002", subscriptionId: "WH-002", event: "login.suspicious", payload: { userId: "CUST-099", ip: "154.120.x.x", country: "NG", device: "unknown" }, status: "delivered", httpStatus: 200, attempts: 1, createdAt: "2026-05-09T14:45:00Z", deliveredAt: "2026-05-09T14:45:00Z", durationMs: 120 },
  { id: "WD-003", subscriptionId: "WH-003", event: "otp.generated", payload: { userId: "CUST-001", channel: "sms", purpose: "transfer" }, status: "delivered", httpStatus: 202, attempts: 1, createdAt: "2026-05-09T14:50:00Z", deliveredAt: "2026-05-09T14:50:02Z", durationMs: 1800 },
  { id: "WD-004", subscriptionId: "WH-001", event: "loan.disbursed", payload: { loanId: "LA-001", amount: 5000000, customerId: "CUST-001" }, status: "failed", httpStatus: 503, attempts: 3, createdAt: "2026-05-09T10:00:00Z", nextRetryAt: "2026-05-09T10:08:00Z", responseBody: "Service Unavailable", durationMs: 5000 },
];

export const WEBHOOK_EVENTS = [
  "transaction.completed", "transaction.failed", "transaction.reversed",
  "account.created", "account.closed", "account.frozen",
  "loan.disbursed", "loan.payment.received", "loan.payment.due", "loan.npl.classified",
  "card.issued", "card.blocked", "card.activated",
  "otp.generated", "otp.verified",
  "login.successful", "login.failed", "login.suspicious",
  "ctr.generated", "suspicious.activity.reported",
  "kyc.approved", "kyc.rejected",
];

export function getWebhookSubscriptions() { return subscriptions; }
export function getWebhookDeliveries() { return deliveries; }
export function getWebhookEvents() { return WEBHOOK_EVENTS; }
