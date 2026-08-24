import httpStatus from "http-status";
import * as z from "zod";
import { asyncHandler } from "../../middlewares/async";
import { ApiError }     from "../../middlewares/error";
import { AppDataSource } from "../../database/dataSource";
import { KycVerificationWorkflowEntity } from "../../entity/KycVerificationWorkflowEntity";
import { KycIdentityProviders, VerificationWorkflowStatus } from "../../utils/enums";
import { setupTemporalClient } from "../../setup/setupTemporalClient";
import { workflowRunner }      from "../../utils/workflowRunner";
import { readEnv }             from "../../config/readEnv.config";
import { AuthRequest }         from "../../types";
import { businessKybWorkflow } from "../../workflows/businessKybWorkflow";
import logger                  from "../../config/logger.config";

const PostInitializeKybSchema = z.object({
  business_name: z.string().trim().nonempty(),
  cac:           z.string().trim().nonempty(),
  tin:           z.string().trim().nonempty(),
  tenant_id:     z.string().trim().nonempty(),
  metadata:      z.record(z.unknown()).optional(),
});

export const postInitializeVerification = asyncHandler(async (req: AuthRequest, res) => {
  const body    = req.body ?? {};
  const client  = req.client!;

  // Validate
  const parsed = PostInitializeKybSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      parsed.error.errors.map(e => e.message).join("; "),
      "KYB-400-01",
      "verification-service",
    );
  }
  const payload = parsed.data;

  logger.info(`[initializeKyb] request — business=${payload.business_name} cac=${payload.cac} tin=${payload.tin} callbackUrl=${client.callback_url ?? "none"} metadata=${JSON.stringify(payload.metadata)}`);

  // Check for existing running KYB workflow for same CAC
  const existing = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
    where: {
      client_app_user_id: payload.cac,
      client_id: client.id,
    },
  });
  if (existing) {
    if (existing.status === VerificationWorkflowStatus.RUNNING) {
      try {
        const wfClient = await setupTemporalClient();
        const handle = wfClient.getHandle(`init-business_kyb-kyb-${existing.id}`);
        try {
          await handle.describe();
          const { terminate_business_kyb_signal } = await import("../../workflows/businessKybWorkflow");
          await handle.signal(terminate_business_kyb_signal, true);
        } catch (_) { /* workflow gone, fine */ }
      } catch (_) { /* Temporal unavailable */ }
    }
    await AppDataSource.manager.remove(existing);
  }

  // Create entity
  const entity = new KycVerificationWorkflowEntity();
  entity.identity_provider  = KycIdentityProviders.BUSINESS_KYB;
  entity.client             = client;
  entity.client_app_user_id = payload.cac;

  try {
    await AppDataSource.manager.save(entity);
    logger.info(`[initializeKyb] entity saved — id=${entity.id}`);
  } catch (dbErr: any) {
    // M-54: generic client-facing error; DB details stay in logs.
    logger.error(`[initializeKyb] DB save failed: ${dbErr.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to save KYB verification record.", "KYB-500-01", "verification-service");
  }

  // Build URL — verification-ui reads kyb_verification_id to render KybFlow
  const url = `${readEnv("KYC_FLOW_BASE_URL")}?kyb_verification_id=${entity.id}&metadata=${encodeURIComponent(
    JSON.stringify({ ...payload.metadata, is_business: true }),
  )}`;

  logger.info(`[initializeKyb] URL — ${url}`);

  // Determine callback URL: prefer client-registered URL, fall back to env-configured KYB_CALLBACK_URL
  const callBackUrl = client.callback_url
    || readEnv("KYB_CALLBACK_URL")
    || undefined;

  logger.info(`[initializeKyb] callBackUrl=${callBackUrl ?? "none"}`);

  // Start daemon workflow
  try {
    await workflowRunner(businessKybWorkflow, {
      args: {
        id:           entity.id,
        businessName: payload.business_name,
        cac:          payload.cac,
        tin:          payload.tin,
        callBackUrl,
        metadata:     payload.metadata as Record<string, unknown> | undefined,
      },
      workflowId:          `init-business_kyb-kyb-${entity.id}`,
      defaultErrorMessage: "Failed to initialize KYB workflow.",
      isDaemon:            true,
    } as any);
    logger.info(`[initializeKyb] workflow started — id=${entity.id}`);
  } catch (wfErr: any) {
    await AppDataSource.manager.remove(entity);
    logger.error(`[initializeKyb] workflow start failed: ${wfErr.message}`);
    throw wfErr;
  }

  return res.status(httpStatus.CREATED).json({ id: entity.id, url });
});
