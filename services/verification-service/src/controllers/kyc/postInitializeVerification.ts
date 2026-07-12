import httpStatus from "http-status";
import logger from "../../config/logger.config";
import { readEnv } from "../../config/readEnv.config";
import { AppDataSource } from "../../database/dataSource";
import { KycVerificationWorkflowEntity } from "../../entity/KycVerificationWorkflowEntity";
import { asyncHandler } from "../../middlewares/async";
import { ApiError } from "../../middlewares/error";
import { setupTemporalClient } from "../../setup/setupTemporalClient";
import { KycWorkflowArgs, KycWorkflowResult } from "../../types/workflow";
import {
  KycIdentityProviders,
  VerificationWorkflowStatus,
} from "../../utils/enums";
import { workflowRunner } from "../../utils/workflowRunner";
import { validateRequest } from "../../validations";
import { PostInitializeKycVerificationValidationSchema } from "../../validations/schemas";
import {
  defaultKycWorkflow,
  terminate_default_verification_workflow_signal,
} from "../../workflows/defaultKycWorkflow";
import {
  shieldKycWorkflow,
  terminate_shield_verification_workflow_signal,
} from "../../workflows/shieldKycWorkflow";
import {
  livenessKycWorkflow,
  terminate_liveness_verification_workflow_signal,
} from "../../workflows/livenessKycWorkflow";

export const postInitializeVerification = asyncHandler(async (req, res) => {
  const payload = validateRequest(
    PostInitializeKycVerificationValidationSchema,
    req.body,
  );

  const client = req.client!;

  // Check if existing verification workflow exists and end it.
  const existingKycVerification = await AppDataSource.manager.findOne(
    KycVerificationWorkflowEntity,
    {
      where: {
        client_app_user_id: payload.user.UIN,
        client_id: client.id,
      },
    },
  );

  if (existingKycVerification) {
    // terminate workflow if still in running state
    if (existingKycVerification.status == VerificationWorkflowStatus.RUNNING) {
      try {
        const wfClient = await setupTemporalClient();

        const handle = wfClient!.getHandle(
          `init-${existingKycVerification.identity_provider}-kyc-${existingKycVerification.id}`,
        );

        // Check if workflow actually exists before trying to signal it
        try {
          await handle.describe();
          
          // send terminate signal to workflow only if it exists
          if (
            existingKycVerification.identity_provider ===
            KycIdentityProviders.SHIELD
          ) {
            await handle.signal(
              terminate_shield_verification_workflow_signal,
              true,
            );
          } else if (
            existingKycVerification.identity_provider ===
            KycIdentityProviders.DEFAULT
          ) {
            await handle.signal(
              terminate_default_verification_workflow_signal,
              true,
            );
          } else if (
            existingKycVerification.identity_provider ===
            KycIdentityProviders.LIVENESS
          ) {
            await handle.signal(
              terminate_liveness_verification_workflow_signal,
              true,
            );
          }
        } catch (describeError: any) {
          // Workflow doesn't exist in Temporal, just log and continue
          logger.warn(
            `Workflow init-${existingKycVerification.identity_provider}-kyc-${existingKycVerification.id} not found in Temporal, skipping termination signal`,
          );
        }
      } catch (clientError: any) {
        // Failed to get Temporal client, log but continue
        logger.error(`Failed to get Temporal client for workflow termination:`, clientError.message);
      }
    }

    // delete database entry
    await AppDataSource.manager.remove(existingKycVerification);
  }

  logger.info(`[initializeKyc] request — UIN=${payload.user.UIN} provider=${payload.identityProvider} callbackUrl=${client.callback_url ?? "none"} metadata=${JSON.stringify(payload.metadata)}`);

  const kycVerification = new KycVerificationWorkflowEntity();

  kycVerification.identity_provider =
    payload.identityProvider || KycIdentityProviders.LIVENESS;
  kycVerification.client = client;
  kycVerification.client_app_user_id = payload.user.UIN;

  try {
    await AppDataSource.manager.save(kycVerification);
    logger.info(`[initializeKyc] entity saved — id=${kycVerification.id} provider=${kycVerification.identity_provider}`);
  } catch (dbError: any) {
    logger.error(`[initializeKyc] DB save failed: ${dbError.message}`);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to save KYC verification record: ${dbError.message}`,
      "VER-500-01",
      "verification-service",
    );
  }

  const url = `${readEnv("KYC_FLOW_BASE_URL")}?verification_id=${kycVerification.id}&identity_provider=${
    kycVerification.identity_provider
  }${payload.redirectUrl ? "&redirect_url=" + payload.redirectUrl : ""}${
    payload.metadata ? `&metadata=${encodeURIComponent(JSON.stringify(payload.metadata))}` : ""
  }`;

  logger.info(`[initializeKyc] KYC URL built — ${url}`);

  const workflowArgs: KycWorkflowArgs = {
    id:          kycVerification.id,
    callBackUrl: client.callback_url || undefined,
    ...payload.user,
    metadata:    payload.metadata || undefined,
  };

  logger.info(`[initializeKyc] starting workflow — workflowArgs.id=${workflowArgs.id} workflowArgs.metadata=${JSON.stringify(workflowArgs.metadata)}`);

  try {
    if (payload.identityProvider == KycIdentityProviders.SHIELD) {
      await workflowRunner<KycWorkflowArgs, KycWorkflowResult | void>(shieldKycWorkflow, {
        args: workflowArgs,
        workflowId: `init-shield-kyc-${kycVerification.id}`,
        defaultErrorMessage: "Failed to initialize shield kyc verification workflow.",
        isDaemon: true,
      });
    } else if (payload.identityProvider == KycIdentityProviders.DEFAULT) {
      await workflowRunner<KycWorkflowArgs, KycWorkflowResult | void>(defaultKycWorkflow, {
        args: workflowArgs,
        workflowId: `init-default-kyc-${kycVerification.id}`,
        defaultErrorMessage: "Failed to initialize default kyc verification workflow.",
        isDaemon: true,
      });
    } else if (payload.identityProvider == KycIdentityProviders.LIVENESS) {
      await workflowRunner<KycWorkflowArgs, KycWorkflowResult | void>(livenessKycWorkflow, {
        args: workflowArgs,
        workflowId: `init-liveness-kyc-${kycVerification.id}`,
        defaultErrorMessage: "Failed to initialize liveness kyc verification workflow.",
        isDaemon: true,
      });
    } else {
      throw new ApiError(
        httpStatus.NOT_IMPLEMENTED,
        "Not supported.",
        "VER-501-00",
        "verification-service",
      );
    }

    logger.info(`[initializeKyc] workflow started OK — id=${kycVerification.id}`);
  } catch (workflowError: any) {
    logger.error(`[initializeKyc] workflow start failed: ${workflowError.message} — cleaning up entity ${kycVerification.id}`);
    await AppDataSource.manager.remove(kycVerification);
    throw workflowError;
  }

  return res.status(httpStatus.CREATED).json({
    id: kycVerification.id,
    url,
  });
});
