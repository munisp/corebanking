/**
 * Digital Channels API — APISIX Route Registry
 *
 * ┌──────────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┬───────┐
 * │ UI Route                             │ APISIX Prefix                    │ Backend Service                  │ Port  │
 * ├──────────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┼───────┤
 * │ /ussd-banking-gateway                │ /ussd-banking-gateway            │ ussd-banking-gateway-go          │ 9057  │
 * │ /whatsapp-banking-flows              │ /whatsapp-banking-flows          │ whatsapp-banking-flows-rs        │ 9323  │
 * │ /whatsapp-business-gateway           │ /whatsapp-business-gateway       │ whatsapp-business-gateway-go     │ 9141  │
 * │ /sms-banking                         │ /sms-banking                     │ sms-banking                      │ 8080  │
 * │ /telegram-bot-gateway                │ /telegram-bot-gateway            │ telegram-bot-gateway-go          │ 9003  │
 * │ /telegram-banking-commands           │ /telegram-banking-commands       │ telegram-banking-commands-rs     │ 9303  │
 * │ /voice-banking-gateway               │ /voice-banking-gateway           │ voice-banking-gateway-go         │ 9048  │
 * │ /chatbot                             │ /chatbot                         │ chatbot-py                       │ 9239  │
 * │ /identity-channels                   │ /identity-channels               │ identity-channels-go             │ 9274  │
 * └──────────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── USSD Banking Gateway ─────────────────────────────────────────────────────
export interface USSDSession {
  id: string;
  sessionRef: string;
  msisdn: string;
  customerId?: string;
  menuPath: string;
  status: "active" | "completed" | "timeout" | "failed";
  startedAt: string;
  endedAt?: string;
}

export interface USSDMenu {
  id: string;
  code: string;
  title: string;
  options: { key: string; label: string; action: string }[];
  status: "active" | "inactive";
}

export const ussdBankingApi = {
  listSessions: (params?: { page?: number; limit?: number; status?: string; from?: string; to?: string }) =>
    apiClient.get<{ items: USSDSession[]; total: number }>(`${APISIX.USSD_BANKING_GW}/v1/ussd/sessions`, { params }).then((r) => r.data),

  getSessionById: (id: string) =>
    apiClient.get<USSDSession>(`${APISIX.USSD_BANKING_GW}/v1/ussd/sessions/${id}`).then((r) => r.data),

  listMenus: (params?: { status?: string }) =>
    apiClient.get<{ items: USSDMenu[] }>(`${APISIX.USSD_BANKING_GW}/v1/ussd/sessions`, { params }).then((r) => r.data),

  updateMenu: (id: string, body: Partial<USSDMenu>) =>
    apiClient.put(`${APISIX.USSD_BANKING_GW}/v1/ussd/sessions/${id}`, body).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.USSD_BANKING_GW}/v1/ussd/stats`, { params }).then((r) => r.data),

  getGatewayStatus: () =>
    apiClient.get(`${APISIX.USSD_BANKING_GW}/v1/ussd/stats`).then((r) => r.data),
};

// ─── WhatsApp Banking Flows ───────────────────────────────────────────────────
export interface WhatsAppFlow {
  id: string;
  name: string;
  triggerKeyword: string;
  flowType: string;
  status: "active" | "inactive" | "draft";
  sessions: number;
  completionRate: number;
  updatedAt: string;
}

export interface WhatsAppConversation {
  id: string;
  phoneNumber: string;
  customerId?: string;
  currentFlow: string;
  status: "active" | "completed" | "abandoned";
  lastMessageAt: string;
}

export const whatsappBankingApi = {
  listFlows: (params?: { page?: number; limit?: number; flowType?: string; status?: string }) =>
    apiClient.get<{ items: WhatsAppFlow[]; total: number }>(`${APISIX.WHATSAPP_BANKING}/v1/whatsapp/messages`, { params }).then((r) => r.data),

  getFlowById: (id: string) =>
    apiClient.get<WhatsAppFlow>(`${APISIX.WHATSAPP_BANKING}/v1/whatsapp/messages/${id}`).then((r) => r.data),

  updateFlowStatus: (id: string, status: "active" | "inactive") =>
    apiClient.patch(`${APISIX.WHATSAPP_BANKING}/v1/whatsapp/messages/${id}`, { status }).then((r) => r.data),

  listConversations: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: WhatsAppConversation[]; total: number }>(`${APISIX.WHATSAPP_BANKING}/v1/whatsapp/messages`, { params }).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.WHATSAPP_BANKING}/v1/whatsapp/stats`, { params }).then((r) => r.data),
};

// ─── WhatsApp Business Gateway ────────────────────────────────────────────────
export const whatsappGatewayApi = {
  getConfig: () =>
    apiClient.get(`${APISIX.WHATSAPP_GATEWAY}/v1/whatsapp/templates`).then((r) => r.data),

  updateConfig: (body: { webhookUrl?: string; phoneNumberId?: string; verifyToken?: string }) =>
    apiClient.post(`${APISIX.WHATSAPP_GATEWAY}/v1/whatsapp/send-template`, body).then((r) => r.data),

  getDeliveryStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.WHATSAPP_GATEWAY}/v1/whatsapp/stats`, { params }).then((r) => r.data),

  getGatewayHealth: () =>
    apiClient.get(`${APISIX.WHATSAPP_GATEWAY}/v1/whatsapp/stats`).then((r) => r.data),
};

// ─── SMS Banking ──────────────────────────────────────────────────────────────
export interface SMSTransaction {
  id: string;
  msisdn: string;
  customerId?: string;
  commandType: string;
  amount?: number;
  currency?: string;
  status: "success" | "failed" | "pending";
  responseCode?: string;
  processedAt: string;
}

export const smsBankingApi = {
  listTransactions: (params?: { page?: number; limit?: number; commandType?: string; status?: string }) =>
    apiClient.get<{ items: SMSTransaction[]; total: number }>(`${APISIX.SMS_BANKING}/api/v1/sms/stats`, { params }).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.SMS_BANKING}/api/v1/sms/stats`, { params }).then((r) => r.data),

  getCommands: () =>
    apiClient.get(`${APISIX.SMS_BANKING}/api/v1/sms/receive`).then((r) => r.data),

  updateCommand: (id: string, body: { enabled: boolean; keywords?: string[] }) =>
    apiClient.post(`${APISIX.SMS_BANKING}/api/v1/sms/send`, body).then((r) => r.data),
};

// ─── Telegram Bot Gateway ─────────────────────────────────────────────────────
export const telegramBotApi = {
  getConfig: () =>
    apiClient.get(`${APISIX.TELEGRAM_BOT_GW}/v1/telegram/stats`).then((r) => r.data),

  updateConfig: (body: { botToken?: string; webhookUrl?: string }) =>
    apiClient.post(`${APISIX.TELEGRAM_BOT_GW}/v1/telegram/send`, body).then((r) => r.data),

  getActiveSessions: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.TELEGRAM_BOT_GW}/v1/telegram/messages`, { params }).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.TELEGRAM_BOT_GW}/v1/telegram/stats`, { params }).then((r) => r.data),
};

// ─── Telegram Banking Commands ────────────────────────────────────────────────
export const telegramBankingCommandsApi = {
  listCommands: (params?: { status?: string }) =>
    apiClient.get(`${APISIX.TELEGRAM_COMMANDS}/v1/telegram/commands`, { params }).then((r) => r.data),

  updateCommand: (id: string, body: { enabled: boolean }) =>
    apiClient.put(`${APISIX.TELEGRAM_COMMANDS}/v1/telegram/commands/${id}`, body).then((r) => r.data),

  getCommandUsage: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.TELEGRAM_COMMANDS}/v1/telegram/stats`, { params }).then((r) => r.data),
};

// ─── Voice Banking Gateway ────────────────────────────────────────────────────
export interface VoiceSession {
  id: string;
  sessionRef: string;
  callerNumber: string;
  customerId?: string;
  language: string;
  menuPath: string;
  duration?: number;
  status: "active" | "completed" | "dropped" | "failed";
  startedAt: string;
  endedAt?: string;
}

export const voiceBankingApi = {
  listSessions: (params?: { page?: number; limit?: number; status?: string; from?: string; to?: string }) =>
    apiClient.get<{ items: VoiceSession[]; total: number }>(`${APISIX.VOICE_BANKING_GW}/v1/voice-banking-gateway/list`, { params }).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.VOICE_BANKING_GW}/v1/voice-banking-gateway/stats`, { params }).then((r) => r.data),

  getIVRMenus: () =>
    apiClient.get(`${APISIX.VOICE_BANKING_GW}/v1/voice-banking-gateway/list`).then((r) => r.data),

  updateIVRMenu: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.VOICE_BANKING_GW}/v1/voice-banking-gateway/create`, body).then((r) => r.data),
};

// ─── Chatbot ──────────────────────────────────────────────────────────────────
export interface ChatbotConversation {
  id: string;
  sessionRef: string;
  channel: string;
  customerId?: string;
  intent: string;
  messageCount: number;
  satisfactionScore?: number;
  status: "active" | "completed" | "escalated";
  startedAt: string;
  endedAt?: string;
}

export const chatbotApi = {
  listConversations: (params?: { page?: number; limit?: number; channel?: string; status?: string; intent?: string }) =>
    apiClient.get<{ items: ChatbotConversation[]; total: number }>(`${APISIX.CHATBOT}/api/v1/chatbot/analytics/conversations`, { params }).then((r) => r.data),

  getConversationById: (id: string) =>
    apiClient.get<ChatbotConversation>(`${APISIX.CHATBOT}/api/v1/chatbot/analytics/conversations/${id}`).then((r) => r.data),

  getIntents: () =>
    apiClient.get(`${APISIX.CHATBOT}/api/v1/chatbot/intents`).then((r) => r.data),

  updateIntent: (id: string, body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.CHATBOT}/api/v1/chatbot/intents/${id}`, body).then((r) => r.data),

  getStats: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.CHATBOT}/api/v1/chatbot/analytics/intents`, { params }).then((r) => r.data),

  trainModel: () =>
    apiClient.post(`${APISIX.CHATBOT}/api/v1/chatbot/intents`, {}).then((r) => r.data),
};

// ─── Identity Channels ────────────────────────────────────────────────────────
export interface IdentityChannelConfig {
  channelId: string;
  channelType: "email" | "sms" | "whatsapp" | "biometric";
  enabled: boolean;
  otpLength: number;
  otpExpirySeconds: number;
  maxAttempts: number;
  updatedAt: string;
}

export const identityChannelsApi = {
  listChannels: () =>
    apiClient.get<{ items: IdentityChannelConfig[] }>(`${APISIX.IDENTITY_CHANNELS}/api/v1/verify/audit`).then((r) => r.data),

  updateChannel: (channelId: string, body: Partial<IdentityChannelConfig>) =>
    apiClient.post(`${APISIX.IDENTITY_CHANNELS}/api/v1/verify/bvn`, body).then((r) => r.data),

  sendOTP: (body: { customerId: string; channel: string; purpose: string }) =>
    apiClient.post(`${APISIX.IDENTITY_CHANNELS}/api/v1/verify/bvn`, body).then((r) => r.data),

  verifyOTP: (body: { customerId: string; otp: string; sessionRef: string }) =>
    apiClient.post(`${APISIX.IDENTITY_CHANNELS}/api/v1/verify/nin`, body).then((r) => r.data),

  getVerificationStats: () =>
    apiClient.get(`${APISIX.IDENTITY_CHANNELS}/api/v1/verify/audit`).then((r) => r.data),
};
