// Admin service for API calls
// Implements: get admin by id, get admin by keycloak id, get all admins, suspend/unsuspend admin
import { apiRequest } from './api';

const API_BASE = '/admin/admin';
const ORCHESTRATOR_ADMIN_API = '/orchestrator/admin';

export interface CreateAdminResponse {
  message: string;
  verification?: string;
}

export interface AdminsParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  verification?: string;
}

export interface AdminsResult {
  admins: any[];
  total: number;
}

export async function createAdmin(payload: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  password: string;
  tenantRole?: string;
  branchId?: string;
}) {
  return apiRequest<CreateAdminResponse>({ url: ORCHESTRATOR_ADMIN_API, method: 'POST', data: payload });
}

export async function getAdminById(id: number) {
  return apiRequest({ url: `${API_BASE}/${id}`, method: 'GET' });
}

export async function getAdminByKeycloakId(keycloakId: string) {
  return apiRequest({ url: `${API_BASE}/keycloak/${keycloakId}`, method: 'GET' });
}

export async function getAdmins(params?: AdminsParams): Promise<AdminsResult> {
  const res = await apiRequest<{
    message: string;
    admins: any[];
    total?: number;
    totalCount?: number;
    count?: number;
    pagination?: { total?: number };
  }>({ url: API_BASE, method: 'GET', params });
  const admins = res.admins ?? [];
  const total = res.total ?? res.totalCount ?? res.count ?? res.pagination?.total ?? admins.length;
  return { admins, total };
}

export async function suspendAdmin(id: number) {
  return apiRequest({ url: `${API_BASE}/${id}/suspend`, method: 'PATCH' });
}

export async function unsuspendAdmin(id: number) {
  return apiRequest({ url: `${API_BASE}/${id}/unsuspend`, method: 'PATCH' });
}
