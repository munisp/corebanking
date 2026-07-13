import apiClient from './api';
import type { EquipmentLeasingListResponse, EquipmentLeasingStats, CreateEquipmentLeasingPayload } from '../types/equipmentLeasing';

const BASE = '/credit/v1/equipment-leasing';

export const equipmentLeasingService = {
  list: () => apiClient.get<EquipmentLeasingListResponse>(`${BASE}/list`).then(r => r.data),
  create: (payload: CreateEquipmentLeasingPayload) => apiClient.post(`${BASE}/create`, payload).then(r => r.data),
  stats: () => apiClient.get<EquipmentLeasingStats>(`${BASE}/stats`).then(r => r.data),
};
