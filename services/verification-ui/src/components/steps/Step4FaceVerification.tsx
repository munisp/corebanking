/**
 * Step 4 — Face Verification / Liveness
 *
 * Sub-steps:
 *   intro → camera_init → countdown → challenge → verifying →
 *   verified | rejected
 *
 * Features:
 *   • Pre-verification instructions
 *   • Liveness engine (motion-based challenge detection)
 *   • 3-challenge sequence from existing engine
 *   • Face capture (best frame from liveness session)
 *   • Calls new biometric/liveness + biometric/face-match endpoints
 *   • Falls back to legacy /kyc/verify if new endpoints are unavailable
 *   • Final verification submit + result screen
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  addToBuffer,
  buildProof,
  captureFrame,
  frameDiff,
  generateChallenge,
  generateProofReport,
  getAverageBrightness,
  getChallengeInstruction,
  hashProof,
  initCamera,
  motionScore,
  scoreEngine,
  stopCamera,
  verifyChallengeResponse,
  type ChallengeType,
  type FrameData,
  type LivenessProof,
  type SignalInputs,
} from "../../liveness";
import type { DocumentRequirement, OCRResult } from "../../types/verification";
import { verificationAPI } from "../../services/verificationAPI";
import type { CapturedImage } from "./Step3DocumentCapture";
import "./Step4FaceVerification.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type SubStep =
  | "intro"
  | "camera_init"
  | "countdown"
  | "challenge"
  | "verifying"
  | "verified"
  | "rejected";

export interface Step4Result {
  verified: boolean;
  status:   "verified" | "rejected" | "manual_review";
  livenessScore: number;
  faceMatchScore?: number;
}

interface Step4Props {
  verificationId: string;
  documentRequirement: DocumentRequirement;
  countryCode: string;
  ocrResult: OCRResult | null;
  capturedImages: CapturedImage[];
  metadata?: Record<string, unknown>;
  onComplete: (result: Step4Result) => void;
  onBack:     () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Step4FaceVerification({
  verificationId,
  documentRequirement,
  countryCode,
  ocrResult,
  capturedImages,
  metadata,
  onComplete,
  onBack,
}: Step4Props) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef          = useRef<HTMLVideoElement>(null);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const animFrameRef      = useRef<number | null>(null);
  const frameBufferRef    = useRef<FrameData[]>([]);
  const prevFrameRef      = useRef<ImageData | null>(null);
  const motionHistRef     = useRef<number[]>([]);
  const diffHistRef       = useRef<number[]>([]);
  const brightnessRef     = useRef<number[]>([]);
  const challengeStartRef = useRef<number>(0);
  const detectedRef       = useRef(false);
  const responseTimesRef  = useRef<number[]>([]);
  const passedCountRef    = useRef(0);
  const allPassedRef      = useRef(false);
  const noiseCaliRef      = useRef<number[]>([]);
  const noiseFloorRef     = useRef(0);

  // ── State ─────────────────────────────────────────────────────────────────
  const [subStep,       setSubStep]       = useState<SubStep>("intro");
  const [countdown,     setCountdown]     = useState(3);
  const [challenges,    setChallenges]    = useState<ChallengeType[]>([]);
  const [challengeIdx,  setChallengeIdx]  = useState(0);
  const [challenge,     setChallenge]     = useState<ChallengeType | null>(null);
  const [challengeOk,   setChallengeOk]   = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [proof,         setProof]         = useState<LivenessProof | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [retryCount,    setRetryCount]    = useState(0);
  const [debugMotion,   setDebugMotion]   = useState(0);

  // ── Camera helpers ─────────────────────────────────────────────────────────

  const cleanupCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) { stopCamera(streamRef.current); streamRef.current = null; }
  }, []);

  const captureSelfie = (): string | null => {
    if (!frameBufferRef.current.length || !canvasRef.current) return null;
    const best = frameBufferRef.current[0];
    const cvs  = canvasRef.current;
    cvs.width  = best.imageData.width;
    cvs.height = best.imageData.height;
    const ctx  = cvs.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(best.imageData, 0, 0);
    return cvs.toDataURL("image/jpeg", 0.82);
  };

  // ── Liveness finalization ──────────────────────────────────────────────────

  const finalizeLiveness = useCallback(async () => {
    setSubStep("verifying");
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const avgMotion = motionHistRef.current.length
      ? motionHistRef.current.reduce((a, b) => a + b, 0) / motionHistRef.current.length
      : 0;

    const calcTimingVariance = (times: number[]) => {
      if (times.length < 2) return 0;
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
      return Math.min(Math.sqrt(variance) / 1000, 1);
    };

    const calcLightVariance = (br: number[]) => {
      if (br.length < 2) return 0;
      const mean = br.reduce((a, b) => a + b, 0) / br.length;
      const variance = br.reduce((s, b) => s + (b - mean) ** 2, 0) / br.length;
      return Math.min(Math.sqrt(variance) / 50, 1);
    };

    const avgDiff = diffHistRef.current.length
      ? diffHistRef.current.reduce((a, b) => a + b, 0) / diffHistRef.current.length
      : 0;

    const inputs: SignalInputs = {
      motion:           avgMotion,
      challengePassed:  allPassedRef.current,
      timingVariance:   calcTimingVariance(responseTimesRef.current),
      lightVariance:    calcLightVariance(brightnessRef.current),
      frameDiff:        avgDiff,
    };

    const signals  = scoreEngine(inputs);
    const total    = challenges.length || 3;
    const half     = Math.ceil(total / 2);
    const passed   = passedCountRef.current >= half;
    const verdict  = (passed && avgMotion > 0.01) || (passed && signals.score > 0.5)
      ? "VERIFIED" : "REJECTED";

    console.log("[Step4] Verdict:", verdict, "Passed:", passedCountRef.current, "/", total, "AvgMotion:", avgMotion.toFixed(5));
    console.log(generateProofReport({ ...buildProof(signals, verdict) }));

    const livenessProof = buildProof(signals, verdict);
    const proofHash     = await hashProof(livenessProof);
    const finalProof    = { ...livenessProof, hash: proofHash };
    setProof(finalProof);

    if (verdict !== "VERIFIED") {
      setSubStep("rejected");
      return;
    }

    // Pass finalProof (with hash) so the backend stores the complete proof
    await submitVerification(finalProof);
  }, [challenges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame processing ───────────────────────────────────────────────────────

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const frame = captureFrame(video, canvas, ctx);
    frameBufferRef.current = addToBuffer(frameBufferRef.current, frame, 12);

    if (prevFrameRef.current) {
      const rawMotion = motionScore(prevFrameRef.current, frame.imageData);

      // Noise floor calibration (first 30 frames)
      if (noiseCaliRef.current.length < 30) {
        noiseCaliRef.current.push(rawMotion);
        if (noiseCaliRef.current.length === 30) {
          const sorted = [...noiseCaliRef.current].sort((a, b) => a - b);
          noiseFloorRef.current = sorted[0] * 0.5;
        }
      }

      let motion = Math.max(0, rawMotion - noiseFloorRef.current);
      if (motion > 0 && motion < 0.01) motion *= 1.5;

      setDebugMotion(motion);
      motionHistRef.current.push(motion);
      if (motionHistRef.current.length > 60) motionHistRef.current.shift();

      const diff = frameDiff(prevFrameRef.current, frame.imageData);
      diffHistRef.current.push(diff);
      if (diffHistRef.current.length > 60) diffHistRef.current.shift();

      const bright = getAverageBrightness(frame.imageData);
      brightnessRef.current.push(bright);
      if (brightnessRef.current.length > 60) brightnessRef.current.shift();

      const elapsed = Date.now() - challengeStartRef.current;
      const MAX_TIME = 10_000;

      // Overall progress
      const challengeProgress = Math.min((elapsed / MAX_TIME) * 100, 100);
      const baseProgress = (challengeIdx / (challenges.length || 3)) * 100;
      setProgress(Math.min(baseProgress + challengeProgress / (challenges.length || 3), 100));

      const completed =
        challenge && verifyChallengeResponse(challenge, motion, motionHistRef.current);

      if (completed && !detectedRef.current) {
        detectedRef.current = true;
        setChallengeOk(true);
        passedCountRef.current++;
        responseTimesRef.current.push(elapsed);

        setTimeout(() => {
          setChallengeOk(false);
          if (challengeIdx < (challenges.length) - 1) {
            const next = challengeIdx + 1;
            setChallengeIdx(next);
            setChallenge(challenges[next]);
            challengeStartRef.current = Date.now();
            detectedRef.current = false;
          } else {
            const half = Math.ceil(challenges.length / 2);
            allPassedRef.current = passedCountRef.current >= half;
            finalizeLiveness();
          }
        }, 800);
      } else if (elapsed > MAX_TIME) {
        responseTimesRef.current.push(MAX_TIME);
        setTimeout(() => {
          if (challengeIdx < (challenges.length) - 1) {
            const next = challengeIdx + 1;
            setChallengeIdx(next);
            setChallenge(challenges[next]);
            challengeStartRef.current = Date.now();
            detectedRef.current = false;
          } else {
            const half = Math.ceil(challenges.length / 2);
            allPassedRef.current = passedCountRef.current >= half;
            finalizeLiveness();
          }
        }, 1500);
        return;
      }
    }

    prevFrameRef.current = frame.imageData;
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [challenge, challenges, challengeIdx, finalizeLiveness]);

  // ── Start liveness ─────────────────────────────────────────────────────────

  const startLiveness = useCallback(async () => {
    try {
      setSubStep("camera_init");
      setError(null);
      passedCountRef.current   = 0;
      allPassedRef.current     = false;
      responseTimesRef.current = [];
      noiseFloorRef.current    = 0;
      noiseCaliRef.current     = [];

      if (!videoRef.current) throw new Error("Camera element unavailable");
      const stream = await initCamera(videoRef.current);
      streamRef.current = stream;

      setSubStep("countdown");
      let count = 3;
      setCountdown(count);
      const iv = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(iv);
          const newChallenges = [
            generateChallenge(),
            generateChallenge(),
            generateChallenge(),
          ];
          setChallenges(newChallenges);
          setChallengeIdx(0);
          setChallenge(newChallenges[0]);
          challengeStartRef.current = Date.now();
          detectedRef.current       = false;
          motionHistRef.current     = [];
          diffHistRef.current       = [];
          brightnessRef.current     = [];
          frameBufferRef.current    = [];
          prevFrameRef.current      = null;
          setProgress(0);
          setSubStep("challenge");
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start camera");
      setSubStep("intro");
    }
  }, []);

  // ── Verification submission ────────────────────────────────────────────────

  const submitVerification = useCallback(async (livenessProof: LivenessProof) => {
    try {
      const selfieImage   = captureSelfie();
      const frontImage    = capturedImages.find((i) => i.side === "front")?.base64;
      const backImage     = capturedImages.find((i) => i.side === "back")?.base64;
      const docFaceImage  = ocrResult?.extractedData.faceImageBase64;

      // 1. Try new biometric endpoints
      try {
        // Always send liveness proof — it's independent of selfie capture
        await verificationAPI.verifyLiveness(verificationId, [], livenessProof);

        // Face match only when we have both images
        if (selfieImage && docFaceImage) {
          await verificationAPI.verifyFace(verificationId, selfieImage, docFaceImage);
        }

        await verificationAPI.submitVerification(verificationId, {
          documentVerified:  capturedImages.length > 0,
          faceMatched:       !!selfieImage && !!docFaceImage,
          livenessVerified:  true,
          metadata,
        });

        setSubStep("verified");
        onComplete({ verified: true, status: "verified", livenessScore: livenessProof.confidence });
        return;
      } catch (newEndpointErr) {
        console.warn("[Step4] New endpoints unavailable, falling back to legacy submit:", newEndpointErr);
      }

      // 2. Fallback: legacy /kyc/verify
      const tenantId   = (metadata?.tenant_id   as string) || undefined;
      const keycloakId = (metadata?.keycloak_id as string) || undefined;

      await verificationAPI.submitLegacyKYC({
        verificationId,
        frontImage,
        backImage,
        selfieImage:   selfieImage || undefined,
        livenessProof: {
          sessionId:  livenessProof.sessionId,
          timestamp:  livenessProof.timestamp,
          confidence: livenessProof.confidence,
          verdict:    livenessProof.verdict,
          signals:    livenessProof.signals,
          hash:       livenessProof.hash,
        },
        documentType: documentRequirement.type,
        countryCode,
        metadata,
        tenantId,
        keycloakId,
      });

      setSubStep("verified");
      onComplete({ verified: true, status: "verified", livenessScore: livenessProof.confidence });
    } catch (err) {
      console.error("[Step4] Submission failed:", err);
      setError(err instanceof Error ? err.message : "Verification submission failed");
      setSubStep("rejected");
    }
  }, [capturedImages, ocrResult, verificationId, documentRequirement.type, countryCode, metadata, onComplete]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    cleanupCamera();
    setChallenges([]);
    setChallengeIdx(0);
    setChallenge(null);
    setChallengeOk(false);
    setProgress(0);
    setProof(null);
    setError(null);
    setCountdown(3);
    setRetryCount((c) => c + 1);
    setSubStep("intro");
  }, [cleanupCamera]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Frame loop starts/stops with "challenge" subStep
  useEffect(() => {
    if (subStep === "challenge") {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [subStep, processFrame]);

  // Cleanup on unmount
  useEffect(() => () => cleanupCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────
  const isCameraActive = subStep === "countdown" || subStep === "challenge";
  const totalChallenges = challenges.length || 3;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="s4-wrapper">
      {/* Off-screen capture canvas */}
      <canvas ref={canvasRef} className="s4-hidden" />

      {/* Video element — always in DOM for refs, visibility controlled */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={isCameraActive ? "s4-video s4-video-active" : "s4-hidden"}
      />

      {/* ── INTRO SCREEN ─────────────────────────────────────────────────── */}
      {subStep === "intro" && (
        <div className="s4-intro">
          <div className="s4-intro-header">
            <button className="s4-icon-btn" onClick={onBack} aria-label="Go back">
              <IconChevronLeft />
            </button>
            <span className="s4-step-badge">Final Step</span>
          </div>

          <div className="s4-intro-hero">
            <div className="s4-face-ring">
              <div className="s4-face-oval" />
              <div className="s4-face-pulse" />
            </div>
          </div>

          <div className="s4-intro-text">
            <h2>Face Verification</h2>
            <p>We'll perform a quick liveness check to confirm you're physically present</p>
          </div>

          <div className="s4-checklist">
            <CheckItem emoji="💡" text="Find a well-lit area — no harsh backlight" />
            <CheckItem emoji="🚫" text="Remove glasses and face coverings" />
            <CheckItem emoji="👁"  text="Look directly at the camera" />
            <CheckItem emoji="📱" text="Hold your device steady at eye level" />
          </div>

          {error && (
            <div className="s4-error-banner">
              <IconAlertCircle size={18} /> <span>{error}</span>
            </div>
          )}

          {retryCount > 0 && !error && (
            <div className="s4-info-banner">
              Attempt {retryCount + 1} — follow the instructions carefully
            </div>
          )}

          <div className="s4-intro-actions">
            <button className="s4-btn s4-btn-primary" onClick={startLiveness}>
              Start Face Verification →
            </button>
          </div>

          <p className="s4-secure-note">🔐 Secure · Encrypted · Privacy-first</p>
        </div>
      )}

      {/* ── CAMERA INIT ──────────────────────────────────────────────────── */}
      {subStep === "camera_init" && (
        <div className="s4-loading-screen">
          <div className="s4-loader-ring" />
          <h3>Starting camera…</h3>
          <p>Please allow camera access if prompted</p>
        </div>
      )}

      {/* ── COUNTDOWN ────────────────────────────────────────────────────── */}
      {subStep === "countdown" && (
        <div className="s4-camera-screen">
          {/* Dark overlay with countdown */}
          <div className="s4-countdown-overlay">
            <div className="s4-countdown-number">{countdown}</div>
            <p>Get into position…</p>
          </div>
          {/* Oval guide under countdown */}
          <div className="s4-oval-guide">
            <div className="s4-face-oval-border" />
          </div>
        </div>
      )}

      {/* ── CHALLENGE ────────────────────────────────────────────────────── */}
      {subStep === "challenge" && (
        <div className="s4-camera-screen">
          {/* Face oval frame */}
          <div className="s4-oval-guide">
            <div className={`s4-face-oval-border ${challengeOk ? "ok" : ""}`} />

            {/* Challenge badge */}
            <div className={`s4-challenge-badge ${challengeOk ? "ok" : ""}`}>
              {challengeOk
                ? <><IconCheck /> Challenge passed!</>
                : challenge && getChallengeInstruction(challenge)}
            </div>

            {/* Counter */}
            <div className="s4-challenge-counter">
              Task {challengeIdx + 1} of {totalChallenges}
            </div>
          </div>

          {/* Motion debug (dev only) */}
          {import.meta.env.DEV && (
            <div className="s4-debug">
              <span>Motion: {debugMotion.toFixed(4)}</span>
              <span>Floor: {noiseFloorRef.current.toFixed(4)}</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="s4-progress-bar">
            <div className="s4-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── VERIFYING ────────────────────────────────────────────────────── */}
      {subStep === "verifying" && (
        <div className="s4-loading-screen">
          <div className="s4-loader-ring" />
          <h3>Verifying your identity…</h3>
          <p>Comparing biometric data — this takes a moment</p>
        </div>
      )}

      {/* ── VERIFIED ─────────────────────────────────────────────────────── */}
      {subStep === "verified" && proof && (
        <div className="s4-result-screen s4-result-success">
          <div className="s4-result-icon s4-result-icon-success">
            <IconCheckBig />
          </div>
          <h2>Identity Verified!</h2>
          <p>Your identity has been confirmed successfully</p>

          <div className="s4-result-card">
            <ResultRow label="Liveness" value={`${(proof.confidence * 100).toFixed(1)}%`} type="score" />
            <ResultRow label="Challenges" value={`${passedCountRef.current} / ${totalChallenges} passed`} type="text" ok={passedCountRef.current > 0} />
            <ResultRow label="Status" value="Verified" type="badge-success" />
          </div>

          <div className="s4-result-info">
            <p>✓ You can now close this page and return to the application.</p>
          </div>
        </div>
      )}

      {/* ── REJECTED ─────────────────────────────────────────────────────── */}
      {subStep === "rejected" && (
        <div className="s4-result-screen s4-result-fail">
          <div className="s4-result-icon s4-result-icon-fail">
            <IconXBig />
          </div>
          <h2>Verification Failed</h2>
          <p>
            {error || "We couldn't complete your verification. Please try again."}
          </p>

          {proof && (
            <div className="s4-result-card">
              <ResultRow label="Challenges passed" value={`${passedCountRef.current} / ${totalChallenges}`} type="text" />
              {proof.signals.motion < 0.05 && (
                <p className="s4-fail-reason">⚠ Not enough movement detected</p>
              )}
              {!proof.signals.challengePassed && (
                <p className="s4-fail-reason">⚠ Challenges were not completed correctly</p>
              )}
            </div>
          )}

          <div className="s4-result-tips">
            <h4>How to improve your result:</h4>
            <ul>
              <li>Make sure your face is clearly visible</li>
              <li>Follow each challenge instruction carefully</li>
              <li>Improve lighting — avoid sitting with a window behind you</li>
              <li>Move naturally; don't hold your device too close</li>
            </ul>
          </div>

          <div className="s4-result-actions">
            {retryCount < 2 && (
              <button className="s4-btn s4-btn-primary" onClick={reset}>
                Try Again
              </button>
            )}
            {retryCount >= 2 && (
              <button
                className="s4-btn s4-btn-secondary"
                onClick={() =>
                  onComplete({ verified: false, status: "manual_review", livenessScore: proof?.confidence || 0 })
                }
              >
                Request Manual Review
              </button>
            )}
            <button className="s4-btn s4-btn-ghost" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="s4-check-item">
      <span className="s4-check-emoji">{emoji}</span>
      <span>{text}</span>
    </div>
  );
}

function ResultRow({
  label, value, type, ok,
}: {
  label: string;
  value: string;
  type: "score" | "text" | "badge-success" | "badge-fail";
  ok?: boolean;
}) {
  return (
    <div className="s4-result-row">
      <span className="s4-result-label">{label}</span>
      {type === "score" ? (
        <span className="s4-result-score">{value}</span>
      ) : type === "badge-success" ? (
        <span className="s4-result-badge s4-badge-green">{value}</span>
      ) : type === "badge-fail" ? (
        <span className="s4-result-badge s4-badge-red">{value}</span>
      ) : (
        <span className={`s4-result-text ${ok === true ? "ok" : ok === false ? "fail" : ""}`}>{value}</span>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconChevronLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);
const IconCheckBig = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconXBig = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6"  y1="6" x2="18" y2="18" />
  </svg>
);
const IconAlertCircle = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
