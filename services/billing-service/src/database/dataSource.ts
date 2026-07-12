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
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
});
