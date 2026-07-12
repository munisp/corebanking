import apiClient from "./api";

const BASE = "/user/user/feedback";

export type FeedbackStatus = "open" | "in_progress" | "resolved" | "closed";
export type FeedbackCategory =
  | "general"
  | "bug"
  | "feature_request"
  | "complaint"
  | "compliment"
  | "support";

export interface Feedback {
  id: string;
  user_id: string;
  tenant_id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  rating: number | null;
  status: FeedbackStatus;
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummary {
  total: number;
  by_status: Record<FeedbackStatus, number>;
  by_category: Record<FeedbackCategory, number>;
  average_rating: number | null;
  rated_count: number;
}

export async function listFeedback(filters?: {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  page?: number;
  limit?: number;
}): Promise<{ feedbacks: Feedback[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.page) params.append("page", String(filters.page));
  if (filters?.limit) params.append("limit", String(filters.limit));
  const res = await apiClient.get(`${BASE}?${params.toString()}`);
  return res.data;
}

export async function getFeedback(
  feedbackId: string,
): Promise<{ feedback: Feedback }> {
  const res = await apiClient.get(`${BASE}/${feedbackId}`);
  return res.data;
}

export async function respondToFeedback(
  feedbackId: string,
  payload: { response: string; status?: FeedbackStatus },
): Promise<{ feedback: Feedback }> {
  const res = await apiClient.post(`${BASE}/${feedbackId}/respond`, payload);
  return res.data;
}

export async function getFeedbackSummary(): Promise<{
  summary: FeedbackSummary;
}> {
  const res = await apiClient.get(`${BASE}/summary`);
  return res.data;
}
