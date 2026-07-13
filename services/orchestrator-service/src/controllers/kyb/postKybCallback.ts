import httpStatus from "http-status";
import * as z from "zod";
import { asyncHandler } from "../../middlewares/async";
import { validateRequest } from "../../validations";
import { markBusinessKybComplete } from "../../activities/business/markBusinessKybComplete";
import logger from "../../config/logger.config";

const KybCallbackSchema = z.object({
  id:    z.string(),
  score: z.number(),
  metadata: z.object({
    keycloak_id:  z.string(),
    tenant_id:    z.string(),
    is_business:  z.boolean().optional(),
  }).passthrough(),
  faceVerificationResult: z.object({
    success:    z.boolean(),
    similarity: z.number(),
  }).optional(),
  dataVerificationResult: z.object({
    UIN:         z.boolean(),
    firstName:   z.boolean(),
    lastName:    z.boolean(),
    phone:       z.boolean(),
    dateOfBirth: z.boolean(),
  }).optional(),
});

export const postKybCallback = asyncHandler(async (req, res) => {
  logger.info(`[kybCallback] incoming body: ${JSON.stringify(req.body)}`);

  let payload: z.infer<typeof KybCallbackSchema>;
  try {
    payload = validateRequest(KybCallbackSchema, req.body);
  } catch (validationError: any) {
    logger.error(`[kybCallback] schema validation failed: ${validationError.message ?? JSON.stringify(validationError)}`);
    throw validationError;
  }

  const { id, score, metadata } = payload;
  logger.info(`[kybCallback] parsed — id=${id} score=${score} tenant_id=${metadata.tenant_id} keycloak_id=${metadata.keycloak_id}`);

  const kybMinimumScore = parseInt(process.env.KYB_MINIMUM_SCORE || "50", 10);
  const scorePercent    = score <= 1 ? score * 100 : score;

  logger.info(`[kybCallback] score check — raw=${score} percent=${scorePercent} minimum=${kybMinimumScore}`);

  if (scorePercent < kybMinimumScore) {
    logger.warn(`[kybCallback] score ${scorePercent} below minimum ${kybMinimumScore} — KYB rejected`);
    return res.status(httpStatus.OK).json({
      isSuccessful: false,
      message:      "KYB verification score below minimum threshold.",
      responseModel: {},
    });
  }

  logger.info(`[kybCallback] score OK — calling markBusinessKybComplete`);
  await markBusinessKybComplete(metadata.tenant_id, metadata.keycloak_id);
  logger.info(`[kybCallback] markBusinessKybComplete done — returning success`);

  return res.status(httpStatus.OK).json({ isSuccessful: true, message: "success" });
});
