import axios from "axios";
import * as https from "https";
import logger from "../config/logger.config";
import { NonRetriableApplicationError } from "../middlewares/error";

/**
 * Verify document authenticity and extract data.
 *
 * W7-C-01: this activity NEVER fabricates identity data. It calls the
 * configured document-verification/OCR provider and returns exactly what the
 * provider asserts. When no provider is configured it fails fast with a
 * non-retriable `document_verification_not_configured` error instead of
 * returning a default-success payload.
 *
 * Provider configuration (fail-closed when absent):
 *   DOC_VERIFICATION_PROVIDER_URL     — base URL of the OCR/authenticity provider
 *   DOC_VERIFICATION_PROVIDER_API_KEY — optional bearer/x-api-key credential
 *   DOC_VERIFICATION_TIMEOUT_MS       — optional request timeout (default 30000)
 *
 * Provider contract: POST {DOC_VERIFICATION_PROVIDER_URL}/verify-document
 *   request:  { frontImage, backImage, documentType, country } (base64 images)
 *   response: { isValid: boolean, confidence: number (0..1),
 *               extractedData: { firstName?, lastName?, dateOfBirth?,
 *                                documentNumber?, expiryDate?, address? } }
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";
const ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS === "true" && !IS_PRODUCTION;

interface ExtractedDocumentData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  documentNumber?: string;
  expiryDate?: string;
  address?: string;
}

interface DocumentVerificationResult {
  isValid: boolean;
  extractedData: ExtractedDocumentData;
  confidence: number;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Extract only the known string fields from a provider response — never invent values. */
function sanitizeExtractedData(raw: unknown): ExtractedDocumentData {
  if (raw === null || typeof raw !== "object") return {};
  const data = raw as Record<string, unknown>;
  const out: ExtractedDocumentData = {};
  const firstName = pickString(data.firstName);
  const lastName = pickString(data.lastName);
  const dateOfBirth = pickString(data.dateOfBirth);
  const documentNumber = pickString(data.documentNumber);
  const expiryDate = pickString(data.expiryDate);
  const address = pickString(data.address);
  if (firstName) out.firstName = firstName;
  if (lastName) out.lastName = lastName;
  if (dateOfBirth) out.dateOfBirth = dateOfBirth;
  if (documentNumber) out.documentNumber = documentNumber;
  if (expiryDate) out.expiryDate = expiryDate;
  if (address) out.address = address;
  return out;
}

export async function verifyDocument(args: {
  frontImage: string;
  backImage: string;
  documentType: string;
  country: string;
}): Promise<{
  isValid: boolean;
  extractedData: ExtractedDocumentData;
  confidence: number;
}> {
  const providerUrl = process.env.DOC_VERIFICATION_PROVIDER_URL;
  if (!providerUrl) {
    // Fail fast and explicitly — fabricated identity data is never acceptable
    // on the KYC/KYB path.
    logger.error(
      `[verifyDocument] no document verification provider configured (set DOC_VERIFICATION_PROVIDER_URL) — refusing request for documentType=${args.documentType} country=${args.country}`,
    );
    throw new NonRetriableApplicationError(
      "document_verification_not_configured: no document verification provider is configured (DOC_VERIFICATION_PROVIDER_URL)",
    );
  }

  const apiKey = process.env.DOC_VERIFICATION_PROVIDER_API_KEY;
  const timeoutMs = Number(process.env.DOC_VERIFICATION_TIMEOUT_MS ?? 30000);

  logger.info(`[verifyDocument] requesting provider verification — documentType=${args.documentType} country=${args.country}`);

  let response;
  try {
    response = await axios.post(
      `${providerUrl.replace(/\/+$/, "")}/verify-document`,
      {
        frontImage: args.frontImage,
        backImage: args.backImage,
        documentType: args.documentType,
        country: args.country,
      },
      {
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: !ALLOW_INSECURE_TLS }),
      },
    );
  } catch (error: any) {
    // Transient provider/network failure — retriable by Temporal; the direct
    // (non-Temporal) caller marks the OCR job failed. Never convert to success.
    logger.error(`[verifyDocument] provider call failed: ${String(error?.message ?? error)}`);
    throw error;
  }

  const data = response?.data;
  if (data === null || typeof data !== "object" || typeof data.isValid !== "boolean") {
    // Provider answered but the payload does not satisfy the contract —
    // treat as non-retriable misconfiguration rather than guessing a result.
    logger.error(`[verifyDocument] provider returned malformed payload (status=${response?.status})`);
    throw new NonRetriableApplicationError(
      "document_verification_invalid_provider_response: provider payload missing boolean isValid",
    );
  }

  const rawConfidence = Number(data.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : 0;

  const result: DocumentVerificationResult = {
    isValid: data.isValid,
    extractedData: sanitizeExtractedData(data.extractedData),
    confidence,
  };

  logger.info(`[verifyDocument] provider result — isValid=${result.isValid} confidence=${result.confidence}`);
  return result;
}
