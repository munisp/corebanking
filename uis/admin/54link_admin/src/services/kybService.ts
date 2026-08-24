import type {
    Business,
    BusinessVerificationPayload,
    DocumentUploadResponse,
    KYBVerificationRequest,
    KYBVerificationResponse,
    KYBVerificationStatus,
    RegisterBusinessPayload,
} from "../types/kyb";
import apiClient from "./api";

// Raw shape returned by business-service (schemas/v1/business.py BusinessResponse)
interface RawBusiness {
  id: string;
  tenant_id: string;
  name: string;
  registration_number?: string;
  business_type?: string;
  verification_status: string;
  industry_code?: string;
  headquarters_address?: string;
  phone_number?: string;
  email_address?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

// business-service uses id/name/industry_code/headquarters_address/phone_number/email_address;
// the rest of this app was built against business_id/business_name/industry/address/contact_phone/contact_email.
function toBusiness(raw: RawBusiness): Business {
  return {
    business_id: raw.id,
    tenant_id: raw.tenant_id,
    business_name: raw.name,
    registration_number: raw.registration_number,
    business_type: raw.business_type,
    industry: raw.industry_code,
    address: raw.headquarters_address,
    contact_email: raw.email_address,
    contact_phone: raw.phone_number,
    verification_status: raw.verification_status as Business["verification_status"],
    metadata: raw.metadata,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function toCreateBusinessRequest(payload: RegisterBusinessPayload): Record<string, unknown> {
  return {
    name: payload.business_name,
    registration_number: payload.registration_number,
    business_type: payload.business_type,
    industry_code: payload.industry,
    headquarters_address: payload.address,
    email_address: payload.contact_email,
    phone_number: payload.contact_phone,
    metadata: payload.metadata,
  };
}

class KYBService {
  private readonly BASE_URL = "/business/api/v1";

  /**
   * Upload a document for KYB verification
   * @param file - The file to upload
   * @param documentType - The type of document being uploaded
   * @returns Promise resolving to the upload response with document URL
   */
  async uploadDocument(
    file: File,
    documentType: string,
  ): Promise<DocumentUploadResponse> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);

      const response = await apiClient.post<DocumentUploadResponse>(
        "/document/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.status === "success" && response.data.url) {
        return response.data;
      }

      throw new Error("Invalid response format from document upload API");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error uploading document:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Start KYB verification for a business
   * @param payload - The KYB verification request payload
   * @returns Promise resolving to the verification response
   */
  async startVerification(
    payload: KYBVerificationRequest,
  ): Promise<KYBVerificationResponse> {
    try {
      const response = await apiClient.post<KYBVerificationResponse>(
        `${this.BASE_URL}/verification/start`,
        payload,
      );

      if (response.data.status === "success") {
        if (import.meta.env.DEV) {
          console.log("KYB verification started:", response.data);
        }
        return response.data;
      }

      throw new Error("Invalid response format from KYB verification API");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error starting KYB verification:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Get KYB verification status
   * @param verificationId - The verification ID to check
   * @returns Promise resolving to the verification status
   */
  async getVerificationStatus(
    verificationId: string,
  ): Promise<KYBVerificationStatus> {
    try {
      const response = await apiClient.get<{
        status: string;
        data: KYBVerificationStatus;
      }>(`${this.BASE_URL}/verification/${verificationId}`);

      if (response.data.status === "success" && response.data.data) {
        return response.data.data;
      }

      throw new Error("Invalid response format from KYB status API");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching KYB status:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Get all businesses for the tenant
   * @returns Promise resolving to the businesses on this page and the total count
   */
  async getAllBusinesses(skip = 0, limit = 100): Promise<{ businesses: Business[]; total: number }> {
    try {
      const response = await apiClient.get<
        { total: number; skip: number; limit: number; businesses: RawBusiness[] } | RawBusiness[]
      >(
        `${this.BASE_URL}/businesses`,
        { params: { skip, limit } },
      );
      const payload = response.data;
      // Handle array response
      if (Array.isArray(payload)) {
        const businesses = payload.map(toBusiness);
        return { businesses, total: businesses.length };
      }
      // Handle object response with businesses array
      if (payload && Array.isArray(payload.businesses)) {
        return { businesses: payload.businesses.map(toBusiness), total: payload.total ?? payload.businesses.length };
      }
      // Fallback
      return { businesses: [], total: 0 };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching businesses:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Register a new business
   * @param payload - The business registration payload
   * @returns Promise resolving to the created business
   */
  async registerBusiness(payload: RegisterBusinessPayload): Promise<Business> {
    try {
      const response = await apiClient.post<RawBusiness>(
        `${this.BASE_URL}/businesses`,
        toCreateBusinessRequest(payload),
      );
      return toBusiness(response.data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error registering business:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Verify a business
   * @param businessId - The business ID
   * @param payload - The business verification payload
   * @returns Promise resolving to the verification response
   */
  async verifyBusiness(
    businessId: string,
    payload: BusinessVerificationPayload,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
      }>(`${this.BASE_URL}/businesses/${businessId}/verify`, payload);
      return response.data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error verifying business:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Update business verification status
   * @param businessId - The business ID
   * @param status - The new status
   * @returns Promise resolving to success response
   */
  async updateBusinessStatus(
    businessId: string,
    status: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<{
        success: boolean;
        message: string;
      }>(`${this.BASE_URL}/businesses/${businessId}/status`, {
        verification_status: status,
      });
      return response.data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error updating business status:", errorMessage);
      throw this.handleError(error);
    }
  }

  /**
   * Generate a unique verification ID
   * @returns A unique verification ID
   */
  generateVerificationId(): string {
    const timestamp = Date.now();
    // CSPRNG suffix — verification IDs are security-relevant, never Math.random().
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const random = String(buf[0] % 1000000).padStart(6, "0");
    return `verif_${timestamp}${random}`;
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error("An unexpected error occurred");
  }
}

// Export singleton instance
export const kybService = new KYBService();
export default kybService;
