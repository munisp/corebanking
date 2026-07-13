/**
 * Motion Engine
 * Detects general movement, natural jitter, and micro motion
 */

export function motionScore(prev: ImageData, curr: ImageData): number {
  let diff = 0;
  const sampleRate = 2; // Sample every 2nd pixel for better sensitivity

  for (let i = 0; i < curr.data.length; i += sampleRate * 4) {
    const r = Math.abs(curr.data[i] - prev.data[i]);
    const g = Math.abs(curr.data[i + 1] - prev.data[i + 1]);
    const b = Math.abs(curr.data[i + 2] - prev.data[i + 2]);
    diff += (r + g + b) / 3;
  }

  // Normalize to 0-1 range
  const maxDiff = (curr.data.length / (sampleRate * 4)) * 255;
  return Math.min(diff / maxDiff, 1);
}

export function detectJitter(motionHistory: number[]): number {
  if (motionHistory.length < 3) return 0;

  let variance = 0;
  const mean = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;

  motionHistory.forEach((value) => {
    variance += Math.pow(value - mean, 2);
  });

  variance /= motionHistory.length;

  // Natural movement should have some variance
  // Return normalized jitter score (0-1)
  return Math.min(variance * 10, 1);
}

export function isMoving(score: number, threshold: number = 0.01): boolean {
  return score > threshold;
}
