import apiClient from './api';
import type {
  StandingOrder,
  StandingOrderListResponse,
  CreateStandingOrderPayload,
  DirectDebitMandate,
  MandateListResponse,
  CreateMandatePayload,
  ScheduledPayment,
  ScheduledPaymentListResponse,
  CreateScheduledPaymentPayload,
} from '../types/standingOrders';

const BASE = '/standing-orders/v1';

export const standingOrdersService = {
  listOrders: (): Promise<StandingOrderListResponse> =>
    apiClient.get<StandingOrderListResponse>(`${BASE}/standing-orders`).then((r) => r.data),

  createOrder: (payload: CreateStandingOrderPayload): Promise<StandingOrder> =>
    apiClient.post<StandingOrder>(`${BASE}/standing-orders`, payload).then((r) => r.data),

  pauseOrder: (orderId: string): Promise<StandingOrder> =>
    apiClient
      .post<StandingOrder>(`${BASE}/standing-orders/pause`, { orderId })
      .then((r) => r.data),

  resumeOrder: (orderId: string): Promise<StandingOrder> =>
    apiClient
      .post<StandingOrder>(`${BASE}/standing-orders/resume`, { orderId })
      .then((r) => r.data),

  listMandates: (): Promise<MandateListResponse> =>
    apiClient.get<MandateListResponse>(`${BASE}/mandates`).then((r) => r.data),

  createMandate: (payload: CreateMandatePayload): Promise<DirectDebitMandate> =>
    apiClient.post<DirectDebitMandate>(`${BASE}/mandates`, payload).then((r) => r.data),

  revokeMandate: (mandateId: string): Promise<DirectDebitMandate> =>
    apiClient
      .post<DirectDebitMandate>(`${BASE}/mandates/revoke`, { mandateId })
      .then((r) => r.data),

  listScheduledPayments: (): Promise<ScheduledPaymentListResponse> =>
    apiClient
      .get<ScheduledPaymentListResponse>(`${BASE}/scheduled-payments`)
      .then((r) => r.data),

  createScheduledPayment: (payload: CreateScheduledPaymentPayload): Promise<ScheduledPayment> =>
    apiClient
      .post<ScheduledPayment>(`${BASE}/scheduled-payments`, payload)
      .then((r) => r.data),
};
