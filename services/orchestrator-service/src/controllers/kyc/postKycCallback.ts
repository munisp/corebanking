import { uuid4 } from "@temporalio/workflow";
import httpStatus from "http-status";
import * as z from "zod";
import { asyncHandler } from "../../middlewares/async";
import { notificationService } from "../../services/notificationService";
import { workflowRunner } from "../../utils/workflowRunner";
import { NotificationCategory, NotificationType } from "../../utils/enums";
import { validateRequest } from "../../validations";
import { KycCustomerCallbackSchema } from "../../validations/schemas";
import { markCustomerKycFailed } from "../../activities/customer/markCustomerKycFailed";
import { markAgentKycFailed } from "../../activities/agent/markAgentKycFailed";
import { markAdminKycComplete } from "../../activities/admin/markAdminKycComplete";
import { completeAgentOnboardingWorkflow } from "../../workflows/completeAgentOnboardingWorkflow";
import { completeCustomerOnboardingWorkflow } from "../../workflows/completeCustomerOnboardingWorkflow";
import logger from "../../config/logger.config";

export const postKycCallback = asyncHandler(async (req, res) => {
  logger.info(`[kycCallback] incoming body: ${JSON.stringify(req.body)}`);

  let payload: z.infer<typeof KycCustomerCallbackSchema>;
  try {
    payload = validateRequest(KycCustomerCallbackSchema, req.body);
  } catch (validationError: any) {
    logger.error(`[kycCallback] schema validation failed: ${validationError.message ?? JSON.stringify(validationError)}`);
    throw validationError;
  }

  const { id, score, metadata } = payload;
  const isAdmin = metadata.is_admin === true;
  const isAgent = metadata.is_agent === true;

  logger.info(`[kycCallback] parsed — id=${id} score=${score} isAdmin=${isAdmin} isAgent=${isAgent} tenant_id=${metadata.tenant_id} keycloak_id=${metadata.keycloak_id}`);

  // ── Admin path ────────────────────────────────────────────────────────────
  // Admin KYC uses liveness/default workflow — no NIN/document gate.
  // score=0 means the workflow threw (e.g. Invalid face); otherwise mark complete.
  if (isAdmin) {
    logger.info(`[kycCallback] admin path — score=${score}`);
    if (score === 0) {
      logger.warn(`[kycCallback] admin KYC failed (score=0) — returning failure`);
      return res.status(httpStatus.OK).json({
        isSuccessful: false,
        message: "Admin KYC verification failed.",
        responseModel: {},
      });
    }
    logger.info(`[kycCallback] calling markAdminKycComplete — tenant_id=${metadata.tenant_id} keycloak_id=${metadata.keycloak_id}`);
    await markAdminKycComplete(metadata.tenant_id, metadata.keycloak_id);
    logger.info(`[kycCallback] markAdminKycComplete done`);
    return res.status(httpStatus.OK).json({ isSuccessful: true, message: "success" });
  }

  // ── Customer / Agent path ─────────────────────────────────────────────────
  // kycVerificationScore returns 0–1; KYC_MINIMUM_SCORE env is 0–100 scale.
  const kycMinimumScore = parseInt(process.env.KYC_MINIMUM_SCORE || "80", 10);
  const scorePercent    = score <= 1 ? score * 100 : score;

  logger.info(`[kycCallback] score check — raw=${score} percent=${scorePercent} minimum=${kycMinimumScore}`);

  if (scorePercent < kycMinimumScore) {
    logger.warn(`[kycCallback] score ${scorePercent} below minimum ${kycMinimumScore} — marking KYC failed`);

    if (isAgent) {
      logger.info(`[kycCallback] calling markAgentKycFailed`);
      await markAgentKycFailed(metadata.tenant_id, metadata.keycloak_id);
    } else {
      logger.info(`[kycCallback] calling markCustomerKycFailed`);
      await markCustomerKycFailed(metadata.tenant_id, metadata.keycloak_id);
    }

    await notificationService.event({
      subscriberId: metadata.keycloak_id,
      payload: { reason: "KYC score below minimum threshold" },
      type: NotificationType.KYC,
      category: NotificationCategory.EMAIL,
    });

    return res.status(httpStatus.OK).json({
      isSuccessful: false,
      message: `KYC verification score below minimum threshold.`,
      responseModel: {},
    });
  }

  logger.info(`[kycCallback] score OK — triggering complete onboarding workflow (isAgent=${isAgent})`);

  if (isAgent) {
    await workflowRunner(completeAgentOnboardingWorkflow, {
      args: payload,
      workflowId: `54link_complete_agent_onboarding_${metadata.keycloak_id}_${uuid4()}`,
      defaultErrorMessage: "Complete agent onboarding failed.",
      withTimeOut: 40000,
      timeOutFn: () => {
        logger.info(`[kycCallback] agent onboarding workflow timed out — returning ACCEPTED`);
        return res.status(httpStatus.ACCEPTED).json({
          isSuccessful: true,
          message: "Complete agent onboarding processing... You'll be notified when it's done.",
          responseModel: {},
        });
      },
    });
  } else {
    await workflowRunner(completeCustomerOnboardingWorkflow, {
      args: payload,
      workflowId: `54link_complete_customer_onboarding_${metadata.keycloak_id}_${uuid4()}`,
      defaultErrorMessage: "Complete customer onboarding failed.",
      withTimeOut: 40000,
      timeOutFn: () => {
        logger.info(`[kycCallback] customer onboarding workflow timed out — returning ACCEPTED`);
        return res.status(httpStatus.ACCEPTED).json({
          isSuccessful: true,
          message: "Complete customer onboarding processing... You'll be notified when it's done.",
          responseModel: {},
        });
      },
    });
  }

  logger.info(`[kycCallback] complete — returning success`);
  return res.status(httpStatus.OK).json({ message: "success" });
});
