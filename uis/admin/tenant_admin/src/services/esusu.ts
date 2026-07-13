import { apiRequest } from './api';

const ESUSU_API_BASE = '/esusu/api/v1/esusu';

function getTenantId(): string {
  return (
    (import.meta.env.VITE_TENANT_ID as string | undefined) ||
    localStorage.getItem("tenant_id") ||
    ""
  );
}

export async function listEsusuGroups(page = 1, limit = 10): Promise<{ groups: any[]; total: number }> {
  const res = await apiRequest<any>({
    url: `${ESUSU_API_BASE}/groups`,
    method: 'GET',
    params: { tenant_id: getTenantId(), page, limit },
  });
  const groups = Array.isArray(res) ? res : res?.groups ?? res?.data ?? [];
  const total = res?.total ?? res?.count ?? groups.length;
  return { groups, total };
}
