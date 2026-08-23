/**
 * Canonical contract module for the KYC verification workflows.
 *
 * The concrete Temporal workflow implementations live in the sibling modules
 * (defaultKycWorkflow.ts, kycWorkflow.ts, shieldKycWorkflow.ts,
 * livenessKycWorkflow.ts) and are wired into the worker via
 * workflows/index.ts (see setup/setupTemporalWorker.ts). This module defines
 * the shared result contract that those workflows produce and that the
 * sendWebhook activity serializes into the client callback payload.
 *
 * It is intentionally type-only: activities (e.g. activities/sendWebhook.ts)
 * import this contract without pulling @temporalio/workflow runtime code (or
 * the workflow<->activity dependency cycle) into the activity process.
 */
import type { IVerifyDataResult, IVerifyFaceResult } from "../types/verification";

/**
 * Result of a KYC verification workflow run, as delivered to the client's
 * callback URL by the sendWebhook activity.
 *
 * The verification sub-results are produced by the workflow implementations;
 * status/decision/workflowRuntimeData are optional orchestrator-facing fields
 * that a caller may attach before delivery.
 */
export interface KycWorkflowResult {
  id: string;
  status?: string;
  decision?: string;
  workflowRuntimeData?: unknown;
  faceVerificationResult?: IVerifyFaceResult;
  dataVerificationResult?: IVerifyDataResult;
  documentVerificationResult?: unknown;
  score?: number;
  metadata?: any;
}

export type { KycWorkflowArgs } from "../types/workflow";
