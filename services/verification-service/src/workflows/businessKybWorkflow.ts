import {
  CancellationScope,
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type * as activities from "../activities";
import { VerificationWorkflowStatus } from "../utils/enums";

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface KybDocumentSignalPayload {
  /** The KYC/KYB workflow entity UUID */
  verificationId: string;
  /** Business documents: cac_certificate, tin_certificate */
  businessDocuments: Array<{
    type: "cac_certificate" | "tin_certificate" | "utility_bill" | "memorandum";
    base64: string;
    mimeType?: string;
  }>;
  /** Director's personal ID */
  directorDocument?: {
    type: string;
    base64: string;
    mimeType?: string;
  };
  /** Business info extracted / provided by the UI */
  businessInfo?: {
    businessName?: string;
    cac?: string;
    tin?: string;
    address?: string;
  };
  metadata?: Record<string, unknown>;
}

export const process_business_kyb_signal = defineSignal<[KybDocumentSignalPayload]>(
  "process_business_kyb_signal",
);

export const terminate_business_kyb_signal = defineSignal<[boolean]>(
  "terminate_business_kyb_signal",
);

// ─── Workflow result ──────────────────────────────────────────────────────────

export interface BusinessKybResult {
  id: string;
  score: number;
  verified: boolean;
  documentResults: {
    cac: boolean;
    tin: boolean;
    directorId: boolean;
  };
  metadata?: Record<string, unknown>;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export async function businessKybWorkflow(args: {
  id: string;
  businessName: string;
  cac: string;
  tin: string;
  callBackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<BusinessKybResult | void> {
  const {
    verifyDocument,
    endKycVerificationWorkflow,
    sendWebhook,
  } = proxyActivities<typeof activities>({
    retry: {
      initialInterval: "1s",
      maximumAttempts: 3,
      nonRetryableErrorTypes: ["NonRetriableApplicationError"],
    },
    startToCloseTimeout: "2m",
  });

  console.log(`[businessKybWorkflow] started — id=${args.id} businessName=${args.businessName} cac=${args.cac} tin=${args.tin} callBackUrl=${args.callBackUrl}`);

  let signalPayload: KybDocumentSignalPayload | null = null;
  let terminate = false;

  setHandler(process_business_kyb_signal, (input) => {
    console.log(`[businessKybWorkflow] signal received — docs=${input.businessDocuments?.length ?? 0} hasDirector=${Boolean(input.directorDocument)}`);
    signalPayload = input;
  });

  setHandler(terminate_business_kyb_signal, (input) => {
    terminate = input;
  });

  console.log(`[businessKybWorkflow] waiting for signal…`);
  await condition(() => Boolean(terminate) || Boolean(signalPayload));

  if (terminate) {
    console.log(`[businessKybWorkflow] terminate signal — cancelling`);
    CancellationScope.current().cancel();
    return;
  }

  try {
    const payload = signalPayload!;

    // ── 01. Verify each business document via OCR ─────────────────────────────
    const docResults: Record<string, boolean> = { cac: false, tin: false, directorId: false };

    for (const doc of payload.businessDocuments ?? []) {
      console.log(`[businessKybWorkflow] verifying document type=${doc.type}`);
      try {
        const result = await verifyDocument({
          frontImage: doc.base64,
          backImage:  doc.base64,
          documentType: doc.type,
          country: "NG",
        });
        const passed = result.isValid || result.confidence > 0.4;
        console.log(`[businessKybWorkflow] doc ${doc.type}: isValid=${result.isValid} confidence=${result.confidence} → passed=${passed}`);
        if (doc.type === "cac_certificate") docResults.cac = passed;
        if (doc.type === "tin_certificate") docResults.tin = passed;
      } catch (err: any) {
        console.warn(`[businessKybWorkflow] doc ${doc.type} verification error: ${err.message} — treating as failed`);
      }
    }

    if (payload.directorDocument?.base64) {
      console.log(`[businessKybWorkflow] verifying director document type=${payload.directorDocument.type}`);
      try {
        const result = await verifyDocument({
          frontImage: payload.directorDocument.base64,
          backImage:  payload.directorDocument.base64,
          documentType: payload.directorDocument.type,
          country: "NG",
        });
        docResults.directorId = result.isValid || result.confidence > 0.4;
        console.log(`[businessKybWorkflow] directorId: isValid=${result.isValid} confidence=${result.confidence} → passed=${docResults.directorId}`);
      } catch (err: any) {
        console.warn(`[businessKybWorkflow] director doc verification error: ${err.message}`);
      }
    }

    // ── 02. Calculate KYB score ───────────────────────────────────────────────
    // CAC = 50%, TIN = 30%, Director ID = 20%
    const score = Number(
      ((docResults.cac ? 0.5 : 0) + (docResults.tin ? 0.3 : 0) + (docResults.directorId ? 0.2 : 0)).toFixed(3),
    );
    const verified = score >= 0.5;

    console.log(`[businessKybWorkflow] score=${score} verified=${verified} docResults=${JSON.stringify(docResults)}`);

    const result: BusinessKybResult = {
      id:              args.id,
      score,
      verified,
      documentResults: { cac: docResults.cac, tin: docResults.tin, directorId: docResults.directorId },
      metadata:        { ...args.metadata, ...(payload.metadata ?? {}) },
    };

    // ── 03. Send webhook ──────────────────────────────────────────────────────
    if (args.callBackUrl) {
      console.log(`[businessKybWorkflow] sending webhook → ${args.callBackUrl}`);
      await sendWebhook(args.callBackUrl, {
        id:                     args.id,
        score,
        faceVerificationResult: { success: verified, similarity: score },
        dataVerificationResult: {
          firstName:   true,
          lastName:    true,
          UIN:         docResults.cac,
          phone:       true,
          dateOfBirth: false,
        },
        metadata: result.metadata,
      } as any);
    }

    // ── 04. End workflow ──────────────────────────────────────────────────────
    await endKycVerificationWorkflow(args.cac, VerificationWorkflowStatus.COMPLETED, score, Boolean(args.callBackUrl));
    console.log(`[businessKybWorkflow] completed — score=${score}`);

    return result;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[businessKybWorkflow] ERROR: ${errMsg}`);

    if (args.callBackUrl) {
      try {
        await sendWebhook(args.callBackUrl, {
          id:                     args.id,
          score:                  0,
          faceVerificationResult: { success: false, similarity: 0 },
          dataVerificationResult: { firstName: false, lastName: false, UIN: false, phone: false, dateOfBirth: false },
          metadata: args.metadata,
        } as any);
      } catch (_) { /* ignore */ }
    }

    await CancellationScope.nonCancellable(
      async () => await endKycVerificationWorkflow(args.cac, VerificationWorkflowStatus.FAILED),
    );
  }
}
