/**
 * Carbon Trading API — APISIX Route Registry (W12 A4-P1-A)
 *
 * ┌──────────────────┬────────────────┬─────────────────┬──────┐
 * │ UI Route         │ APISIX Prefix  │ Backend Service │ Port │
 * ├──────────────────┼────────────────┼─────────────────┼──────┤
 * │ /carbon-credits  │ /carbon        │ carbon-service  │ 80   │
 * └──────────────────┴────────────────┴─────────────────┴──────┘
 *
 * carbon.yaml rewrites /carbon/(.*) → /$1; carbon-service serves
 * /api/v1/carbon/* (services/carbon-service/handlers.go). Wires the
 * previously-orphaned trade settlement and footprint detail routes.
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

const CARBON_BASE = `${APISIX.CARBON}/api/v1/carbon`;

export interface CarbonTrade {
  trade_id: string;
  credit_id: string;
  seller_id: string;
  buyer_id: string;
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  status: string;
  trade_date: string;
}

export interface CarbonFootprint {
  footprint_id?: string;
  entity_id?: string;
  entity_type?: string;
  scope1?: number;
  scope2?: number;
  scope3?: number;
  total?: number;
  unit?: string;
  period_start?: string;
  period_end?: string;
  [key: string]: unknown;
}

export const carbonTradingApi = {
  listTrades: (params?: { status?: string }) =>
    apiClient.get<CarbonTrade[]>(`${CARBON_BASE}/trades`, { params }).then((r) => r.data),

  getTrade: (tradeId: string) =>
    apiClient.get<CarbonTrade>(`${CARBON_BASE}/trades/${encodeURIComponent(tradeId)}`).then((r) => r.data),

  /** Settle an open trade — requires the operator's transaction PIN. */
  settleTrade: (tradeId: string, pin: string) =>
    apiClient
      .post(`${CARBON_BASE}/trades/${encodeURIComponent(tradeId)}/settle`, { pin })
      .then((r) => r.data),

  listFootprints: (params?: { entity_id?: string }) =>
    apiClient.get<CarbonFootprint[]>(`${CARBON_BASE}/footprints`, { params }).then((r) => r.data),

  getFootprint: (footprintId: string) =>
    apiClient.get<CarbonFootprint>(`${CARBON_BASE}/footprints/${encodeURIComponent(footprintId)}`).then((r) => r.data),
};
