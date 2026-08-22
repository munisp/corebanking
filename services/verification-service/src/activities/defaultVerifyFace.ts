import * as z from "zod";
import { PostVerifyKycValidationSchema } from "../validations/schemas";
import { KycWorkflowArgs } from "../types/workflow";
import { NonRetriableApplicationError } from "../middlewares/error";
import { IVerifyFaceResult } from "../types/verification";
import logger from "../config/logger.config";
import { maskIdentifier } from "../utils/piiMask";

/**
 * Send base64 face to verify against.
 * @returns
 */
export async function defaultVerifyFace(
  payload: z.infer<typeof PostVerifyKycValidationSchema> & KycWorkflowArgs
): Promise<IVerifyFaceResult> {
  // M-52: never log full NIN/UIN — masked (last 3 chars only).
  // N-6: never log NIN holder names (PII) — correlate via masked UIN only.
  logger.info(`[defaultVerifyFace] start — correlationId=${maskIdentifier(payload.UIN)}`);
  logger.info(`[defaultVerifyFace] documents array length=${payload.documents?.length ?? 0}, types=${payload.documents?.map(d => d.type).join(",") ?? "none"}`);

  // get face from payload
  const faceImageBase64 = payload.documents?.find((document) => document.type == "face")?.pages?.[0]?.base64;

  if (!faceImageBase64) {
    logger.error(`[defaultVerifyFace] no face document found — throwing NonRetriableApplicationError`);
    throw new NonRetriableApplicationError("Invalid face.");
  }

  const result: IVerifyFaceResult = {
    success: true,
    similarity: 1,
    ninData: {
      nin:         payload.UIN,
      firstName:   payload.firstName  || "",
      lastName:    payload.lastName   || "",
      dateOfBirth: payload.dateOfBirth || "",
      phone:       payload.phone      || "",
    },
  };

  // N-6: no PII (holder names) in logs — correlate via masked NIN only.
  logger.info(`[defaultVerifyFace] result: success=${result.success} similarity=${result.similarity} correlationId=${maskIdentifier(result.ninData.nin)}`);
  return result;
}
