/**
 * Verification Session Store
 *
 * W12 C3-P1-B2 (c3-1024): redis-backed store for the step-by-step
 * verification flow (register b3 verdict said REUSE an existing client, but
 * the cited otel/init.ts:5 is only an instrumentation comment — this service
 * has NO wired redis client, so a pooled ioredis client is initialized here
 * from the declared-pattern dep; ioredis ^5.4.2 matches the fleet).
 *
 * Keys (register pattern session:{tenant}:{session_id} with
 * tenant="verification"):
 *   session:verification:{sessionId}  JSON VerificationSession,
 *                                     TTL 1800s SLIDING (re-expired on every
 *                                     access — preserves the previous
 *                                     30-minute in-memory lifetime)
 * Sessions expire after 30 minutes; redis TTL replaces the background sweep.
 * Session state now survives restarts and is consistent across replicas;
 * previously a restart silently dropped in-flight KYC verification flows
 * (including uploaded document images and OCR job state).
 * FAIL MODE: redis down => these functions throw and controllers fail closed
 * (500 via asyncHandler) — session state is never silently skipped.
 * No DB writes here — images are transient, only final scores go to the DB
 * (via the /submit endpoint which updates KycVerificationWorkflowEntity).
 */

import { randomUUID } from "crypto";
import Redis from "ioredis";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000; // 1800s sliding

// ─── Redis client (lazy singleton, REDIS_URL per fleet convention) ───────────

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 2,
    });
    redisClient.on("error", (err) => {
      // Logged, not thrown — operations themselves surface errors to callers.
      console.error("[verificationSessionStore] redis error:", err);
    });
  }
  return redisClient;
}

const sessionKey = (id: string): string => `session:verification:${id}`;

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

// ─── Store helpers ────────────────────────────────────────────────────────────

async function loadSession(id: string): Promise<VerificationSession | undefined> {
  const raw = await getRedis().get(sessionKey(id));
  if (!raw) return undefined;
  // Sliding expiry: every access re-applies the TTL (preserves the previous
  // 30-minute inactivity lifetime).
  await getRedis().expire(sessionKey(id), SESSION_TTL_SECONDS);
  return JSON.parse(raw) as VerificationSession;
}

async function saveSession(session: VerificationSession): Promise<void> {
  await getRedis().set(sessionKey(session.id), JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
}

// ─── ID generator ─────────────────────────────────────────────────────────────

// M-56: CSPRNG session/job identifiers (unpredictable, unguessable).
function genId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createSession(metadata?: Record<string, unknown>, id?: string): Promise<VerificationSession> {
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
  await saveSession(session);
  return session;
}

export async function getSession(id: string): Promise<VerificationSession | undefined> {
  const session = await loadSession(id);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) session.status = "expired";
  return session;
}

export async function updateSession(
  id: string,
  updates: Partial<VerificationSession>,
): Promise<VerificationSession | undefined> {
  const session = await loadSession(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  await saveSession(session);
  return session;
}

export async function addDocument(
  sessionId: string,
  doc: Omit<SessionDocument, "id">,
): Promise<SessionDocument | undefined> {
  const session = await loadSession(sessionId);
  if (!session) return undefined;
  // Replace existing image of the same side
  session.documents = session.documents.filter(d => d.side !== doc.side);
  const document: SessionDocument = { ...doc, id: genId("doc") };
  session.documents.push(document);
  await saveSession(session);
  return document;
}

export async function createOcrJob(sessionId: string): Promise<OcrJob | undefined> {
  const session = await loadSession(sessionId);
  if (!session) return undefined;
  const job: OcrJob = {
    jobId:     genId("ocr"),
    status:    "pending",
    createdAt: Date.now(),
  };
  session.ocrJobs[job.jobId] = job;
  await saveSession(session);
  return job;
}

export async function getOcrJob(sessionId: string, jobId: string): Promise<OcrJob | undefined> {
  const session = await loadSession(sessionId);
  return session?.ocrJobs[jobId];
}

export async function updateOcrJob(
  sessionId: string,
  jobId: string,
  updates: Partial<OcrJob>,
): Promise<OcrJob | undefined> {
  const session = await loadSession(sessionId);
  if (!session || !session.ocrJobs[jobId]) return undefined;
  Object.assign(session.ocrJobs[jobId], updates);
  await saveSession(session);
  return session.ocrJobs[jobId];
}
