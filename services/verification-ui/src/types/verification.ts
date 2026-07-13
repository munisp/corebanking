/**
 * Verification Flow Types
 * Complete type definitions for the 4-step verification process
 */

// ============ Step 1: Country Selection ============
export type CountryCode = string; // ISO 3166-1 alpha-2

export interface Country {
  code: CountryCode;
  name: string;
  flag?: string;
  callingCode?: string;
  region?: string;
  popular?: boolean;
}

// ============ Step 2: Document Selection ============
export type DocumentType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVERS_LICENSE"
  | "VOTER_CARD"
  | "RESIDENCE_PERMIT"
  | "BVN"
  | "NIN"
  | "CAC"
  | "OTHER";

export interface DocumentRequirement {
  type: DocumentType;
  name: string;
  description: string;
  icon?: string;
  requiredSides: "front" | "back" | "both";
  ocrCapable: boolean;
  maxFileSize: number; // bytes
  allowedFormats: string[]; // MIME types
  validationRules?: {
    minDPI?: number;
    requireMRZ?: boolean;
    expiryCheck?: boolean;
  };
  recommended?: boolean;
  processingProvider?: string;
}

export interface CountryDocumentConfig {
  countryCode: CountryCode;
  supportedDocuments: DocumentType[];
  documentRequirements: DocumentRequirement[];
  ocrProvider?: string;
  verificationProvider?: string;
  rules?: {
    requireFaceMatch?: boolean;
    requireLivenessCheck?: boolean;
    maxRetries?: number;
  };
}

// ============ Step 3: Document Verification ============
export type DocumentSide = "front" | "back";

export interface DocumentImage {
  side: DocumentSide;
  file: File;
  base64?: string;
  uploadedAt?: number;
}

export interface OCRResult {
  confidence: number;
  provider: string;
  extractedData: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    issuingDate?: string;
    nationality?: string;
    gender?: string;
    address?: string;
    mrz?: string; // Machine Readable Zone for passports
    faceImageBase64?: string; // Extracted face from document
  };
  validations: {
    isExpired?: boolean;
    isBlurry?: boolean;
    isCropped?: boolean;
    hasGlare?: boolean;
    isComplete?: boolean;
  };
  rawResponse?: Record<string, unknown>;
}

export interface DocumentVerificationState {
  documentType: DocumentType;
  countryCode: CountryCode;
  images: DocumentImage[];
  ocrResults?: OCRResult[];
  uploadProgress: number; // 0-100
  isProcessing: boolean;
  error?: string;
}

// ============ Step 4: Biometric Verification ============
export type BiometricVerificationType = "face_match" | "liveness";

export interface FaceVerificationResult {
  matched: boolean;
  confidence: number;
  provider: string;
  details?: Record<string, unknown>;
}

export interface LivenessVerificationResult {
  live: boolean;
  confidence: number;
  provider: string;
  methods: {
    blink?: boolean;
    headMovement?: boolean;
    smileChallenge?: boolean;
  };
  details?: Record<string, unknown>;
}

export interface BiometricVerificationState {
  selfieImage?: string; // base64
  selfieImageFile?: File;
  faceMatchResult?: FaceVerificationResult;
  livenessResult?: LivenessVerificationResult;
  isProcessing: boolean;
  error?: string;
}

// ============ Verification Session ============
export type VerificationStep = 1 | 2 | 3 | 4 | "complete";
export type VerificationStatus =
  | "pending"
  | "processing"
  | "verified"
  | "rejected"
  | "manual_review"
  | "expired"
  | "retry_required";

export interface VerificationSession {
  sessionId: string;
  verificationId: string;
  currentStep: VerificationStep;
  status: VerificationStatus;
  country?: Country;
  documentConfig?: CountryDocumentConfig;
  documentVerification?: DocumentVerificationState;
  biometricVerification?: BiometricVerificationState;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  attemptCount: number;
}

// ============ API Responses ============
export interface CountriesListResponse {
  countries: Country[];
  lastUpdated: number;
}

export interface DocumentConfigResponse {
  countryCode: CountryCode;
  config: CountryDocumentConfig;
}

export interface OCRProcessingResponse {
  status: "processing" | "completed" | "failed";
  jobId: string;
  result?: OCRResult;
  error?: string;
  estimatedTimeMs?: number;
}

export interface VerificationSubmissionResponse {
  status: VerificationStatus;
  sessionId: string;
  verificationId: string;
  nextStep?: VerificationStep;
  message: string;
  error?: string;
}

// ============ Verification Audit ============
export interface VerificationAuditEntry {
  id: string;
  verificationId: string;
  sessionId: string;
  action: string;
  step: VerificationStep;
  status: VerificationStatus;
  ocrConfidence?: number;
  livenessScore?: number;
  faceMatchScore?: number;
  provider?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
}
