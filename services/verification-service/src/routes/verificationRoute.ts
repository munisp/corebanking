/**
 * /api/v1 routes — step-by-step verification flow
 *
 * All routes require KYC agent authentication (Authorization or X-API-KEY header
 * matching KYC_FLOW_API_KEY env var).
 */

import { Router, RequestHandler } from "express";
import multer                      from "multer";
import { authenticateKycAgent } from "../middlewares/auth";
import {
  initializeVerification,
  getVerificationSession,
  patchVerificationSession,
  listCountries,
  getCountryConfig,
  uploadDocument,
  processOcr,
  getOcrResult,
  faceMatch,
  livenessCheck,
  submitVerification,
  getVerificationStatus,
} from "../controllers/verification/verificationController";
import {
  initializeKybSession,
  getKybSession,
  uploadKybDocument,
  processKybOcr,
  getKybOcrResult,
  submitKybVerification,
  getKybStatus,
} from "../controllers/verification/kybController";

const router = Router();

// Memory storage — file bytes live only in req.file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Countries ─────────────────────────────────────────────────────────────────
router.get("/countries",                     authenticateKycAgent, listCountries);
router.get("/countries/:countryCode/config", authenticateKycAgent, getCountryConfig);

// ── KYC: Session lifecycle ────────────────────────────────────────────────────
router.post ("/verification/initialize",   authenticateKycAgent, initializeVerification);
router.get  ("/verification/:id/session",  authenticateKycAgent, getVerificationSession);
router.patch("/verification/:id/session",  authenticateKycAgent, patchVerificationSession);

// ── KYC: Document upload + OCR ────────────────────────────────────────────────
router.post("/verification/:id/documents/upload",     authenticateKycAgent, upload.single("document") as unknown as RequestHandler, uploadDocument);
router.post("/verification/:id/documents/ocr",        authenticateKycAgent, processOcr);
router.get ("/verification/:id/documents/ocr/:jobId", authenticateKycAgent, getOcrResult);

// ── KYC: Biometric verification ───────────────────────────────────────────────
router.post("/verification/:id/biometric/face-match", authenticateKycAgent, faceMatch);
router.post("/verification/:id/biometric/liveness",   authenticateKycAgent, livenessCheck);

// ── KYC: Submission & status ──────────────────────────────────────────────────
router.post("/verification/:id/submit", authenticateKycAgent, submitVerification);
router.get ("/verification/:id/status", authenticateKycAgent, getVerificationStatus);

// ── KYB: Business verification (step-by-step) ─────────────────────────────────
router.post("/kyb/initialize",                    authenticateKycAgent, initializeKybSession);
router.get ("/kyb/:id/session",                   authenticateKycAgent, getKybSession);
router.post("/kyb/:id/documents/upload",          authenticateKycAgent, upload.single("document") as unknown as RequestHandler, uploadKybDocument);
router.post("/kyb/:id/documents/ocr",             authenticateKycAgent, processKybOcr);
router.get ("/kyb/:id/documents/ocr/:jobId",      authenticateKycAgent, getKybOcrResult);
router.post("/kyb/:id/submit",                    authenticateKycAgent, submitKybVerification);
router.get ("/kyb/:id/status",                    authenticateKycAgent, getKybStatus);

export default router;
