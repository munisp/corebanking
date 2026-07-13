import { Connection, WorkflowClient } from "@temporalio/client";
import { readEnv } from "../config/readEnv.config";
import logger from "../config/logger.config";

class TemporalClient {
  private static instance: TemporalClient;
  private clientInstance?: WorkflowClient;

  private constructor() {}

  public static async getInstance(): Promise<WorkflowClient> {
    if (!this.instance) {
      this.instance = new TemporalClient();
    }

    if (!this.instance.clientInstance) {
      await this.instance.connect();
    }

    return this.instance.clientInstance!;
  }

  public static reset() {
    if (this.instance) {
      this.instance.clientInstance = undefined;
    }
  }

  private async connect() {
    const temporalAddress = readEnv("TEMPORAL_ADDRESS");
    const temporalNamespace = readEnv("TEMPORAL_NAMESPACE");
    
    logger.info(`[TemporalClient] Attempting to connect`, {
      address: temporalAddress,
      namespace: temporalNamespace,
      connectTimeout: 30000,
    });

    try {
      const connection = await Connection.connect({
        address: temporalAddress,
        connectTimeout: 30000,
        channelArgs: {
          "grpc.keepalive_time_ms": 30000,
          "grpc.keepalive_timeout_ms": 10000,
          "grpc.keepalive_permit_without_calls": 1,
        },
      });

      logger.info(`[TemporalClient] Connected to Temporal server`, {
        address: temporalAddress,
        namespace: temporalNamespace,
      });

      this.clientInstance = new WorkflowClient({
        connection,
        namespace: temporalNamespace,
      });
      
      logger.info(`[TemporalClient] WorkflowClient initialized successfully`);
    } catch (error: any) {
      logger.error(`[TemporalClient] Failed to connect to Temporal server`, {
        address: temporalAddress,
        namespace: temporalNamespace,
        error: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      throw error;
    }
  }
}

export async function setupTemporalClient() {
  return TemporalClient.getInstance();
}

export function resetTemporalClient() {
  TemporalClient.reset();
}
