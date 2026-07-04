import * as z from "zod";
import { SupportedDatabaseTypes } from "../utils/enums";

export const EnvSchema = z.object({
  NODE_ENV: z.string(),
  APP_HOST: z.string(),
  APP_PORT: z.coerce.number(),
  LOG_PATH: z.string().optional().default("./logs"),
  LOG_LEVEL: z.string().optional().default("info"),
  LOG_SILENT: z.string().optional().default("false"),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string(),
  DB_DATABASE_TYPE: z.nativeEnum(SupportedDatabaseTypes),
  DAPR_HOST: z.string(),
  DAPR_HTTP_PORT: z.string(),
  // billing-service is bundled in this same pod (not independently Dapr-addressable,
  // since one pod only exposes one Dapr app-id/port) — reached directly over HTTP.
  BILLING_SERVICE_URL: z.string().optional().default("http://localhost:9523"),
});
