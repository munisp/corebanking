/**
 * Verification Session Store
 *
 * In-memory store for the step-by-step verification flow.
 * Sessions expire after 30 minutes; a background interval clears them.
 * No DB writes here — images are transient, only final scores go to the DB
 * (via the /submit endpoint which updates KycVerificationWorkflowEntity).
 */

import { randomUUID } from "crypto";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface SessionDocument {
  id: string;
  side: "front" | "back";
  /** data:<mime>;base64,<data> */
  base64: string;
  mimeType: string;
  uploadedAt: number;
}

export interface OcrJobResult {
  documentType: string;
  confidence: number;
  isValid: boolean;
  extractedData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    address?: string;
    nationality?: string;
    /** Front image passed as the "extracted face" so Step 4 face-match can proceed */
    faceImageBase64?: string;
  };
  validations: {
    isExpired:  boolean;
    isBlurry:   boolean;
    isCropped:  boolean;
    hasGlare:   boolean;
    isComplete: boolean;
  };
}

export interface OcrJob {
  jobId:     string;
  status:    "pending" | "processing" | "completed" | "failed";
  result?:   OcrJobResult;
  error?:    string;
  createdAt: number;
}

export type SessionStatus =
  | "pending"
  | "processing"
  | "verified"
  | "rejected"
  | "manual_review"
  | "expired";

export interface VerificationSession {
  id:               string;
  status:           SessionStatus;
  country?:         string;
  documentType?:    string;
  documents:        SessionDocument[];
  ocrJobs:          Record<string, OcrJob>;
  selfieBase64?:    string;
  faceMatchScore?:  number;
  livenessVerified?:    boolean;
  livenessConfidence?:  number;
  /** Raw liveness proof from the UI — forwarded as-is to the Temporal signal */
  livenessProof?:       unknown;
  score?:           number;
  metadata?:        Record<string, unknown>;
  /**
   * UUID of an existing KycVerificationWorkflowEntity created by
   * POST /kyc/initialize-verification.  When set, the submit endpoint
   * signals the running Temporal workflow instead of processing inline.
   */
  linkedVerificationId?: string;
  createdAt:        number;
  expiresAt:        number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const store = new Map<string, VerificationSession>();

// Sweep expired sessions every 5 minutes without blocking process exit
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of store.entries()) {
    if (s.expiresAt < now) store.delete(id);
  }
}, 5 * 60 * 1000).unref();

// ─── ID generator ─────────────────────────────────────────────────────────────

// M-56: CSPRNG session/job identifiers (unpredictable, unguessable).
function genId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createSession(metadata?: Record<string, unknown>, id?: string): VerificationSession {
  const sessionId = id || genId("ver");
  const session: VerificationSession = {
    id:        sessionId,
    status:    "pending",
    documents: [],
    ocrJobs:   {},
    metadata,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  store.set(sessionId, session);
  return session;
}

export function getSession(id: string): VerificationSession | undefined {
  const session = store.get(id);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) session.status = "expired";
  return session;
}

export function updateSession(
  id: string,
  updates: Partial<VerificationSession>,
): VerificationSession | undefined {
  const session = store.get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  return session;
}

export function addDocument(
  sessionId: string,
  doc: Omit<SessionDocument, "id">,
): SessionDocument | undefined {
  const session = store.get(sessionId);
  if (!session) return undefined;
  // Replace existing image of the same side
  session.documents = session.documents.filter(d => d.side !== doc.side);
  const document: SessionDocument = { ...doc, id: genId("doc") };
  session.documents.push(document);
  return document;
}

export function createOcrJob(sessionId: string): OcrJob | undefined {
  const session = store.get(sessionId);
  if (!session) return undefined;
  const job: OcrJob = {
    jobId:     genId("ocr"),
    status:    "pending",
    createdAt: Date.now(),
  };
  session.ocrJobs[job.jobId] = job;
  return job;
}

export function getOcrJob(sessionId: string, jobId: string): OcrJob | undefined {
  return store.get(sessionId)?.ocrJobs[jobId];
}

export function updateOcrJob(
  sessionId: string,
  jobId: string,
  updates: Partial<OcrJob>,
): OcrJob | undefined {
  const session = store.get(sessionId);
  if (!session || !session.ocrJobs[jobId]) return undefined;
  Object.assign(session.ocrJobs[jobId], updates);
  return session.ocrJobs[jobId];
}
