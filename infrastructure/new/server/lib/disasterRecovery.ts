/**
 * Disaster Recovery / replication status.
 *
 * PL-12: the previous implementation served a fabricated topology (hardcoded
 * Lagos/Abuja/London nodes with fixed lag numbers), fabricated backup records,
 * fabricated failover history, and a /failover-test endpoint that returned
 * 201 "initiated" without doing anything. All of that fiction is deleted.
 *
 * What remains is real:
 *  - GET /api/dr/v1/replicas answers from pg_stat_replication on the primary
 *    (requires DATABASE_URL). With no database configured it returns 503.
 *  - Everything else (backups, failover history, RTO/RPO metrics, failover
 *    drills) has no real data source in this codebase yet and returns an
 *    honest 501 until one is wired (backup inventory should come from the
 *    S3 bucket populated by the db-backup CronJob; failover events from an
 *    operator-run log).
 *
 * Failover itself is MANUAL by design — see k8s/dr/disaster-recovery.yaml
 * (`automatic_failover: false  # Manual trigger required for banking`).
 */
import type { Express, Request, Response } from "express";
import pg from "pg";
import { logger } from "./logger";

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  _pool = new pg.Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 5_000,
    application_name: "54bank-dr-status",
  } as any);
  _pool.on("error", (err: Error) => {
    logger.warn("DR status pool error", { error: String(err) });
    _pool = null;
  });
  return _pool;
}

const NOT_IMPLEMENTED = {
  error: "not_implemented",
  message:
    "No real data source is wired for this endpoint yet. The previous fabricated " +
    "response (hardcoded nodes/records) was removed under PL-12. See the DR " +
    "runbook in k8s/dr/disaster-recovery.yaml and the db-backup CronJob for the " +
    "real backup/failover procedures.",
};

export function registerDisasterRecovery(app: Express) {
  // Real replication topology from pg_stat_replication.
  app.get("/api/dr/v1/replicas", async (_req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        error: "dr_status_unavailable",
        message: "DATABASE_URL is not configured — replication status cannot be queried. No cached or fabricated topology is served.",
      });
    }
    try {
      const result = await pool.query(`
        SELECT application_name AS id,
               client_addr::text AS host,
               state,
               sync_state,
               COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn), 0)::bigint AS lag_bytes,
               COALESCE(EXTRACT(EPOCH FROM (now() - reply_time)), 0) AS lag_seconds
          FROM pg_stat_replication
      `);
      res.json({
        source: "pg_stat_replication",
        primary: "this database (pg_current_wal_lsn)",
        items: result.rows,
        total: result.rows.length,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.warn("DR replica query failed", { error: String(err?.message || err) });
      res.status(503).json({
        error: "dr_status_unavailable",
        message: "pg_stat_replication query failed — replication status unknown.",
      });
    }
  });

  app.get("/api/dr/v1/backups", (_req: Request, res: Response) => {
    res.status(501).json({
      ...NOT_IMPLEMENTED,
      hint: "Backup inventory should be listed from s3://$S3_BUCKET (see k8s/backups/backup-cronjob.yaml).",
    });
  });

  app.get("/api/dr/v1/failovers", (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPLEMENTED);
  });

  app.get("/api/dr/v1/metrics", (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPLEMENTED);
  });

  // No automated failover test exists — failover is manual by policy.
  app.post("/api/dr/v1/failover-test", (_req: Request, res: Response) => {
    res.status(501).json({
      error: "not_implemented",
      message:
        "Failover is a manual, operator-run procedure for this platform " +
        "(automatic_failover: false in k8s/dr/disaster-recovery.yaml). There is " +
        "no automated failover-test to initiate; follow the DR runbook for drills.",
    });
  });

  app.get("/api/dr/v1/stats", (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPLEMENTED);
  });
}
