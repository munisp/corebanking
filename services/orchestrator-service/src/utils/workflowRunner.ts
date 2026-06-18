import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { setupTemporalClient, resetTemporalClient } from "../setup/setupTemporalClient";
import { UnwrapPromise } from "../types";
import { WorkflowOptions } from "../types/workflows";
import { timeoutWorkflow } from "./timeoutWorkflow";

/**
 * Generic Workflow Runner
 * @param {Function} workflowFn - The workflow function to execute.
 * @param {WorkflowOptions<T>} options - Workflow options.
 */
export async function workflowRunner<T, K>(
  workflowFn: (args: T) => Promise<UnwrapPromise<K>>,
  {
    args,
    workflowId,
    withTimeOut,
    timeOutFn,
  }: WorkflowOptions<T>,
): Promise<UnwrapPromise<K>> {
  const client = await setupTemporalClient();
  const taskQueue = readEnv("TEMPORAL_TASK_QUEUE");

  logger.info(`[workflowRunner] Attempting to start workflow`, {
    workflowId,
    taskQueue,
    workflowFunction: workflowFn.name,
    argsKeys: typeof args === 'object' && args !== null ? Object.keys(args) : 'N/A',
  });

  let handle: Awaited<ReturnType<typeof client.start>>;
  try {
    handle = await client.start(workflowFn, {
      args: [args],
      taskQueue,
      workflowId,
    });
    
    logger.info(
      `[workflowRunner] Successfully started workflow ${handle.workflowId} with RunID ${handle.firstExecutionRunId}`,
    );
  } catch (err: any) {
    const errorInfo = {
      message: err?.message || String(err),
      code: err?.code,
      details: err?.details,
      stack: err?.stack,
      taskQueue,
      workflowFunction: workflowFn.name,
      rawError: JSON.stringify(err, null, 2),
      errorType: err?.constructor?.name,
    };
    
    logger.error(
      `[workflowRunner] Failed to start workflow ${workflowId}`,
      errorInfo,
    );
    
    logger.error(`[workflowRunner] Raw error output: ${JSON.stringify(err)}`);
    
    resetTemporalClient();
    throw err;
  }

  if (withTimeOut && timeOutFn) {
    return await timeoutWorkflow(handle.result(), withTimeOut, timeOutFn);
  }

  return await handle.result();
}
