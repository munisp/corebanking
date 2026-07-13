/**
 * Verification Flow State Management
 * Central state management for the 4-step verification process
 */

import { useState, useCallback, useRef } from "react";
import type {
  VerificationSession,
  VerificationStep,
  VerificationStatus,
  Country,
  DocumentType,
  DocumentImage,
  OCRResult,
  CountryDocumentConfig,
} from "../types/verification";
import { verificationAPI } from "../services/verificationAPI";

interface UseVerificationFlowOptions {
  verificationId?: string;
  onStepChange?: (step: VerificationStep) => void;
  onStatusChange?: (status: VerificationStatus) => void;
}

export function useVerificationFlow(options: UseVerificationFlowOptions = {}) {
  const { verificationId: initialVerificationId, onStepChange, onStatusChange } =
    options;

  // Session state
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Country Selection
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countriesLoading, setCountriesLoading] = useState(false);

  // Step 2: Document Selection
  const [documentConfig, setDocumentConfig] = useState<CountryDocumentConfig | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [documentConfigLoading, setDocumentConfigLoading] = useState(false);

  // Step 3: Document Verification
  const [documentImages, setDocumentImages] = useState<DocumentImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  // Step 4: Biometric Verification
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [biometricProcessing, setBiometricProcessing] = useState(false);

  const verificationIdRef = useRef(initialVerificationId || "");

  /**
   * Initialize verification session
   */
  const initializeSession = useCallback(async (metadata?: Record<string, unknown>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await verificationAPI.initializeVerification(metadata) as Record<string, unknown>;
      const newSession: VerificationSession = {
        sessionId:      (response.sessionId      as string) || "",
        verificationId: (response.verificationId as string) || "",
        currentStep: 1,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        attemptCount: 0,
      };

      verificationIdRef.current = newSession.verificationId;
      setSession(newSession);
      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize verification";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Step 1: Load countries
   */
  const loadCountries = useCallback(async () => {
    try {
      setCountriesLoading(true);
      const response = await verificationAPI.getCountriesList();
      setCountries(response.countries || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load countries";
      setError(message);
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  /**
   * Step 1: Select country and load document config
   */
  const selectCountry = useCallback(
    async (country: Country) => {
      try {
        setSelectedCountry(country);
        setDocumentConfigLoading(true);
        setError(null);

        const configResponse = await verificationAPI.getCountryConfig(country.code);
        setDocumentConfig(configResponse.config);

        // Update session
        if (session) {
          const updatedSession: VerificationSession = {
            ...session,
            country,
            documentConfig: configResponse.config,
            updatedAt: Date.now(),
          };
          setSession(updatedSession);
        }

        // Move to step 2
        moveToStep(2);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load document configuration";
        setError(message);
      } finally {
        setDocumentConfigLoading(false);
      }
    },
    [session],
  );

  /**
   * Step 2: Select document type
   */
  const selectDocumentType = useCallback((documentType: DocumentType) => {
    setSelectedDocumentType(documentType);
    moveToStep(3);
  }, []);

  /**
   * Step 3: Add document image
   */
  const addDocumentImage = useCallback(
    (image: DocumentImage) => {
      setDocumentImages((prev) => {
        // Remove existing image of the same side
        const filtered = prev.filter((img) => img.side !== image.side);
        return [...filtered, image];
      });
    },
    [],
  );

  /**
   * Step 3: Process OCR
   */
  const processDocumentOCR = useCallback(async () => {
    if (!selectedDocumentType || !verificationIdRef.current) {
      setError("Document type or verification ID not set");
      return;
    }

    try {
      setOcrProcessing(true);
      setError(null);

      // Upload documents and get IDs
      const documentIds: string[] = [];
      for (const image of documentImages) {
        const { documentId } = await verificationAPI.uploadDocument(
          verificationIdRef.current,
          image.file,
          image.side,
        );
        documentIds.push(documentId);
      }

      // Process OCR
      const ocrResponse = await verificationAPI.processOCR(
        verificationIdRef.current,
        documentIds,
        selectedDocumentType,
      );

      // Poll for OCR result if processing
      if (ocrResponse.status === "processing" && ocrResponse.jobId) {
        let jobId = ocrResponse.jobId;
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2 = 60 seconds

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
          const result = await verificationAPI.getOCRResult(
            verificationIdRef.current,
            jobId,
          );

          if (result.status === "completed" && result.result) {
            setOcrResults([result.result]);
            return result.result;
          } else if (result.status === "failed") {
            throw new Error(result.error || "OCR processing failed");
          }

          attempts++;
        }

        throw new Error("OCR processing timeout");
      }

      if (ocrResponse.result) {
        setOcrResults([ocrResponse.result]);
        return ocrResponse.result;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR processing failed";
      setError(message);
      throw err;
    } finally {
      setOcrProcessing(false);
    }
  }, [documentImages, selectedDocumentType]);

  /**
   * Step 4: Add selfie
   */
  const addSelfieImage = useCallback((imageBase64: string) => {
    setSelfieImage(imageBase64);
  }, []);

  /**
   * Step 4: Verify biometrics (face match + liveness)
   */
  const verifyBiometrics = useCallback(
    async (frameData?: unknown[], livenessProof?: unknown) => {
      if (!verificationIdRef.current || !selfieImage) {
        setError("Selfie image not captured");
        return;
      }

      try {
        setBiometricProcessing(true);
        setError(null);

        // Get document face from OCR results
        const documentFaceImage = ocrResults[0]?.extractedData.faceImageBase64;
        if (!documentFaceImage) {
          throw new Error("Document face image not available");
        }

        // Verify face match
        const faceVerification = await verificationAPI.verifyFace(
          verificationIdRef.current,
          selfieImage,
          documentFaceImage,
        );

        // Verify liveness if proof provided
        if (frameData && livenessProof) {
          await verificationAPI.verifyLiveness(
            verificationIdRef.current,
            frameData,
            livenessProof,
          );
        }

        return { faceVerification };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Biometric verification failed";
        setError(message);
        throw err;
      } finally {
        setBiometricProcessing(false);
      }
    },
    [selfieImage, ocrResults],
  );

  /**
   * Submit verification
   */
  const submitVerification = useCallback(
    async (metadata?: Record<string, unknown>) => {
      if (!verificationIdRef.current) {
        setError("Verification ID not set");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await verificationAPI.submitVerification(
          verificationIdRef.current,
          {
            documentVerified: ocrResults.length > 0,
            faceMatched: !!selfieImage,
            livenessVerified: !!selfieImage,
            metadata,
          },
        );

        // Update session
        if (session) {
          const updatedSession: VerificationSession = {
            ...session,
            status: response.status,
            currentStep: "complete",
            updatedAt: Date.now(),
          };
          setSession(updatedSession);
          onStatusChange?.(response.status);
        }

        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [session, ocrResults, selfieImage, onStatusChange],
  );

  /**
   * Navigation helpers
   */
  const moveToStep = useCallback(
    (step: VerificationStep) => {
      if (session) {
        const updatedSession: VerificationSession = {
          ...session,
          currentStep: step,
          updatedAt: Date.now(),
        };
        setSession(updatedSession);
      }
      onStepChange?.(step);
    },
    [session, onStepChange],
  );

  const nextStep = useCallback(() => {
    if (session) {
      const nextStep = Math.min(4, (session.currentStep as number) + 1) as VerificationStep;
      moveToStep(nextStep);
    }
  }, [session, moveToStep]);

  const previousStep = useCallback(() => {
    if (session) {
      const prevStep = Math.max(1, (session.currentStep as number) - 1) as VerificationStep;
      moveToStep(prevStep);
    }
  }, [session, moveToStep]);

  const reset = useCallback(() => {
    setSession(null);
    setSelectedCountry(null);
    setSelectedDocumentType(null);
    setDocumentImages([]);
    setOcrResults([]);
    setSelfieImage(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  return {
    // Session
    session,
    loading,
    error,
    verificationId: verificationIdRef.current,
    initializeSession,

    // Step 1: Country
    countries,
    countriesLoading,
    selectedCountry,
    loadCountries,
    selectCountry,

    // Step 2: Document
    documentConfig,
    documentConfigLoading,
    selectedDocumentType,
    selectDocumentType,

    // Step 3: Document verification
    documentImages,
    uploadProgress,
    ocrResults,
    ocrProcessing,
    addDocumentImage,
    processDocumentOCR,

    // Step 4: Biometric
    selfieImage,
    biometricProcessing,
    addSelfieImage,
    verifyBiometrics,

    // Navigation
    moveToStep,
    nextStep,
    previousStep,

    // Submission
    submitVerification,
    reset,
  };
}
