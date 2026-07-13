/**
 * Agriculture API — APISIX Route Registry
 *
 * ┌─────────────────────────────────────┬────────────────────────────────┬────────────────────────────────────┬───────┐
 * │ UI Route                            │ APISIX Prefix                  │ Backend Service                    │ Port  │
 * ├─────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────┼───────┤
 * │ /agriculture-*                      │ /agriculture                   │ agricultural-service               │ 8015  │
 * │ /agriculture-banking                │ /agriculture-banking           │ agriculture-banking-rs             │ 9571  │
 * │ /crop-yield-prediction              │ /crop-yield-prediction         │ crop-yield-prediction-py           │ 9129  │
 * │ /farm-boundary-mapping              │ /farm-boundary-mapping         │ farm-boundary-mapping-rs           │ 9579  │
 * │ /satellite-crop-monitor             │ /satellite-crop-monitor        │ satellite-crop-monitor-rs          │ 9589  │
 * │ /livestock-finance                  │ /livestock-finance             │ livestock-finance-rs               │ 9255  │
 * │ /livestock-management               │ /livestock-management          │ livestock-management-rs            │ 9257  │
 * │ /commodity-exchange                 │ /commodity-exchange            │ commodity-exchange-rs              │ 9214  │
 * │ /commodity-price-intelligence       │ /commodity-price-intelligence  │ commodity-price-intelligence-py    │ 9643  │
 * │ /warehouse-management               │ /warehouse-management          │ warehouse-management-go            │ 9079  │
 * │ /fisheries-aquaculture              │ /fisheries-aquaculture         │ fisheries-aquaculture-go           │ 9580  │
 * │ /crossborder-agri-trade             │ /crossborder-agri-trade        │ crossborder-agri-trade-rs          │ 9576  │
 * │ /area-yield-index-insurance         │ /area-yield-index-insurance    │ area-yield-index-insurance-py      │ 9602  │
 * │ /agri-evoucher                      │ /agri-evoucher                 │ agri-evoucher-go                   │ 9565  │
 * │ /agri-iot-sensor                    │ /agri-iot-sensor               │ agri-iot-sensor-rs                 │ 9567  │
 * │ /agri-logistics                     │ /agri-logistics                │ agri-logistics-go                  │ 9568  │
 * │ /agri-savings-cycles                │ /agri-savings-cycles           │ agri-savings-cycles-go             │ 9301  │
 * │ /agri-reinsurance                   │ /agri-reinsurance              │ agri-reinsurance-go                │ 9569  │
 * │ /agri-input-marketplace             │ /agri-input-marketplace        │ agri-input-marketplace-go          │ 9566  │
 * │ /agri-esg-impact                    │ /agri-esg-impact               │ agri-esg-impact-py                 │ 9564  │
 * │ /cbn-agri-returns                   │ /cbn-agri-returns              │ cbn-agri-returns-py                │ 9247  │
 * │ /cbn-anchor-borrowers               │ /cbn                           │ cbn-anchor-borrowers-go            │ 9107  │
 * │ /nirsal-agro-geocoop                │ /agriculture                   │ nirsal-agro-geocoop (via agri svc) │ 9109  │
 * └─────────────────────────────────────┴────────────────────────────────┴────────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Agricultural Service (Farmers, Farms, AgTech, Partners, etc.) ────────────
export interface Farmer {
  id: string;
  farmerId: string;
  customerId: string;
  fullName: string;
  bvn?: string;
  farmCount: number;
  totalFarmArea: number;
  areaUnit: string;
  primaryCrop: string;
  state: string;
  lga: string;
  status: "active" | "inactive";
  registeredAt: string;
}

export interface Farm {
  id: string;
  farmRef: string;
  farmerId: string;
  farmName: string;
  area: number;
  areaUnit: string;
  cropTypes: string[];
  state: string;
  lga: string;
  coordinates?: { lat: number; lng: number };
  soilType?: string;
  irrigated: boolean;
  status: "active" | "fallow" | "inactive";
}

export interface AgriPartner {
  id: string;
  name: string;
  partnerType: "input_supplier" | "off_taker" | "aggregator" | "extension_agent" | "insurer";
  state: string;
  status: "active" | "inactive";
  contactEmail: string;
  contactPhone: string;
}

export const agricultureApi = {
  listFarmers: (params?: { page?: number; limit?: number; state?: string; status?: string; q?: string }) =>
    apiClient.get<{ items: Farmer[]; total: number }>(`${APISIX.AGRICULTURE}/v1/farmers`, { params }).then((r) => r.data),

  getFarmerById: (id: string) =>
    apiClient.get<Farmer>(`${APISIX.AGRICULTURE}/v1/farmers/${id}`).then((r) => r.data),

  onboardFarmer: (body: Partial<Farmer>) =>
    apiClient.post<Farmer>(`${APISIX.AGRICULTURE}/v1/farmers`, body).then((r) => r.data),

  listFarms: (params?: { page?: number; limit?: number; farmerId?: string; state?: string; cropType?: string }) =>
    apiClient.get<{ items: Farm[]; total: number }>(`${APISIX.AGRICULTURE}/v1/farms`, { params }).then((r) => r.data),

  getFarmById: (id: string) =>
    apiClient.get<Farm>(`${APISIX.AGRICULTURE}/v1/farms/${id}`).then((r) => r.data),

  registerFarm: (body: Partial<Farm>) =>
    apiClient.post<Farm>(`${APISIX.AGRICULTURE}/v1/farms`, body).then((r) => r.data),

  listAgTechDevices: (params?: { page?: number; limit?: number; farmId?: string; status?: string }) =>
    apiClient.get(`${APISIX.AGRICULTURE}/v1/agtech/devices`, { params }).then((r) => r.data),

  getAgriculturalAnalytics: (params?: { state?: string; season?: string }) =>
    apiClient.get(`${APISIX.AGRICULTURE}/v1/analytics`, { params }).then((r) => r.data),

  listPartners: (params?: { page?: number; limit?: number; partnerType?: string; status?: string }) =>
    apiClient.get<{ items: AgriPartner[]; total: number }>(`${APISIX.AGRICULTURE}/v1/partners`, { params }).then((r) => r.data),

};

// ─── Crop Yield Prediction ────────────────────────────────────────────────────
export interface CropYieldPrediction {
  farmId: string;
  cropType: string;
  season: string;
  predictedYield: number;
  unit: string;
  confidence: number;
  factors: { name: string; impact: number }[];
  generatedAt: string;
}

export const cropYieldPredictionApi = {
  predict: (body: { farmId: string; cropType: string; season: string }) =>
    apiClient.post<CropYieldPrediction>(`${APISIX.CROP_YIELD_PREDICTION}/v1/predict`, body).then((r) => r.data),

  getByFarm: (farmId: string, params?: { season?: string; cropType?: string }) =>
    apiClient.get<{ items: CropYieldPrediction[] }>(`${APISIX.CROP_YIELD_PREDICTION}/v1/predictions/${farmId}`, { params }).then((r) => r.data),

  runBatchPrediction: (body: { farmIds: string[]; season: string }) =>
    apiClient.post(`${APISIX.CROP_YIELD_PREDICTION}/v1/batch/predict`, body).then((r) => r.data),

  getModelMetrics: () =>
    apiClient.get(`${APISIX.CROP_YIELD_PREDICTION}/v1/model/metrics`).then((r) => r.data),
};

// ─── Farm Boundary Mapping ────────────────────────────────────────────────────
export interface FarmBoundary {
  farmId: string;
  area: number;
  areaUnit: string;
  geometry: { type: string; coordinates: number[][][] };
  capturedAt: string;
  capturedBy: string;
  verificationStatus: "pending" | "verified" | "disputed";
}

export const farmBoundaryMappingApi = {
  getBoundary: (farmId: string) =>
    apiClient.get<FarmBoundary>(`${APISIX.FARM_BOUNDARY_MAPPING}/v1/boundaries/${farmId}`).then((r) => r.data),

  saveBoundary: (farmId: string, body: Partial<FarmBoundary>) =>
    apiClient.post<FarmBoundary>(`${APISIX.FARM_BOUNDARY_MAPPING}/v1/boundaries/${farmId}`, body).then((r) => r.data),

  verifyBoundary: (farmId: string) =>
    apiClient.post(`${APISIX.FARM_BOUNDARY_MAPPING}/v1/boundaries/${farmId}/verify`, {}).then((r) => r.data),

  getConflicts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.FARM_BOUNDARY_MAPPING}/v1/conflicts`, { params }).then((r) => r.data),
};

// ─── Satellite Crop Monitor ───────────────────────────────────────────────────
export const satelliteCropMonitorApi = {
  getMonitoringData: (farmId: string, params?: { from?: string; to?: string; indicator?: string }) =>
    apiClient.get(`${APISIX.SATELLITE_CROP_MONITOR}/v1/farms/${farmId}/monitoring`, { params }).then((r) => r.data),

  getNDVIHistory: (farmId: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.SATELLITE_CROP_MONITOR}/v1/farms/${farmId}/ndvi`, { params }).then((r) => r.data),

  getCropStressAlerts: (params?: { page?: number; limit?: number; severity?: string }) =>
    apiClient.get(`${APISIX.SATELLITE_CROP_MONITOR}/v1/alerts`, { params }).then((r) => r.data),

  getRegionalSummary: (params?: { state?: string }) =>
    apiClient.get(`${APISIX.SATELLITE_CROP_MONITOR}/v1/regional-summary`, { params }).then((r) => r.data),
};

// ─── Livestock Finance ────────────────────────────────────────────────────────
export interface LivestockLoan {
  id: string;
  loanRef: string;
  farmerId: string;
  livestockType: string;
  quantity: number;
  unitValue: number;
  loanAmount: number;
  currency: string;
  interestRate: number;
  tenor: number;
  status: string;
  disbursedAt?: string;
}

export const livestockFinanceApi = {
  listLoans: (params?: { page?: number; limit?: number; livestockType?: string; status?: string }) =>
    apiClient.get<{ items: LivestockLoan[]; total: number }>(`${APISIX.LIVESTOCK_FINANCE}/v1/loans`, { params }).then((r) => r.data),

  getLoanById: (id: string) =>
    apiClient.get<LivestockLoan>(`${APISIX.LIVESTOCK_FINANCE}/v1/loans/${id}`).then((r) => r.data),

  create: (body: Partial<LivestockLoan>) =>
    apiClient.post<LivestockLoan>(`${APISIX.LIVESTOCK_FINANCE}/v1/loans`, body).then((r) => r.data),

  approveLoan: (id: string) =>
    apiClient.post(`${APISIX.LIVESTOCK_FINANCE}/v1/loans/${id}/approve`, {}).then((r) => r.data),

  getValuations: (params?: { livestockType?: string }) =>
    apiClient.get(`${APISIX.LIVESTOCK_FINANCE}/v1/valuations`, { params }).then((r) => r.data),
};

// ─── Livestock Management ─────────────────────────────────────────────────────
export interface LivestockRecord {
  id: string;
  recordRef: string;
  farmerId: string;
  farmId: string;
  livestockType: string;
  breed?: string;
  quantity: number;
  estimatedValue: number;
  currency: string;
  healthStatus: "healthy" | "sick" | "quarantine" | "deceased";
  tagIds?: string[];
  registeredAt: string;
}

export const livestockMgmtApi = {
  list: (params?: { page?: number; limit?: number; farmerId?: string; livestockType?: string; healthStatus?: string }) =>
    apiClient.get<{ items: LivestockRecord[]; total: number }>(`${APISIX.LIVESTOCK_MGMT}/v1/livestock`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<LivestockRecord>(`${APISIX.LIVESTOCK_MGMT}/v1/livestock/${id}`).then((r) => r.data),

  register: (body: Partial<LivestockRecord>) =>
    apiClient.post<LivestockRecord>(`${APISIX.LIVESTOCK_MGMT}/v1/livestock`, body).then((r) => r.data),

  updateHealthStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`${APISIX.LIVESTOCK_MGMT}/v1/livestock/${id}/health`, { status, notes }).then((r) => r.data),

  getHealthAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.LIVESTOCK_MGMT}/v1/health-alerts`, { params }).then((r) => r.data),
};

// ─── Commodity Exchange ───────────────────────────────────────────────────────
export interface CommodityListing {
  id: string;
  listingRef: string;
  sellerId: string;
  commodity: string;
  grade: string;
  quantity: number;
  unit: string;
  askPrice: number;
  currency: string;
  location: string;
  status: "active" | "sold" | "expired" | "cancelled";
  expiresAt: string;
}

export const commodityExchangeApi = {
  listListings: (params?: { page?: number; limit?: number; commodity?: string; status?: string; location?: string }) =>
    apiClient.get<{ items: CommodityListing[]; total: number }>(`${APISIX.COMMODITY_EXCHANGE}/v1/listings`, { params }).then((r) => r.data),

  getListingById: (id: string) =>
    apiClient.get<CommodityListing>(`${APISIX.COMMODITY_EXCHANGE}/v1/listings/${id}`).then((r) => r.data),

  createListing: (body: Partial<CommodityListing>) =>
    apiClient.post<CommodityListing>(`${APISIX.COMMODITY_EXCHANGE}/v1/listings`, body).then((r) => r.data),

  placeBid: (listingId: string, body: { buyerId: string; bidPrice: number; quantity: number }) =>
    apiClient.post(`${APISIX.COMMODITY_EXCHANGE}/v1/listings/${listingId}/bids`, body).then((r) => r.data),

  getMarketPrices: (params?: { commodity?: string }) =>
    apiClient.get(`${APISIX.COMMODITY_EXCHANGE}/v1/prices`, { params }).then((r) => r.data),
};

// ─── Warehouse Management ─────────────────────────────────────────────────────
export interface WarehouseReceipt {
  id: string;
  receiptRef: string;
  warehouseId: string;
  depositorId: string;
  commodity: string;
  quantity: number;
  unit: string;
  grade: string;
  valueAtDeposit: number;
  currency: string;
  status: "active" | "pledged" | "redeemed" | "expired";
  depositedAt: string;
  expiresAt: string;
}

export const warehouseMgmtApi = {
  listReceipts: (params?: { page?: number; limit?: number; status?: string; warehouseId?: string }) =>
    apiClient.get<{ items: WarehouseReceipt[]; total: number }>(`${APISIX.WAREHOUSE_MGMT}/v1/receipts`, { params }).then((r) => r.data),

  getReceiptById: (id: string) =>
    apiClient.get<WarehouseReceipt>(`${APISIX.WAREHOUSE_MGMT}/v1/receipts/${id}`).then((r) => r.data),

  issueReceipt: (body: Partial<WarehouseReceipt>) =>
    apiClient.post<WarehouseReceipt>(`${APISIX.WAREHOUSE_MGMT}/v1/receipts`, body).then((r) => r.data),

  pledgeReceipt: (id: string, body: { pledgedTo: string; loanRef: string }) =>
    apiClient.post(`${APISIX.WAREHOUSE_MGMT}/v1/receipts/${id}/pledge`, body).then((r) => r.data),

  redeemReceipt: (id: string) =>
    apiClient.post(`${APISIX.WAREHOUSE_MGMT}/v1/receipts/${id}/redeem`, {}).then((r) => r.data),

  listWarehouses: (params?: { page?: number; limit?: number; state?: string }) =>
    apiClient.get(`${APISIX.WAREHOUSE_MGMT}/v1/warehouses`, { params }).then((r) => r.data),
};

// ─── CBN Anchor Borrowers ─────────────────────────────────────────────────────
export interface AnchorBorrowersApplication {
  id: string;
  applicationRef: string;
  farmerId: string;
  farmerName: string;
  cropType: string;
  farmArea: number;
  loanAmount: number;
  currency: string;
  aggregatorId: string;
  status: "pending" | "approved" | "disbursed" | "repaid" | "defaulted";
  submittedAt: string;
}

export const cbnAnchorBorrowersApi = {
  listApplications: (params?: { page?: number; limit?: number; status?: string; cropType?: string }) =>
    apiClient.get<{ items: AnchorBorrowersApplication[]; total: number }>(`${APISIX.CBN_ANCHOR_BORROWERS}/v1/applications`, { params }).then((r) => r.data),

  getApplicationById: (id: string) =>
    apiClient.get<AnchorBorrowersApplication>(`${APISIX.CBN_ANCHOR_BORROWERS}/v1/applications/${id}`).then((r) => r.data),

  submit: (body: Partial<AnchorBorrowersApplication>) =>
    apiClient.post<AnchorBorrowersApplication>(`${APISIX.CBN_ANCHOR_BORROWERS}/v1/applications`, body).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post(`${APISIX.CBN_ANCHOR_BORROWERS}/v1/applications/${id}/approve`, {}).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.CBN_ANCHOR_BORROWERS}/v1/dashboard`).then((r) => r.data),
};

// ─── NIRSAL AgroGeoCoop ───────────────────────────────────────────────────────
export const nirsalAgroGeocoopApi = {
  listMembers: (params?: { page?: number; limit?: number; state?: string; status?: string }) =>
    apiClient.get(`${APISIX.NIRSAL_AGRO_GEOCOOP}/v1/members`, { params }).then((r) => r.data),

  getMemberById: (id: string) =>
    apiClient.get(`${APISIX.NIRSAL_AGRO_GEOCOOP}/v1/members/${id}`).then((r) => r.data),

  registerMember: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.NIRSAL_AGRO_GEOCOOP}/v1/members`, body).then((r) => r.data),

  getGeospatialData: (params?: { state?: string; lga?: string }) =>
    apiClient.get(`${APISIX.NIRSAL_AGRO_GEOCOOP}/v1/geospatial`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.NIRSAL_AGRO_GEOCOOP}/v1/dashboard`).then((r) => r.data),
};

// ─── Fisheries & Aquaculture ──────────────────────────────────────────────────
export const fisheriesAquacultureApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/list`, { params }).then((r) => r.data),

  create: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/create`, body).then((r) => r.data),

  update: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/update`, body).then((r) => r.data),

  process: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/stats`).then((r) => r.data),

  score: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/score`, body).then((r) => r.data),

  validate: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.FISHERIES_AQUACULTURE}/v1/fisheries-aquaculture/validate`, body).then((r) => r.data),
};

// ─── Crossborder Agri Trade ───────────────────────────────────────────────────
export const crossborderAgriTradeApi = {
  listRecords: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CROSSBORDER_AGRI_TRADE}/v1/records`, { params }).then((r) => r.data),

  assessTrade: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.CROSSBORDER_AGRI_TRADE}/v1/assess_trade`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.CROSSBORDER_AGRI_TRADE}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CROSSBORDER_AGRI_TRADE}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Commodity Price Intelligence ─────────────────────────────────────────────
export const commodityPriceIntelApi = {
  listPrices: (params?: { commodity?: string; page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.COMMODITY_PRICE_INTEL}/v1/prices`, { params }).then((r) => r.data),

  getPriceTrend: (commodity: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.COMMODITY_PRICE_INTEL}/v1/prices/${commodity}/trend`, { params }).then((r) => r.data),

  getForecast: (body: { commodity: string; horizon: number }) =>
    apiClient.post(`${APISIX.COMMODITY_PRICE_INTEL}/v1/forecast`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.COMMODITY_PRICE_INTEL}/v1/stats`).then((r) => r.data),
};

// ─── CBN Agri Returns ─────────────────────────────────────────────────────────
export const cbnAgriReturnsApi = {
  listReturns: (params?: { page?: number; limit?: number; status?: string; period?: string }) =>
    apiClient.get(`${APISIX.CBN_AGRI_RETURNS}/v1/returns`, { params }).then((r) => r.data),

  createReturn: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.CBN_AGRI_RETURNS}/v1/create`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.CBN_AGRI_RETURNS}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.CBN_AGRI_RETURNS}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Area Yield Index Insurance ───────────────────────────────────────────────
export const areaYieldIndexInsuranceApi = {
  listPolicies: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/records`, { params }).then((r) => r.data),

  createPolicy: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/create`, body).then((r) => r.data),

  updatePolicy: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/area-yield-index-insurance/update`, body).then((r) => r.data),

  processPolicy: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/area-yield-index-insurance/process`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AREA_YIELD_INDEX_INSURANCE}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Agriculture Banking (RS) ─────────────────────────────────────────────────
export const agricultureBankingApi = {
  listRecords: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AGRICULTURE_BANKING_RS}/v1/records`, { params }).then((r) => r.data),

  assessFarm: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRICULTURE_BANKING_RS}/v1/assess_farm`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRICULTURE_BANKING_RS}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRICULTURE_BANKING_RS}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Agri Reinsurance ─────────────────────────────────────────────────────────
export const agriReinsuranceApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/list`, { params }).then((r) => r.data),

  create: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/create`, body).then((r) => r.data),

  update: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/update`, body).then((r) => r.data),

  process: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/stats`).then((r) => r.data),

  yieldScore: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/yield-score`, body).then((r) => r.data),

  riskAssess: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_REINSURANCE}/v1/agri-reinsurance/risk-assess`, body).then((r) => r.data),
};

// ─── Agri Input Marketplace ───────────────────────────────────────────────────
export const agriInputMarketplaceApi = {
  list: (params?: { page?: number; limit?: number; category?: string; status?: string }) =>
    apiClient.get(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/list`, { params }).then((r) => r.data),

  create: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/create`, body).then((r) => r.data),

  update: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/update`, body).then((r) => r.data),

  process: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/stats`).then((r) => r.data),

  yieldScore: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/yield-score`, body).then((r) => r.data),

  riskAssess: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_INPUT_MARKETPLACE}/v1/agri-input-marketplace/risk-assess`, body).then((r) => r.data),
};

// ─── Agri ESG Impact ─────────────────────────────────────────────────────────
export const agriEsgImpactApi = {
  listRecords: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_ESG_IMPACT}/v1/records`, { params }).then((r) => r.data),

  createRecord: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_ESG_IMPACT}/v1/create`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_ESG_IMPACT}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_ESG_IMPACT}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Agri eVoucher ───────────────────────────────────────────────────────────
export const agriEvoucherApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/list`, { params }).then((r) => r.data),

  create: (body: { farmerId: string; type: string; value: number; currency: string; supplierId: string }) =>
    apiClient.post(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/create`, body).then((r) => r.data),

  process: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/stats`).then((r) => r.data),

  yieldScore: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/yield-score`, body).then((r) => r.data),

  riskAssess: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_EVOUCHER}/v1/agri-evoucher/risk-assess`, body).then((r) => r.data),
};

// ─── Agri IoT Sensor ─────────────────────────────────────────────────────────
export const agriIotSensorApi = {
  listData: (params?: { farmId?: string; from?: string; to?: string; metric?: string }) =>
    apiClient.get(`${APISIX.AGRI_IOT_SENSOR}/v1/records`, { params }).then((r) => r.data),

  processSensor: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_IOT_SENSOR}/v1/process_sensor`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_IOT_SENSOR}/v1/stats`).then((r) => r.data),

  getAlerts: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_IOT_SENSOR}/v1/alerts`, { params }).then((r) => r.data),
};

// ─── Agri Logistics ──────────────────────────────────────────────────────────
export const agriLogisticsApi = {
  listOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/list`, { params }).then((r) => r.data),

  createOrder: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/create`, body).then((r) => r.data),

  updateOrder: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/update`, body).then((r) => r.data),

  processOrder: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/stats`).then((r) => r.data),

  yieldScore: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/yield-score`, body).then((r) => r.data),

  riskAssess: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_LOGISTICS}/v1/agri-logistics/risk-assess`, body).then((r) => r.data),
};

// ─── Agri Savings Cycles ─────────────────────────────────────────────────────
export const agriSavingsCyclesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/list`, { params }).then((r) => r.data),

  create: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/create`, body).then((r) => r.data),

  update: (body: Record<string, unknown>) =>
    apiClient.put(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/update`, body).then((r) => r.data),

  process: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/process`, body).then((r) => r.data),

  getAudit: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/audit`, { params }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/stats`).then((r) => r.data),

  yieldScore: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/yield-score`, body).then((r) => r.data),

  riskAssess: (body: Record<string, unknown>) =>
    apiClient.post(`${APISIX.AGRI_SAVINGS_CYCLES}/v1/agri-savings-cycles/risk-assess`, body).then((r) => r.data),
};
