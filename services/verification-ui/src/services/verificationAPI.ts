/**
 * Verification API Service
 * Centralized API client for all verification endpoints through APISIX
 *
 * APISIX Endpoint Registry
 * ┌─────┬──────────────────────────────────────────────────────────┬────────────────────────────────┐
 * │  #  │ UI Step              │ APISIX Route                       │ Purpose                        │
 * ├─────┼──────────────────────┼────────────────────────────────────┼────────────────────────────────┤
 * │  1  │ Init                 │ POST /api/v1/verification/initialize│ Create session                 │
 * │  2  │ Step 1               │ GET  /api/v1/countries             │ List countries                 │
 * │  3  │ Step 1               │ GET  /api/v1/countries/:code/config│ Country document config        │
 * │  4  │ Step 1-3             │ GET/PATCH /api/v1/verification/:id/session│ Session state         │
 * │  5  │ Step 3               │ POST /api/v1/verification/:id/documents/upload│ Upload doc image  │
 * │  6  │ Step 3               │ POST /api/v1/verification/:id/documents/ocr│ Trigger OCR        │
 * │  7  │ Step 3               │ GET  /api/v1/verification/:id/documents/ocr/:jobId│ Poll OCR result│
 * │  8  │ Step 4               │ POST /api/v1/verification/:id/biometric/face-match│ Face match    │
 * │  9  │ Step 4               │ POST /api/v1/verification/:id/biometric/liveness│ Liveness       │
 * │ 10  │ Step 4               │ POST /api/v1/verification/:id/submit│ Final submission               │
 * │ 11  │ Step 4               │ GET  /api/v1/verification/:id/status│ Result status                 │
 * │ 12  │ Legacy               │ POST /kyc/verify                   │ Legacy all-in-one submission   │
 * └─────┴──────────────────────┴────────────────────────────────────┴────────────────────────────────┘
 */

import type {
  CountriesListResponse,
  CountryCode,
  DocumentConfigResponse,
  OCRProcessingResponse,
  VerificationSubmissionResponse,
} from "../types/verification";

const API_BASE_URL =
  import.meta.env.VITE_VERIFICATION_API_URL ||
  "https://54link-dev.upi.dev/verification";

const ENV_API_KEY = import.meta.env.VITE_KYC_FLOW_API_KEY || "";
const FALLBACK_API_KEY = "Zr6lIvOEuGDlzlDyV+/dEDcUX7cChZKs";

/**
 * APISIX Routes Registry — single source of truth for all endpoints
 */
export const ROUTES = {
  // Country & Configuration
  LIST_COUNTRIES:       "/api/v1/countries",
  GET_COUNTRY_CONFIG:   "/api/v1/countries/:countryCode/config",

  // Verification Session
  INITIALIZE:           "/api/v1/verification/initialize",
  GET_SESSION:          "/api/v1/verification/:id/session",
  UPDATE_SESSION:       "/api/v1/verification/:id/session",

  // Document Processing
  UPLOAD_DOCUMENT:      "/api/v1/verification/:id/documents/upload",
  PROCESS_OCR:          "/api/v1/verification/:id/documents/ocr",
  GET_OCR_RESULT:       "/api/v1/verification/:id/documents/ocr/:jobId",

  // Biometric Verification
  FACE_MATCH:           "/api/v1/verification/:id/biometric/face-match",
  LIVENESS:             "/api/v1/verification/:id/biometric/liveness",

  // Submission & Status
  SUBMIT:               "/api/v1/verification/:id/submit",
  STATUS:               "/api/v1/verification/:id/status",

  // Legacy (working endpoint)
  LEGACY_KYC_VERIFY:    "/kyc/verify",

  // KYB (Business Verification)
  KYB_INITIALIZE:       "/api/v1/kyb/initialize",
  KYB_SESSION:          "/api/v1/kyb/:id/session",
  KYB_UPLOAD_DOCUMENT:  "/api/v1/kyb/:id/documents/upload",
  KYB_SUBMIT:           "/api/v1/kyb/:id/submit",
  KYB_STATUS:           "/api/v1/kyb/:id/status",
} as const;

class VerificationAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = API_BASE_URL, apiKey?: string) {
    this.baseUrl = baseUrl;
    // Resolve API key: explicit > env > fallback
    this.apiKey = (apiKey || ENV_API_KEY || FALLBACK_API_KEY).trim();
  }

  /** Override the API key (e.g. from URL params) */
  setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  // ─────────────────────────────────────────────
  //  Private request helpers
  // ─────────────────────────────────────────────

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-KEY":    this.apiKey,
      Authorization:  this.apiKey, // legacy compat
      ...extra,
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH",
    route:  string,
    body?:  unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${route}`;
    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(extraHeaders),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`API ${response.status}: ${errText || response.statusText}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    try { return JSON.parse(text) as T; }
    catch { return {} as T; }
  }

  // ─────────────────────────────────────────────
  //  Step 1: Country Management
  // ─────────────────────────────────────────────

  async getCountriesList(): Promise<CountriesListResponse> {
    return this.request("GET", ROUTES.LIST_COUNTRIES);
  }

  async getCountryConfig(countryCode: CountryCode): Promise<DocumentConfigResponse> {
    const route = ROUTES.GET_COUNTRY_CONFIG.replace(":countryCode", countryCode);
    return this.request("GET", route);
  }

  // ─────────────────────────────────────────────
  //  Verification Session
  // ─────────────────────────────────────────────

  async initializeVerification(metadata?: Record<string, unknown>) {
    return this.request("POST", ROUTES.INITIALIZE, { metadata });
  }

  async getVerificationSession(verificationId: string) {
    return this.request("GET", ROUTES.GET_SESSION.replace(":id", verificationId));
  }

  async updateVerificationSession(verificationId: string, data: Record<string, unknown>) {
    return this.request("PATCH", ROUTES.UPDATE_SESSION.replace(":id", verificationId), data);
  }

  // ─────────────────────────────────────────────
  //  Step 3: Document Processing
  // ─────────────────────────────────────────────

  async uploadDocument(
    verificationId: string,
    file: File,
    side: "front" | "back",
  ): Promise<{ documentId: string; uploadedAt: number }> {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("side", side);

    const url = `${this.baseUrl}${ROUTES.UPLOAD_DOCUMENT.replace(":id", verificationId)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "X-API-KEY": this.apiKey, Authorization: this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed (${response.status}): ${response.statusText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { documentId: `doc_${side}_${Date.now()}`, uploadedAt: Date.now() };
  }

  async processOCR(
    verificationId: string,
    documentIds: string[],
    documentType: string,
  ): Promise<OCRProcessingResponse> {
    const route = ROUTES.PROCESS_OCR.replace(":id", verificationId);
    return this.request("POST", route, { documentIds, documentType });
  }

  async getOCRResult(verificationId: string, jobId: string): Promise<OCRProcessingResponse> {
    const route = ROUTES.GET_OCR_RESULT
      .replace(":id", verificationId)
      .replace(":jobId", jobId);
    return this.request("GET", route);
  }

  // ─────────────────────────────────────────────
  //  Step 4: Biometric Verification
  // ─────────────────────────────────────────────

  async verifyFace(
    verificationId: string,
    selfieImage: string,
    documentFaceImage: string,
  ) {
    return this.request("POST", ROUTES.FACE_MATCH.replace(":id", verificationId), {
      selfieImage,
      documentFaceImage,
    });
  }

  async verifyLiveness(
    verificationId: string,
    frames: unknown[],
    livenessProof: unknown,
  ) {
    return this.request("POST", ROUTES.LIVENESS.replace(":id", verificationId), {
      frames,
      proof: livenessProof,
    });
  }

  // ─────────────────────────────────────────────
  //  Final Submission
  // ─────────────────────────────────────────────

  async submitVerification(
    verificationId: string,
    data: {
      documentVerified: boolean;
      faceMatched?: boolean;
      livenessVerified?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<VerificationSubmissionResponse> {
    return this.request("POST", ROUTES.SUBMIT.replace(":id", verificationId), data);
  }

  async getVerificationStatus(verificationId: string) {
    return this.request("GET", ROUTES.STATUS.replace(":id", verificationId));
  }

  // ─────────────────────────────────────────────
  //  Legacy /kyc/verify (working endpoint)
  // ─────────────────────────────────────────────

  async submitLegacyKYC(payload: {
    verificationId: string;
    frontImage?: string;
    backImage?: string;
    selfieImage?: string;
    livenessProof?: unknown;
    documentType?: string;
    countryCode?: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
    keycloakId?: string;
  }) {
    const extraHeaders: Record<string, string> = {};
    if (payload.tenantId)   extraHeaders["x-tenant-id"]   = payload.tenantId;
    if (payload.keycloakId) extraHeaders["x-keycloak-id"] = payload.keycloakId;

    const body = {
      endUserInfo: { id: payload.verificationId },
      document: (payload.frontImage || payload.backImage) ? {
        type:        payload.documentType || "id_card",
        country:     payload.countryCode  || "NG",
        frontImage:  payload.frontImage,
        backImage:   payload.backImage,
      } : undefined,
      selfie:      payload.selfieImage ? { image: payload.selfieImage } : undefined,
      livenessProof: payload.livenessProof,
      metadata:    payload.metadata,
    };

    return this.request("POST", ROUTES.LEGACY_KYC_VERIFY, body, extraHeaders);
  }

  // ─────────────────────────────────────────────
  //  KYB (Business Verification)
  // ─────────────────────────────────────────────

  /**
   * Create a KYB session linked to an existing verification entity.
   * @param existingVerificationId — the kyb_verification_id from the URL (entity ID)
   */
  async initializeKybSession(
    existingVerificationId: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ sessionId: string; verificationId: string; status: string }> {
    return this.request("POST", ROUTES.KYB_INITIALIZE, {
      metadata: { ...metadata, existingVerificationId },
    });
  }

  async getKybSession(sessionId: string) {
    return this.request("GET", ROUTES.KYB_SESSION.replace(":id", sessionId));
  }

  /**
   * Upload a KYB document (CAC certificate, TIN certificate, director ID, etc.)
   */
  async uploadKybDocument(
    sessionId: string,
    file: File,
    documentType: "cac_certificate" | "tin_certificate" | "director_id" | "utility_bill" | "memorandum",
  ): Promise<{ documentId: string; documentType: string; uploadedAt: number }> {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", documentType);

    const url = `${this.baseUrl}${ROUTES.KYB_UPLOAD_DOCUMENT.replace(":id", sessionId)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "X-API-KEY": this.apiKey, Authorization: this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`KYB upload failed (${response.status}): ${response.statusText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { documentId: `kyb_${documentType}_${Date.now()}`, documentType, uploadedAt: Date.now() };
  }

  async submitKybVerification(
    sessionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ status: string; verified: boolean; score: number; message: string }> {
    return this.request("POST", ROUTES.KYB_SUBMIT.replace(":id", sessionId), { metadata });
  }

  async getKybStatus(sessionId: string) {
    return this.request("GET", ROUTES.KYB_STATUS.replace(":id", sessionId));
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────
export const verificationAPI = new VerificationAPIClient();

// Factory for cases where a different API key is required at runtime
export function createVerificationAPIClient(apiKey?: string) {
  return new VerificationAPIClient(API_BASE_URL, apiKey);
}
