import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { notificationService } from "../../services/notificationService";
import { workflowRunner } from "../../utils/workflowRunner";
import { NotificationCategory, NotificationType } from "../../utils/enums";
import { validateRequest } from "../../validations";
import { KycAgentCallbackSchema } from "../../validations/schemas";
import { markAgentKycFailed } from "../../activities/agent/markAgentKycFailed";
import { completeAgentOnboardingWorkflow } from "../../workflows/completeAgentOnboardingWorkflow";

export const postAgentKycCallback = asyncHandler(async (req, res) => {
  const payload = validateRequest(KycAgentCallbackSchema, req.body);

  // OB-11: kycVerificationScore returns 0–1; KYC_MINIMUM_SCORE is 0–100 scale.
  // Normalize exactly like postKycCallback.ts (customer route).
  const kycMinimumScore = parseInt(process.env.KYC_MINIMUM_SCORE || "80", 10);
  const scorePercent = payload.score <= 1 ? payload.score * 100 : payload.score;
  if (scorePercent < kycMinimumScore) {
    await markAgentKycFailed(payload.metadata.tenant_id, payload.metadata.keycloak_id);

    await notificationService.event({
      subscriberId: payload.metadata.keycloak_id,
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

  await workflowRunner(completeAgentOnboardingWorkflow, {
    args: payload,
    // OB-08: deterministic id (keycloak_id + verification id) dedups repeat callback deliveries.
    workflowId: `54link_complete_agent_onboarding_${payload.metadata.keycloak_id}_${payload.id}`,
    defaultErrorMessage: "Complete agent onboarding failed.",
    withTimeOut: 40000,
    timeOutFn: () => {
      return res.status(httpStatus.ACCEPTED).json({
        isSuccessful: true,
        message:
          "Complete agent onboarding processing... You'll be notified when it's done.",
        responseModel: {},
      });
    },
  });

  return res.status(httpStatus.OK).json({ message: "success" });
});
