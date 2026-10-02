/**
 * Merchant Settlements API — APISIX Route Registry (W12 A4-P1-A)
 *
 * ┌──────────────────────────┬────────────────┬───────────────────┬──────┐
 * │ UI Route                 │ APISIX Prefix  │ Backend Service   │ Port │
 * ├──────────────────────────┼────────────────┼───────────────────┼──────┤
 * │ /merchant-settlements    │ /merchant      │ merchant-service  │ 80   │
 * └──────────────────────────┴────────────────┴───────────────────┴──────┘
 *
 * Wires the previously-orphaned merchant settlement family
 * (services/merchant-service/merchant_settlement.py):
 * calculate / create / process / list / detail / config (get+set) / adjust.
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

export interface MerchantSummary {
  merchant_id: string;
  business_name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MerchantSettlement {
  settlement_id: string;
  merchant_id: string;
  settlement_period_start: string;
  settlement_period_end: string;
  total_transactions?: number;
  gross_amount?: number | string;
  fees_amount?: number | string;
  net_amount?: number | string;
  bank_account_number?: string;
  bank_code?: string;
  account_name?: string;
  status: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface MerchantSettlementConfig {
  merchant_id?: string;
  settlement_frequency?: string;
  settlement_day?: number;
  auto_settlement?: boolean;
  minimum_settlement_amount?: number | string;
  bank_account_number?: string;
  bank_code?: string;
  account_name?: string;
  [key: string]: unknown;
}

const merchantBase = (merchantId: string) =>
  `${APISIX.MERCHANT}/api/v1/merchants/${encodeURIComponent(merchantId)}`;

export const merchantSettlementsApi = {
  listMerchants: (params?: { skip?: number; limit?: number; status?: string }) =>
    apiClient
      .get<MerchantSummary[] | { items: MerchantSummary[] }>(`${APISIX.MERCHANT}/api/v1/merchants`, { params })
      .then((r) => r.data),

  calculateSettlement: (merchantId: string, periodStart: string, periodEnd: string) =>
    apiClient
      .post(`${merchantBase(merchantId)}/settlements/calculate`, null, {
        params: { period_start: periodStart, period_end: periodEnd },
      })
      .then((r) => r.data),

  createSettlement: (merchantId: string, body: {
    settlement_period_start: string;
    settlement_period_end: string;
    bank_account_number: string;
    bank_code: string;
    account_name: string;
  }) =>
    apiClient.post(`${merchantBase(merchantId)}/settlements/create`, body).then((r) => r.data),

  processSettlement: (merchantId: string, settlementId: string) =>
    apiClient
      .post(`${merchantBase(merchantId)}/settlements/${encodeURIComponent(settlementId)}/process`, {})
      .then((r) => r.data),

  listSettlements: (merchantId: string, params?: { status?: string; skip?: number; limit?: number }) =>
    apiClient
      .get<MerchantSettlement[] | { items: MerchantSettlement[]; total?: number }>(`${merchantBase(merchantId)}/settlements`, { params })
      .then((r) => r.data),

  getSettlement: (merchantId: string, settlementId: string) =>
    apiClient
      .get<MerchantSettlement>(`${merchantBase(merchantId)}/settlements/${encodeURIComponent(settlementId)}`)
      .then((r) => r.data),

  getConfig: (merchantId: string) =>
    apiClient.get<MerchantSettlementConfig>(`${merchantBase(merchantId)}/settlements/config`).then((r) => r.data),

  setConfig: (merchantId: string, body: MerchantSettlementConfig) =>
    apiClient.post<MerchantSettlementConfig>(`${merchantBase(merchantId)}/settlements/config`, body).then((r) => r.data),

  adjustSettlement: (merchantId: string, settlementId: string, body: {
    settlement_id: string;
    adjustment_type: string;
    amount: number;
    reason: string;
    reference?: string;
  }) =>
    apiClient
      .post(`${merchantBase(merchantId)}/settlements/${encodeURIComponent(settlementId)}/adjust`, body)
      .then((r) => r.data),
};
