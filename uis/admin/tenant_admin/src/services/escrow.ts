// Escrow service for API calls (admin endpoints)
import { apiRequest } from './api';

const ESCROW_API_BASE = 'escrow/api/v1/escrow';

export async function listContracts(params?: { page?: number; per_page?: number }) {
  return apiRequest({ url: `${ESCROW_API_BASE}/contracts`, method: 'GET', params });
}

export async function releaseContract(contractID: string, userID: string, notes: string) {
  return apiRequest({
    url: `${ESCROW_API_BASE}/contracts/${contractID}/release`,
    method: 'POST',
    data: { user_id: userID, notes }
  });
}

// Add more admin endpoints as needed
