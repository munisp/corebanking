/**
 * App.tsx — Entry point for 54link Verification UI
 *
 * URL parameter contract:
 *   verification_id     — KYC session ID (triggers individual KYC flow)
 *   kyb_verification_id — KYB entity ID  (triggers business KYB flow)
 *   api_key             — API key override (optional)
 *   metadata            — JSON string with tenant_id, keycloak_id, etc. (optional)
 *
 * KYC example:
 *   https://54link-dev.upi.dev/verification-ui/?verification_id=ver_abc123&api_key=xxx
 *
 * KYB example:
 *   https://54link-dev.upi.dev/verification-ui/?kyb_verification_id=ent_abc123&metadata=%7B%22tenant_id%22%3A%22t1%22%7D
 */

import "./App.css";
import { VerificationFlow } from "./components/steps/VerificationFlow";
import { KybFlow }          from "./components/kyb/KybFlow";

function App() {
  // ── Parse URL parameters ──────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);

  const verificationId    = params.get("verification_id")     || undefined;
  const kybVerificationId = params.get("kyb_verification_id") || undefined;
  const apiKey            = params.get("api_key")             || undefined;

  let metadata: Record<string, unknown> = {};
  try {
    const raw = params.get("metadata");
    if (raw) metadata = JSON.parse(raw);
  } catch {
    // ignore malformed metadata
  }

  // ── Shared event handlers ─────────────────────────────────────────────────

  const postMessage = (type: string, payload: unknown) => {
    if (window.parent !== window) {
      window.parent.postMessage({ type, payload }, "*");
    }
  };

  const handleKycComplete = (result: { verified: boolean; status: string; verificationId: string }) => {
    console.log("[App] KYC complete:", result);
    postMessage("VERIFICATION_COMPLETE", result);
  };

  const handleKybComplete = (result: { verified: boolean; score: number }) => {
    console.log("[App] KYB complete:", result);
    postMessage("KYB_COMPLETE", result);
  };

  const handleError = (error: string) => {
    console.error("[App] Verification error:", error);
    postMessage("VERIFICATION_ERROR", { error });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (kybVerificationId) {
    return (
      <KybFlow
        kybVerificationId={kybVerificationId}
        apiKey={apiKey}
        metadata={metadata}
        onComplete={handleKybComplete}
        onError={handleError}
      />
    );
  }

  return (
    <VerificationFlow
      verificationId={verificationId}
      apiKey={apiKey}
      metadata={metadata}
      onComplete={handleKycComplete}
      onError={handleError}
    />
  );
}

export default App;
