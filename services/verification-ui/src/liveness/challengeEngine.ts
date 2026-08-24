/**
 * Challenge Engine
 * Generates random challenges for liveness verification
 */

import type { ChallengeType } from "./types";

export const CHALLENGES: ChallengeType[] = [
  "TURN_LEFT",
  "TURN_RIGHT",
  "BLINK",
  "NOD",
  "SMILE",
];

export const CHALLENGE_INSTRUCTIONS: Record<ChallengeType, string> = {
  TURN_LEFT: "Turn your head left",
  TURN_RIGHT: "Turn your head right",
  BLINK: "Blink twice",
  NOD: "Nod your head",
  SMILE: "Smile!",
};

export function generateChallenge(): ChallengeType {
  // CSPRNG challenge selection — liveness challenges are security-relevant
  // (anti-spoofing), so never use Math.random() here.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return CHALLENGES[buf[0] % CHALLENGES.length];
}

export function generateChallengeSequence(count: number = 1): ChallengeType[] {
  const sequence: ChallengeType[] = [];
  for (let i = 0; i < count; i++) {
    sequence.push(generateChallenge());
  }
  return sequence;
}

export function getChallengeInstruction(challenge: ChallengeType): string {
  return CHALLENGE_INSTRUCTIONS[challenge];
}

/**
 * Verify if motion pattern matches expected challenge
 * Analyzes motion patterns to detect actual user actions
 */
export function verifyChallengeResponse(
  challenge: ChallengeType,
  currentMotion: number,
  motionHistory: number[],
): boolean {
  // Need at least a few frames of history
  console.log(
    `Verifying challenge ${challenge} with current motion ${currentMotion.toFixed(5)} and history length ${motionHistory.length}`,
  );
  if (motionHistory.length < 10) return false;

  // Get last 15 frames (about 0.5 seconds at 30fps)
  const recentFrames = Math.min(15, motionHistory.length);
  const recentMotion = motionHistory.slice(-recentFrames);

  // Calculate average of recent motion
  const avgMotion =
    recentMotion.reduce((a, b) => a + b, 0) / recentMotion.length;

  // Find the maximum motion in recent frames
  const maxMotion = Math.max(...recentMotion);

  // Get baseline from earlier frames (before this challenge)
  const baselineFrames = motionHistory.slice(-40, -20);
  const baseline =
    baselineFrames.length > 0
      ? baselineFrames.reduce((a, b) => a + b, 0) / baselineFrames.length
      : 0;

  // Calculate how much motion increased from baseline
  const motionIncrease = avgMotion - baseline;

  // CRITICAL: Absolute minimum - if no real motion at all, always fail
  // Ultra-low threshold for maximum sensitivity
  if (maxMotion < 0.0015 && avgMotion < 0.001) {
    console.log(
      `⚠ Motion too low: max=${maxMotion.toFixed(5)}, avg=${avgMotion.toFixed(5)}`,
    );
    return false;
  }

  let passed = false;
  let reason = "";

  // Require actual increase from baseline OR high enough peak motion
  switch (challenge) {
    case "TURN_LEFT":
    case "TURN_RIGHT":
      // Ultra-sensitive threshold for head turns
      if (motionIncrease > 0.001 && avgMotion > 0.002) {
        passed = true;
        reason = `increase ${motionIncrease.toFixed(4)} + avg ${avgMotion.toFixed(4)}`;
      } else if (maxMotion > 0.004) {
        passed = true;
        reason = `peak ${maxMotion.toFixed(4)}`;
      } else if (avgMotion > 0.003) {
        passed = true;
        reason = `sustained motion ${avgMotion.toFixed(4)}`;
      } else if (motionIncrease > 0.0008) {
        passed = true;
        reason = `any increase ${motionIncrease.toFixed(4)}`;
      }
      break;

    case "NOD": {
      // Need up/down motion with variance
      const variance =
        recentMotion.reduce((sum, m) => sum + Math.pow(m - avgMotion, 2), 0) /
        recentMotion.length;

      if (variance > 0.00003 && motionIncrease > 0.002) {
        passed = true;
        reason = `variance ${variance.toFixed(6)} + increase ${motionIncrease.toFixed(4)}`;
      } else if (variance > 0.00005 && avgMotion > 0.004) {
        passed = true;
        reason = `high variance ${variance.toFixed(6)}`;
      } else if (maxMotion > 0.008) {
        passed = true;
        reason = `peak motion ${maxMotion.toFixed(4)}`;
      }
      break;
    }

    case "BLINK":
      // Extremely sensitive - detect any facial motion
      if (maxMotion > 0.003 && motionIncrease > 0.001) {
        passed = true;
        reason = `spike ${maxMotion.toFixed(4)} + increase ${motionIncrease.toFixed(4)}`;
      } else if (maxMotion > 0.005) {
        passed = true;
        reason = `high spike ${maxMotion.toFixed(4)}`;
      } else if (avgMotion > 0.003 && motionIncrease > 0.0008) {
        passed = true;
        reason = `subtle motion ${avgMotion.toFixed(4)}`;
      } else if (avgMotion > 0.004) {
        passed = true;
        reason = `sustained ${avgMotion.toFixed(4)}`;
      }
      break;

    case "SMILE":
      // Very sensitive for subtle facial movements
      if (motionIncrease > 0.001 && avgMotion > 0.003) {
        passed = true;
        reason = `increase ${motionIncrease.toFixed(4)} + avg ${avgMotion.toFixed(4)}`;
      } else if (maxMotion > 0.005) {
        passed = true;
        reason = `peak ${maxMotion.toFixed(4)}`;
      } else if (avgMotion > 0.004) {
        passed = true;
        reason = `sustained ${avgMotion.toFixed(4)}`;
      }
      break;

    default:
      return false;
  }

  if (passed) {
    console.log(`✓ ${challenge} detected: ${reason}`);
  }

  return passed;
}
