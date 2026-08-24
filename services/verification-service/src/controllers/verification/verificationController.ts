/**
 * Verification Controller — new /api/v1 step-by-step endpoints
 *
 * All handlers use the in-memory VerificationSessionStore for the 4-step flow.
 * OCR, liveness, and face-match activities are called directly (not via Temporal)
 * so each step can return a synchronous HTTP response.
 *
 * The /submit endpoint calculates a final score and returns the verification
 * decision; the caller (tenant back-end) is responsible for persisting the result.
 */

import httpStatus from "http-status";
import { Request, Response } from "express";
import { asyncHandler }       from "../../middlewares/async";
import { ApiError }           from "../../middlewares/error";
import { KycCountryDocumentMap, KycDocumentType } from "../../utils/enums";
import { verifyDocument }         from "../../activities/verifyDocument";
import { validateLivenessProof }  from "../../activities/validateLivenessProof";
import { sendWebhook }            from "../../activities/sendWebhook";
import { AppDataSource }          from "../../database/dataSource";
import { KycVerificationWorkflowEntity } from "../../entity/KycVerificationWorkflowEntity";
import { setupTemporalClient }    from "../../setup/setupTemporalClient";
import { VerificationWorkflowStatus } from "../../utils/enums";
import { process_liveness_verification_event_signal } from "../../workflows/livenessKycWorkflow";
import { process_default_verification_event_signal }  from "../../workflows";
import { process_shield_verification_event_signal }   from "../../workflows";
import { KycIdentityProviders }   from "../../utils/enums";
import logger                     from "../../config/logger.config";
import { readEnv }                from "../../config/readEnv.config";
import { shieldApiClient }        from "../../lib/ShieldApiClient";
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

// ─── Country helpers ──────────────────────────────────────────────────────────

/** ISO-3166 alpha-2 → flag emoji */
function toFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map(c => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

function getRegion(code: string): string {
  if (["NG","GH","SN","CI","CM","BJ","BF","ML"].includes(code)) return "West Africa";
  if (["KE","TZ","UG","ET","RW"].includes(code))                 return "East Africa";
  if (["ZA","ZM","ZW","AO","MZ","MG"].includes(code))            return "Southern Africa";
  if (["EG","MA","TN"].includes(code))                            return "North Africa";
  return "Other";
}

/** Map backend KycDocumentType → UI DocumentType strings */
const UI_DOC_TYPE: Record<string, string> = {
  [KycDocumentType.INTERNATIONAL_PASSPORT]: "PASSPORT",
  [KycDocumentType.NATIONAL_ID]:            "NATIONAL_ID",
  [KycDocumentType.DRIVERS_LICENSE]:        "DRIVERS_LICENSE",
  [KycDocumentType.VOTERS_CARD]:            "VOTER_CARD",
  [KycDocumentType.VOTERS_ID_GHANA]:        "VOTER_CARD",
  [KycDocumentType.VOTERS_CARD_GENERIC]:    "VOTER_CARD",
  [KycDocumentType.NIN_SLIP]:               "NIN",
  [KycDocumentType.GHANA_CARD]:             "NATIONAL_ID",
  [KycDocumentType.SSNIT_CARD]:             "OTHER",
  [KycDocumentType.ALIEN_CARD]:             "RESIDENCE_PERMIT",
  [KycDocumentType.SA_SMART_ID]:            "NATIONAL_ID",
  [KycDocumentType.SA_GREEN_ID_BOOK]:       "NATIONAL_ID",
  [KycDocumentType.REFUGEE_ID]:             "RESIDENCE_PERMIT",
  [KycDocumentType.RESIDENCE_PERMIT]:       "RESIDENCE_PERMIT",
};

function buildDocRequirement(
  type: string,
  cfg: { label: string; requiresBothSides: boolean },
  recommended: boolean,
) {
  return {
    type:            UI_DOC_TYPE[type] || "OTHER",
    name:            cfg.label,
    description:     `Present a valid ${cfg.label}`,
    requiredSides:   cfg.requiresBothSides ? "both" : "front",
    ocrCapable:      true,
    maxFileSize:     10 * 1024 * 1024,
    allowedFormats:  ["image/jpeg", "image/png", "image/webp"],
    recommended,
  };
}

// ─── Verification Session ────────────────────────────────────────────────────

/** POST /api/v1/verification/initialize */
export const initializeVerification = asyncHandler(async (req: Request, res: Response) => {
  const { metadata } = req.body || {};

  // If an existingVerificationId is supplied (tenant already called
  // POST /kyc/initialize-verification), use the UUID as the session key
  // so all subsequent calls using that UUID resolve directly.
  const existingId = (metadata as Record<string, unknown> | undefined)?.existingVerificationId as string | undefined;

  let linkedId: string | undefined;

  if (existingId) {
    try {
      const entity = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
        where: { id: existingId },
      });
      if (entity && entity.status === VerificationWorkflowStatus.RUNNING) {
        linkedId = existingId;
      }
    } catch (err: any) {
      // Non-fatal: DB may be unreachable; fall through to local session
      logger.warn(`[verification] Could not link to existing workflow ${existingId}: ${err.message}`);
    }
  }

  // Create session with UUID as key (when linked) so GET/POST /verification/:id/...
  // using that UUID resolves correctly via getSession(UUID).
  const session = createSession(metadata, linkedId);
  if (linkedId) {
    updateSession(session.id, { linkedVerificationId: linkedId });
    logger.info(`[verification] Session ${session.id} linked to workflow ${linkedId}`);
  }

  return res.status(httpStatus.CREATED).json({
    sessionId:      session.id,
    verificationId: session.id,  // Always the actual session key — UUID when linked, ver_xxx when not
    status:         session.status,
    createdAt:      session.createdAt,
    expiresAt:      session.expiresAt,
  });
});

/** GET /api/v1/verification/:id/session */
export const getVerificationSession = asyncHandler(async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  return res.json({
    id:            session.id,
    status:        session.status,
    country:       session.country,
    documentType:  session.documentType,
    documentCount: session.documents.length,
    score:         session.score,
    createdAt:     session.createdAt,
    expiresAt:     session.expiresAt,
  });
});

/** PATCH /api/v1/verification/:id/session */
export const patchVerificationSession = asyncHandler(async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  const { country, documentType } = req.body || {};
  const updated = updateSession(req.params.id, {
    ...(country      !== undefined && { country }),
    ...(documentType !== undefined && { documentType }),
  });

  return res.json({ id: updated!.id, status: updated!.status, country: updated!.country, documentType: updated!.documentType });
});

// ─── Countries ───────────────────────────────────────────────────────────────

/** GET /api/v1/countries */
export const listCountries = asyncHandler(async (_req: Request, res: Response) => {
  const popular = ["NG", "GH", "KE", "ZA"];
  const countries = Object.entries(KycCountryDocumentMap).map(([code, cfg]) => ({
    code,
    name:        cfg.countryName,
    flag:        toFlag(code),
    region:      getRegion(code),
    popular:     popular.includes(code),
  }));

  return res.json({ countries, lastUpdated: Date.now() });
});

/** GET /api/v1/countries/:countryCode/config */
export const getCountryConfig = asyncHandler(async (req: Request, res: Response) => {
  const code = req.params.countryCode.toUpperCase();
  const cfg  = KycCountryDocumentMap[code];
  if (!cfg) throw new ApiError(httpStatus.NOT_FOUND, `Country ${code} not supported`, "VER-404-01", "verification-service");

  const documentRequirements = Object.entries(cfg.documents).map(([type, docCfg], i) =>
    buildDocRequirement(type, docCfg!, i === 0),
  );

  return res.json({
    countryCode: code,
    config: {
      countryCode:          code,
      supportedDocuments:   documentRequirements.map(d => d.type),
      documentRequirements,
      ocrProvider:          "internal",
      verificationProvider: "liveness",
      rules: {
        requireFaceMatch:      true,
        requireLivenessCheck:  true,
        maxRetries:            3,
      },
    },
  });
});

// ─── Document Upload ──────────────────────────────────────────────────────────

/** POST /api/v1/verification/:id/documents/upload  (multipart/form-data) */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  const file = req.file;
  if (!file) throw new ApiError(httpStatus.BAD_REQUEST, "No document file uploaded", "VER-400-01", "verification-service");

  const side = (req.body?.side === "back" ? "back" : "front") as "front" | "back";
  const base64 = file.buffer.toString("base64");

  const doc = addDocument(id, {
    side,
    base64:     `data:${file.mimetype};base64,${base64}`,
    mimeType:   file.mimetype,
    uploadedAt: Date.now(),
  });

  return res.status(httpStatus.CREATED).json({
    documentId: doc!.id,
    side:       doc!.side,
    uploadedAt: doc!.uploadedAt,
  });
});

// ─── OCR ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/verification/:id/documents/ocr */
export const processOcr = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { documentType } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  const frontDoc = session.documents.find(d => d.side === "front");
  if (!frontDoc) throw new ApiError(httpStatus.BAD_REQUEST, "Front document image required", "VER-400-02", "verification-service");

  const job = createOcrJob(id)!;
  updateOcrJob(id, job.jobId, { status: "processing" });

  // Run OCR in background — controller returns immediately with jobId
  runOcrJob(id, job.jobId, {
    frontImage:   frontDoc.base64,
    backImage:    session.documents.find(d => d.side === "back")?.base64 || frontDoc.base64,
    documentType: documentType || session.documentType || "national_id",
    country:      session.country || "NG",
  }).catch(() => { /* errors stored in job */ });

  return res.json({ jobId: job.jobId, status: "processing", estimatedTimeMs: 2000 });
});

/** GET /api/v1/verification/:id/documents/ocr/:jobId */
export const getOcrResult = asyncHandler(async (req: Request, res: Response) => {
  const { id, jobId } = req.params;

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  const job = getOcrJob(id, jobId);
  if (!job) throw new ApiError(httpStatus.NOT_FOUND, "OCR job not found", "VER-404-03", "verification-service");

  if (job.status === "failed") {
    return res.json({ status: "failed", jobId, error: job.error });
  }

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

// ─── Biometrics ───────────────────────────────────────────────────────────────

/** POST /api/v1/verification/:id/biometric/face-match */
export const faceMatch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  // `documentFaceImage` is accepted for backward compatibility but no longer
  // used: the provider verifies the selfie against the identity reference.
  const { selfieImage } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");
  if (!selfieImage) throw new ApiError(httpStatus.BAD_REQUEST, "selfieImage is required", "VER-400-03", "verification-service");

  updateSession(id, { selfieBase64: selfieImage });

  // The identity reference (NIN) must come from session metadata captured at
  // initialization — never from the face-match request body.
  const nin = (session.metadata?.nin ?? session.metadata?.UIN) as string | undefined;
  const result = await compareFaces(selfieImage, nin);
  updateSession(id, { faceMatchScore: result.score });

  return res.json({
    verified:   result.verified,
    score:      result.score,
    confidence: result.score,
    provider:   "internal",
    message:    result.verified ? "Face match successful" : "Face match failed",
  });
});

/** POST /api/v1/verification/:id/biometric/liveness */
export const livenessCheck = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { proof } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");
  if (!proof)   throw new ApiError(httpStatus.BAD_REQUEST, "Liveness proof is required", "VER-400-04", "verification-service");

  const result = await validateLivenessProof({ livenessProof: proof, sessionId: id });

  // Store the raw proof — needed to build the Temporal signal payload at submit time
  updateSession(id, {
    livenessVerified:    result.isValid,
    livenessConfidence:  proof.confidence ?? 0,
    livenessProof:       proof,
  });

  return res.json({
    verified:   result.isValid,
    live:       result.isValid,
    confidence: proof.confidence ?? 0,
    provider:   "internal",
    reason:     result.reason,
    methods: {
      challengePassed: proof.signals?.challengePassed ?? false,
      motionDetected:  (proof.signals?.motion ?? 0) > 0.2,
    },
  });
});

// ─── Submit & Status ──────────────────────────────────────────────────────────

/** POST /api/v1/verification/:id/submit */
export const submitVerification = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { documentVerified, faceMatched, livenessVerified, metadata } = req.body || {};

  const session = getSession(id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

  if (metadata) updateSession(id, { metadata });

  // ── Path A: linked to an existing Temporal workflow ─────────────────────────
  // When the tenant initialised via POST /kyc/initialize-verification (old flow),
  // pass all collected data as the Temporal signal and let the workflow handle
  // scoring, DB update, and webhook — exactly like the legacy /kyc/verify does.
  const linkedId = session.linkedVerificationId;
  logger.info(`[submit:${id}] linkedVerificationId=${linkedId ?? "none"} sessionMeta=${JSON.stringify(session.metadata)}`);

  if (linkedId) {
    try {
      const entity = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
        where: { id: linkedId, status: VerificationWorkflowStatus.RUNNING },
        relations: ["client"],
      });

      if (!entity) {
        logger.warn(`[submit:${id}] linked entity ${linkedId} not found or not RUNNING — falling through to inline scoring`);
      }

      if (entity) {
        logger.info(`[submit:${id}] found running entity — provider=${entity.identity_provider} callbackUrl=${entity.client?.callback_url ?? "none"}`);

        const frontDoc = session.documents.find(d => d.side === "front");
        const backDoc  = session.documents.find(d => d.side === "back");

        const signalPayload = {
          endUserInfo: { id: linkedId },
          document: (frontDoc || backDoc) ? {
            type:       session.documentType || "national_id",
            country:    session.country      || "NG",
            frontImage: frontDoc?.base64     || "",
            backImage:  backDoc?.base64      || frontDoc?.base64 || "",
          } : undefined,
          selfie:       session.selfieBase64 ? { image: session.selfieBase64 } : undefined,
          // defaultVerifyFace reads payload.documents.find(d => d.type === "face").pages[0].base64
          // Include the selfie as a "face" document so all three workflow types work.
          documents: session.selfieBase64 ? [
            { type: "face" as const, pages: [{ base64: session.selfieBase64 }] },
          ] : undefined,
          livenessProof: session.livenessProof,
          metadata:      session.metadata,
        };

        logger.info(`[submit:${id}] signal payload summary — hasDocument=${Boolean(signalPayload.document)} hasSelfie=${Boolean(signalPayload.selfie)} hasDocuments=${Boolean(signalPayload.documents)} hasLivenessProof=${Boolean(signalPayload.livenessProof)} metadata=${JSON.stringify(signalPayload.metadata)}`);

        const wfClient = await setupTemporalClient();
        const wfId     = `init-${entity.identity_provider}-kyc-${linkedId}`;
        const handle   = wfClient.getHandle(wfId);

        logger.info(`[submit:${id}] signalling Temporal workflow ${wfId} (provider=${entity.identity_provider})`);

        if (entity.identity_provider === KycIdentityProviders.LIVENESS) {
          await handle.signal(process_liveness_verification_event_signal, signalPayload as any);
        } else if (entity.identity_provider === KycIdentityProviders.DEFAULT) {
          await handle.signal(process_default_verification_event_signal, signalPayload as any);
        } else {
          await handle.signal(process_shield_verification_event_signal, signalPayload as any);
        }

        logger.info(`[submit:${id}] signal sent OK`);
        updateSession(id, { status: "processing" });

        return res.json({
          status:         "processing",
          sessionId:      id,
          verificationId: linkedId,
          message:        "Verification submitted — processing via workflow",
        });
      }
    } catch (err: any) {
      // Temporal may be unavailable; fall through to inline path
      logger.warn(`[submit:${id}] Temporal signal failed (${err.message}) — falling back to inline scoring`);
    }
  }

  // ── Path B: inline scoring (no Temporal, or Temporal unavailable) ────────────
  const score  = computeScore(session, { documentVerified, faceMatched, livenessVerified });
  const status = score >= 0.6 ? "verified"
               : score >= 0.4 ? "manual_review"
               : "rejected";

  updateSession(id, { status: status as any, score });

  // Fire webhook if a callbackUrl was included in session metadata
  const callbackUrl = (session.metadata?.callbackUrl || session.metadata?.callback_url) as string | undefined;
  if (callbackUrl) {
    const webhookPayload: any = {
      id:             linkedId || id,
      score,
      status,
      faceVerificationResult: { success: status === "verified", similarity: session.faceMatchScore ?? 0, ninData: { nin: "", firstName: "", lastName: "", dateOfBirth: "", phone: "" } },
      dataVerificationResult: { UIN: true, firstName: true, lastName: true, phone: false, dateOfBirth: false },
      metadata: session.metadata,
    };
    sendWebhook(callbackUrl, webhookPayload).catch(err =>
      logger.warn(`[verification] Webhook delivery failed: ${err.message}`),
    );
  }

  return res.json({
    status,
    sessionId:      id,
    verificationId: linkedId || id,
    score,
    verified:       status === "verified",
    message:        statusMessage(status),
  });
});

/** GET /api/v1/verification/:id/status */
export const getVerificationStatus = asyncHandler(async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, "Session not found", "VER-404-02", "verification-service");

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

async function runOcrJob(
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
      extractedData: {
        ...result.extractedData,
        // Expose front image as the "extracted face" so the Step 4 face-match can run
        faceImageBase64: args.frontImage,
      },
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
    // M-54: provider/upstream error details stay in server logs; the client only
    // ever sees a generic failure message.
    logger.error(`[ocrJob:${jobId}] document processing failed`, { error: String(err?.message ?? err) });
    updateOcrJob(sessionId, jobId, { status: "failed", error: "Document processing failed" });
  }
}

/**
 * Face comparison (W7-C-02).
 *
 * `verified: true` is NEVER a default. The selfie is verified through the
 * configured Shield face-verification provider against the identity reference
 * (NIN passport photo). When no provider is configured, or the session carries
 * no identity reference, the request fails closed (503/400) instead of
 * returning a fabricated similarity score. Match threshold: similarity ≥ 0.70.
 */
async function compareFaces(selfie: string, nin?: string): Promise<{ score: number; verified: boolean }> {
  if (!selfie) return { score: 0, verified: false };
  if (!readEnv("SHIELD_VERIFICATION_BASE_URL") || !readEnv("SHIELD_VERIFICATION_API_KEY")) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Face-match provider not configured (face_match_not_configured)",
      "VER-503-01",
      "verification-service",
    );
  }
  if (!nin) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Session metadata must include an identity reference (nin) before face match can run",
      "VER-400-05",
      "verification-service",
    );
  }
  const result = await shieldApiClient.verifyFace({ base64Image: selfie, nin });
  const similarity = typeof result.similarity === "number" && Number.isFinite(result.similarity)
    ? Math.min(Math.max(result.similarity, 0), 1)
    : 0;
  return { score: similarity, verified: result.success === true && similarity >= 0.70 };
}

/**
 * Weighted verification score:
 *   Document OCR confidence  → 40%
 *   Face match               → 40%
 *   Liveness                 → 20%
 */
function computeScore(
  session: NonNullable<ReturnType<typeof getSession>>,
  flags: { documentVerified?: boolean; faceMatched?: boolean; livenessVerified?: boolean },
): number {
  const completedOcr   = Object.values(session.ocrJobs).find(j => j.status === "completed");
  const docConfidence  = completedOcr?.result?.confidence ?? 0;
  const docScore       = flags.documentVerified ? Math.max(docConfidence, 0.80) : 0;

  // W7-C-02: only a measured provider score counts. A client-supplied
  // `faceMatched` flag can never mint a similarity score.
  const faceScore      = session.faceMatchScore ?? 0;
  const livenessScore  = (session.livenessVerified || flags.livenessVerified) ? 1.0 : 0;

  const total = docScore * 0.40 + faceScore * 0.40 + livenessScore * 0.20;
  return Number(total.toFixed(3));
}

function statusMessage(status: string): string {
  switch (status) {
    case "verified":      return "Identity verified successfully";
    case "manual_review": return "Verification submitted for manual review";
    default:              return "Verification could not be completed";
  }
}
