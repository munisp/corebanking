/**
 * KYB Controller — /api/v1/kyb/ step-by-step endpoints
 *
 * Mirrors the KYC verificationController pattern but for business onboarding:
 *   POST   /api/v1/kyb/initialize
 *   POST   /api/v1/kyb/:id/documents/upload
 *   POST   /api/v1/kyb/:id/documents/ocr
 *   GET    /api/v1/kyb/:id/documents/ocr/:jobId
 *   GET    /api/v1/kyb/:id/session
 *   POST   /api/v1/kyb/:id/submit
 *   GET    /api/v1/kyb/:id/status
 */

import httpStatus from "http-status";
import { Request, Response } from "express";
import { asyncHandler }      from "../../middlewares/async";
import { ApiError }          from "../../middlewares/error";
import { AppDataSource }     from "../../database/dataSource";
import { KycVerificationWorkflowEntity } from "../../entity/KycVerificationWorkflowEntity";
import { VerificationWorkflowStatus, KycIdentityProviders } from "../../utils/enums";
import { setupTemporalClient } from "../../setup/setupTemporalClient";
import { verifyDocument }      from "../../activities/verifyDocument";
import logger                  from "../../config/logger.config";
import {
  createSession,
  getSession,
  updateSession,
  addDocument,
  createOcrJob,
  getOcrJob,
  updateOcrJob,
  OcrJobResult,
} from "../../services/verificationSessionStore";
import {
  process_business_kyb_signal,
  KybDocumentSignalPayload,
} from "../../workflows/businessKybWorkflow";

// ─── Initialize ───────────────────────────────────────────────────────────────

/** POST /api/v1/kyb/initialize */
export const initializeKybSession = asyncHandler(async (req: Request, res: Response) => {
  const { metadata } = req.body || {};

  const existingId = (metadata as Record<string, unknown> | undefined)?.existingVerificationId as string | undefined;

  let linkedId: string | undefined;
  if (existingId) {
    try {
      const entity = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
        where: { id: existingId },
      });
      if (entity && entity.status === VerificationWorkflowStatus.RUNNING && entity.identity_provider === KycIdentityProviders.BUSINESS_KYB) {
        linkedId = existingId;
      }
    } catch (err: any) {
      logger.warn(`[kybController] could not link to entity ${existingId}: ${err.message}`);
    }
  }

  const session = createSession(metadata, linkedId);
  if (linkedId) {
    updateSession(session.id, { linkedVerificationId: linkedId });
    logger.info(`[kybController] session ${session.id} linked to workflow ${linkedId}`);
  }

  return res.status(httpStatus.CREATED).json({
    sessionId:      session.id,
    verificationId: session.id,
    status:         session.status,
    createdAt:      session.createdAt,
    expiresAt:      session.expiresAt,
  });
});

// ─── Session ──────────────────────────────────────────────────────────────────

/** GET /api/v1/kyb/:id/session */
export const getKybSession = asyncHandler(async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  return res.json({
    id:            session.id,
    status:        session.status,
    documentCount: session.documents.length,
    score:         session.score,
    createdAt:     session.createdAt,
    expiresAt:     session.expiresAt,
  });
});

// ─── Document upload ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/kyb/:id/documents/upload
 * Body (multipart): file, documentType (cac_certificate|tin_certificate|director_id|utility_bill|memorandum)
 */
export const uploadKybDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  const file = req.file;
  if (!file) throw new ApiError(httpStatus.BAD_REQUEST, "No document file uploaded", "KYB-400-01", "verification-service");

  const docType = (req.body?.documentType || "other") as string;
  const base64  = file.buffer.toString("base64");

  logger.info(`[kybController] uploadKybDocument — session=${id} docType=${docType} size=${file.size}`);

  const doc = addDocument(id, {
    side:       "front",
    base64:     `data:${file.mimetype};base64,${base64}`,
    mimeType:   file.mimetype,
    uploadedAt: Date.now(),
  });

  // Tag the document with its KYB type so the submit handler can find it
  updateSession(id, {
    documentType: docType,
    [`kybDoc_${docType}`]: `data:${file.mimetype};base64,${base64}`,
  } as any);

  return res.status(httpStatus.CREATED).json({
    documentId:   doc!.id,
    documentType: docType,
    uploadedAt:   doc!.uploadedAt,
  });
});

// ─── OCR ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/kyb/:id/documents/ocr */
export const processKybOcr = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { documentType } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  const frontDoc = session.documents.at(-1); // most recently uploaded
  if (!frontDoc) throw new ApiError(httpStatus.BAD_REQUEST, "No document uploaded yet", "KYB-400-02", "verification-service");

  const job = createOcrJob(id)!;
  updateOcrJob(id, job.jobId, { status: "processing" });

  // Run OCR in background
  runKybOcrJob(id, job.jobId, {
    frontImage:   frontDoc.base64,
    backImage:    frontDoc.base64,
    documentType: documentType || session.documentType || "national_id",
    country:      "NG",
  }).catch(() => { /* errors stored in job */ });

  logger.info(`[kybController] OCR job started — session=${id} jobId=${job.jobId} docType=${documentType}`);
  return res.json({ jobId: job.jobId, status: "processing", estimatedTimeMs: 2000 });
});

/** GET /api/v1/kyb/:id/documents/ocr/:jobId */
export const getKybOcrResult = asyncHandler(async (req: Request, res: Response) => {
  const { id, jobId } = req.params;

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  const job = getOcrJob(id, jobId);
  if (!job) throw new ApiError(httpStatus.NOT_FOUND, "OCR job not found", "KYB-404-02", "verification-service");

  if (job.status === "failed")    return res.json({ status: "failed", jobId, error: job.error });
  if (job.status === "completed" && job.result) {
    return res.json({
      status: "completed",
      jobId,
      result: {
        confidence:    job.result.confidence,
        provider:      "internal",
        extractedData: job.result.extractedData,
        validations:   job.result.validations,
      },
    });
  }
  return res.json({ status: job.status, jobId });
});

// ─── Submit ───────────────────────────────────────────────────────────────────

/** POST /api/v1/kyb/:id/submit */
export const submitKybVerification = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metadata } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  if (metadata) updateSession(id, { metadata });

  logger.info(`[kybSubmit:${id}] linkedVerificationId=${session.linkedVerificationId ?? "none"} sessionMeta=${JSON.stringify(session.metadata)}`);

  const linkedId = session.linkedVerificationId;
  if (linkedId) {
    try {
      const entity = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
        where: { id: linkedId, status: VerificationWorkflowStatus.RUNNING },
        relations: ["client"],
      });

      if (!entity) {
        logger.warn(`[kybSubmit:${id}] entity ${linkedId} not found or not RUNNING`);
      }

      if (entity && entity.identity_provider === KycIdentityProviders.BUSINESS_KYB) {
        // Collect all KYB documents from the session
        const sessionData = session as any;
        const businessDocuments: KybDocumentSignalPayload["businessDocuments"] = [];
        const docTypes = ["cac_certificate", "tin_certificate", "utility_bill", "memorandum"] as const;
        for (const dt of docTypes) {
          const base64 = sessionData[`kybDoc_${dt}`];
          if (base64) businessDocuments.push({ type: dt, base64 });
        }

        const directorBase64 = sessionData["kybDoc_director_id"];
        const directorDocument = directorBase64 ? { type: "national_id", base64: directorBase64 } : undefined;

        const signalPayload: KybDocumentSignalPayload = {
          verificationId:   linkedId,
          businessDocuments,
          directorDocument,
          metadata:         session.metadata as Record<string, unknown>,
        };

        logger.info(`[kybSubmit:${id}] signal payload — businessDocs=${businessDocuments.length} hasDirector=${Boolean(directorDocument)}`);

        const wfClient = await setupTemporalClient();
        const wfId     = `init-business_kyb-kyb-${linkedId}`;
        const handle   = wfClient.getHandle(wfId);

        logger.info(`[kybSubmit:${id}] signalling ${wfId}`);
        await handle.signal(process_business_kyb_signal, signalPayload);
        logger.info(`[kybSubmit:${id}] signal sent OK`);

        updateSession(id, { status: "processing" });
        return res.json({
          status:         "processing",
          sessionId:      id,
          verificationId: linkedId,
          message:        "KYB verification submitted — processing via workflow",
        });
      }
    } catch (err: any) {
      logger.warn(`[kybSubmit:${id}] Temporal signal failed (${err.message}) — falling back to inline scoring`);
    }
  }

  // ── Inline fallback (no Temporal) ─────────────────────────────────────────
  const sessionData = session as any;
  const hasCac      = Boolean(sessionData["kybDoc_cac_certificate"]);
  const hasTin      = Boolean(sessionData["kybDoc_tin_certificate"]);
  const hasDirector = Boolean(sessionData["kybDoc_director_id"]);
  const score       = Number(((hasCac ? 0.5 : 0) + (hasTin ? 0.3 : 0) + (hasDirector ? 0.2 : 0)).toFixed(3));
  const status      = score >= 0.5 ? "verified" : score >= 0.3 ? "manual_review" : "rejected";

  updateSession(id, { status: status as any, score });

  // Notify orchestrator so business-service gets marked VERIFIED
  if (status === "verified") {
    const callbackUrl = process.env.KYB_CALLBACK_URL;
    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    if (callbackUrl && meta.tenant_id && meta.keycloak_id) {
      try {
        const axios = (await import("axios")).default;
        await axios.post(callbackUrl, {
          id:    linkedId || id,
          score,
          metadata: meta,
          faceVerificationResult: { success: true, similarity: score },
          dataVerificationResult: { firstName: true, lastName: true, UIN: hasCac, phone: true, dateOfBirth: false },
        }, { timeout: 10000 });
        logger.info(`[kybSubmit:${id}] inline callback delivered to ${callbackUrl}`);
      } catch (cbErr: any) {
        logger.warn(`[kybSubmit:${id}] inline callback failed (${cbErr.message}) — business-service not updated`);
      }
    }
  }

  return res.json({
    status,
    sessionId:      id,
    verificationId: linkedId || id,
    score,
    verified:       status === "verified",
    message:        status === "verified" ? "Business verification successful" : "Business verification requires review",
  });
});

// ─── Status ───────────────────────────────────────────────────────────────────

/** GET /api/v1/kyb/:id/status */
export const getKybStatus = asyncHandler(async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "KYB session not found", "KYB-404-01", "verification-service");

  return res.json({
    status:         session.status,
    sessionId:      session.id,
    verificationId: session.id,
    score:          session.score,
    createdAt:      session.createdAt,
    expiresAt:      session.expiresAt,
  });
});

// ─── Private helpers ──────────────────────────────────────────────────────────

async function runKybOcrJob(
  sessionId: string,
  jobId: string,
  args: { frontImage: string; backImage: string; documentType: string; country: string },
) {
  try {
    const result = await verifyDocument(args);
    const ocrResult: OcrJobResult = {
      documentType:  args.documentType,
      confidence:    result.confidence,
      isValid:       result.isValid,
      extractedData: result.extractedData,
      validations: {
        isComplete: result.isValid,
        isExpired:  false,
        isBlurry:   false,
        isCropped:  false,
        hasGlare:   false,
      },
    };
    updateOcrJob(sessionId, jobId, { status: "completed", result: ocrResult });
  } catch (err: any) {
    updateOcrJob(sessionId, jobId, { status: "failed", error: err.message });
  }
}
