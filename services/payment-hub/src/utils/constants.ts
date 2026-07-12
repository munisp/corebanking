import { readEnv } from "../config/readEnv.config";

export const EXTERNAL_DAPR_EVENT_PUBSUB_NAME = readEnv(
  "EXTERNAL_DAPR_EVENT_PUBSUB_NAME",
  "54link-ph-event-pubsub",
) as string;
