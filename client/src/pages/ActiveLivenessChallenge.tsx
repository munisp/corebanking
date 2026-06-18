/**
 * ActiveLivenessChallenge — Real-time camera-based active liveness verification.
 * Uses browser MediaDevices API (getUserMedia) for video capture and client-side
 * facial landmark tracking via lightweight heuristics on canvas-extracted frames.
 * Sends reference + action frames to the server for ML-based motion verification.
 *
 * Challenge types: blink, smile, head_turn_left, head_turn_right, nod, random_pose
 *
 * Flow:
 * 1. Open camera, detect face in neutral position (reference frame)
 * 2. Display challenge instruction ("Turn head left")
 * 3. Capture action frames as user performs motion
 * 4. Submit reference + action frames to /api/liveness/v1/submit-challenge
 * 5. Server verifies motion via landmark comparison + anti-spoofing
 * 6. Advance to next challenge or complete session
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Shield,
  AlertTriangle,
  ArrowLeft,
  Smile,
  Eye,
  MoveHorizontal,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ChallengeType = "blink" | "smile" | "head_turn_left" | "head_turn_right" | "nod" | "random_pose";

interface Challenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  status: "pending" | "capturing" | "analyzing" | "passed" | "failed";
  score: number;
  attempts: number;
}

interface LivenessSession {
  id: string;
  challenges: Challenge[];
  status: "pending" | "in_progress" | "completed" | "failed";
  overallScore: number;
  isLive: boolean;
  verdict: string;
}

interface Props {
  customerId: string;
  tenantId?: string;
  onComplete?: (session: LivenessSession) => void;
  onCancel?: () => void;
  challengeCount?: number;
  mode?: "active" | "hybrid";
}

const CHALLENGE_ICONS: Record<ChallengeType, typeof Camera> = {
  blink: Eye,
  smile: Smile,
  head_turn_left: ArrowLeft,
  head_turn_right: MoveHorizontal,
  nod: ArrowDown,
  random_pose: RotateCcw,
};

const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  blink: "Blink Detection",
  smile: "Smile Detection",
  head_turn_left: "Turn Head Left",
  head_turn_right: "Turn Head Right",
  nod: "Nod Detection",
  random_pose: "Follow Target",
};

const REFERENCE_CAPTURE_DELAY = 1500; // ms to wait for neutral pose
const ACTION_CAPTURE_INTERVAL = 300;  // ms between action frame captures
const ACTION_CAPTURE_COUNT = 8;       // number of action frames to capture
const MAX_ATTEMPTS_PER_CHALLENGE = 3;

export default function ActiveLivenessChallenge({
  customerId,
  tenantId = "default",
  onComplete,
  onCancel,
  challengeCount = 3,
  mode = "active",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [session, setSession] = useState<LivenessSession | null>(null);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [phase, setPhase] = useState<"init" | "camera" | "reference" | "challenge" | "analyzing" | "result">("init");
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceFrame, setReferenceFrame] = useState<string | null>(null);
  const [actionFrames, setActionFrames] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [userGuidance, setUserGuidance] = useState("");
  const [noiseWarning, setNoiseWarning] = useState<string | null>(null);

  // Get device info for noise-aware processing
  const devicePlatform = /iPhone|iPad/.test(navigator.userAgent) ? "ios"
    : /Android/.test(navigator.userAgent) ? "android" : "web";
  const deviceModel = navigator.userAgent.match(/(Tecno|Itel|Infinix|Samsung|Redmi|POCO|Pixel|iPhone)\s?[\w-]*/i)?.[0] ?? "unknown";

  // Create liveness session on mount
  useEffect(() => {
    const createSession = async () => {
      try {
        const res = await fetch("/api/liveness/v1/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            tenantId,
            mode,
            devicePlatform,
            deviceModel,
            challengeCount,
          }),
        });
        if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
        const data = await res.json();
        setSession(data);
        setPhase("camera");
      } catch (e) {
        setError(`Failed to create liveness session: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    };
    createSession();
    return () => {
      stopCamera();
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setPhase("reference");
        startFaceDetectionLoop();
      }
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access and try again."
          : `Camera error: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror the video (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1]; // base64 without prefix
  }, []);

  // Simple client-side face presence check using canvas brightness analysis
  const startFaceDetectionLoop = useCallback(() => {
    const checkFace = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      // Sample center region for face-like content (skin tone + variance check)
      const cx = Math.floor(canvas.width * 0.3);
      const cy = Math.floor(canvas.height * 0.15);
      const cw = Math.floor(canvas.width * 0.4);
      const ch = Math.floor(canvas.height * 0.7);
      const imageData = ctx.getImageData(cx, cy, cw, ch);
      const data = imageData.data;

      let skinPixels = 0;
      let totalPixels = 0;
      for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
        const r = data[i], g = data[i + 1], b = data[i + 2];
        totalPixels++;
        // Simplified skin color detection (works for diverse skin tones)
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10 && r - b > 15) {
          skinPixels++;
        }
      }
      const skinRatio = skinPixels / Math.max(totalPixels, 1);
      setFaceDetected(skinRatio > 0.15);
    };

    const interval = setInterval(checkFace, 500);
    return () => clearInterval(interval);
  }, []);

  // Capture reference (neutral) frame
  const captureReferenceFrame = useCallback(async () => {
    if (!faceDetected) {
      setUserGuidance("Position your face in the center of the frame");
      return;
    }
    setCountdown(3);
    setUserGuidance("Hold still — capturing neutral pose...");

    // 3-2-1 countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(0);

    const frame = captureFrame();
    if (!frame) {
      setError("Failed to capture reference frame");
      return;
    }
    setReferenceFrame(frame);
    setPhase("challenge");
    setUserGuidance("");
  }, [faceDetected, captureFrame]);

  // Start active challenge capture
  const startChallengeCapture = useCallback(() => {
    if (!session) return;
    const challenge = session.challenges[currentChallengeIndex];
    if (!challenge) return;

    setActionFrames([]);
    const frames: string[] = [];
    let captureCount = 0;

    setUserGuidance(challenge.instruction);

    // Update challenge status to capturing
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.challenges = [...updated.challenges];
      updated.challenges[currentChallengeIndex] = {
        ...updated.challenges[currentChallengeIndex],
        status: "capturing",
      };
      return updated;
    });

    captureTimerRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        frames.push(frame);
        captureCount++;
        setActionFrames([...frames]);
      }

      if (captureCount >= ACTION_CAPTURE_COUNT) {
        if (captureTimerRef.current) clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
        submitChallenge(challenge.id, frames);
      }
    }, ACTION_CAPTURE_INTERVAL);
  }, [session, currentChallengeIndex, captureFrame]);

  // Submit challenge frames to server
  const submitChallenge = async (challengeId: string, frames: string[]) => {
    if (!session || !referenceFrame) return;

    setPhase("analyzing");
    setUserGuidance("Analyzing motion...");

    // Update challenge status
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.challenges = [...updated.challenges];
      updated.challenges[currentChallengeIndex] = {
        ...updated.challenges[currentChallengeIndex],
        status: "analyzing",
      };
      return updated;
    });

    try {
      const res = await fetch("/api/liveness/v1/submit-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          challengeId,
          referenceFrame,
          actionFrames: frames,
          challengeType: session.challenges[currentChallengeIndex].type,
          devicePlatform,
          deviceModel,
        }),
      });

      if (!res.ok) throw new Error(`Challenge submission failed: ${res.status}`);
      const result = await res.json();

      // Check for noise warning
      if (result.noiseAssessment?.noise_category === "high") {
        setNoiseWarning("Camera quality is low — ensure good lighting and hold device steady");
      }

      // Update session with result
      setSession((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        updated.challenges = [...updated.challenges];
        updated.challenges[currentChallengeIndex] = {
          ...updated.challenges[currentChallengeIndex],
          status: result.challengeStatus,
          score: result.motionScore ?? result.score,
          attempts: (updated.challenges[currentChallengeIndex].attempts || 0) + 1,
        };
        updated.overallScore = result.overallScore ?? prev.overallScore;
        updated.isLive = result.isLive ?? prev.isLive;
        updated.status = result.sessionStatus ?? prev.status;
        updated.verdict = result.verdict ?? prev.verdict;
        return updated;
      });

      // Handle result
      if (result.challengeStatus === "passed") {
        setUserGuidance("Challenge passed!");
        await new Promise((r) => setTimeout(r, 1000));

        if (currentChallengeIndex + 1 < (session.challenges?.length ?? 0)) {
          setCurrentChallengeIndex((prev) => prev + 1);
          setPhase("challenge");
          setActionFrames([]);
          setUserGuidance("");
        } else {
          // All challenges done
          setPhase("result");
          stopCamera();
          if (result.sessionStatus === "completed" && onComplete) {
            onComplete({
              ...session,
              status: result.sessionStatus,
              overallScore: result.overallScore,
              isLive: result.isLive,
              verdict: result.verdict,
            });
          }
        }
      } else if (result.challengeStatus === "failed") {
        const attempts = (session.challenges[currentChallengeIndex]?.attempts ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS_PER_CHALLENGE) {
          setUserGuidance("Challenge failed — maximum attempts reached");
          setPhase("result");
          stopCamera();
        } else {
          setUserGuidance(result.userGuidance ?? "Please try again — perform the motion more clearly");
          setPhase("challenge");
          setActionFrames([]);
        }
      } else {
        // Retry
        setUserGuidance(result.userGuidance ?? "Please try again");
        setPhase("challenge");
        setActionFrames([]);
      }
    } catch (e) {
      setError(`Challenge submission error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

  // Auto-start camera when phase changes
  useEffect(() => {
    if (phase === "camera" && !cameraReady) {
      startCamera();
    }
  }, [phase, cameraReady, startCamera]);

  // Auto-capture reference when face detected
  useEffect(() => {
    if (phase === "reference" && faceDetected && !referenceFrame) {
      const timer = setTimeout(() => captureReferenceFrame(), REFERENCE_CAPTURE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [phase, faceDetected, referenceFrame, captureReferenceFrame]);

  const currentChallenge = session?.challenges[currentChallengeIndex];
  const ChallengeIcon = currentChallenge ? CHALLENGE_ICONS[currentChallenge.type] : Camera;
  const progress = session
    ? ((session.challenges.filter((c) => c.status === "passed").length) / session.challenges.length) * 100
    : 0;

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardContent className="p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Liveness Check Error</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => { setError(null); setPhase("camera"); }}>
              <RotateCcw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-4">
      {/* Progress bar */}
      {session && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Challenge {Math.min(currentChallengeIndex + 1, session.challenges.length)} of {session.challenges.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Camera view */}
      <Card className="overflow-hidden">
        <div className="relative bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face detection overlay */}
          {cameraReady && phase !== "result" && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Face guide oval */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-48 h-64 border-2 rounded-[50%] transition-colors duration-300 ${
                    faceDetected ? "border-green-400" : "border-yellow-400 animate-pulse"
                  }`}
                />
              </div>

              {/* Countdown */}
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl font-bold text-white drop-shadow-lg">{countdown}</span>
                </div>
              )}

              {/* Challenge instruction overlay */}
              {phase === "challenge" && currentChallenge && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-2 text-white">
                    <ChallengeIcon className="w-6 h-6" />
                    <span className="text-lg font-semibold">
                      {currentChallenge.instruction}
                    </span>
                  </div>
                </div>
              )}

              {/* Capture progress indicator */}
              {currentChallenge?.status === "capturing" && (
                <div className="absolute top-4 inset-x-4">
                  <div className="flex gap-1">
                    {Array.from({ length: ACTION_CAPTURE_COUNT }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < actionFrames.length ? "bg-green-400" : "bg-white/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Analyzing spinner */}
              {phase === "analyzing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <span className="text-sm">Analyzing motion...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result overlay */}
          {phase === "result" && session && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                {session.isLive ? (
                  <>
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">Verified</p>
                    <p className="text-sm text-white/80">Score: {Math.round(session.overallScore * 100)}%</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-16 h-16 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-400">Not Verified</p>
                    <p className="text-sm text-white/80">Please try again</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Init state */}
          {phase === "init" && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* Guidance text */}
          {userGuidance && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Shield className="w-4 h-4 shrink-0" />
              {userGuidance}
            </div>
          )}

          {/* Noise warning */}
          {noiseWarning && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-yellow-50 rounded-lg text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {noiseWarning}
            </div>
          )}

          {/* Face detection status */}
          {cameraReady && phase !== "result" && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${faceDetected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
              <span className={faceDetected ? "text-green-700" : "text-yellow-700"}>
                {faceDetected ? "Face detected" : "Position your face in the oval"}
              </span>
            </div>
          )}

          {/* Challenge list */}
          {session && (
            <div className="space-y-2">
              {session.challenges.map((challenge, idx) => {
                const Icon = CHALLENGE_ICONS[challenge.type];
                return (
                  <div
                    key={challenge.id}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm transition-colors ${
                      idx === currentChallengeIndex && phase !== "result"
                        ? "bg-blue-50 border border-blue-200"
                        : challenge.status === "passed"
                          ? "bg-green-50"
                          : challenge.status === "failed"
                            ? "bg-red-50"
                            : "bg-gray-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${
                      challenge.status === "passed" ? "text-green-600"
                        : challenge.status === "failed" ? "text-red-600"
                          : idx === currentChallengeIndex ? "text-blue-600"
                            : "text-gray-400"
                    }`} />
                    <span className="flex-1">{CHALLENGE_LABELS[challenge.type]}</span>
                    {challenge.status === "passed" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {challenge.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
                    {challenge.status === "analyzing" && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {challenge.status === "capturing" && (
                      <span className="text-xs text-blue-600">{actionFrames.length}/{ACTION_CAPTURE_COUNT}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            {phase === "challenge" && currentChallenge?.status !== "capturing" && (
              <Button onClick={startChallengeCapture} className="flex-1" disabled={!faceDetected}>
                <Camera className="w-4 h-4 mr-1" />
                Start Challenge
              </Button>
            )}
            {phase === "result" && !session?.isLive && (
              <Button
                onClick={() => {
                  setPhase("camera");
                  setReferenceFrame(null);
                  setActionFrames([]);
                  setCurrentChallengeIndex(0);
                  setSession(null);
                  setUserGuidance("");
                  setNoiseWarning(null);
                }}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
