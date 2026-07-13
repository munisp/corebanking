import { uuid4 } from "@temporalio/workflow";
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

  const kycMinimumScore = parseInt(process.env.KYC_MINIMUM_SCORE || "80", 10);
  if (payload.score < kycMinimumScore) {
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
    workflowId: `54link_complete_agent_onboarding_${payload.metadata.keycloak_id}_${uuid4()}`,
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
