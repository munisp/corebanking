import { KycWorkflowResult } from "../types/workflow";
import logger from "../config/logger.config";

/**
 * Takes in a kyc verification result struct, and returns a verification score
 * @param verificationResult The result of the verification workflow
 * @returns
 */
export function kycVerificationScore(verificationResult: KycWorkflowResult) {
  const faceSimilarity = verificationResult.faceVerificationResult?.similarity || 0;
  const faceVerificationScore = faceSimilarity * 0.42;

  logger.info(`[kycVerificationScore] faceResult: success=${verificationResult.faceVerificationResult?.success} similarity=${faceSimilarity} → faceScore=${faceVerificationScore}`);
  logger.info(`[kycVerificationScore] dataResult: ${JSON.stringify(verificationResult.dataVerificationResult)}`);

  let dataVerificationScore = 0;

  for (const key of ["UIN", "firstName", "lastName"] as const) {
    if (!verificationResult.dataVerificationResult?.[key]) {
      logger.warn(`[kycVerificationScore] required field "${key}" is falsy — returning score=0`);
      return 0;
    }
  }

  if (verificationResult.dataVerificationResult?.phone)       dataVerificationScore += 0.08;
  if (verificationResult.dataVerificationResult?.dateOfBirth) dataVerificationScore += 0.08;

  const docSimilarity = verificationResult.documentVerificationResult?.similarity || 0;
  const documentVerificationScore = docSimilarity * 0.42;

  const total = Number((faceVerificationScore + dataVerificationScore + documentVerificationScore).toFixed(3));

  logger.info(`[kycVerificationScore] components — face=${faceVerificationScore.toFixed(3)} data=${dataVerificationScore.toFixed(3)} doc=${documentVerificationScore.toFixed(3)} → total=${total}`);
  return total;
}
