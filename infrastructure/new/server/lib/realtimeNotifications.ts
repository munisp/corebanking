/**
 * Real-Time Notifications Engine — WebSocket push + multi-channel delivery.
 * SMS, email, push notifications, in-app alerts, and USSD callbacks
 * with delivery tracking, templates, and preference management.
 *
 * W12-C3-P2-MLIB (c3-0998): the notification delivery log was module process
 * memory (a restart erased the delivery audit trail). Now
 * Postgres-authoritative (table `notification_log`) via lib/pgJsonStore.ts;
 * fail-closed 503 on PG outage, no degraded-memory fallback.
 * (TEMPLATES/WS_CONNECTIONS are out of this batch's scope — WS connections
 *  are inherently per-process runtime state, not business data.)
 */
import type { Express, Request, Response } from "express";
import { ensureTables, storeDDL, storeInsert, storeList, storeSeed } from "./pgJsonStore";
import { asyncRoute, pgGuard } from "./pgSupport";

const LOG_TABLE = "notification_log";

async function ensureNotificationStores(): Promise<void> {
  await ensureTables("realtimeNotifications", storeDDL(LOG_TABLE));
  await storeSeed(LOG_TABLE, NOTIFICATION_LOG_SEED, (n) => n.tenantId ?? "");
}

async function loadNotificationLog(): Promise<NotificationLog[]> {
  await ensureNotificationStores(); return storeList<NotificationLog>(LOG_TABLE);
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables: string[];
  language: string;
  status: "active" | "draft";
}

interface NotificationLog {
  id: string;
  tenantId: string;
  recipientId: string;
  channel: "sms" | "email" | "push" | "in_app" | "ussd" | "whatsapp";
  template: string;
  subject?: string;
  body: string;
  status: "delivered" | "pending" | "failed" | "read";
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  metadata: Record<string, unknown>;
}

interface WebSocketConnection {
  connectionId: string;
  userId: string;
  tenantId: string;
  connectedAt: string;
  lastPingAt: string;
  subscriptions: string[];
  status: "active" | "idle" | "disconnected";
}

const TEMPLATES: NotificationTemplate[] = [
  { id: "TPL-001", name: "Transfer Credit Alert", channel: "sms", body: "54Bank: ₦{{amount}} credit to {{accountNumber}} from {{sender}}. Bal: ₦{{balance}}. Ref: {{reference}}. {{timestamp}}", variables: ["amount", "accountNumber", "sender", "balance", "reference", "timestamp"], language: "en", status: "active" },
  { id: "TPL-002", name: "Transfer Debit Alert", channel: "sms", body: "54Bank: ₦{{amount}} debit from {{accountNumber}} to {{recipient}}. Bal: ₦{{balance}}. Ref: {{reference}}. {{timestamp}}", variables: ["amount", "accountNumber", "recipient", "balance", "reference", "timestamp"], language: "en", status: "active" },
  { id: "TPL-003", name: "OTP Verification", channel: "sms", body: "54Bank: Your OTP is {{otp}}. Valid for {{expiry}} minutes. Do not share this code.", variables: ["otp", "expiry"], language: "en", status: "active" },
  { id: "TPL-004", name: "Loan Disbursement", channel: "email", subject: "Loan Disbursed — {{loanId}}", body: "Dear {{customerName}}, your loan of ₦{{amount}} has been disbursed to account {{accountNumber}}. Repayment starts {{firstRepaymentDate}}.", variables: ["customerName", "amount", "accountNumber", "loanId", "firstRepaymentDate"], language: "en", status: "active" },
  { id: "TPL-005", name: "Fraud Alert", channel: "push", body: "🚨 Suspicious transaction detected on your account. ₦{{amount}} attempted at {{merchant}}. Tap to review.", variables: ["amount", "merchant"], language: "en", status: "active" },
  { id: "TPL-006", name: "KYC Approved", channel: "in_app", body: "Your identity verification is complete. You now have full access to all banking services.", variables: [], language: "en", status: "active" },
  { id: "TPL-007", name: "Card PIN Change", channel: "sms", body: "54Bank: Your card PIN has been changed successfully. If you did not make this change, call 0800-54BANK immediately.", variables: [], language: "en", status: "active" },
  { id: "TPL-008", name: "Maker-Checker Approval", channel: "in_app", body: "Pending approval: {{actionType}} — ₦{{amount}} by {{initiator}}. Tap to review and approve/reject.", variables: ["actionType", "amount", "initiator"], language: "en", status: "active" },
  { id: "TPL-009", name: "USSD Transaction Confirm", channel: "ussd", body: "54Bank: Transfer of N{{amount}} to {{recipient}} successful. Ref: {{reference}}", variables: ["amount", "recipient", "reference"], language: "en", status: "active" },
  { id: "TPL-010", name: "WhatsApp Statement", channel: "whatsapp", body: "Hi {{customerName}}, your account statement for {{period}} is ready. Reply STMT to receive it.", variables: ["customerName", "period"], language: "en", status: "active" },
];

// Seed rows (same data the in-memory build shipped; Postgres owns it after first seed).
const NOTIFICATION_LOG_SEED: NotificationLog[] = [
  { id: "NTF-001", tenantId: "TEN-GTBANK", recipientId: "USR-GT-001", channel: "sms", template: "TPL-001", body: "54Bank: ₦5,000,000 credit to 0012345678 from BUA Group. Bal: ₦8,500,000. Ref: TXN-2026050901. 09 May 2026 10:30", status: "delivered", sentAt: "2026-05-09T10:30:05Z", deliveredAt: "2026-05-09T10:30:08Z", metadata: { provider: "Termii", cost: 4.0 } },
  { id: "NTF-002", tenantId: "TEN-GTBANK", recipientId: "USR-GT-001", channel: "push", template: "TPL-001", body: "₦5,000,000 credited to your account", status: "read", sentAt: "2026-05-09T10:30:05Z", deliveredAt: "2026-05-09T10:30:06Z", readAt: "2026-05-09T10:31:00Z", metadata: { provider: "FCM", platform: "android" } },
  { id: "NTF-003", tenantId: "TEN-FIRSTBANK", recipientId: "USR-FB-001", channel: "email", template: "TPL-004", subject: "Loan Disbursed — PLN-2026-0045", body: "Dear Adewale Johnson, your loan of ₦2,500,000 has been disbursed...", status: "delivered", sentAt: "2026-05-09T11:00:10Z", deliveredAt: "2026-05-09T11:00:15Z", metadata: { provider: "SendGrid", emailId: "msg-abc123" } },
  { id: "NTF-004", tenantId: "TEN-WEMA", recipientId: "USR-WEMA-001", channel: "sms", template: "TPL-003", body: "54Bank: Your OTP is 847291. Valid for 5 minutes. Do not share this code.", status: "delivered", sentAt: "2026-05-09T12:15:00Z", deliveredAt: "2026-05-09T12:15:02Z", metadata: { provider: "Termii", cost: 4.0 } },
  { id: "NTF-005", tenantId: "TEN-ACCESS", recipientId: "USR-ACC-001", channel: "push", template: "TPL-005", body: "🚨 Suspicious transaction detected. ₦450,000 attempted at unknown merchant. Tap to review.", status: "delivered", sentAt: "2026-05-09T14:30:00Z", deliveredAt: "2026-05-09T14:30:01Z", metadata: { provider: "FCM", priority: "high" } },
  { id: "NTF-006", tenantId: "TEN-MUTUAL-MFB", recipientId: "USR-MFB-001", channel: "ussd", template: "TPL-009", body: "54Bank: Transfer of N15,000 to Amina Yusuf successful. Ref: TXN-MFB-001", status: "delivered", sentAt: "2026-05-09T08:00:30Z", deliveredAt: "2026-05-09T08:00:32Z", metadata: { provider: "USSD-Gateway", sessionId: "USSD-89012" } },
];

const WS_CONNECTIONS: WebSocketConnection[] = [
  { connectionId: "WS-001", userId: "USR-ADMIN-01", tenantId: "TEN-PLATFORM-ADMIN", connectedAt: "2026-05-09T06:00:00Z", lastPingAt: "2026-05-09T15:29:55Z", subscriptions: ["transactions.*", "alerts.*", "system.*"], status: "active" },
  { connectionId: "WS-002", userId: "USR-GT-OP01", tenantId: "TEN-GTBANK", connectedAt: "2026-05-09T07:30:00Z", lastPingAt: "2026-05-09T15:29:50Z", subscriptions: ["transactions.TEN-GTBANK", "alerts.TEN-GTBANK", "approvals.TEN-GTBANK"], status: "active" },
  { connectionId: "WS-003", userId: "USR-FB-AUD", tenantId: "TEN-FIRSTBANK", connectedAt: "2026-05-09T08:00:00Z", lastPingAt: "2026-05-09T15:29:45Z", subscriptions: ["audit.TEN-FIRSTBANK"], status: "active" },
  { connectionId: "WS-004", userId: "USR-WEMA-CS", tenantId: "TEN-WEMA", connectedAt: "2026-05-09T09:15:00Z", lastPingAt: "2026-05-09T14:50:00Z", subscriptions: ["transactions.TEN-WEMA"], status: "idle" },
];

export function registerRealtimeNotifications(app: Express) {
  app.get("/api/notifications/v1/templates", (_req: Request, res: Response) => {
    res.json({ items: TEMPLATES, total: TEMPLATES.length });
  });
  app.get("/api/notifications/v1/log", asyncRoute(async (req: Request, res: Response) => {
    const channel = req.query.channel as string;
    const log = await pgGuard(loadNotificationLog());
    const filtered = channel ? log.filter((n) => n.channel === channel) : log;
    res.json({ items: filtered, total: filtered.length });
  }));
  app.post("/api/notifications/v1/send", asyncRoute(async (req: Request, res: Response) => {
    const { channel, recipientId, templateId, variables } = req.body ?? {};
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    const log = await pgGuard(loadNotificationLog());
    const tenantId = (req.headers["x-tenant-id"] as string) ?? "TEN-PLATFORM-ADMIN";
    const entry: NotificationLog = {
      id: `NTF-${String(log.length + 1).padStart(3, "0")}`,
      tenantId,
      recipientId: recipientId ?? "USR-001",
      channel: channel ?? "in_app",
      template: templateId ?? "TPL-006",
      body: tpl?.body ?? "Notification sent",
      status: "delivered",
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      metadata: { variables },
    };
    await pgGuard(storeInsert(LOG_TABLE, tenantId, entry));
    res.status(201).json(entry);
  }));
  app.get("/api/notifications/v1/websockets", (_req: Request, res: Response) => {
    res.json({ items: WS_CONNECTIONS, total: WS_CONNECTIONS.length, active: WS_CONNECTIONS.filter((w) => w.status === "active").length });
  });
  app.get("/api/notifications/v1/stats", asyncRoute(async (_req: Request, res: Response) => {
    const log = await pgGuard(loadNotificationLog());
    res.json({
      totalSent: log.length, delivered: log.filter((n) => n.status === "delivered" || n.status === "read").length,
      read: log.filter((n) => n.status === "read").length, failed: log.filter((n) => n.status === "failed").length,
      deliveryRate: 100, channels: { sms: 3, email: 1, push: 2, in_app: 0, ussd: 1, whatsapp: 0 },
      websocketConnections: WS_CONNECTIONS.length, activeConnections: WS_CONNECTIONS.filter((w) => w.status === "active").length,
      templates: TEMPLATES.length, avgDeliveryTimeMs: 3200,
    });
  }));
}
