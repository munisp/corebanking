/**
 * Cooperative & Groups API — APISIX Route Registry
 *
 * ┌──────────────────────────────────┬──────────────────────────────┬────────────────────────────────┬───────┐
 * │ UI Route                         │ APISIX Prefix                │ Backend Service                │ Port  │
 * ├──────────────────────────────────┼──────────────────────────────┼────────────────────────────────┼───────┤
 * │ /cooperative-management          │ /cooperative-management      │ cooperative-management-go      │ 9089  │
 * │ /cooperative-financials          │ /cooperative-financials      │ cooperative-financials-py      │ 9246  │
 * │ /cooperative-meetings            │ /cooperative-meetings        │ cooperative-meetings-go        │ 9032  │
 * │ /esusu-groups                    │ /esusu-groups                │ esusu-groups-go                │ 8080  │
 * │ /group-lending                   │ /group-lending               │ group-lending-go               │ 9273  │
 * │ /cooperative-credit-scoring      │ /cooperative-credit-scoring  │ cooperative-credit-scoring-py  │ 9245  │
 * └──────────────────────────────────┴──────────────────────────────┴────────────────────────────────┴───────┘
 */

import apiClient from "@/services/api";
import { APISIX } from "./registry";

// ─── Cooperative Management ───────────────────────────────────────────────────
export interface Cooperative {
  id: string;
  coopRef: string;
  name: string;
  type: "savings" | "credit" | "multi_purpose" | "farmers";
  registrationNumber: string;
  chairperson: string;
  memberCount: number;
  totalSavings: number;
  totalLoans: number;
  currency: string;
  status: "active" | "inactive" | "suspended";
  registeredAt: string;
  address: string;
}

export interface CooperativeMember {
  id: string;
  coopId: string;
  customerId: string;
  memberName: string;
  membershipRef: string;
  shareCount: number;
  savingsBalance: number;
  loanBalance: number;
  status: "active" | "inactive" | "suspended";
  joinedAt: string;
}

export const cooperativeMgmtApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string; q?: string }) =>
    apiClient.get<{ items: Cooperative[]; total: number }>(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Cooperative>(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${id}`).then((r) => r.data),

  create: (body: Partial<Cooperative>) =>
    apiClient.post<Cooperative>(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives`, body).then((r) => r.data),

  update: (id: string, body: Partial<Cooperative>) =>
    apiClient.put(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${id}`, body).then((r) => r.data),

  getMembers: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: CooperativeMember[]; total: number }>(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${id}/members`, { params }).then((r) => r.data),

  addMember: (id: string, body: { customerId: string; shareCount?: number }) =>
    apiClient.post<CooperativeMember>(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${id}/members`, body).then((r) => r.data),

  removeMember: (coopId: string, memberId: string, reason: string) =>
    apiClient.post(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${coopId}/members/${memberId}/remove`, { reason }).then((r) => r.data),

  getDashboard: (id: string) =>
    apiClient.get(`${APISIX.COOPERATIVE_MGMT}/api/v1/cooperatives/${id}/dashboard`).then((r) => r.data),
};

// ─── Cooperative Financials ───────────────────────────────────────────────────
export interface CooperativeFinancials {
  coopId: string;
  totalAssets: number;
  totalLiabilities: number;
  memberEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  netSurplus: number;
  currency: string;
  period: string;
}

export const cooperativeFinancialsApi = {
  getSummary: (coopId: string, params?: { period?: string }) =>
    apiClient.get<CooperativeFinancials>(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/financials`, { params }).then((r) => r.data),

  getIncomeStatement: (coopId: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/income-statement`, { params }).then((r) => r.data),

  getBalanceSheet: (coopId: string, params?: { asOf?: string }) =>
    apiClient.get(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/balance-sheet`, { params }).then((r) => r.data),

  getDividendCalculation: (coopId: string, period: string) =>
    apiClient.post(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/dividends/calculate`, { period }).then((r) => r.data),

  approveDividends: (coopId: string, period: string) =>
    apiClient.post(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/dividends/approve`, { period }).then((r) => r.data),

  getShareLedger: (coopId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${APISIX.COOPERATIVE_FINANCIALS}/api/v1/cooperatives/${coopId}/share-ledger`, { params }).then((r) => r.data),
};

// ─── Cooperative Meetings ─────────────────────────────────────────────────────
export interface CooperativeMeeting {
  id: string;
  coopId: string;
  meetingType: "AGM" | "EGM" | "board" | "committee";
  title: string;
  scheduledAt: string;
  venue: string;
  agenda: string[];
  quorum: number;
  attendees?: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  minutesUrl?: string;
}

export const cooperativeMeetingsApi = {
  list: (coopId: string, params?: { page?: number; limit?: number; meetingType?: string; status?: string }) =>
    apiClient.get<{ items: CooperativeMeeting[]; total: number }>(`${APISIX.COOPERATIVE_MEETINGS}/api/v1/cooperatives/${coopId}/meetings`, { params }).then((r) => r.data),

  getById: (coopId: string, meetingId: string) =>
    apiClient.get<CooperativeMeeting>(`${APISIX.COOPERATIVE_MEETINGS}/api/v1/cooperatives/${coopId}/meetings/${meetingId}`).then((r) => r.data),

  schedule: (coopId: string, body: Partial<CooperativeMeeting>) =>
    apiClient.post<CooperativeMeeting>(`${APISIX.COOPERATIVE_MEETINGS}/api/v1/cooperatives/${coopId}/meetings`, body).then((r) => r.data),

  uploadMinutes: (coopId: string, meetingId: string, body: FormData) =>
    apiClient.post(`${APISIX.COOPERATIVE_MEETINGS}/api/v1/cooperatives/${coopId}/meetings/${meetingId}/minutes`, body, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),

  recordAttendance: (coopId: string, meetingId: string, body: { attendees: string[] }) =>
    apiClient.post(`${APISIX.COOPERATIVE_MEETINGS}/api/v1/cooperatives/${coopId}/meetings/${meetingId}/attendance`, body).then((r) => r.data),
};

// ─── Esusu Groups ─────────────────────────────────────────────────────────────
export interface EsusuGroup {
  id: string;
  groupRef: string;
  name: string;
  memberCount: number;
  contributionAmount: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly";
  currentBeneficiary?: string;
  cycleNumber: number;
  status: "active" | "paused" | "completed";
  createdAt: string;
}

export interface EsusuContribution {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  amount: number;
  currency: string;
  cycleNumber: number;
  paidAt?: string;
  status: "pending" | "paid" | "overdue";
}

export const esusuGroupsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<{ items: EsusuGroup[]; total: number }>(`${APISIX.ESUSU_GROUPS}/v1/groups`, { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<EsusuGroup>(`${APISIX.ESUSU_GROUPS}/v1/groups/${id}`).then((r) => r.data),

  create: (body: Partial<EsusuGroup>) =>
    apiClient.post<EsusuGroup>(`${APISIX.ESUSU_GROUPS}/v1/groups`, body).then((r) => r.data),

  getContributions: (id: string, params?: { page?: number; limit?: number; cycleNumber?: number }) =>
    apiClient.get<{ items: EsusuContribution[]; total: number }>(`${APISIX.ESUSU_GROUPS}/v1/groups/${id}/contributions`, { params }).then((r) => r.data),

  recordContribution: (id: string, body: { memberId: string; amount: number; cycleNumber: number }) =>
    apiClient.post<EsusuContribution>(`${APISIX.ESUSU_GROUPS}/v1/groups/${id}/contributions`, body).then((r) => r.data),

  disburse: (id: string, body: { beneficiaryId: string; cycleNumber: number }) =>
    apiClient.post(`${APISIX.ESUSU_GROUPS}/v1/groups/${id}/disburse`, body).then((r) => r.data),
};

// ─── Group Lending ────────────────────────────────────────────────────────────
export interface LendingGroup {
  id: string;
  groupRef: string;
  name: string;
  type: "joint_liability" | "solidarity" | "village_banking";
  memberCount: number;
  totalLoanAmount: number;
  currency: string;
  guarantorIds: string[];
  status: string;
  createdAt: string;
}

export interface GroupLoan {
  id: string;
  groupId: string;
  loanRef: string;
  totalAmount: number;
  memberAllocations: { memberId: string; memberName: string; amount: number }[];
  currency: string;
  interestRate: number;
  tenor: number;
  status: string;
  disbursedAt?: string;
}

export const groupLendingApi = {
  listGroups: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    apiClient.get<{ items: LendingGroup[]; total: number }>(`${APISIX.GROUP_LENDING}/v1/groups`, { params }).then((r) => r.data),

  getGroupById: (id: string) =>
    apiClient.get<LendingGroup>(`${APISIX.GROUP_LENDING}/v1/groups/${id}`).then((r) => r.data),

  createGroup: (body: Partial<LendingGroup>) =>
    apiClient.post<LendingGroup>(`${APISIX.GROUP_LENDING}/v1/groups`, body).then((r) => r.data),

  listLoans: (params?: { page?: number; limit?: number; groupId?: string; status?: string }) =>
    apiClient.get<{ items: GroupLoan[]; total: number }>(`${APISIX.GROUP_LENDING}/v1/loans`, { params }).then((r) => r.data),

  createLoan: (body: Partial<GroupLoan>) =>
    apiClient.post<GroupLoan>(`${APISIX.GROUP_LENDING}/v1/loans`, body).then((r) => r.data),

  getLoanById: (id: string) =>
    apiClient.get<GroupLoan>(`${APISIX.GROUP_LENDING}/v1/loans/${id}`).then((r) => r.data),

  approveLoan: (id: string) =>
    apiClient.post(`${APISIX.GROUP_LENDING}/v1/loans/${id}/approve`, {}).then((r) => r.data),

  disburseLoan: (id: string) =>
    apiClient.post(`${APISIX.GROUP_LENDING}/v1/loans/${id}/disburse`, {}).then((r) => r.data),
};

// ─── Cooperative Credit Scoring ───────────────────────────────────────────────
export interface CooperativeCreditScore {
  coopId: string;
  memberId: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  savingsHistory: number;
  loanRepaymentHistory: number;
  attendanceScore: number;
  guarantorScore: number;
  computedAt: string;
}

export const cooperativeCreditScoringApi = {
  scoreMember: (coopId: string, memberId: string) =>
    apiClient.post<CooperativeCreditScore>(`${APISIX.COOPERATIVE_CREDIT}/v1/score`, { coopId, memberId }).then((r) => r.data),

  getMemberScore: (coopId: string, memberId: string) =>
    apiClient.get<CooperativeCreditScore>(`${APISIX.COOPERATIVE_CREDIT}/v1/scores/${coopId}/${memberId}`).then((r) => r.data),

  listGroupScores: (coopId: string, params?: { page?: number; limit?: number; grade?: string }) =>
    apiClient.get<{ items: CooperativeCreditScore[]; total: number }>(`${APISIX.COOPERATIVE_CREDIT}/v1/scores/${coopId}`, { params }).then((r) => r.data),

  runBatchScoring: (coopId: string) =>
    apiClient.post(`${APISIX.COOPERATIVE_CREDIT}/v1/batch/score`, { coopId }).then((r) => r.data),
};
