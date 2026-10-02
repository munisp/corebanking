import createLogger from "../config/logger.config";
import { extract_name_form_path } from "../utils/helpers";
import { AppDataSource } from "./dataSource";

const logger = createLogger(extract_name_form_path(__filename));

/**
 * MN-13/MN-14: durable tables for sanctions-blocked alerts and processed
 * callback dedup. synchronize is false, so we create them explicitly at
 * startup (expand-only, idempotent DDL).
 */
const COMPLIANCE_DDL = `
CREATE TABLE IF NOT EXISTS sanctions_blocked_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  transfer_id TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  payer_fsp TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  screening_id TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  action TEXT NOT NULL,
  suspense_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  str_filed BOOLEAN NOT NULL DEFAULT false,
  note TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_sanctions_blocked_alerts_transfer
  ON sanctions_blocked_alerts(transfer_id);

CREATE TABLE IF NOT EXISTS processed_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  outcome TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_processed_callbacks_provider_external
  ON processed_callbacks(provider, external_id);
`;

export const initializeDatabase = async (): Promise<void> => {
  logger.info("Connecting to database...");

  await AppDataSource.initialize()
    .then(async () => {
      logger.info("Database connection success.");
    })
    .catch((error: any) => {
      /* istanbul ignore next */
      throw error;
    });

  await AppDataSource.query(COMPLIANCE_DDL)
    .then(() => logger.info("Compliance tables ready (sanctions_blocked_alerts, processed_callbacks)."))
    .catch((error: any) => {
      // Fail-closed: dedup/alert tables are load-bearing for money safety.
      logger.error(`Compliance table init failed: ${JSON.stringify(error)}`);
      throw error;
    });
};
