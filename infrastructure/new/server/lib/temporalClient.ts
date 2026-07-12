/**
 * Temporal Workflow Client — Node.js integration layer
 *
 * Provides workflow execution tracking, saga status queries, and activity log access
 * via the Temporal HTTP API (temporal-ui-server) and direct DB audit logging.
 *
 * Temporal gRPC: temporal:7233
 * Temporal HTTP API: temporal:8233 (via temporal-ui-server)
 *
 * For actual workflow execution, use the Go temporal-worker-go or temporal-sagas-go services.
 * This module provides the BFF (Backend for Frontend) integration layer.
 */

import { db } from "../db";
import {
  temporalWorkflowExecutions,
  temporalActivityLog,
  temporalSagaCompensations,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "./logger";

const TEMPORAL_HOST = process.env.TEMPORAL_HOST || "temporal:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || "54bank";
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || "54bank-banking";
const TEMPORAL_HTTP_URL = process.env.TEMPORAL_HTTP_URL || "http://temporal:8233";

// ── Workflow Types ───────────────────────────────────────────────────────────

export type WorkflowType =
  | "FundTransferWorkflow"
  | "LoanDisbursementWorkflow"
  | "KYCVerificationWorkflow"
  | "FXSettlementWorkflow"
  | "BulkPaymentWorkflow"
  | "AccountOpeningWorkflow"
  | "CardIssuanceWorkflow"
  | "RemittanceWorkflow"
  | "AMLInvestigationWorkflow"
  | "MojalooopTransferWorkflow";

export interface WorkflowStartRequest {
  workflowId: string;
  workflowType: WorkflowType;
  tenantId: string;
  input: Record<string, unknown>;
  taskQueue?: string;
}

export interface WorkflowStatus {
  workflowId: string;
  workflowType: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  result?: Record<string, unknown>;
}

// ── Temporal availability probe ──────────────────────────────────────────────

let temporalAvailable = false;

async function probeTemporalHttp(): Promise<boolean> {
  try {
    const res = await fetch(`${TEMPORAL_HTTP_URL}/api/v1/namespaces`, {
      signal: AbortSignal.timeout(3000),
    });
    temporalAvailable = res.ok;
  } catch {
    temporalAvailable = false;
  }
  return temporalAvailable;
}

probeTemporalHttp();
setInterval(probeTemporalHttp, 60_000);

// ── Workflow Execution Tracking ──────────────────────────────────────────────

/**
 * Record a workflow execution start in the DB.
 * The actual workflow is started by the Go temporal-worker-go service.
 */
export async function recordWorkflowStart(req: WorkflowStartRequest): Promise<void> {
  await db.insert(temporalWorkflowExecutions).values({
    workflowId: req.workflowId,
    workflowType: req.workflowType,
    taskQueue: req.taskQueue ?? TEMPORAL_TASK_QUEUE,
    tenantId: req.tenantId,
    inputPayload: req.input,
    status: "running",
  }).onConflictDoNothing();
}

/**
 * Record a workflow completion in the DB.
 */
export async function recordWorkflowComplete(
  workflowId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await db
    .update(temporalWorkflowExecutions)
    .set({
      status: "completed",
      completedAt: new Date(),
      resultPayload: result,
    })
    .where(eq(temporalWorkflowExecutions.workflowId, workflowId));
}

/**
 * Record a workflow failure in the DB.
 */
export async function recordWorkflowFailed(
  workflowId: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(temporalWorkflowExecutions)
    .set({
      status: "failed",
      completedAt: new Date(),
      errorMessage,
    })
    .where(eq(temporalWorkflowExecutions.workflowId, workflowId));
}

/**
 * Get workflow status from DB.
 */
export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
  const rows = await db
    .select()
    .from(temporalWorkflowExecutions)
    .where(eq(temporalWorkflowExecutions.workflowId, workflowId))
    .limit(1);

  if (!rows.length) return null;
  const row = rows[0];
  return {
    workflowId: row.workflowId,
    workflowType: row.workflowType,
    status: row.status as WorkflowStatus["status"],
    startedAt: row.startedAt ?? new Date(),
    completedAt: row.completedAt ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    result: row.resultPayload as Record<string, unknown> | undefined,
  };
}

/**
 * List recent workflows for a tenant.
 */
export async function listWorkflows(
  tenantId: string,
  limit = 20
): Promise<WorkflowStatus[]> {
  const rows = await db
    .select()
    .from(temporalWorkflowExecutions)
    .where(eq(temporalWorkflowExecutions.tenantId, tenantId))
    .orderBy(desc(temporalWorkflowExecutions.startedAt))
    .limit(limit);

  return rows.map((row) => ({
    workflowId: row.workflowId,
    workflowType: row.workflowType,
    status: row.status as WorkflowStatus["status"],
    startedAt: row.startedAt ?? new Date(),
    completedAt: row.completedAt ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  }));
}

// ── Activity Log ─────────────────────────────────────────────────────────────

/**
 * Log an activity execution.
 */
export async function logActivity(
  workflowId: string,
  activityName: string,
  status: "completed" | "failed" | "retrying",
  payload?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  await db.insert(temporalActivityLog).values({
    workflowId,
    activityName,
    status,
    payload,
    errorMessage,
    completedAt: new Date(),
  });
}

// ── Saga Compensation ────────────────────────────────────────────────────────

/**
 * Register a saga compensation step.
 */
export async function registerSagaCompensation(
  workflowId: string,
  sagaType: string,
  stepName: string,
  compensationActivity: string
): Promise<void> {
  await db.insert(temporalSagaCompensations).values({
    workflowId,
    sagaType,
    stepName,
    compensationActivity,
    status: "pending",
  });
}

/**
 * Mark a saga compensation as executed.
 */
export async function markCompensationExecuted(
  workflowId: string,
  stepName: string
): Promise<void> {
  await db
    .update(temporalSagaCompensations)
    .set({ status: "executed", executedAt: new Date() })
    .where(
      and(
        eq(temporalSagaCompensations.workflowId, workflowId),
        eq(temporalSagaCompensations.stepName, stepName)
      )
    );
}

// ── Temporal HTTP API Proxy ──────────────────────────────────────────────────

/**
 * Query Temporal HTTP API for live workflow status.
 * Falls back to DB if Temporal HTTP is unavailable.
 */
export async function queryTemporalWorkflow(
  workflowId: string
): Promise<Record<string, unknown> | null> {
  if (temporalAvailable) {
    try {
      const url = `${TEMPORAL_HTTP_URL}/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${workflowId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return await res.json() as Record<string, unknown>;
      }
    } catch (err) {
      logger.warn({ err, workflowId }, "Temporal HTTP query failed, using DB fallback");
    }
  }

  // Fallback to DB
  const dbStatus = await getWorkflowStatus(workflowId);
  return dbStatus ? { ...dbStatus, source: "db_fallback" } : null;
}

// ── Temporal Status ──────────────────────────────────────────────────────────

export function getTemporalStatus(): {
  available: boolean;
  host: string;
  namespace: string;
  taskQueue: string;
  httpUrl: string;
} {
  return {
    available: temporalAvailable,
    host: TEMPORAL_HOST,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TEMPORAL_TASK_QUEUE,
    httpUrl: TEMPORAL_HTTP_URL,
  };
}
