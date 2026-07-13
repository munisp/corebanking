import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "../activities";
import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";

export async function setupTemporalWorker() {
  const temporalAddress = readEnv("TEMPORAL_ADDRESS");
  const temporalNamespace = readEnv("TEMPORAL_NAMESPACE");
  const temporalTaskQueue = readEnv("TEMPORAL_TASK_QUEUE");

  logger.info(`[setupTemporalWorker] Initializing Temporal worker`, {
    address: temporalAddress,
    namespace: temporalNamespace,
    taskQueue: temporalTaskQueue,
  });

  try {
    const connection = await NativeConnection.connect({
      address: temporalAddress,
    });

    logger.info(`[setupTemporalWorker] Connected to Temporal server`);

    const worker = await Worker.create({
      workflowsPath: require.resolve("../workflows"),
      activities,
      namespace: temporalNamespace,
      taskQueue: temporalTaskQueue,
      connection,
    });

    logger.info(`[setupTemporalWorker] Worker created successfully, starting...`);
    
    // NOTE: worker.run() is a blocking call that never returns during normal operation
    // It continuously polls for tasks. Errors are logged by the worker internally.
    await worker.run();
    
    // This line is unreachable unless the worker shuts down or errors
    logger.info(`[setupTemporalWorker] Worker stopped`);
  } catch (e: any) {
    logger.error(
      "[setupTemporalWorker] Failed to start Temporal worker",
      {
        address: temporalAddress,
        namespace: temporalNamespace,
        taskQueue: temporalTaskQueue,
        error: e?.message,
        code: e?.code,
        details: e?.details,
        stack: e?.stack,
      }
    );
    throw e;
  }
}

export function stopTemporalWorker(worker?: Worker) {
  worker && worker.shutdown();
}
