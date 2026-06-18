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

class KYBService {
  private readonly BASE_URL = "/business/api/v1";

  /** Normalize the API response (snake_case API fields) into the Business UI type. */
  private mapBusiness(raw: Record<string, unknown>): Business {
    return {
      ...raw,
      // canonical API fields
      id:                   (raw.id as string),
      name:                 (raw.name as string),
      // UI alias fields
      business_id:          (raw.id as string),
      business_name:        (raw.name as string),
      contact_email:        (raw.email_address as string | undefined),
      contact_phone:        (raw.phone_number as string | undefined),
      address:              (raw.headquarters_address as string | undefined),
      industry:             (raw.industry_code as string | undefined),
    } as Business;
  }

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

      if (response.data.url && response.data.id) {
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

      if (response.data.verification_id && response.data.status) {
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
   * Generate a unique verification ID
   * @returns A unique verification ID
   */
  generateVerificationId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `verif_${timestamp}${random}`;
  }

  /**
   * Get all businesses for the tenant
   * @param params - Optional pagination params: skip and limit
   * @returns Promise resolving to an array of businesses and total count
   */
  async getAllBusinesses(params?: { skip?: number; limit?: number }): Promise<{ businesses: Business[]; total: number }> {
    try {
      const response = await apiClient.get<{
        total: number;
        count: number;
        skip: number;
        limit: number;
        businesses: Record<string, unknown>[];
      }>(`${this.BASE_URL}/businesses`, { params });
      const raw = Array.isArray(response.data)
        ? (response.data as Record<string, unknown>[])
        : (response.data.businesses ?? []);
      const total = response.data.total ?? response.data.count ?? raw.length;
      return { businesses: raw.map((b) => this.mapBusiness(b)), total };
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
      // Map UI field names → business-service field names
      const body = {
        name:                  payload.business_name,
        registration_number:   payload.registration_number,
        business_type:         payload.business_type || "limited_company",
        industry_code:         payload.industry,
        headquarters_address:  payload.address,
        phone_number:          payload.contact_phone,
        email_address:         payload.contact_email,
        metadata:              payload.metadata,
      };
      const response = await apiClient.post<Record<string, unknown>>(
        `${this.BASE_URL}/businesses`,
        body,
      );
      return this.mapBusiness(response.data);
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
      // Route to the correct endpoint depending on the target status
      if (status === "approved") {
        await apiClient.post(
          `${this.BASE_URL}/businesses/${businessId}/approve-verification`,
          { approved_by: "admin", reason: "Approved via admin portal" },
        );
      } else if (status === "rejected") {
        await apiClient.post(
          `${this.BASE_URL}/businesses/${businessId}/reject-verification`,
          { reason: "Rejected via admin portal" },
        );
      } else {
        // suspended / activate / other — use suspend/activate endpoints
        const endpoint = status === "suspended" ? "suspend" : "activate";
        await apiClient.post(
          `${this.BASE_URL}/businesses/${businessId}/${endpoint}`,
          {},
        );
      }
      return { success: true, message: `Business status updated to ${status}` };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error updating business status:", errorMessage);
      throw this.handleError(error);
    }
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
