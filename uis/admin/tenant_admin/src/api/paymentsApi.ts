/**
 * Payments Hub API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────┬──────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                │ Backend Service              │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────┼──────────────────────────────┼───────┤
 * │ /payments-hub                    │ /payment-hub                 │ payment-hub                  │ 80    │
 * │ /bulk-payments                   │ /bulk-payments               │ bulk-payments-rs             │ 9229  │
 * │ /qr-payments                     │ /qr-payments                 │ qr-payments-go               │ 8500  │
 * │ /offline-transactions            │ /offline-resilience          │ offline-resilience-rs        │ 8253  │
 * │ /utility-payments                │ /utility-payments            │ utility-payments-go          │ 8031  │
 * │ /self-service-transactions       │ /payment-hub                 │ payment-hub                  │ 80    │
 * │ /payment-transactions            │ /payment-processing          │ payment-processing-service   │ 80    │
 * │ /payment-investigation           │ /payment-investigation       │ payment-investigation-go     │ 8080  │
 * │ /wire-transfer-monitor           │ /wire-transfer-monitor       │ wire-transfer-monitor-rs     │ 9325  │
 * │ /nibss-direct-debit              │ /nibss-direct-debit          │ nibss-direct-debit-go        │ 8281  │
 * │ /iso20022-hub                    │ /iso20022                    │ iso20022-hub-rs              │ 8901  │
 * │ /swift-messages                  │ /swift                       │ swift-messaging-go           │ 8248  │
 * │ /remittance                      │ /remittance                  │ remittance-go                │ 8080  │
 * │ /whatsapp-payment-integration    │ /whatsapp-payment-integration│ whatsapp-payment-integration │ 9030  │
 * └──────────────────────────────────┴──────────────────────────────┴──────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Transfer Initiation ─────────────────────────────────────────────────────
export interface TransferParty {
  idType: string;
  idValue: string;
  displayName: string;
}

export interface TransferPayload {
  amount: string;
  currency: string;
  destination: string;
  from: TransferParty;
  to: TransferParty;
  note: string;
  pin: string;
  switch_name: string;
}

export interface TransferResult {
  transferState?: string;
  transactionId?: string;
  [key: string]: unknown;
}

export const transferApi = {
  initiate: (body: TransferPayload) =>
    apiClient.post<TransferResult>(`${APISIX.PAYMENT_HUB}/api/v1/transfers/initiate`, body).then((r) => r.data),
};

// ─── Payments Hub ─────────────────────────────────────────────────────────────
export interface Payment {
  id: string;
  paymentType: string;
  sourceAccount: string;
  destAccount?: string;
  amount: number;
  fee: number;
  currency: string;
  channel: string;
  status: string;
  nipRef?: string;
  billerName?: string;
  narration: string;
  createdAt: string;
}

export interface PaymentStats {
  totalPayments: number;
  totalVolume: number;
  successRate: number;
  pending: number;
  failed: number;
}

export const paymentsHubApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string; from?: string; to?: string }) =>
    apiClient.get<{ items: Payment[]; total: number }>(`${APISIX.PAYMENT_HUB}/v1/payments`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Payment>(`${APISIX.PAYMENT_HUB}/v1/payments/${id}`).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get<PaymentStats>(`${APISIX.PAYMENT_HUB}/v1/payments/stats`, { params }).then((r) => r.data),

  reverse: (id: string, reason: string) =>
    apiClient.post(`${APISIX.PAYMENT_HUB}/v1/payments/${id}/reverse`, { reason }).then((r) => r.data),
};

// ─── Bulk Payments ────────────────────────────────────────────────────────────
export interface BulkPaymentItem {
  destAccount: string;
  destBankCode: string;
  amount: number;
  narration: string;
  beneficiaryName?: string;
}

export interface BulkPaymentBatch {
  id: string;
  batchRef: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export const bulkPaymentsApi = {
  createBatch: (body: { sourceAccount: string; currency: string; items: BulkPaymentItem[] }) =>
    apiClient.post<BulkPaymentBatch>(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments`, body).then((r) => r.data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: BulkPaymentBatch[]; total: number }>(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<BulkPaymentBatch>(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments/${id}`).then((r) => r.data),

  getItems: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments/${id}/items`, { params }).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments/${id}/approve`, {}).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    apiClient.post(`${APISIX.BULK_PAYMENTS}/v1/bulk-payments/${id}/cancel`, { reason }).then((r) => r.data),
};

// ─── QR Payments ─────────────────────────────────────────────────────────────
export interface QRPayment {
  id: string;
  qrCode: string;
  merchantId: string;
  amount?: number;
  currency: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export const qrPaymentsApi = {
  generate: (body: { merchantId: string; amount?: number; currency?: string; description?: string }) =>
    apiClient.post<QRPayment>(`${APISIX.QR_PAYMENTS}/v1/qr/generate`, body).then((r) => r.data),

  list: (params?: { page?: number; limit?: number; merchantId?: string }) =>
    apiClient.get<{ items: QRPayment[]; total: number }>(`${APISIX.QR_PAYMENTS}/v1/qr/payments`, { params }).then((r) => r.data),

  validate: (qrCode: string) =>
    apiClient.post(`${APISIX.QR_PAYMENTS}/v1/qr/validate`, { qrCode }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.QR_PAYMENTS}/v1/qr/stats`).then((r) => r.data),
};

// ─── Utility Payments ─────────────────────────────────────────────────────────
export interface Biller {
  id: string;
  name: string;
  category: string;
  logo?: string;
  status: string;
}

export interface UtilityPayment {
  id: string;
  billerId: string;
  billerName: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  receiptRef: string;
  createdAt: string;
}

export const utilityPaymentsApi = {
  getBillers: (params?: { category?: string }) =>
    apiClient.get<{ items: Biller[]; total: number }>(`${APISIX.UTILITY_PAYMENTS}/v1/billers`, { params }).then((r) => r.data),

  validateBill: (body: { billerId: string; customerId: string; amount?: number }) =>
    apiClient.post(`${APISIX.UTILITY_PAYMENTS}/v1/bills/validate`, body).then((r) => r.data),

  pay: (body: { sourceAccount: string; billerId: string; customerId: string; amount: number; currency: string }) =>
    apiClient.post<UtilityPayment>(`${APISIX.UTILITY_PAYMENTS}/v1/bills/pay`, body).then((r) => r.data),

  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<{ items: UtilityPayment[]; total: number }>(`${APISIX.UTILITY_PAYMENTS}/v1/bills`, { params }).then((r) => r.data),
};

// ─── Payment Investigation ────────────────────────────────────────────────────
export interface PaymentInvestigation {
  id: string;
  transactionRef: string;
  type: string;
  status: string;
  priority: string;
  assignedTo?: string;
  description: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export const paymentInvestigationApi = {
  list: (params?: { page?: number; limit?: number; status?: string; priority?: string }) =>
    apiClient.get<{ items: PaymentInvestigation[]; total: number }>(`/ledger/v1/investigation`, { params }).then((r) => r.data),

  create: (body: { transactionRef: string; type: string; priority: string; description: string }) =>
    apiClient.post<PaymentInvestigation>(`/ledger/v1/investigation`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<PaymentInvestigation>(`/ledger/v1/investigations/${id}`).then((r) => r.data),

  resolve: (id: string, resolution: string) =>
    apiClient.post(`/ledger/v1/investigations/${id}/resolve`, { resolution }).then((r) => r.data),
};

// ─── Wire Transfer Monitor ────────────────────────────────────────────────────
export interface WireTransfer {
  id: string;
  transferRef: string;
  swiftRef?: string;
  senderName: string;
  senderAccount: string;
  receiverName: string;
  receiverAccount: string;
  receiverBankCode: string;
  amount: number;
  currency: string;
  status: string;
  direction: "inward" | "outward";
  createdAt: string;
  settledAt?: string;
}

export const wireTransferApi = {
  list: (params?: { page?: number; limit?: number; direction?: string; status?: string }) =>
    apiClient.get<{ items: WireTransfer[]; total: number }>(`${APISIX.WIRE_TRANSFER}/v1/wire-transfers`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<WireTransfer>(`${APISIX.WIRE_TRANSFER}/v1/wire-transfers/${id}`).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.WIRE_TRANSFER}/v1/wire-transfers/stats`).then((r) => r.data),
};

// ─── NIBSS Direct Debit ───────────────────────────────────────────────────────
export interface DirectDebitMandate {
  id: string;
  mandateRef: string;
  debtorAccount: string;
  debtorBank: string;
  creditorAccount: string;
  amount: number;
  frequency: string;
  status: string;
  startDate: string;
  endDate?: string;
}

export const nibssDirectDebitApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: DirectDebitMandate[]; total: number }>(`${APISIX.NIBSS_DIRECT_DEBIT}/v1/mandates`, { params }).then((r) => r.data),

  create: (body: Partial<DirectDebitMandate>) =>
    apiClient.post<DirectDebitMandate>(`${APISIX.NIBSS_DIRECT_DEBIT}/v1/mandates`, body).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete(`${APISIX.NIBSS_DIRECT_DEBIT}/v1/mandates/${id}`).then((r) => r.data),

  processDebits: (mandateId: string) =>
    apiClient.post(`${APISIX.NIBSS_DIRECT_DEBIT}/v1/mandates/${mandateId}/process`, {}).then((r) => r.data),
};

// ─── ISO 20022 Hub ────────────────────────────────────────────────────────────
export interface ISO20022Message {
  id: string;
  messageId: string;
  messageType: string;
  direction: "inbound" | "outbound";
  status: string;
  payload: string;
  createdAt: string;
  processedAt?: string;
}

export const iso20022Api = {
  list: (params?: { page?: number; limit?: number; messageType?: string; direction?: string }) =>
    apiClient.get<{ items: ISO20022Message[]; total: number }>(`${APISIX.ISO20022}/v1/messages`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ISO20022Message>(`${APISIX.ISO20022}/v1/messages/${id}`).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.ISO20022}/v1/messages/stats`).then((r) => r.data),

  validate: (payload: string, messageType: string) =>
    apiClient.post(`${APISIX.ISO20022}/v1/messages/validate`, { payload, messageType }).then((r) => r.data),
};

// ─── SWIFT Messages ───────────────────────────────────────────────────────────
export interface SWIFTMessage {
  id: string;
  messageRef: string;
  messageType: string;
  senderBic: string;
  receiverBic: string;
  direction: "inward" | "outward";
  status: string;
  amount?: number;
  currency?: string;
  createdAt: string;
}

export const swiftApi = {
  list: (params?: { page?: number; limit?: number; messageType?: string; direction?: string }) =>
    apiClient.get<{ items: SWIFTMessage[]; total: number }>(`${APISIX.SWIFT}/v1/messages`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<SWIFTMessage>(`${APISIX.SWIFT}/v1/messages/${id}`).then((r) => r.data),

  send: (body: { receiverBic: string; messageType: string; payload: Record<string, unknown> }) =>
    apiClient.post<SWIFTMessage>(`${APISIX.SWIFT}/v1/messages`, body).then((r) => r.data),
};

// ─── Remittance ───────────────────────────────────────────────────────────────
export interface RemittanceTransaction {
  id: string;
  remittanceRef: string;
  senderName: string;
  senderCountry: string;
  receiverName: string;
  receiverAccount: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  corridor: string;
  status: string;
  provider: string;
  createdAt: string;
}

export const remittanceApi = {
  list: (params?: { page?: number; limit?: number; corridor?: string; status?: string }) =>
    apiClient.get<{ items: RemittanceTransaction[]; total: number }>(`${APISIX.REMITTANCE}/v1/remittances`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<RemittanceTransaction>(`${APISIX.REMITTANCE}/v1/remittances/${id}`).then((r) => r.data),

  getExchangeRates: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.REMITTANCE}/v1/rates`, { params }).then((r) => r.data),

  initiate: (body: Partial<RemittanceTransaction>) =>
    apiClient.post<RemittanceTransaction>(`${APISIX.REMITTANCE}/v1/remittances`, body).then((r) => r.data),

  getCorridors: () =>
    apiClient.get(`${APISIX.REMITTANCE}/v1/corridors`).then((r) => r.data),
};

// ─── WhatsApp Payment Integration ─────────────────────────────────────────────
export interface WhatsAppPaymentConfig {
  id: string;
  tenantId: string;
  webhookUrl: string;
  businessPhoneNumberId: string;
  status: string;
  enabledFeatures: string[];
}

export const whatsappPaymentApi = {
  getConfig: () =>
    apiClient.get<WhatsAppPaymentConfig>(`${APISIX.WHATSAPP_PAYMENT}/v1/config`).then((r) => r.data),

  updateConfig: (body: Partial<WhatsAppPaymentConfig>) =>
    apiClient.put(`${APISIX.WHATSAPP_PAYMENT}/v1/config`, body).then((r) => r.data),

  getTransactions: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.WHATSAPP_PAYMENT}/v1/transactions`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.WHATSAPP_PAYMENT}/v1/stats`).then((r) => r.data),
};
