import { DataSource } from "typeorm";
import { readEnv } from "../config/readEnv.config";
import { Tenant } from "../models/Tenant";
import { Transaction } from "../models/Transaction";

const DATABASE_URL = readEnv("DATABASE_URL", "") as string;
const DB_SCHEMA: string = readEnv("DB_SCHEMA", "public") as string;
const STAGE: string = readEnv("NODE_ENV", "development") as string;

export const AppDataSource = new DataSource({
  type: "postgres",
  url: DATABASE_URL,
  schema: DB_SCHEMA,
  synchronize: false,
  logging: STAGE === "development",
  entities: [Tenant, Transaction],
  migrations: [],
  subscribers: [],
  ssl: { rejectUnauthorized: false },
});
