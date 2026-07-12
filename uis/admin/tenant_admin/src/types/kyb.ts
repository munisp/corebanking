export interface KYBDocument {
  title: string;
  url: string;
}

export interface KYBMetadata {
  requested_by: string;
  source: string;
  priority: "low" | "medium" | "high";
  country: string;
  [key: string]: unknown;
}

export interface KYBVerificationRequest {
  verification_id: string;
  tenant_id: string;
  business_id: string;
  verification_path: string;
  required_documents: string[];
  uploaded_documents: KYBDocument[];
  timeout_days: number;
  metadata: KYBMetadata;
}

export interface KYBVerificationResponse {
  verification_id: string;
  attempts: number;
  status: string;
  verification_path: string;
}

export interface DocumentUploadResponse {
  url: string;
  id: string;
  filename: string;
  content_type: string;
  ocr: string | null;
}

export type DocumentType =
  | "certificate_of_incorporation"
  | "tax_identification_number"
  | "business_license"
  | "utility_bill"
  | "bank_statement"
  | "memorandum_of_association"
  | "articles_of_association"
  | "director_id"
  | "shareholder_id";

export interface KYBVerificationStatus {
  verification_id: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "expired";
  business_id: string;
  created_at: string;
  updated_at: string;
  verification_path: string;
  documents_verified: number;
  total_documents: number;
}

export interface Business {
  // API field names (from business-service to_dict)
  id: string;
  tenant_id: string;
  name: string;
  registration_number?: string;
  business_type?: string;
  industry_code?: string;
  headquarters_address?: string;
  headquarters_location?: string;
  phone_number?: string;
  email_address?: string;
  verification_status: "unverified" | "pending_verification" | "verified" | "rejected" | "suspended" | "pending" | "under_review" | "approved";
  compliance_status?: string;
  website_url?: string;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  // Aliases kept for UI compatibility
  business_id: string;
  business_name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  industry?: string;
  tin?: string;
  country?: string;
  verification_date?: string;
  documents?: KYBDocument[];
  verification_path?: string;
}

export interface BusinessVerificationPayload {
  business_name: string;
  registration_number?: string;
  tin?: string;
  business_type?: string;
  industry?: string;
  country?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  documents?: KYBDocument[];
  verification_path?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterBusinessPayload {
  business_name: string;
  registration_number?: string;
  tin?: string;
  business_type?: string;
  industry?: string;
  country?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  documents?: KYBDocument[];
  verification_path?: string;
  metadata?: Record<string, unknown>;
}
