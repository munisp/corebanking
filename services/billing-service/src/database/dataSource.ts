import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import { readEnv } from "../config/readEnv.config";

const DB_HOSTNAME = readEnv("DB_HOST", "localhost") as string;
const PORT = Number(readEnv("DB_PORT", 5432));
const DB_USERNAME = readEnv("DB_USERNAME", "postgres") as string;
const DB_PASSWORD = readEnv("DB_PASSWORD", "") as string;
const DB_DATABASE = readEnv("DB_DATABASE", "link_core_banking") as string;
const DB_SCHEMA = readEnv("DB_SCHEMA", "billing") as string;
const DB_SSL = (readEnv("DB_SSL", "false") as string) === "true";
const NODE_ENV = readEnv("NODE_ENV", "development") as string;

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
  host: DB_HOSTNAME,
  port: PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  schema: DB_SCHEMA,
  synchronize: true,
  logging: NODE_ENV === "development",
  entities: [path.join(__dirname, "../models/*.{js,ts}")],
  migrations: [path.join(__dirname, "migrations/*.{js,ts}")],
  subscribers: [],
  ssl: DB_SSL ? { rejectUnauthorized: !ALLOW_INSECURE_TLS } : undefined,
});
