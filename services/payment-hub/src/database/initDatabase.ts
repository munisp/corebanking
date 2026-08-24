import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { AppDataSource } from "./dataSource";

export const initializeDatabase = async (): Promise<void> => {
  logger.info("Connecting to database...");
  logger.info(
    `Database target host=${readEnv("DB_HOST", "undefined")} port=${readEnv("DB_PORT", "undefined")} database=${readEnv("DB_DATABASE", "undefined")} schema=${readEnv("DB_SCHEMA", "undefined")} ssl=${readEnv("DB_SSL", "false")}`,
  );

  await AppDataSource.initialize()
    .then(async () => {
      logger.info("Database connection success.");
      const [{ current_database, current_schema }] = (await AppDataSource.query(
        "SELECT current_database(), current_schema()",
      )) as Array<{ current_database: string; current_schema: string }>;
      logger.info(
        `Database session confirmed database=${current_database} schema=${current_schema}`,
      );

      // W7-C-16: the sanctions-blocked alerts table is the durable system of
      // record for blocked sanctions hits. synchronize is false and the
      // TypeORM migrations array is empty, so create it idempotently here —
      // an alert must never depend on an out-of-band migration having run.
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS sanctions_blocked_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id TEXT NOT NULL,
          party TEXT NOT NULL,
          screened_name TEXT NOT NULL,
          customer_id TEXT,
          screening_id TEXT,
          transfer_reference TEXT,
          amount_kobo BIGINT,
          risk_level TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT NOT NULL,
          event_published BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await AppDataSource.query(
        "CREATE INDEX IF NOT EXISTS idx_sanctions_blocked_alerts_tenant ON sanctions_blocked_alerts (tenant_id)",
      );
      await AppDataSource.query(
        "CREATE INDEX IF NOT EXISTS idx_sanctions_blocked_alerts_created ON sanctions_blocked_alerts (created_at DESC)",
      );
      logger.info("sanctions_blocked_alerts table verified.");
    })
    .catch((error: any) => {
      /* istanbul ignore next */
      throw error;
    });
};
