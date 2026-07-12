import apiClient from './api';

const BASE = '/rm/api/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RMCustomer {
  customerID: string;
  tenantID: string;
  customerType: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  segment: string;
  relationshipAge: number;
  totalBalance: number;
  totalProducts: number;
  revenue: number;
  profitability: number;
  riskRating: string;
  nps: number;
  lastContact: string;
  nextReview: string;
  assignedRM: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Portfolio {
  portfolioID: string;
  rmID: string;
  totalCustomers: number;
  totalBalance: number;
  totalRevenue: number;
  totalProducts: number;
  averageNPS: number;
  churnRate: number;
  crossSellRatio: number;
  targetRevenue: number;
  actualRevenue: number;
  achievement: number;
}

export interface Opportunity {
  opportunityID: string;
  customerID: string;
  customerName: string;
  productType: string;
  productName: string;
  expectedValue: number;
  probability: number;
  weightedValue: number;
  stage: string;
  source: string;
  assignedRM: string;
  expectedClose: string;
  actualClose?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  activityID: string;
  customerID: string;
  customerName: string;
  activityType: string;
  subject: string;
  description: string;
  outcome: string;
  followUpDate?: string;
  followUpNotes: string;
  rmID: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrossSellRecommendation {
  recommendationID: string;
  customerID: string;
  customerName: string;
  productType: string;
  productName: string;
  reason: string;
  score: number;
  expectedValue: number;
  status: string;
  assignedRM: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  campaignID: string;
  campaignName: string;
  campaignType: string;
  productType: string;
  startDate: string;
  endDate: string;
  targetSegment: string;
  targetCount: number;
  contactedCount: number;
  responseCount: number;
  conversionCount: number;
  budget: number;
  spent: number;
  revenue: number;
  status: string;
}

export interface RMDashboard {
  date: string;
  totalCustomers: number;
  totalBalance: number;
  totalRevenue: number;
  revenueTarget: number;
  achievement: number;
  totalOpportunities: number;
  pipelineValue: number;
  weightedPipeline: number;
  activitiesToday: number;
  activitiesThisWeek: number;
  pendingFollowUps: number;
  recommendations: number;
  conversionRate: number;
  atRiskCustomers: number;
  dormantCustomers: number;
  averageNPS: number;
}

export interface RelationshipManager {
  rmID: string;
  employeeID: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  segment: string;
  branchID: string;
  targetRevenue: number;
  actualRevenue: number;
  customerCount: number;
  status: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<RMDashboard> {
  const res = await apiClient.get(`${BASE}/dashboard`);
  return res.data;
}

export async function getDashboardAlerts(): Promise<{ alerts: any[] }> {
  const res = await apiClient.get(`${BASE}/dashboard/alerts`);
  return res.data;
}

export async function getDashboardTasks(): Promise<{ tasks: any[] }> {
  const res = await apiClient.get(`${BASE}/dashboard/tasks`);
  return res.data;
}

// Portfolio
export async function getPortfolio(): Promise<Portfolio> {
  const res = await apiClient.get(`${BASE}/portfolio`);
  return res.data;
}

export async function getPortfolioBySegment(): Promise<Record<string, any>> {
  const res = await apiClient.get(`${BASE}/portfolio/segments`);
  return res.data;
}

export async function getPortfolioTargets(): Promise<Record<string, any>> {
  const res = await apiClient.get(`${BASE}/portfolio/targets`);
  return res.data;
}

// Customers
export async function listCustomers(segment?: string): Promise<{ customers: RMCustomer[] }> {
  const params = segment ? `?segment=${segment}` : '';
  const res = await apiClient.get(`${BASE}/customers${params}`);
  return res.data;
}

export async function getAtRiskCustomers(): Promise<{ customers: RMCustomer[] }> {
  const res = await apiClient.get(`${BASE}/customers/at-risk`);
  return res.data;
}

export async function getDormantCustomers(): Promise<{ customers: RMCustomer[] }> {
  const res = await apiClient.get(`${BASE}/customers/dormant`);
  return res.data;
}

export async function searchCustomers(query: string): Promise<{ customers: RMCustomer[] }> {
  const res = await apiClient.get(`${BASE}/customers/search?q=${encodeURIComponent(query)}`);
  return res.data;
}

export async function createCustomer(payload: {
  customerType: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email: string;
  phone: string;
  segment: string;
}): Promise<RMCustomer> {
  const res = await apiClient.post(`${BASE}/customers`, payload);
  return res.data;
}

// Opportunities
export async function listOpportunities(stage?: string): Promise<{ opportunities: Opportunity[] }> {
  const params = stage ? `?stage=${stage}` : '';
  const res = await apiClient.get(`${BASE}/opportunities${params}`);
  return res.data;
}

export async function createOpportunity(payload: {
  customerID: string;
  productType: string;
  productName: string;
  expectedValue: number;
  probability: number;
  source: string;
  expectedClose: string;
  notes?: string;
}): Promise<Opportunity> {
  const res = await apiClient.post(`${BASE}/opportunities`, payload);
  return res.data;
}

export async function getPipelineByStage(): Promise<Record<string, any>> {
  const res = await apiClient.get(`${BASE}/opportunities/pipeline/stages`);
  return res.data;
}

export async function updateOpportunityStage(
  id: string,
  stage: string,
  notes?: string,
): Promise<Opportunity> {
  const res = await apiClient.put(`${BASE}/opportunities/${id}/stage`, { stage, notes });
  return res.data;
}

// Activities
export async function listActivities(type?: string): Promise<{ activities: Activity[] }> {
  const params = type ? `?type=${type}` : '';
  const res = await apiClient.get(`${BASE}/activities${params}`);
  return res.data;
}

export async function createActivity(payload: {
  customerID: string;
  activityType: string;
  subject: string;
  description?: string;
  outcome?: string;
  duration?: number;
  followUpDate?: string;
}): Promise<Activity> {
  const res = await apiClient.post(`${BASE}/activities`, payload);
  return res.data;
}

export async function getFollowUps(): Promise<{ followUps: Activity[] }> {
  const res = await apiClient.get(`${BASE}/activities/follow-ups`);
  return res.data;
}

// Cross-sell
export async function listRecommendations(status?: string): Promise<{ recommendations: CrossSellRecommendation[] }> {
  const params = status ? `?status=${status}` : '';
  const res = await apiClient.get(`${BASE}/cross-sell/recommendations${params}`);
  return res.data;
}

export async function acceptRecommendation(id: string): Promise<CrossSellRecommendation> {
  const res = await apiClient.post(`${BASE}/cross-sell/recommendations/${id}/accept`);
  return res.data;
}

export async function rejectRecommendation(id: string): Promise<CrossSellRecommendation> {
  const res = await apiClient.post(`${BASE}/cross-sell/recommendations/${id}/reject`);
  return res.data;
}

export async function convertRecommendation(id: string): Promise<CrossSellRecommendation> {
  const res = await apiClient.post(`${BASE}/cross-sell/recommendations/${id}/convert`);
  return res.data;
}

// Campaigns
export async function listCampaigns(status?: string): Promise<{ campaigns: Campaign[] }> {
  const params = status ? `?status=${status}` : '';
  const res = await apiClient.get(`${BASE}/campaigns${params}`);
  return res.data;
}

// RMs
export async function listRMs(): Promise<{ rms: RelationshipManager[] }> {
  const res = await apiClient.get(`${BASE}/rms`);
  return res.data;
}

export async function getRMLeaderboard(): Promise<{ leaderboard: RelationshipManager[] }> {
  const res = await apiClient.get(`${BASE}/rms/leaderboard`);
  return res.data;
}
