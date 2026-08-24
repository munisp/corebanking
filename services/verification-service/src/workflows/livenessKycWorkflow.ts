import {
  CancellationScope,
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import * as z from "zod";
import type * as activities from "../activities";
import { KycWorkflowArgs, KycWorkflowResult } from "../types/workflow";
import { VerificationWorkflowStatus } from "../utils/enums";
import { maskIdentifier } from "../utils/piiMask";
import { PostVerifyKycValidationSchema } from "../validations/schemas";

export const process_liveness_verification_event_signal = defineSignal<
  [z.infer<typeof PostVerifyKycValidationSchema>]
>("process_liveness_verification_event_signal");

export const terminate_liveness_verification_workflow_signal = defineSignal<
  [boolean]
>("terminate_liveness_verification_workflow_signal");

/**
 * Liveness-based KYC Workflow
 * Uses liveness detection instead of Shield/Ballerine for KYC verification
 */
export async function livenessKycWorkflow(
  args: KycWorkflowArgs,
): Promise<KycWorkflowResult | void> {
  const {
    defaultVerifyFace,
    defaultVerifyData,
    verifyDocument,
    endKycVerificationWorkflow,
    calculateKycVerificationScore,
    sendWebhook,
  } = proxyActivities<typeof activities>({
    retry: {
      initialInterval: "1s",
      maximumAttempts: 3,
      nonRetryableErrorTypes: ["NonRetriableApplicationError"],
    },
    startToCloseTimeout: "2m",
  });

  // Direct import workaround for validateLivenessProof TypeScript issue
  const validateLivenessProof = proxyActivities<
    typeof import("../activities/validateLivenessProof")
  >({
    retry: {
      initialInterval: "1s",
      maximumAttempts: 3,
      nonRetryableErrorTypes: ["NonRetriableApplicationError"],
    },
    startToCloseTimeout: "2m",
  }).validateLivenessProof;

  // M-52: never log full NIN/UIN — masked (last 3 chars only).
  console.log(`[livenessKycWorkflow] started — id=${args.id} UIN=${maskIdentifier(args.UIN)} callBackUrl=${args.callBackUrl} metadata=${JSON.stringify(args.metadata)}`);

  try {
    let process_liveness_verification_event_signal_payload: z.infer<
      typeof PostVerifyKycValidationSchema
    > | null = null;
    let terminate_workflow = false;
    let has_sent_webhook = false;

    setHandler(process_liveness_verification_event_signal, (input) => {
      console.log(`[livenessKycWorkflow] signal received — hasSelfie=${Boolean((input as any)?.selfie?.image)} hasLivenessProof=${Boolean((input as any)?.livenessProof)} hasDocument=${Boolean((input as any)?.document?.frontImage)}`);
      process_liveness_verification_event_signal_payload = input;
    });

    setHandler(terminate_liveness_verification_workflow_signal, (input) => {
      terminate_workflow = input;
    });

    console.log(`[livenessKycWorkflow] waiting for signal…`);

    // Wait for verification data from UI
    await condition(
      () =>
        Boolean(terminate_workflow) ||
        Boolean(process_liveness_verification_event_signal_payload),
    );

    if (terminate_workflow) {
      console.log(`[livenessKycWorkflow] terminate signal received — cancelling`);
      CancellationScope.current().cancel();
    }

    if (process_liveness_verification_event_signal_payload) {
      const payload: z.infer<typeof PostVerifyKycValidationSchema> =
        process_liveness_verification_event_signal_payload;

      // 01. Validate liveness proof (optional field — skip if absent)
      if (payload.livenessProof) {
        console.log(`[livenessKycWorkflow] step 1: validating liveness proof — confidence=${(payload.livenessProof as any)?.confidence} motion=${(payload.livenessProof as any)?.signals?.motion}`);
        const livenessResult = await validateLivenessProof({
          livenessProof: payload.livenessProof as any,
          sessionId: payload.endUserInfo.id,
        });

        console.log(`[livenessKycWorkflow] liveness result: isValid=${livenessResult.isValid} reason=${livenessResult.reason ?? "n/a"}`);
        if (!livenessResult.isValid) {
          throw new Error(
            "Liveness verification failed: " + livenessResult.reason,
          );
        }
      } else {
        console.log(`[livenessKycWorkflow] step 1: no livenessProof in signal — skipping validation`);
      }

      // 02. Verify document authenticity and extract data (optional)
      let documentVerificationResult = null;
      let extractedUserData = {
        nin:         args.UIN,
        firstName:   args.firstName  || "",
        lastName:    args.lastName   || "",
        dateOfBirth: args.dateOfBirth || "",
        phone:       args.phone,
      };

      if (payload.document?.frontImage && payload.document?.backImage) {
        console.log(`[livenessKycWorkflow] step 2: verifying document — type=${payload.document.type} country=${payload.document.country}`);
        documentVerificationResult = await verifyDocument({
          frontImage:   payload.document.frontImage,
          backImage:    payload.document.backImage,
          documentType: payload.document.type,
          country:      payload.document.country,
        });

        console.log(`[livenessKycWorkflow] document result: isValid=${documentVerificationResult.isValid} confidence=${documentVerificationResult.confidence}`);

        extractedUserData = {
          nin:         documentVerificationResult.extractedData.documentNumber || args.UIN,
          firstName:   documentVerificationResult.extractedData.firstName  || args.firstName  || "",
          lastName:    documentVerificationResult.extractedData.lastName   || args.lastName   || "",
          dateOfBirth: documentVerificationResult.extractedData.dateOfBirth || args.dateOfBirth || "",
          phone:       args.phone,
        };
      } else {
        console.log(`[livenessKycWorkflow] step 2: no document images — using args data (firstName=${extractedUserData.firstName} lastName=${extractedUserData.lastName})`);
      }

      // 03. Verify face from selfie against document (skip if selfie absent)
      let faceVerificationResult = {
        success: false,
        similarity: 0,
        ninData: { nin: "", firstName: "", lastName: "", dateOfBirth: "", phone: "" },
      };
      if (payload.selfie?.image) {
        console.log(`[livenessKycWorkflow] step 3: verifying face (selfie present)`);
        const faceVerificationPayload: any = {
          ...args,
          documents: [{ type: "face" as const, pages: [{ base64: payload.selfie.image }] }],
        };
        faceVerificationResult = await defaultVerifyFace(faceVerificationPayload);
        console.log(`[livenessKycWorkflow] face result: success=${faceVerificationResult.success} similarity=${faceVerificationResult.similarity}`);
      } else {
        console.log(`[livenessKycWorkflow] step 3: no selfie in signal — faceVerification skipped (similarity=0)`);
      }

      // 04. Verify extracted data against user-provided data
      console.log(`[livenessKycWorkflow] step 4: verifying data — extractedUserData=${JSON.stringify(extractedUserData)}`);
      const dataVerificationResult = await defaultVerifyData(args, extractedUserData);
      console.log(`[livenessKycWorkflow] data result: ${JSON.stringify(dataVerificationResult)}`);

      const result: KycWorkflowResult = {
        id:                     args.id,
        faceVerificationResult,
        dataVerificationResult,
        documentVerificationResult,
        metadata:               args.metadata,
      };

      // 05. Calculate verification score
      result.score = await calculateKycVerificationScore(result);
      console.log(`[livenessKycWorkflow] step 5: score=${result.score}`);

      // 06. Send notification webhook to the client
      if (args.callBackUrl) {
        console.log(`[livenessKycWorkflow] step 6: sending webhook → ${args.callBackUrl}`);
        has_sent_webhook = await sendWebhook(args.callBackUrl, result);
        console.log(`[livenessKycWorkflow] webhook sent: ${has_sent_webhook}`);
      } else {
        console.log(`[livenessKycWorkflow] step 6: no callBackUrl — skipping webhook`);
      }

      // 07. End workflow
      await endKycVerificationWorkflow(
        args.UIN,
        VerificationWorkflowStatus.COMPLETED,
        result.score,
        has_sent_webhook,
        args.metadata,
      );
      console.log(`[livenessKycWorkflow] completed — score=${result.score} webhookSent=${has_sent_webhook}`);

      return result;
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[livenessKycWorkflow] ERROR: ${errMsg}`);

    // Send failure webhook to notify the orchestrator
    if (args.callBackUrl) {
      try {
        console.log(`[livenessKycWorkflow] sending failure webhook → ${args.callBackUrl}`);
        const failureResult: KycWorkflowResult = {
          id: args.id,
          faceVerificationResult: {
            success: false,
            similarity: 0,
            ninData: { nin: "", firstName: "", lastName: "", dateOfBirth: "", phone: "" },
          },
          dataVerificationResult: {
            firstName:   false,
            lastName:    false,
            dateOfBirth: false,
            phone:       false,
            UIN:         false,
          },
          documentVerificationResult: null,
          metadata: args.metadata,
          score: 0,
        };
        await sendWebhook(args.callBackUrl, failureResult);
      } catch (webhookError) {
        console.error(`[livenessKycWorkflow] failed to send failure webhook: ${webhookError instanceof Error ? webhookError.message : webhookError}`);
      }
    }

    await CancellationScope.nonCancellable(
      async () =>
        await endKycVerificationWorkflow(args.UIN, VerificationWorkflowStatus.FAILED),
    );
  }
}
