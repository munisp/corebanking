/**
 * Validate liveness proof from UI
 */
export async function validateLivenessProof(args: {
  livenessProof: {
    sessionId: string;
    timestamp: number;
    confidence: number;
    verdict: string;
    signals: {
      motion: number;
      challengePassed: boolean;
      timingVariance: number;
      lightVariance: number;
      frameDiff: number;
    };
    hash: string;
  };
  sessionId: string;
}): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Validate basic proof structure
    if (!args.livenessProof || !args.livenessProof.sessionId) {
      return { isValid: false, reason: "Invalid proof structure" };
    }

    // Note: We don't validate sessionId match because the liveness proof generates
    // its own session ID on the frontend, which is different from the verification ID

    // Check verdict
    if (args.livenessProof.verdict !== "VERIFIED") {
      return { isValid: false, reason: "Liveness check was not verified" };
    }

    // Validate confidence threshold — scoring engine maxes at ~0.85 in ideal
    // conditions (challenge=0.4 + motion=0.3 + rest). A realistic pass gives
    // 0.5–0.75, so 0.5 is the minimum meaningful bar.
    if (args.livenessProof.confidence < 0.5) {
      return { isValid: false, reason: "Confidence score too low" };
    }

    // Validate motion detection — pixel-diff motion for a normal head move
    // is 0.005–0.05; 0.2 would require the entire frame to change (never
    // happens in normal use). Use 0.01 to match the frontend verdict threshold.
    if (args.livenessProof.signals.motion < 0.01) {
      return { isValid: false, reason: "Insufficient motion detected" };
    }

    // Validate challenge response
    if (!args.livenessProof.signals.challengePassed) {
      return { isValid: false, reason: "Challenge not passed" };
    }

    // Check timestamp (not older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (args.livenessProof.timestamp < fiveMinutesAgo) {
      return { isValid: false, reason: "Proof expired" };
    }

    return { isValid: true };
  } catch (error) {
    console.error("Error validating liveness proof:", error);
    return { isValid: false, reason: "Validation error: " + (error as Error).message };
  }
}
