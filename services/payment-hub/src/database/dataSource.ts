import { DataSource } from "typeorm";
import { readEnv } from "../config/readEnv.config";
import { Tenant } from "../models/Tenant";
import { Transaction } from "../models/Transaction";

const DATABASE_URL = readEnv("DATABASE_URL", "") as string;
const DB_SCHEMA: string = readEnv("DB_SCHEMA", "public") as string;
const STAGE: string = readEnv("NODE_ENV", "development") as string;

// M-50: TLS certificate verification for database connections is ON by default.
// The only opt-out is an explicit development override: ALLOW_INSECURE_TLS=true
// AND non-production. In production the override is ignored (fail closed).
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";
const ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS === "true" && !IS_PRODUCTION;
if (process.env.ALLOW_INSECURE_TLS === "true") {
  console.warn(
    ALLOW_INSECURE_TLS
      ? "[TLS] ALLOW_INSECURE_TLS=true — database TLS certificate verification DISABLED (non-production override). NEVER use in production."
      : "[TLS] ALLOW_INSECURE_TLS=true IGNORED in production — database TLS certificate verification remains ENABLED."
  );
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: DATABASE_URL,
  schema: DB_SCHEMA,
  synchronize: false,
  logging: STAGE === "development",
  entities: [Tenant, Transaction],
  migrations: [],
  subscribers: [],
  ssl: { rejectUnauthorized: !ALLOW_INSECURE_TLS },
});
