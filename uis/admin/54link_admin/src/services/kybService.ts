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
   * @returns Promise resolving to an array of businesses
   */
  async getAllBusinesses(): Promise<Business[]> {
    try {
      const response = await apiClient.get<
        { total: number; skip: number; limit: number; businesses: Business[] } | Business[]
      >(
        `${this.BASE_URL}/business`,
      );
      const payload = response.data;
      // Handle array response
      if (Array.isArray(payload)) return payload;
      // Handle object response with businesses array
      if (payload && Array.isArray((payload as any).businesses)) {
        return (payload as any).businesses;
      }
      // Fallback
      return [];
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
      const response = await apiClient.post<Business>(
        `${this.BASE_URL}`,
        payload,
      );
      return response.data;
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
    const random = Math.floor(Math.random() * 1000000);
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
