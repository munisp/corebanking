import path from "path";
import { DataSource } from "typeorm";
import { devEnvironment, readEnv } from "../config/readEnv.config";
import { SupportedDatabaseTypes } from "../utils/enums";

const DB_HOST = readEnv("DB_HOST");
const DB_PORT = readEnv("DB_PORT");
const DB_USER = readEnv("DB_USER");
const DB_PASSWORD = readEnv("DB_PASSWORD");
const DB_DATABASE = readEnv("DB_DATABASE");
const DB_DATABASE_TYPE = readEnv("DB_DATABASE_TYPE");

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
  type: DB_DATABASE_TYPE as SupportedDatabaseTypes,
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  synchronize: true,
  logging: false,
  entities: [path.join(__dirname, "../entity/*.{js,ts}")],
  migrations: [path.join(__dirname, "../migration/*.{js,ts}")],
  subscribers: [],
  ssl: devEnvironment()
    ? undefined
    : {
        rejectUnauthorized: !ALLOW_INSECURE_TLS,
      },
});
