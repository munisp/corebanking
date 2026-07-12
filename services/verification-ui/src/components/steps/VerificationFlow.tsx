/**
 * VerificationFlow — 4-Step Guided Verification Container
 *
 * Step 1  Country Selection
 * Step 2  Document Type Selection
 * Step 3  Document Capture + OCR
 * Step 4  Face Verification / Liveness
 *
 * Data flows forward:
 *   country → documentConfig → docImages + ocrResult → verified
 *
 * Navigation:
 *   Steps 1 & 2 use parent Back/Continue buttons.
 *   Steps 3 & 4 are self-contained — they own their own navigation.
 */

import { useEffect, useState } from "react";
import { useVerificationFlow }         from "../../hooks/useVerificationFlow";
import { Step1CountrySelection }       from "./Step1CountrySelection";
import { Step2DocumentSelection }      from "./Step2DocumentSelection";
import { Step3DocumentCapture }        from "./Step3DocumentCapture";
import type { Step3Result }            from "./Step3DocumentCapture";
import { Step4FaceVerification }       from "./Step4FaceVerification";
import type { Step4Result }            from "./Step4FaceVerification";
import type { OCRResult }              from "../../types/verification";
import type { CapturedImage }          from "./Step3DocumentCapture";
import { verificationAPI }             from "../../services/verificationAPI";
import "./VerificationFlow.css";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerificationFlowProps {
  /** Verification session ID from URL params (optional — will create one if absent) */
  verificationId?: string;
  /** API key from URL params */
  apiKey?: string;
  /** Tenant / user metadata from URL params */
  metadata?: Record<string, unknown>;
  onComplete?: (result: VerificationCompleteResult) => void;
  onError?:    (error: string) => void;
}

export interface VerificationCompleteResult {
  verified:       boolean;
  status:         string;
  verificationId: string;
  livenessScore?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VerificationFlow({
  verificationId: urlVerificationId,
  apiKey,
  metadata,
  onComplete,
  onError,
}: VerificationFlowProps) {
  const [initialized, setInitialized] = useState(false);

  // ── Step 3/4 data carried forward ─────────────────────────────────────────
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [ocrResult,      setOcrResult]      = useState<OCRResult | null>(null);

  // ── Final result ──────────────────────────────────────────────────────────
  const [finalResult, setFinalResult] = useState<Step4Result | null>(null);

  // ── Apply URL-provided API key to singleton client ────────────────────────
  useEffect(() => {
    if (apiKey) verificationAPI.setApiKey(apiKey);
  }, [apiKey]);

  // ── Hook: manages session + steps 1–2 state ───────────────────────────────
  const flow = useVerificationFlow({
    verificationId: urlVerificationId,
    onStepChange: (step) => console.log("[Flow] Step →", step),
    onStatusChange: (status) => {
      if (status === "verified" && flow.session) {
        onComplete?.({
          verified: true,
          status,
          verificationId: flow.session.verificationId,
        });
      }
    },
  });

  // ── Session initialization ────────────────────────────────────────────────

  useEffect(() => {
    if (initialized) return;

    if (urlVerificationId) {
      // Pass the existing workflow UUID so the backend can link this session to
      // the running Temporal workflow (created by POST /kyc/initialize-verification).
      flow.initializeSession({
        source: "url",
        existingVerificationId: urlVerificationId,
        ...(metadata || {}),
      })
        .catch(() => {
          console.warn("[Flow] Session init failed — running in local mode");
        })
        .finally(() => setInitialized(true));
    } else {
      flow
        .initializeSession({ source: "web", ...(metadata || {}) })
        .then(() => setInitialized(true))
        .catch((err) => {
          console.warn("[Flow] Session init error:", err);
          setInitialized(true);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resolvedVerificationId =
    flow.session?.verificationId || urlVerificationId || `local_${Date.now()}`;

  // VerificationStep = 1 | 2 | 3 | 4 | "complete"
  const currentStep = flow.session?.currentStep ?? 1;

  const country = flow.selectedCountry;

  const handleStep3Complete = (result: Step3Result) => {
    setCapturedImages(result.images);
    setOcrResult(result.ocrResult);
    flow.moveToStep(4);
  };

  const handleStep4Complete = (result: Step4Result) => {
    setFinalResult(result);
    onComplete?.({
      verified:       result.verified,
      status:         result.status,
      verificationId: resolvedVerificationId,
      livenessScore:  result.livenessScore,
    });
    flow.moveToStep("complete");
  };

  const handleError = (msg: string) => {
    onError?.(msg);
  };

  // ── Show full-screen loader while session is being created ─────────────────
  if (!initialized) {
    return (
      <div className="vf-loading-screen">
        <div className="vf-loader">
          <div className="vf-spinner" />
          <h2>Initializing</h2>
          <p>Setting up your secure verification session…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="vf-container">

      {/* ── Progress Stepper ── */}
      {currentStep !== "complete" && (
        <header className="vf-stepper">
          <div className="vf-steps">
            <StepDot n={1} label="Country"  active={currentStep === 1} done={typeof currentStep === "number" && currentStep > 1} />
            <StepLine done={typeof currentStep === "number" && currentStep > 1} />
            <StepDot n={2} label="Document" active={currentStep === 2} done={typeof currentStep === "number" && currentStep > 2} />
            <StepLine done={typeof currentStep === "number" && currentStep > 2} />
            <StepDot n={3} label="Scan"     active={currentStep === 3} done={typeof currentStep === "number" && currentStep > 3} />
            <StepLine done={typeof currentStep === "number" && currentStep > 3} />
            <StepDot n={4} label="Face"     active={currentStep === 4} done={typeof currentStep === "number" && currentStep > 4} />
          </div>
        </header>
      )}

      {/* ── Step content ── */}
      <main className="vf-content">

        {/* Step 1 — Country */}
        {currentStep === 1 && (
          <Step1CountrySelection
            countries={flow.countries}
            selectedCountry={flow.selectedCountry}
            loading={flow.countriesLoading}
            onLoadCountries={flow.loadCountries}
            onSelectCountry={flow.selectCountry}
          />
        )}

        {/* Step 2 — Document */}
        {currentStep === 2 && flow.documentConfig && (
          <Step2DocumentSelection
            documentRequirements={flow.documentConfig.documentRequirements}
            selectedDocumentType={flow.selectedDocumentType}
            onSelectDocument={flow.selectDocumentType}
            loading={flow.documentConfigLoading}
            country={country?.name || ""}
          />
        )}

        {/* Step 2 — waiting for document config */}
        {currentStep === 2 && !flow.documentConfig && (
          <div className="vf-step-loading">
            <div className="vf-spinner" />
            <p>Loading document options…</p>
          </div>
        )}

        {/* Step 3 — Document Capture */}
        {currentStep === 3 && flow.documentConfig && flow.selectedDocumentType && (
          <Step3DocumentCapture
            verificationId={resolvedVerificationId}
            documentRequirement={
              flow.documentConfig.documentRequirements.find(
                (d) => d.type === flow.selectedDocumentType,
              ) || flow.documentConfig.documentRequirements[0]
            }
            countryCode={country?.code || "NG"}
            onComplete={handleStep3Complete}
            onBack={() => flow.moveToStep(2)}
          />
        )}

        {/* Step 4 — Face Verification */}
        {currentStep === 4 &&
          flow.documentConfig &&
          flow.selectedDocumentType && (
          <Step4FaceVerification
            verificationId={resolvedVerificationId}
            documentRequirement={
              flow.documentConfig.documentRequirements.find(
                (d) => d.type === flow.selectedDocumentType,
              ) || flow.documentConfig.documentRequirements[0]
            }
            countryCode={country?.code || "NG"}
            ocrResult={ocrResult}
            capturedImages={capturedImages}
            metadata={metadata}
            onComplete={handleStep4Complete}
            onBack={() => flow.moveToStep(3)}
          />
        )}

        {/* Complete screen */}
        {currentStep === "complete" && finalResult && (
          <CompletionScreen
            result={finalResult}
            verificationId={resolvedVerificationId}
            onClose={() => {
              // Signal the parent app or redirect
              onComplete?.({
                verified:       finalResult.verified,
                status:         finalResult.status,
                verificationId: resolvedVerificationId,
                livenessScore:  finalResult.livenessScore,
              });
            }}
          />
        )}

        {/* Fallback complete (no final result) */}
        {currentStep === "complete" && !finalResult && (
          <div className="vf-success-screen">
            <div className="vf-success-icon">✓</div>
            <h2>Verification Complete</h2>
            <p className="vf-success-status">Status: {flow.session?.status}</p>
          </div>
        )}
      </main>

      {/* ── Bottom navigation (Steps 1 & 2 only) ─────────────────────────── */}
      {(currentStep === 1 || currentStep === 2) && (
        <nav className="vf-nav">
          {currentStep === 2 && (
            <button
              className="vf-btn vf-btn-ghost"
              onClick={flow.previousStep}
            >
              ← Back
            </button>
          )}

          <button
            className="vf-btn vf-btn-primary"
            onClick={flow.nextStep}
            disabled={
              (currentStep === 1 && !flow.selectedCountry) ||
              (currentStep === 2 && !flow.selectedDocumentType)
            }
          >
            Continue →
          </button>
        </nav>
      )}

      {/* ── Global error banner ── */}
      {flow.error && currentStep !== 1 && typeof currentStep === "number" && (
        <div
          className="vf-error-banner"
          role="alert"
          onClick={() => handleError(flow.error!)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v5m0 4v.01" stroke="white" strokeWidth="2" fill="none" />
          </svg>
          <span>{flow.error}</span>
        </div>
      )}
    </div>
  );
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({
  result,
  verificationId,
  onClose,
}: {
  result: Step4Result;
  verificationId: string;
  onClose: () => void;
}) {
  const isVerified = result.verified && result.status !== "rejected";

  return (
    <div className={`vf-complete ${isVerified ? "success" : "fail"}`}>
      <div className={`vf-complete-icon ${isVerified ? "success" : "fail"}`}>
        {isVerified ? (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6"  y2="18" />
            <line x1="6"  y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      <h2>{isVerified ? "Identity Verified!" : result.status === "manual_review" ? "Queued for Review" : "Verification Incomplete"}</h2>

      <p>
        {isVerified
          ? "Your identity has been confirmed. You can now return to the application."
          : result.status === "manual_review"
          ? "Your verification has been submitted for manual review. You'll hear back shortly."
          : "We couldn't complete your verification at this time."}
      </p>

      {isVerified && (
        <div className="vf-complete-card">
          <div className="vf-complete-row">
            <span>Status</span>
            <span className="vf-badge-green">Verified ✓</span>
          </div>
          {result.livenessScore > 0 && (
            <div className="vf-complete-row">
              <span>Liveness Score</span>
              <span className="vf-score">{(result.livenessScore * 100).toFixed(1)}%</span>
            </div>
          )}
          <div className="vf-complete-row mono">
            <span>Reference</span>
            <span>{verificationId.slice(0, 16)}…</span>
          </div>
        </div>
      )}

      {isVerified && (
        <div className="vf-complete-info">
          <p>✓ You may safely close this window and return to the application.</p>
        </div>
      )}

      {!isVerified && (
        <button className="vf-btn vf-btn-ghost" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
}

// ─── Stepper sub-components ───────────────────────────────────────────────────

function StepDot({
  n, label, active, done,
}: {
  n: number; label: string; active: boolean; done: boolean;
}) {
  return (
    <div className={`vf-step ${active ? "active" : ""} ${done ? "done" : ""}`}>
      <div className="vf-step-circle">
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : n}
      </div>
      <span className="vf-step-label">{label}</span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <div className={`vf-step-line ${done ? "done" : ""}`} />;
}
