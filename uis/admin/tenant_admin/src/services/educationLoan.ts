import apiClient from './api';

const BASE_URL = '/education-loan/applications';

function getTenantId(): string {
  return (
    import.meta.env.VITE_TENANT_ID ||
    localStorage.getItem("tenant_id") ||
    ""
  );
}

export const getLoanApplications = async (params?: { page?: number; limit?: number }) => {
  const res = await apiClient.get(BASE_URL, { params: { tenant_id: getTenantId(), ...params } });
  return res.data;
};

export const getLoanApplicationById = async (id: string) => {
  const res = await apiClient.get(`${BASE_URL}/${id}`, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const verifyInstitution = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/verify-institution`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const verifyAdmission = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/verify-admission`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const verifyGuarantor = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/verify-guarantor`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const approveApplication = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/approve`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const declineApplication = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/decline`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const generateOffer = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/generate-offer`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const getDisbursementSchedule = async (id: string) => {
  const res = await apiClient.get(`${BASE_URL}/${id}/disbursement-schedule`, { params: { tenant_id: getTenantId() } });
  return res.data;
};

export const disburseSemester = async (id: string) => {
  const res = await apiClient.post(`${BASE_URL}/${id}/disburse-semester`, null, { params: { tenant_id: getTenantId() } });
  return res.data;
};
