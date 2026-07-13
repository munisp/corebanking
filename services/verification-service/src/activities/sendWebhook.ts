import axios from "axios";
import httpStatus from "http-status";
import * as https from "https";
import logger from "../config/logger.config";
import { KycWorkflowResult } from "../types/workflow";

export async function sendWebhook(url: string, result: KycWorkflowResult) {
  logger.info(`[sendWebhook] → POST ${url}`);
  logger.info(`[sendWebhook] payload: ${JSON.stringify({
    id:                    result.id,
    score:                 result.score,
    metadata:              result.metadata,
    faceVerificationResult: result.faceVerificationResult
      ? { success: result.faceVerificationResult.success, similarity: result.faceVerificationResult.similarity }
      : undefined,
    dataVerificationResult: result.dataVerificationResult,
  })}`);

  const response = await axios.post(url, result, {
    headers: { "Content-Type": "application/json" },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 30000,
  }).catch((err: any) => {
    const detail = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    logger.error(`[sendWebhook] request failed — ${detail}`);
    throw err;
  });

  logger.info(`[sendWebhook] response status: ${response.status}`);

  if (
    response.status != httpStatus.OK &&
    response.status != httpStatus.CREATED &&
    response.status != httpStatus.ACCEPTED
  ) {
    logger.warn(`[sendWebhook] unexpected status ${response.status}, body: ${JSON.stringify(response.data)} — will retry`);
    throw new Error("Invalid webhook response...");
  }

  logger.info(`[sendWebhook] delivered OK (${response.status})`);
  return true;
}
