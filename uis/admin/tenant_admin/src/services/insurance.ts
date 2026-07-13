// src/services/insurance.ts
// Insurance API service functions
import axios from "axios";
import { BACKEND_URL } from "../const";

const BASE_URL = `${BACKEND_URL}/insurance/api/v1`;
const ADMIN_BASE_URL = `${BACKEND_URL}/insurance/api/v1/administration`;
const LOCAL_BASE_URL = "http://localhost:8016/api/v1";

export const payClaim = async (claimId: string) => {
  return axios.post(`${ADMIN_BASE_URL}/insurance/claims/${claimId}/pay`);
};

export const reviewClaim = async (claimId: string, data: any) => {
  return axios.post(
    `${ADMIN_BASE_URL}/insurance/claims/${claimId}/review`,
    data,
  );
};

export const listPremiumPayments = async (policyId: string) => {
  return axios.get(`${BASE_URL}/insurance/premiums/policy/${policyId}`);
};

export const activatePolicy = async (policyId: string, data: any) => {
  return axios.post(
    `${BASE_URL}/administration/insurance/policies/${policyId}/activate`,
    data,
  );
};

export const deactivatePolicy = async (policyId: string, data: any) => {
  // Deactivate endpoint is on localhost
  return axios.post(
    `${LOCAL_BASE_URL}/insurance/policies/${policyId}/deactivate`,
    data,
  );
};
