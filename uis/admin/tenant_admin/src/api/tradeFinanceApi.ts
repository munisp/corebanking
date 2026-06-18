/**
 * Trade Finance API — APISIX Route Registry
 *
 * ┌──────────────────────────────┬──────────────────────────┬────────────────────────────┬───────┐
 * │ UI Route                     │ APISIX Prefix            │ Backend Service            │ Port  │
 * ├──────────────────────────────┼──────────────────────────┼────────────────────────────┼───────┤
 * │ /trade-finance               │ /trade-finance           │ trade-finance-go           │ 9331  │
 * │ /bank-guarantees             │ /guarantees              │ bank-guarantees-go         │ 8080  │
 * │ /factoring                   │ /factoring               │ factoring-go               │ 8080  │
 * │ /supply-chain-finance        │ /supply-chain-finance    │ supply-chain-finance-go    │ 8158  │
 * │ /diaspora-banking            │ /diaspora                │ diaspora-banking-py        │ 8135  │
 * │ /wealth-mgmt                 │ /wealth                  │ wealth-mgmt-py             │ 8168  │
 * │ /portfolio-mgmt              │ /portfolio               │ portfolio-mgmt-rs          │ 8167  │
 * │ /custody-service             │ /custody                 │ custody-service-go         │ 9251  │
 * │ /trust-estate                │ /trust-estate            │ trust-estate-rs            │ 8185  │
 * └──────────────────────────────┴──────────────────────────┴────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Trade Finance ────────────────────────────────────────────────────────────
export interface TradeFinanceTransaction {
  id: string;
  transactionRef: string;
  type: "LC" | "BG" | "DC" | "SBLC" | "invoice_finance";
  applicantId: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  issuingBank: string;
  correspondentBank?: string;
  expiryDate: string;
  status: string;
  createdAt: string;
}

export interface LetterOfCredit {
  id: string;
  lcRef: string;
  type: "irrevocable" | "revocable" | "standby" | "confirmed";
  applicantId: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  amount: number;
  currency: string;
  availableBy: string;
  expiryDate: string;
  placeOfExpiry: string;
  status: string;
  issuedAt?: string;
}

export const tradeFinanceApi = {
  listTransactions: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: TradeFinanceTransaction[]; total: number }>(`${APISIX.TRADE_FINANCE}/api/v1/trade/transactions`, { params }).then((r) => r.data),

  getTransactionById: (id: string) =>
    apiClient.get<TradeFinanceTransaction>(`${APISIX.TRADE_FINANCE}/api/v1/trade/transactions/${id}`).then((r) => r.data),

  listLCs: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: LetterOfCredit[]; total: number }>(`${APISIX.TRADE_FINANCE}/api/v1/lc`, { params }).then((r) => r.data),

  getLCById: (id: string) =>
    apiClient.get<LetterOfCredit>(`${APISIX.TRADE_FINANCE}/api/v1/lc/${id}`).then((r) => r.data),

  issuLC: (body: Partial<LetterOfCredit>) =>
    apiClient.post<LetterOfCredit>(`${APISIX.TRADE_FINANCE}/api/v1/lc`, body).then((r) => r.data),

  amendLC: (id: string, body: Partial<LetterOfCredit>) =>
    apiClient.put(`${APISIX.TRADE_FINANCE}/api/v1/lc/${id}`, body).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.TRADE_FINANCE}/api/v1/stats`).then((r) => r.data),
};

// ─── Bank Guarantees ──────────────────────────────────────────────────────────
export interface BankGuarantee {
  id: string;
  guaranteeRef: string;
  type: "performance" | "advance_payment" | "bid_bond" | "financial" | "customs";
  applicantId: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  amount: number;
  currency: string;
  expiryDate: string;
  underlyingContractRef?: string;
  status: string;
  issuedAt?: string;
}

export const bankGuaranteesApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: BankGuarantee[]; total: number }>(`${APISIX.BANK_GUARANTEES}/api/v1/guarantees`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<BankGuarantee>(`${APISIX.BANK_GUARANTEES}/api/v1/guarantees/${id}`).then((r) => r.data),

  issue: (body: Partial<BankGuarantee>) =>
    apiClient.post<BankGuarantee>(`${APISIX.BANK_GUARANTEES}/api/v1/guarantees`, body).then((r) => r.data),

  extend: (id: string, body: { newExpiryDate: string; reason: string }) =>
    apiClient.post(`${APISIX.BANK_GUARANTEES}/api/v1/guarantees/${id}/extend`, body).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    apiClient.post(`${APISIX.BANK_GUARANTEES}/api/v1/guarantees/${id}/cancel`, { reason }).then((r) => r.data),

  getStats: () =>
    apiClient.get(`${APISIX.BANK_GUARANTEES}/api/v1/stats`).then((r) => r.data),
};

// ─── Factoring ────────────────────────────────────────────────────────────────
export interface FactoringApplication {
  id: string;
  applicationRef: string;
  clientId: string;
  clientName: string;
  invoiceCount: number;
  totalInvoiceValue: number;
  advanceRate: number;
  advanceAmount: number;
  currency: string;
  factoringType: "recourse" | "non_recourse" | "reverse";
  status: string;
  submittedAt: string;
  approvedAt?: string;
}

export interface FactoringInvoice {
  id: string;
  applicationId: string;
  invoiceRef: string;
  debtorName: string;
  invoiceAmount: number;
  currency: string;
  dueDate: string;
  status: string;
}

export const factoringApi = {
  listApplications: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: FactoringApplication[]; total: number }>(`${APISIX.FACTORING}/api/v1/applications`, { params }).then((r) => r.data),

  getApplicationById: (id: string) =>
    apiClient.get<FactoringApplication>(`${APISIX.FACTORING}/api/v1/applications/${id}`).then((r) => r.data),

  create: (body: Partial<FactoringApplication>) =>
    apiClient.post<FactoringApplication>(`${APISIX.FACTORING}/api/v1/applications`, body).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post(`${APISIX.FACTORING}/api/v1/applications/${id}/approve`, {}).then((r) => r.data),

  getInvoices: (applicationId: string) =>
    apiClient.get<{ items: FactoringInvoice[] }>(`${APISIX.FACTORING}/api/v1/applications/${applicationId}/invoices`).then((r) => r.data),

  uploadInvoices: (applicationId: string, invoices: Partial<FactoringInvoice>[]) =>
    apiClient.post(`${APISIX.FACTORING}/api/v1/applications/${applicationId}/invoices`, { invoices }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.FACTORING}/api/v1/dashboard`).then((r) => r.data),
};

// ─── Supply Chain Finance ─────────────────────────────────────────────────────
export interface SupplyChainProgram {
  id: string;
  programRef: string;
  anchorBuyerId: string;
  anchorBuyerName: string;
  programLimit: number;
  utilizedAmount: number;
  currency: string;
  discountRate: number;
  tenorDays: number;
  status: string;
  createdAt: string;
}

export interface SupplyChainInvoice {
  id: string;
  programId: string;
  supplierId: string;
  supplierName: string;
  invoiceRef: string;
  invoiceAmount: number;
  discountedAmount: number;
  currency: string;
  dueDate: string;
  status: string;
}

export const supplyChainFinanceApi = {
  listPrograms: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SupplyChainProgram[]; total: number }>(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/programs`, { params }).then((r) => r.data),

  getProgramById: (id: string) =>
    apiClient.get<SupplyChainProgram>(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/programs/${id}`).then((r) => r.data),

  createProgram: (body: Partial<SupplyChainProgram>) =>
    apiClient.post<SupplyChainProgram>(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/programs`, body).then((r) => r.data),

  listInvoices: (programId: string, params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: SupplyChainInvoice[]; total: number }>(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/programs/${programId}/invoices`, { params }).then((r) => r.data),

  discountInvoice: (programId: string, invoiceId: string) =>
    apiClient.post(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/programs/${programId}/invoices/${invoiceId}/discount`, {}).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.SUPPLY_CHAIN_FINANCE}/api/v1/dashboard`).then((r) => r.data),
};

// ─── Diaspora Banking ─────────────────────────────────────────────────────────
export interface DiasporaAccount {
  id: string;
  customerId: string;
  accountType: "NRO" | "NRE" | "FCNR" | "diaspora_investment";
  currency: string;
  balance: number;
  country: string;
  status: string;
  repatriationAllowed: boolean;
  createdAt: string;
}

export interface DiasporaRemittance {
  id: string;
  senderId: string;
  senderCountry: string;
  receiverAccountId: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  fees: number;
  status: string;
  createdAt: string;
}

export const diasporaBankingApi = {
  listAccounts: (params?: { page?: number; limit?: number; accountType?: string; status?: string }) =>
    apiClient.get<{ items: DiasporaAccount[]; total: number }>(`${APISIX.DIASPORA_BANKING}/api/v1/accounts`, { params }).then((r) => r.data),

  getAccountById: (id: string) =>
    apiClient.get<DiasporaAccount>(`${APISIX.DIASPORA_BANKING}/api/v1/accounts/${id}`).then((r) => r.data),

  openAccount: (body: Partial<DiasporaAccount>) =>
    apiClient.post<DiasporaAccount>(`${APISIX.DIASPORA_BANKING}/api/v1/accounts`, body).then((r) => r.data),

  listRemittances: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: DiasporaRemittance[]; total: number }>(`${APISIX.DIASPORA_BANKING}/api/v1/remittances`, { params }).then((r) => r.data),

  getExchangeRates: (params?: { country?: string; currency?: string }) =>
    apiClient.get(`${APISIX.DIASPORA_BANKING}/api/v1/exchange-rates`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.DIASPORA_BANKING}/api/v1/dashboard`).then((r) => r.data),
};

// ─── Wealth Management ────────────────────────────────────────────────────────
export interface WealthClient {
  id: string;
  customerId: string;
  clientName: string;
  segment: "mass_affluent" | "high_net_worth" | "ultra_high_net_worth";
  totalAUM: number;
  currency: string;
  riskProfile: "conservative" | "moderate" | "aggressive";
  relationshipManager: string;
  status: string;
  onboardedAt: string;
}

export interface WealthPortfolioSummary {
  clientId: string;
  totalValue: number;
  currency: string;
  ytdReturn: number;
  ytdReturnPct: number;
  equities: number;
  fixedIncome: number;
  alternatives: number;
  cash: number;
  asOf: string;
}

export const wealthMgmtApi = {
  listClients: (params?: { page?: number; limit?: number; segment?: string; status?: string; rmId?: string }) =>
    apiClient.get<{ items: WealthClient[]; total: number }>(`${APISIX.WEALTH_MGMT}/api/v1/clients`, { params }).then((r) => r.data),

  getClientById: (id: string) =>
    apiClient.get<WealthClient>(`${APISIX.WEALTH_MGMT}/api/v1/clients/${id}`).then((r) => r.data),

  getPortfolioSummary: (clientId: string) =>
    apiClient.get<WealthPortfolioSummary>(`${APISIX.WEALTH_MGMT}/api/v1/clients/${clientId}/portfolio`).then((r) => r.data),

  getHoldings: (clientId: string, params?: { assetClass?: string }) =>
    apiClient.get(`${APISIX.WEALTH_MGMT}/api/v1/clients/${clientId}/holdings`, { params }).then((r) => r.data),

  getPerformance: (clientId: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.WEALTH_MGMT}/api/v1/clients/${clientId}/performance`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.WEALTH_MGMT}/api/v1/dashboard`).then((r) => r.data),
};

// ─── Portfolio Management ─────────────────────────────────────────────────────
export interface Portfolio {
  id: string;
  portfolioRef: string;
  clientId: string;
  name: string;
  strategy: string;
  totalValue: number;
  currency: string;
  benchmark: string;
  ytdReturn: number;
  status: string;
  managedBy: string;
  createdAt: string;
}

export interface PortfolioHolding {
  id: string;
  portfolioId: string;
  assetClass: string;
  securityName: string;
  isin?: string;
  units: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  weight: number;
  currency: string;
}

export const portfolioMgmtApi = {
  list: (params?: { page?: number; limit?: number; clientId?: string; strategy?: string; status?: string }) =>
    apiClient.get<{ items: Portfolio[]; total: number }>(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Portfolio>(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios/${id}`).then((r) => r.data),

  create: (body: Partial<Portfolio>) =>
    apiClient.post<Portfolio>(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios`, body).then((r) => r.data),

  getHoldings: (id: string) =>
    apiClient.get<{ items: PortfolioHolding[] }>(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios/${id}/holdings`).then((r) => r.data),

  rebalance: (id: string, body: { targetAllocations: Record<string, number> }) =>
    apiClient.post(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios/${id}/rebalance`, body).then((r) => r.data),

  getPerformance: (id: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios/${id}/performance`, { params }).then((r) => r.data),

  getTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.PORTFOLIO_MGMT}/api/v1/portfolios/${id}/transactions`, { params }).then((r) => r.data),
};

// ─── Custody Service ──────────────────────────────────────────────────────────
export interface CustodyAccount {
  id: string;
  accountRef: string;
  clientId: string;
  clientName: string;
  custodyType: "full_service" | "safekeeping" | "settlement";
  totalAssets: number;
  currency: string;
  status: string;
  openedAt: string;
}

export interface CustodyHolding {
  id: string;
  custodyAccountId: string;
  securityName: string;
  isin: string;
  securityType: string;
  units: number;
  nominalValue: number;
  marketValue: number;
  currency: string;
  depositoryId: string;
}

export const custodyServiceApi = {
  listAccounts: (params?: { page?: number; limit?: number; custodyType?: string; status?: string }) =>
    apiClient.get<{ items: CustodyAccount[]; total: number }>(`${APISIX.CUSTODY_SERVICE}/api/v1/accounts`, { params }).then((r) => r.data),

  getAccountById: (id: string) =>
    apiClient.get<CustodyAccount>(`${APISIX.CUSTODY_SERVICE}/api/v1/accounts/${id}`).then((r) => r.data),

  openAccount: (body: Partial<CustodyAccount>) =>
    apiClient.post<CustodyAccount>(`${APISIX.CUSTODY_SERVICE}/api/v1/accounts`, body).then((r) => r.data),

  getHoldings: (id: string, params?: { securityType?: string }) =>
    apiClient.get<{ items: CustodyHolding[] }>(`${APISIX.CUSTODY_SERVICE}/api/v1/accounts/${id}/holdings`, { params }).then((r) => r.data),

  getCorporateActions: (params?: { page?: number; limit?: number; type?: string }) =>
    apiClient.get(`${APISIX.CUSTODY_SERVICE}/api/v1/corporate-actions`, { params }).then((r) => r.data),

  getSettlements: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get(`${APISIX.CUSTODY_SERVICE}/api/v1/settlements`, { params }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${APISIX.CUSTODY_SERVICE}/api/v1/dashboard`).then((r) => r.data),
};

// ─── Trust & Estate ───────────────────────────────────────────────────────────
export interface TrustAccount {
  id: string;
  trustRef: string;
  trustType: "revocable" | "irrevocable" | "testamentary" | "estate";
  settlorId: string;
  settlorName: string;
  beneficiaries: { name: string; share: number; relationship: string }[];
  trusteeId: string;
  totalAssets: number;
  currency: string;
  status: string;
  createdAt: string;
  terminationDate?: string;
}

export interface EstateAdministration {
  id: string;
  estateRef: string;
  deceasedName: string;
  administratorId: string;
  totalEstateValue: number;
  currency: string;
  beneficiaries: { name: string; share: number }[];
  status: string;
  probateRef?: string;
  openedAt: string;
  closedAt?: string;
}

export const trustEstateApi = {
  listTrusts: (params?: { page?: number; limit?: number; trustType?: string; status?: string }) =>
    apiClient.get<{ items: TrustAccount[]; total: number }>(`${APISIX.TRUST_ESTATE}/api/v1/trusts`, { params }).then((r) => r.data),

  getTrustById: (id: string) =>
    apiClient.get<TrustAccount>(`${APISIX.TRUST_ESTATE}/api/v1/trusts/${id}`).then((r) => r.data),

  createTrust: (body: Partial<TrustAccount>) =>
    apiClient.post<TrustAccount>(`${APISIX.TRUST_ESTATE}/api/v1/trusts`, body).then((r) => r.data),

  getTrustAssets: (id: string) =>
    apiClient.get(`${APISIX.TRUST_ESTATE}/api/v1/trusts/${id}/assets`).then((r) => r.data),

  listEstates: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: EstateAdministration[]; total: number }>(`${APISIX.TRUST_ESTATE}/api/v1/estates`, { params }).then((r) => r.data),

  getEstateById: (id: string) =>
    apiClient.get<EstateAdministration>(`${APISIX.TRUST_ESTATE}/api/v1/estates/${id}`).then((r) => r.data),

  createEstate: (body: Partial<EstateAdministration>) =>
    apiClient.post<EstateAdministration>(`${APISIX.TRUST_ESTATE}/api/v1/estates`, body).then((r) => r.data),

  distributeEstate: (id: string, body: { distributions: { beneficiaryName: string; amount: number; currency: string }[] }) =>
    apiClient.post(`${APISIX.TRUST_ESTATE}/api/v1/estates/${id}/distribute`, body).then((r) => r.data),
};
