/**
 * Step 3 — Document Capture + OCR Verification
 *
 * Sub-steps:
 *   capture_front → review_front → capture_back? → review_back? →
 *   uploading → ocr_processing → ocr_review | ocr_error
 *
 * Features:
 *   • Camera capture (environment-facing) or file upload
 *   • Document frame overlay with corner guides
 *   • OCR via backend with job polling
 *   • Extracted data preview with confidence score
 *   • Retry logic (up to 3 attempts) + manual continue fallback
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DocumentRequirement, OCRResult } from "../../types/verification";
import { verificationAPI } from "../../services/verificationAPI";
import "./Step3DocumentCapture.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type SubStep =
  | "capture_front"
  | "review_front"
  | "capture_back"
  | "review_back"
  | "uploading"
  | "ocr_processing"
  | "ocr_review"
  | "ocr_error";

type CaptureMode = "camera" | "upload";

export interface CapturedImage {
  side: "front" | "back";
  base64: string;
}

export interface Step3Result {
  images: CapturedImage[];
  ocrResult: OCRResult | null;
}

interface Step3Props {
  verificationId: string;
  documentRequirement: DocumentRequirement;
  countryCode: string;
  onComplete: (result: Step3Result) => void;
  onBack: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Step3DocumentCapture({
  verificationId,
  documentRequirement,
  countryCode: _countryCode, // stored in payload via parent
  onComplete,
  onBack,
}: Step3Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsBothSides = documentRequirement.requiredSides === "both";

  const [subStep,         setSubStep]         = useState<SubStep>("capture_front");
  const [captureMode,     setCaptureMode]     = useState<CaptureMode>("camera");
  const [currentSide,     setCurrentSide]     = useState<"front" | "back">("front");
  const [capturedImages,  setCapturedImages]  = useState<CapturedImage[]>([]);
  const [ocrResult,       setOcrResult]       = useState<OCRResult | null>(null);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [processingPhase, setProcessingPhase] = useState<"uploading" | "processing" | "verifying">("uploading");
  const [error,           setError]           = useState<string | null>(null);
  const [retryCount,      setRetryCount]      = useState(0);
  const [cameraReady,     setCameraReady]     = useState(false);

  // ── Camera helpers ─────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (!videoRef.current) return;
      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      videoRef.current.onloadedmetadata = () => setCameraReady(true);
      await videoRef.current.play().catch(() => {});
    } catch {
      // Camera unavailable — switch to upload mode silently
      setCaptureMode("upload");
    }
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.88);
  }, []);

  // ── File → base64 helper ───────────────────────────────────────────────────

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target!.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ── base64 → File helper (for multipart upload) ────────────────────────────

  const base64ToFile = (b64: string, name: string): File => {
    const [header, data] = b64.split(",");
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    return new File([buf], name, { type: mime });
  };

  // ── Capture actions ────────────────────────────────────────────────────────

  const handleCameraCapture = useCallback(() => {
    const base64 = capturePhoto();
    if (!base64) return;
    stopCamera();
    setCapturedImages((prev) => [
      ...prev.filter((i) => i.side !== currentSide),
      { side: currentSide, base64 },
    ]);
    setSubStep(currentSide === "front" ? "review_front" : "review_back");
  }, [capturePhoto, stopCamera, currentSide]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const base64 = await readFileAsBase64(file);
      setCapturedImages((prev) => [
        ...prev.filter((i) => i.side !== currentSide),
        { side: currentSide, base64 },
      ]);
      setSubStep(currentSide === "front" ? "review_front" : "review_back");
      // reset the input so same file can be re-selected on retry
      e.target.value = "";
    },
    [currentSide],
  );

  const handleRetake = useCallback(() => {
    setCapturedImages((prev) => prev.filter((i) => i.side !== currentSide));
    setSubStep(currentSide === "front" ? "capture_front" : "capture_back");
  }, [currentSide]);

  // ── Step advancement ───────────────────────────────────────────────────────

  const advanceToOCR = useCallback(async (images: CapturedImage[]) => {
    try {
      setSubStep("uploading");
      setProcessingPhase("uploading");
      setUploadProgress(5);
      setError(null);

      const documentIds: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const img  = images[i];
        const file = base64ToFile(img.base64, `doc_${img.side}_${Date.now()}.jpg`);
        const res  = await verificationAPI.uploadDocument(verificationId, file, img.side);
        documentIds.push(res.documentId);
        setUploadProgress(10 + ((i + 1) / images.length) * 40);
      }

      // Kick off OCR
      setSubStep("ocr_processing");
      setProcessingPhase("processing");
      setUploadProgress(55);

      const ocrStart = await verificationAPI.processOCR(
        verificationId,
        documentIds,
        documentRequirement.type,
      );

      // Immediate result
      if (ocrStart.status === "completed" && ocrStart.result) {
        setOcrResult(ocrStart.result);
        setProcessingPhase("verifying");
        setUploadProgress(100);
        await pause(400);
        setSubStep("ocr_review");
        return;
      }

      // Poll for result
      if (ocrStart.jobId) {
        let attempts = 0;
        const maxAttempts = 20;

        const poll = async (): Promise<void> => {
          if (attempts >= maxAttempts) {
            throw new Error("Document processing timed out. Please try again.");
          }
          await pause(2000);
          setUploadProgress(55 + (attempts / maxAttempts) * 40);

          const result = await verificationAPI.getOCRResult(verificationId, ocrStart.jobId!);
          if (result.status === "completed" && result.result) {
            setOcrResult(result.result);
            setProcessingPhase("verifying");
            setUploadProgress(100);
            await pause(400);
            setSubStep("ocr_review");
            return;
          }
          if (result.status === "failed") {
            throw new Error(result.error || "Document verification failed");
          }
          attempts++;
          return poll();
        };

        await poll();
        return;
      }

      // No job ID returned — OCR not implemented yet, continue gracefully
      setOcrResult(null);
      setSubStep("ocr_review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process document";
      setError(msg);
      setSubStep("ocr_error");
    }
  }, [verificationId, documentRequirement.type]);

  const handleFrontConfirmed = useCallback(() => {
    const images = capturedImages.filter((i) => i.side === "front");
    if (needsBothSides) {
      setCurrentSide("back");
      setSubStep("capture_back");
    } else {
      advanceToOCR(images);
    }
  }, [capturedImages, needsBothSides, advanceToOCR]);

  const handleBackConfirmed = useCallback(() => {
    advanceToOCR(capturedImages);
  }, [capturedImages, advanceToOCR]);

  // ── Completion ─────────────────────────────────────────────────────────────

  const handleConfirmOCR = useCallback(() => {
    onComplete({ images: capturedImages, ocrResult });
  }, [capturedImages, ocrResult, onComplete]);

  const handleSkipOCR = useCallback(() => {
    onComplete({ images: capturedImages, ocrResult: null });
  }, [capturedImages, onComplete]);

  const handleRetryAll = useCallback(() => {
    setRetryCount((c) => c + 1);
    setError(null);
    setOcrResult(null);
    setUploadProgress(0);
    setCapturedImages([]);
    setCurrentSide("front");
    setSubStep("capture_front");
  }, []);

  // ── Camera lifecycle ───────────────────────────────────────────────────────

  useEffect(() => {
    if (
      (subStep === "capture_front" || subStep === "capture_back") &&
      captureMode === "camera"
    ) {
      startCamera();
    }
    return () => {
      if (subStep !== "capture_front" && subStep !== "capture_back") stopCamera();
    };
  }, [subStep, captureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopCamera();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────

  const sideLabel  = currentSide === "front" ? "Front" : "Back";
  const currentImg = capturedImages.find((i) => i.side === currentSide);
  const maxRetries = 3;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="s3-wrapper">
      {/* Hidden helpers */}
      <canvas ref={canvasRef} className="s3-hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="s3-hidden"
        onChange={handleFileChange}
      />

      {/* ── CAPTURE SCREEN ─────────────────────────────────────────────────── */}
      {(subStep === "capture_front" || subStep === "capture_back") && (
        <div className="s3-capture">
          {/* Header */}
          <div className="s3-capture-header">
            <button
              className="s3-icon-btn"
              onClick={() => {
                stopCamera();
                if (subStep === "capture_front") {
                  onBack();
                } else {
                  setCurrentSide("front");
                  setSubStep("review_front");
                }
              }}
              aria-label="Go back"
            >
              <IconChevronLeft />
            </button>

            <div className="s3-capture-title">
              <span className="s3-doc-name">{documentRequirement.name}</span>
              <span className="s3-side-label">{sideLabel} side</span>
            </div>

            <div className="s3-mode-toggle">
              <button
                className={`s3-mode-btn ${captureMode === "camera" ? "active" : ""}`}
                onClick={() => { setCaptureMode("camera"); startCamera(); }}
                title="Use camera"
              >
                <IconCamera />
              </button>
              <button
                className={`s3-mode-btn ${captureMode === "upload" ? "active" : ""}`}
                onClick={() => { setCaptureMode("upload"); stopCamera(); }}
                title="Upload file"
              >
                <IconUpload />
              </button>
            </div>
          </div>

          {/* Sides progress pills */}
          {needsBothSides && (
            <div className="s3-sides-progress">
              <SidePill side="Front" done={!!capturedImages.find((i) => i.side === "front")} active={currentSide === "front"} />
              <div className="s3-sides-divider" />
              <SidePill side="Back"  done={!!capturedImages.find((i) => i.side === "back")}  active={currentSide === "back"}  />
            </div>
          )}

          {/* Camera view */}
          {captureMode === "camera" ? (
            <div className="s3-camera-area">
              <video ref={videoRef} autoPlay playsInline muted className="s3-video" />

              {/* Overlay frame */}
              <div className="s3-doc-overlay">
                <div className="s3-doc-frame">
                  <span className="s3-corner tl" /><span className="s3-corner tr" />
                  <span className="s3-corner bl" /><span className="s3-corner br" />
                  <p className="s3-frame-hint">Align document within frame</p>
                </div>
              </div>

              {/* Capture button */}
              <div className="s3-capture-bar">
                <button
                  className="s3-shutter-btn"
                  onClick={handleCameraCapture}
                  disabled={!cameraReady}
                  aria-label="Take photo"
                >
                  <span className="s3-shutter-ring" />
                  <span className="s3-shutter-inner" />
                </button>
                <p className="s3-capture-hint">Tap to capture</p>
              </div>
            </div>
          ) : (
            /* Upload drop zone */
            <div
              className="s3-upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={`Upload ${sideLabel} of document`}
            >
              <div className="s3-upload-icon"><IconImageUp /></div>
              <h3>Upload {sideLabel} Photo</h3>
              <p>Click to select or drag &amp; drop</p>
              <span className="s3-upload-hint">JPEG · PNG · WebP · max 10 MB</span>
              <button className="s3-upload-btn" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Choose File
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW SCREEN ──────────────────────────────────────────────────── */}
      {(subStep === "review_front" || subStep === "review_back") && currentImg && (
        <div className="s3-review">
          <div className="s3-review-header">
            <button className="s3-icon-btn" onClick={handleRetake} aria-label="Retake">
              <IconChevronLeft />
            </button>
            <h2>Review {sideLabel} Photo</h2>
          </div>

          <div className="s3-preview-frame">
            <img src={currentImg.base64} alt={`${sideLabel} of ${documentRequirement.name}`} className="s3-preview-img" />
            <div className="s3-quality-chip">
              <IconCheck /><span>Image captured</span>
            </div>
          </div>

          <div className="s3-review-tips">
            <TipItem ok icon="💡" text="Text is sharp and readable" />
            <TipItem ok icon="☀️" text="No heavy glare or shadows" />
            <TipItem ok icon="📐" text="All four corners are visible" />
          </div>

          <div className="s3-review-actions">
            <button className="s3-btn s3-btn-ghost" onClick={handleRetake}>
              Retake
            </button>
            <button
              className="s3-btn s3-btn-primary"
              onClick={subStep === "review_front" ? handleFrontConfirmed : handleBackConfirmed}
            >
              {subStep === "review_front" && needsBothSides
                ? "Next: Back Side →"
                : "Process Document →"}
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING SCREEN ──────────────────────────────────────────────── */}
      {(subStep === "uploading" || subStep === "ocr_processing") && (
        <div className="s3-processing">
          <div className="s3-proc-animation">
            <div className="s3-proc-ring" />
            <span className="s3-proc-icon">🔍</span>
          </div>

          <h2>Processing Document</h2>
          <p className="s3-proc-sub">AI is reading your document — this takes a few seconds</p>

          <div className="s3-proc-steps">
            <ProcessingStep label="Uploading document"   status={processingPhase === "uploading"   ? "active" : "done"} />
            <ProcessingStep label="Extracting text (OCR)" status={processingPhase === "processing"  ? "active" : processingPhase === "uploading" ? "pending" : "done"} />
            <ProcessingStep label="Verifying authenticity" status={processingPhase === "verifying" ? "active" : "pending"} />
          </div>

          <div className="s3-progress-track">
            <div className="s3-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="s3-progress-label">{Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* ── OCR REVIEW SCREEN ──────────────────────────────────────────────── */}
      {subStep === "ocr_review" && (
        <div className="s3-ocr-review">
          {ocrResult ? (
            <>
              <div className="s3-ocr-header">
                <div className="s3-ocr-check"><IconCheck /></div>
                <div className="s3-ocr-header-text">
                  <h2>Document Verified</h2>
                  <p>Review the extracted information below</p>
                </div>
                <ConfidenceBadge score={ocrResult.confidence} />
              </div>

              {/* Validation warnings */}
              {ocrResult.validations.isExpired && (
                <div className="s3-warning-banner">
                  <IconWarning /> This document appears to be expired
                </div>
              )}
              {ocrResult.validations.isBlurry && (
                <div className="s3-warning-banner">
                  <IconWarning /> Document image is blurry — data may be inaccurate
                </div>
              )}

              <div className="s3-data-fields">
                {ocrResult.extractedData.fullName && (
                  <DataField icon="👤" label="Full Name"       value={ocrResult.extractedData.fullName} />
                )}
                {ocrResult.extractedData.dateOfBirth && (
                  <DataField icon="🎂" label="Date of Birth"   value={ocrResult.extractedData.dateOfBirth} />
                )}
                {ocrResult.extractedData.documentNumber && (
                  <DataField icon="🪪" label="Document No."    value={ocrResult.extractedData.documentNumber} />
                )}
                {ocrResult.extractedData.expiryDate && (
                  <DataField icon="📅" label="Expires"         value={ocrResult.extractedData.expiryDate} warn={!!ocrResult.validations.isExpired} />
                )}
                {ocrResult.extractedData.nationality && (
                  <DataField icon="🌍" label="Nationality"     value={ocrResult.extractedData.nationality} />
                )}
                {ocrResult.extractedData.gender && (
                  <DataField icon="⚥"  label="Gender"          value={ocrResult.extractedData.gender} />
                )}
                {ocrResult.extractedData.address && (
                  <DataField icon="🏠" label="Address"         value={ocrResult.extractedData.address} />
                )}
              </div>
            </>
          ) : (
            /* OCR not available — show captured images summary */
            <div className="s3-no-ocr">
              <div className="s3-no-ocr-icon">📄</div>
              <h2>Document Captured</h2>
              <p>
                Automatic verification is unavailable right now. Your document
                has been captured and will be reviewed.
              </p>
              <div className="s3-captured-thumbs">
                {capturedImages.map((img) => (
                  <div key={img.side} className="s3-thumb-wrapper">
                    <img src={img.base64} alt={`${img.side} side`} className="s3-thumb" />
                    <span className="s3-thumb-label">{img.side}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="s3-ocr-actions">
            <button className="s3-btn s3-btn-ghost" onClick={handleRetryAll}>
              Recapture
            </button>
            <button className="s3-btn s3-btn-primary" onClick={handleConfirmOCR}>
              {ocrResult ? "Confirm & Continue →" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ── OCR ERROR SCREEN ───────────────────────────────────────────────── */}
      {subStep === "ocr_error" && (
        <div className="s3-error-screen">
          <div className="s3-error-icon"><IconAlertCircle /></div>
          <h2>Processing Failed</h2>
          <p className="s3-error-msg">{error || "We couldn't process your document."}</p>

          <div className="s3-retry-tips">
            <h4>Tips for better results:</h4>
            <ul>
              <li>✓ Place document on a flat, dark surface</li>
              <li>✓ Ensure bright, even lighting — no shadows</li>
              <li>✓ Avoid reflections and glare on the document</li>
              <li>✓ Make sure all four corners are in frame</li>
            </ul>
          </div>

          <div className="s3-error-actions">
            {retryCount < maxRetries ? (
              <button className="s3-btn s3-btn-primary" onClick={handleRetryAll}>
                Try Again ({maxRetries - retryCount} left)
              </button>
            ) : (
              <>
                <button className="s3-btn s3-btn-ghost" onClick={handleRetryAll}>Try Again</button>
                <button className="s3-btn s3-btn-primary" onClick={handleSkipOCR}>
                  Continue Without OCR
                </button>
              </>
            )}
            <button className="s3-btn s3-btn-link" onClick={onBack}>← Go Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidePill({ side, done, active }: { side: string; done: boolean; active: boolean }) {
  return (
    <div className={`s3-side-pill ${active ? "active" : ""} ${done ? "done" : ""}`}>
      {done ? <IconCheck /> : <span>{side[0]}</span>}
      <span>{side}</span>
    </div>
  );
}

function ProcessingStep({ label, status }: { label: string; status: "pending" | "active" | "done" }) {
  return (
    <div className={`s3-ps ${status}`}>
      <span className="s3-ps-dot">
        {status === "done"   ? <IconCheck /> :
         status === "active" ? <span className="s3-ps-spinner" /> :
                               <span className="s3-ps-circle" />}
      </span>
      <span className="s3-ps-label">{label}</span>
    </div>
  );
}

function DataField({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`s3-field ${warn ? "warn" : ""}`}>
      <span className="s3-field-icon">{icon}</span>
      <div className="s3-field-content">
        <span className="s3-field-label">{label}</span>
        <span className={`s3-field-value ${warn ? "warn-text" : ""}`}>{value}</span>
      </div>
      {warn && <span className="s3-field-warn-icon">⚠️</span>}
    </div>
  );
}

function TipItem({ icon, text, ok }: { icon: string; text: string; ok: boolean }) {
  return (
    <div className={`s3-tip ${ok ? "ok" : ""}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct    = Math.round(score * 100);
  const level  = pct >= 85 ? "high" : pct >= 70 ? "medium" : "low";
  const label  = pct >= 85 ? "High" : pct >= 70 ? "Good" : "Low";
  return (
    <div className={`s3-confidence confidence-${level}`}>
      <span className="s3-conf-pct">{pct}%</span>
      <span className="s3-conf-label">{label}</span>
    </div>
  );
}

// ─── Icon helpers (inline SVG) ────────────────────────────────────────────────

const IconChevronLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const IconCamera = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconImageUp = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
    <polyline points="14 8 17 5 20 8"/>
    <line x1="17" y1="5" x2="17" y2="11"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
  </svg>
);
const IconAlertCircle = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ─── Utility ──────────────────────────────────────────────────────────────────

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
