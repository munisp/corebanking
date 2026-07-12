/**
 * Watchlists & Sanctions API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                    │ Backend Service                  │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┼───────┤
 * │ /sanctions-screening             │ /sanctions                       │ sanctions-screening-rs           │ 8283  │
 * │ /sanctions-engine                │ /sanctions-engine                │ sanctions-engine-rs              │ 8121  │
 * │ /sanctions-batch-rescreener      │ /sanctions-batch-rescreener      │ sanctions-batch-rescreener-rs    │ 9290  │
 * │ /watchlist-manager               │ /watchlist-manager               │ watchlist-manager-rs             │ 9322  │
 * │ /adverse-media                   │ /adverse-media                   │ adverse-media-screening-py       │ 8080  │
 * │ /adverse-media-scanner           │ /adverse-media-scanner           │ adverse-media-scanner-py         │ 9204  │
 * │ /risk-based-approach             │ /risk-based-approach             │ risk-based-approach-py           │ 9315  │
 * │ /cbn-tiered-kyc                  │ /cbn-tiered-kyc                  │ cbn-tiered-kyc-rs                │ 8280  │
 * └──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Sanctions Screening ──────────────────────────────────────────────────────
export interface SanctionsScreeningResult {
  id: string;
  screeningRef: string;
  entityName: string;
  entityType: "individual" | "entity" | "vessel" | "aircraft";
  customerId?: string;
  lists: string[];
  matchStatus: "no_match" | "potential_match" | "confirmed_match";
  matchScore?: number;
  matchDetails?: { list: string; matchedName: string; score: number; aliases: string[] }[];
  screenedAt: string;
  reviewedBy?: string;
  resolution?: "cleared" | "blocked" | "pending_review";
}

export const sanctionsScreeningApi = {
  screen: (body: { name: string; dob?: string; country?: string; customerId?: string; entityType?: string }) =>
    apiClient.post<SanctionsScreeningResult>(`${APISIX.SANCTIONS}/api/screen`, body).then((r) => r.data),

  listResults: (params?: { page?: number; limit?: number; matchStatus?: string; resolution?: string }) =>
    apiClient.get<{ items: SanctionsScreeningResult[]; total: number }>(`${APISIX.SANCTIONS}/api/screenings`, { params }).then((r) => r.data),

  getResultById: (id: string) =>
    apiClient.get<SanctionsScreeningResult>(`${APISIX.SANCTIONS}/api/entries`).then((r) => r.data),

  resolve: (id: string, body: { resolution: "cleared" | "blocked"; reason: string; reviewedBy: string }) =>
    apiClient.post(`${APISIX.SANCTIONS}/api/screen`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.SANCTIONS}/api/screenings`).then((r) => r.data),
};

// ─── Sanctions Engine ─────────────────────────────────────────────────────────
export interface SanctionsList {
  id: string;
  name: string;
  source: "OFAC" | "UN" | "EU" | "UK_HMT" | "CBN" | "FATF" | "local";
  totalEntries: number;
  lastUpdated: string;
  status: "active" | "inactive";
}

export const sanctionsEngineApi = {
  getLists: () =>
    apiClient.get<{ items: SanctionsList[] }>(`${APISIX.SANCTIONS_ENGINE}/api/entries`).then((r) => r.data),

  syncList: (listId: string) =>
    apiClient.post(`${APISIX.SANCTIONS_ENGINE}/api/admin/sync-lists`, { listId }).then((r) => r.data),

  getEngineConfig: () =>
    apiClient.get(`${APISIX.SANCTIONS_ENGINE}/api/screenings`).then((r) => r.data),

  updateEngineConfig: (body: { matchThreshold?: number; fuzzyMatchEnabled?: boolean; listsEnabled?: string[] }) =>
    apiClient.post(`${APISIX.SANCTIONS_ENGINE}/api/admin/sync-lists`, body).then((r) => r.data),

  getMetrics: () =>
    apiClient.get(`${APISIX.SANCTIONS_ENGINE}/api/screenings`).then((r) => r.data),
};

// ─── Sanctions Batch Rescreener ───────────────────────────────────────────────
export interface BatchRescreeningJob {
  id: string;
  jobRef: string;
  totalCustomers: number;
  processed: number;
  matches: number;
  status: "queued" | "running" | "completed" | "failed";
  triggeredBy: string;
  startedAt?: string;
  completedAt?: string;
}

export const sanctionsBatchRescreenerApi = {
  runBatch: (body?: { customerIds?: string[]; allCustomers?: boolean }) =>
    apiClient.post<BatchRescreeningJob>(`${APISIX.SANCTIONS_RESCREENER}/api/admin/sync-lists`, body).then((r) => r.data),

  listJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: BatchRescreeningJob[]; total: number }>(`${APISIX.SANCTIONS_RESCREENER}/api/screenings`, { params }).then((r) => r.data),

  getJobById: (id: string) =>
    apiClient.get<BatchRescreeningJob>(`${APISIX.SANCTIONS_RESCREENER}/api/screenings`).then((r) => r.data),

  getJobResults: (id: string, params?: { page?: number; limit?: number; matchStatus?: string }) =>
    apiClient.get(`${APISIX.SANCTIONS_RESCREENER}/api/screenings`, { params }).then((r) => r.data),
};

// ─── Watchlist Manager ────────────────────────────────────────────────────────
export interface WatchlistEntry {
  id: string;
  listType: "internal_pep" | "internal_sanctions" | "high_risk" | "negative_news" | "custom";
  name: string;
  aliases?: string[];
  dateOfBirth?: string;
  nationality?: string;
  identifiers?: { type: string; value: string }[];
  reason: string;
  addedBy: string;
  status: "active" | "inactive";
  createdAt: string;
  expiresAt?: string;
}

export const watchlistManagerApi = {
  list: (params?: { page?: number; limit?: number; listType?: string; status?: string; q?: string }) =>
    apiClient.get<{ items: WatchlistEntry[]; total: number }>(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/list`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<WatchlistEntry>(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/list`).then((r) => r.data),

  add: (body: Partial<WatchlistEntry>) =>
    apiClient.post<WatchlistEntry>(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/create`, body).then((r) => r.data),

  update: (id: string, body: Partial<WatchlistEntry>) =>
    apiClient.post(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/create`, body).then((r) => r.data),

  remove: (id: string, reason: string) =>
    apiClient.post(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/create`, { id, reason, action: "remove" }).then((r) => r.data),

  checkCustomer: (customerId: string) =>
    apiClient.post(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/create`, { customerId }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.WATCHLIST_MANAGER}/v1/watchlist-manager/stats`).then((r) => r.data),
};

// ─── Adverse Media Screening ──────────────────────────────────────────────────
export interface AdverseMediaResult {
  id: string;
  screeningRef: string;
  customerId: string;
  customerName: string;
  matchStatus: "no_match" | "potential_match" | "confirmed_match";
  articles: { title: string; source: string; url?: string; sentiment: string; categories: string[]; publishedAt: string }[];
  riskScore: number;
  screenedAt: string;
  resolution?: "cleared" | "flagged" | "escalated";
}

export const adverseMediaApi = {
  screen: (body: { customerId: string; name: string; country?: string }) =>
    apiClient.post<AdverseMediaResult>(`${APISIX.ADVERSE_MEDIA}/api/v1/compliance/aml/assess`, body).then((r) => r.data),

  listResults: (params?: { page?: number; limit?: number; matchStatus?: string; resolution?: string }) =>
    apiClient.get<{ items: AdverseMediaResult[]; total: number }>(`${APISIX.ADVERSE_MEDIA}/api/v1/compliance/alerts/tenant/all`, { params }).then((r) => r.data),

  getResultById: (id: string) =>
    apiClient.get<AdverseMediaResult>(`${APISIX.ADVERSE_MEDIA}/api/v1/compliance/alerts/${id}`).then((r) => r.data),

  resolve: (id: string, body: { resolution: "cleared" | "flagged" | "escalated"; notes: string }) =>
    apiClient.post(`${APISIX.ADVERSE_MEDIA}/api/v1/compliance/alerts/${id}/resolve`, body).then((r) => r.data),
};

// ─── Adverse Media Scanner ────────────────────────────────────────────────────
export const adverseMediaScannerApi = {
  triggerScan: (body: { customerIds?: string[]; all?: boolean }) =>
    apiClient.post(`${APISIX.ADVERSE_MEDIA_SCANNER}/api/v1/compliance/aml/assess`, body).then((r) => r.data),

  getScanStatus: (jobId: string) =>
    apiClient.get(`${APISIX.ADVERSE_MEDIA_SCANNER}/api/v1/compliance/aml/assessment/${jobId}`).then((r) => r.data),

  getScanHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.ADVERSE_MEDIA_SCANNER}/api/v1/compliance/reports/tenant/all`, { params }).then((r) => r.data),

  getConfig: () =>
    apiClient.get(`${APISIX.ADVERSE_MEDIA_SCANNER}/api/v1/compliance/monitoring/rules`).then((r) => r.data),

  updateConfig: (body: { sources?: string[]; scanFrequency?: string; riskThreshold?: number }) =>
    apiClient.post(`${APISIX.ADVERSE_MEDIA_SCANNER}/api/v1/compliance/monitoring/rules`, body).then((r) => r.data),
};

// ─── Risk-Based Approach ──────────────────────────────────────────────────────
export interface RBAProfile {
  id: string;
  customerId: string;
  customerName: string;
  customerType: "individual" | "corporate" | "pep" | "correspondent_bank";
  inherentRisk: number;
  residualRisk: number;
  riskCategory: "low" | "medium" | "high" | "very_high";
  dueDiligenceLevel: "SDD" | "CDD" | "EDD";
  lastAssessedAt: string;
  nextReviewDate: string;
}

export const riskBasedApproachApi = {
  listProfiles: (params?: { page?: number; limit?: number; riskCategory?: string; dueDiligenceLevel?: string }) =>
    apiClient.get<{ items: RBAProfile[]; total: number }>(`${APISIX.RISK_BASED_APPROACH}/api/v1/profiles`, { params }).then((r) => r.data),

  getProfileByCustomer: (customerId: string) =>
    apiClient.get<RBAProfile>(`${APISIX.RISK_BASED_APPROACH}/api/v1/profiles/${customerId}`).then((r) => r.data),

  assess: (customerId: string) =>
    apiClient.post<RBAProfile>(`${APISIX.RISK_BASED_APPROACH}/api/v1/assess`, { customerId }).then((r) => r.data),

  getDistribution: () =>
    apiClient.get(`${APISIX.RISK_BASED_APPROACH}/api/v1/distribution`).then((r) => r.data),

  runBatchAssessment: () =>
    apiClient.post(`${APISIX.RISK_BASED_APPROACH}/api/v1/batch/assess`, {}).then((r) => r.data),
};

// ─── CBN Tiered KYC ───────────────────────────────────────────────────────────
export interface TieredKYCProfile {
  customerId: string;
  tier: 1 | 2 | 3;
  dailyLimit: number;
  cumulativeBalance: number;
  currency: string;
  verificationStatus: "pending" | "verified" | "failed" | "escalated";
  documentsSubmitted: string[];
  upgradeable: boolean;
  lastCheckedAt: string;
}

export const cbnTieredKYCApi = {
  getProfile: (customerId: string) =>
    apiClient.get<TieredKYCProfile>(`${APISIX.CBN_TIERED_KYC}/api/v1/kyc/${customerId}`).then((r) => r.data),

  upgradeTier: (customerId: string, body: { targetTier: 2 | 3; documents: string[] }) =>
    apiClient.post(`${APISIX.CBN_TIERED_KYC}/api/v1/kyc/${customerId}/upgrade`, body).then((r) => r.data),

  verifyBVN: (customerId: string, bvn: string) =>
    apiClient.post(`${APISIX.CBN_TIERED_KYC}/api/v1/kyc/${customerId}/verify-bvn`, { bvn }).then((r) => r.data),

  getTierLimits: () =>
    apiClient.get(`${APISIX.CBN_TIERED_KYC}/api/v1/tier-limits`).then((r) => r.data),

  listPendingUpgrades: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CBN_TIERED_KYC}/api/v1/upgrades/pending`, { params }).then((r) => r.data),
};
