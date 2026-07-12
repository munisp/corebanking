/**
 * Treasury & FX API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬──────────────────────────────┬────────────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix                │ Backend Service                │ Port  │
 * ├──────────────────────────────┼──────────────────────────────┼────────────────────────────────┼───────┤
 * │ /treasury                    │ /treasury                    │ treasury-service               │ 80    │
 * │ /treasury-liquidity          │ /treasury-liquidity          │ treasury-liquidity-rs          │ 8142  │
 * │ /fx-dealing-room             │ /fx                          │ fx-service                     │ 8080  │
 * │ /fx-rates                    │ /fx-rates                    │ fx-rates-engine-rs             │ 8118  │
 * │ /fx-positions                │ /fx                          │ fx-service                     │ 8080  │
 * │ /fx-revaluation              │ /multicurrency               │ multicurrency-revaluation-rs   │ 8211  │
 * │ /multi-currency-fx           │ /multicurrency               │ multicurrency-revaluation-rs   │ 8211  │
 * │ /money-market                │ /money-market                │ money-market-rs                │ 8156  │
 * │ /interbank-lending           │ /interbank                   │ interbank-lending-rs           │ 8166  │
 * │ /cash-management             │ /banking-clearing-ops        │ banking-clearing-ops-rs        │ 1105  │
 * │ /cash-pooling                │ /cash-pooling                │ cash-pooling-go                │ 8080  │
 * │ /lcr-nsfr                    │ /lcr-nsfr                    │ lcr-nsfr-rs                    │ 8217  │
 * │ /otc-derivatives             │ /otc                         │ otc-derivatives-rs             │ 8161  │
 * │ /securities-trading          │ /securities                  │ securities-trading-rs          │ 8254  │
 * └──────────────────────────────┴──────────────────────────────┴────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Treasury ─────────────────────────────────────────────────────────────────
export interface TreasuryPosition {
  currency: string;
  longPosition: number;
  shortPosition: number;
  netPosition: number;
  valueDate: string;
}

export interface TreasuryDashboard {
  totalAssets: number;
  liquidAssets: number;
  investmentBook: number;
  fundingCost: number;
  currency: string;
  asOf: string;
}

export const treasuryApi = {
  getDashboard: () =>
    apiClient.get<TreasuryDashboard>(`${APISIX.TREASURY}/v1/dashboard`).then((r) => r.data),

  getPositions: (params?: { currency?: string; valueDate?: string }) =>
    apiClient.get<{ items: TreasuryPosition[] }>(`${APISIX.TREASURY}/v1/positions`, { params }).then((r) => r.data),

  getPortfolio: (params?: { type?: string }) =>
    apiClient.get(`${APISIX.TREASURY}/v1/portfolio`, { params }).then((r) => r.data),

  getInvestments: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.TREASURY}/v1/investments`, { params }).then((r) => r.data),
};

// ─── Treasury Liquidity ───────────────────────────────────────────────────────
export interface LiquidityPosition {
  asOf: string;
  totalLiquidAssets: number;
  cashAndCBN: number;
  threeMonthTbills: number;
  bondPortfolio: number;
  netLiquidityRatio: number;
  currency: string;
}

export interface LiquidityForecast {
  date: string;
  expected: number;
  stressed: number;
  currency: string;
}

export const treasuryLiquidityApi = {
  getCurrent: () =>
    apiClient.get<LiquidityPosition>(`${APISIX.TREASURY_LIQUIDITY}/v1/position`).then((r) => r.data),

  getForecast: (params?: { days?: number }) =>
    apiClient.get<{ items: LiquidityForecast[] }>(`${APISIX.TREASURY_LIQUIDITY}/v1/forecast`, { params }).then((r) => r.data),

  getHistory: (params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.TREASURY_LIQUIDITY}/v1/history`, { params }).then((r) => r.data),

  getLCRReport: () =>
    apiClient.get(`${APISIX.TREASURY_LIQUIDITY}/v1/lcr`).then((r) => r.data),
};

// ─── FX Dealing Room ──────────────────────────────────────────────────────────
export interface FXDeal {
  id: string;
  dealRef: string;
  dealType: "spot" | "forward" | "swap" | "option";
  buyCurrency: string;
  sellCurrency: string;
  buyAmount: number;
  sellAmount: number;
  rate: number;
  trader: string;
  counterparty: string;
  valueDate: string;
  status: string;
  createdAt: string;
}

export interface FXPosition {
  currency: string;
  longPosition: number;
  shortPosition: number;
  netPosition: number;
  unrealizedPnL: number;
  valueDate: string;
}

export const fxDealingRoomApi = {
  getDeals: (params?: { page?: number; limit?: number; dealType?: string; status?: string }) =>
    apiClient.get<{ items: FXDeal[]; total: number }>(`${APISIX.FX}/v1/deals`, { params }).then((r) => r.data),

  createDeal: (body: Partial<FXDeal>) =>
    apiClient.post<FXDeal>(`${APISIX.FX}/v1/deals`, body).then((r) => r.data),

  getDealById: (id: string) =>
    apiClient.get<FXDeal>(`${APISIX.FX}/v1/deals/${id}`).then((r) => r.data),

  getPositions: (params?: { currency?: string }) =>
    apiClient.get<{ items: FXPosition[] }>(`${APISIX.FX}/v1/positions`, { params }).then((r) => r.data),

  confirmDeal: (id: string) =>
    apiClient.post(`${APISIX.FX}/v1/deals/${id}/confirm`, {}).then((r) => r.data),
};

// ─── FX Rates ─────────────────────────────────────────────────────────────────
export interface FXRate {
  baseCurrency: string;
  quoteCurrency: string;
  buyRate: number;
  sellRate: number;
  midRate: number;
  source: string;
  timestamp: string;
}

export const fxRatesApi = {
  getCurrent: (params?: { base?: string; quote?: string }) =>
    apiClient.get<{ rates: FXRate[] }>(`${APISIX.FX_RATES}/v1/rates/current`, { params }).then((r) => r.data),

  getHistory: (base: string, quote: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.FX_RATES}/v1/rates/history/${base}/${quote}`, { params }).then((r) => r.data),

  setRate: (body: { base: string; quote: string; buyRate: number; sellRate: number }) =>
    apiClient.post(`${APISIX.FX_RATES}/v1/rates`, body).then((r) => r.data),

  getAll: () =>
    apiClient.get<{ rates: FXRate[] }>(`${APISIX.FX_RATES}/v1/rates`).then((r) => r.data),
};

// ─── FX Revaluation / Multi-Currency ──────────────────────────────────────────
export interface RevaluationResult {
  id: string;
  runDate: string;
  totalGainLoss: number;
  currency: string;
  accountsProcessed: number;
  status: string;
}

export const multicurrencyApi = {
  runRevaluation: (body: { valueDate: string; currencies?: string[] }) =>
    apiClient.post<RevaluationResult>(`${APISIX.MULTICURRENCY}/v1/revaluation/run`, body).then((r) => r.data),

  getRevaluations: (params?: { page?: number; limit?: number }) =>
    apiClient.get<{ items: RevaluationResult[]; total: number }>(`${APISIX.MULTICURRENCY}/v1/revaluation`, { params }).then((r) => r.data),

  getExposures: (params?: { currency?: string }) =>
    apiClient.get(`${APISIX.MULTICURRENCY}/v1/exposures`, { params }).then((r) => r.data),
};

// ─── Money Market ─────────────────────────────────────────────────────────────
export interface MoneyMarketInstrument {
  id: string;
  instrumentType: string;
  faceValue: number;
  currency: string;
  yieldRate: number;
  maturityDate: string;
  counterparty: string;
  direction: "placement" | "borrowing";
  status: string;
  tradeDate: string;
}

export const moneyMarketApi = {
  list: (params?: { page?: number; limit?: number; type?: string; direction?: string }) =>
    apiClient.get<{ items: MoneyMarketInstrument[]; total: number }>(`${APISIX.MONEY_MARKET}/v1/instruments`, { params }).then((r) => r.data),

  create: (body: Partial<MoneyMarketInstrument>) =>
    apiClient.post<MoneyMarketInstrument>(`${APISIX.MONEY_MARKET}/v1/instruments`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<MoneyMarketInstrument>(`${APISIX.MONEY_MARKET}/v1/instruments/${id}`).then((r) => r.data),

  getPortfolio: () =>
    apiClient.get(`${APISIX.MONEY_MARKET}/v1/portfolio`).then((r) => r.data),

  rollover: (id: string, body: { newMaturityDate: string; newRate: number }) =>
    apiClient.post(`${APISIX.MONEY_MARKET}/v1/instruments/${id}/rollover`, body).then((r) => r.data),
};

// ─── Interbank Lending ────────────────────────────────────────────────────────
export interface InterbankLoan {
  id: string;
  loanRef: string;
  direction: "lending" | "borrowing";
  counterpartyBank: string;
  amount: number;
  currency: string;
  rate: number;
  tenor: number;
  startDate: string;
  maturityDate: string;
  status: string;
}

export const interbankApi = {
  list: (params?: { page?: number; limit?: number; direction?: string; status?: string }) =>
    apiClient.get<{ items: InterbankLoan[]; total: number }>(`${APISIX.INTERBANK}/v1/loans`, { params }).then((r) => r.data),

  create: (body: Partial<InterbankLoan>) =>
    apiClient.post<InterbankLoan>(`${APISIX.INTERBANK}/v1/loans`, body).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<InterbankLoan>(`${APISIX.INTERBANK}/v1/loans/${id}`).then((r) => r.data),

  getExposure: () =>
    apiClient.get(`${APISIX.INTERBANK}/v1/exposure`).then((r) => r.data),
};

// ─── LCR / NSFR ──────────────────────────────────────────────────────────────
export interface LCRReport {
  asOf: string;
  hqla: number;
  netCashOutflows: number;
  lcrRatio: number;
  regulatory_minimum: number;
  status: "compliant" | "breach" | "warning";
}

export interface NSFRReport {
  asOf: string;
  availableStableFunding: number;
  requiredStableFunding: number;
  nsfrRatio: number;
  regulatory_minimum: number;
  status: "compliant" | "breach" | "warning";
}

export const lcrNsfrApi = {
  getLCR: (params?: { asOf?: string }) =>
    apiClient.get<LCRReport>(`${APISIX.LCR_NSFR}/v1/lcr`, { params }).then((r) => r.data),

  getNSFR: (params?: { asOf?: string }) =>
    apiClient.get<NSFRReport>(`${APISIX.LCR_NSFR}/v1/nsfr`, { params }).then((r) => r.data),

  runLCR: (asOf: string) =>
    apiClient.post(`${APISIX.LCR_NSFR}/v1/lcr/run`, { asOf }).then((r) => r.data),

  runNSFR: (asOf: string) =>
    apiClient.post(`${APISIX.LCR_NSFR}/v1/nsfr/run`, { asOf }).then((r) => r.data),

  getHistory: (metric: "lcr" | "nsfr", params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.LCR_NSFR}/v1/${metric}/history`, { params }).then((r) => r.data),
};

// ─── OTC Derivatives ──────────────────────────────────────────────────────────
export interface OTCDerivative {
  id: string;
  dealRef: string;
  productType: "IRS" | "CDS" | "FX_Option" | "Equity_Swap";
  notional: number;
  currency: string;
  counterparty: string;
  maturityDate: string;
  mtmValue: number;
  status: string;
  tradeDate: string;
}

export const otcDerivativesApi = {
  list: (params?: { page?: number; limit?: number; productType?: string; status?: string }) =>
    apiClient.get<{ items: OTCDerivative[]; total: number }>(`${APISIX.OTC_DERIVATIVES}/v1/derivatives`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<OTCDerivative>(`${APISIX.OTC_DERIVATIVES}/v1/derivatives/${id}`).then((r) => r.data),

  create: (body: Partial<OTCDerivative>) =>
    apiClient.post<OTCDerivative>(`${APISIX.OTC_DERIVATIVES}/v1/derivatives`, body).then((r) => r.data),

  runMTM: () =>
    apiClient.post(`${APISIX.OTC_DERIVATIVES}/v1/mtm/run`, {}).then((r) => r.data),

  getExposures: () =>
    apiClient.get(`${APISIX.OTC_DERIVATIVES}/v1/exposures`).then((r) => r.data),
};

// ─── Securities Trading ───────────────────────────────────────────────────────
export interface SecurityPosition {
  id: string;
  securityId: string;
  isin?: string;
  securityName: string;
  securityType: string;
  units: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  currency: string;
  portfolio: string;
}

export const securitiesTradingApi = {
  getPositions: (params?: { portfolio?: string; securityType?: string }) =>
    apiClient.get<{ items: SecurityPosition[]; total: number }>(`${APISIX.SECURITIES}/v1/positions`, { params }).then((r) => r.data),

  buy: (body: { securityId: string; units: number; portfolio: string; price?: number }) =>
    apiClient.post(`${APISIX.SECURITIES}/v1/orders/buy`, body).then((r) => r.data),

  sell: (body: { securityId: string; units: number; portfolio: string; price?: number }) =>
    apiClient.post(`${APISIX.SECURITIES}/v1/orders/sell`, body).then((r) => r.data),

  getOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.SECURITIES}/v1/orders`, { params }).then((r) => r.data),

  getMarketData: (securityId: string) =>
    apiClient.get(`${APISIX.SECURITIES}/v1/market-data/${securityId}`).then((r) => r.data),
};
