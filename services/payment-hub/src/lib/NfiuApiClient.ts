import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";
import { AppDataSource } from "../database/dataSource";
import { incCounter } from "../otel/otel";

const nfiuUrl = readEnv("NFIU_SERVICE_URL") as string;

export interface StrRequest {
  customer_id: string;
  customer_name: string;
  customer_type: string;
  customer_bvn?: string;
  reason: string;
  category: string;
  total_amount_kobo: number;
  transaction_count: number;
  period_start: string;
  period_end: string;
  detection_method: string;
  rule_id?: string;
  risk_score: number;
  risk_level: string;
  transaction_ids: string[];
}

/**
 * CP-02 (auto-STR durability): STR filings for sanctions-blocked transfers
 * must never vanish silently. On filing failure the request is persisted to a
 * Postgres outbox table and retried by a background worker; persistent failure
 * escalates to a CRITICAL alert log + metric.
 */
const OUTBOX_DDL = `
CREATE TABLE IF NOT EXISTS nfiu_str_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
const OUTBOX_INDEX_DDL =
  "CREATE INDEX IF NOT EXISTS idx_nfiu_str_outbox_status ON nfiu_str_outbox (status) WHERE status = 'pending'";

const RETRY_INTERVAL_MS = 60_000;

class NfiuApiClient {
  private readonly http: AxiosInstance;
  private outboxReady = false;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.http = axios.create({ baseURL: nfiuUrl, timeout: 15_000 });
  }

  async fileStr(tenantId: string, req: StrRequest): Promise<void> {
    try {
      await this.http.post("/api/strs", req, {
        headers: { "x-tenant-id": tenantId },
      });
    } catch (err) {
      // CP-02: never silently swallow. Persist to the durable outbox for
      // retry, emit a CRITICAL alert, and count the failure.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[NfiuApiClient] CRITICAL: STR filing failed for tenant=${tenantId} customer=${req.customer_id} category=${req.category}: ${message}. Persisting to nfiu_str_outbox for retry.`,
      );
      incCounter("nfiu_str_filing_failures_total", {
        service: "payment-hub",
        tenant_id: tenantId ?? "unknown",
      });
      try {
        await this.persistOutbox(tenantId, req, message);
        this.ensureRetryWorker();
      } catch (outboxErr) {
        // Both the filer AND the outbox are down — this is the worst case and
        // must page someone. The STR data is still in the CRITICAL log above.
        console.error(
          `[NfiuApiClient] CRITICAL: STR outbox persistence ALSO failed for tenant=${tenantId} customer=${req.customer_id}: ${String(outboxErr)}. MANUAL REFILE REQUIRED. Payload: ${JSON.stringify(req)}`,
        );
      }
    }
  }

  private async ensureOutboxTable(): Promise<void> {
    if (this.outboxReady || !AppDataSource.isInitialized) return;
    await AppDataSource.query(OUTBOX_DDL);
    await AppDataSource.query(OUTBOX_INDEX_DDL);
    this.outboxReady = true;
  }

  private async persistOutbox(
    tenantId: string,
    req: StrRequest,
    lastError: string,
  ): Promise<void> {
    if (!AppDataSource.isInitialized) {
      throw new Error("AppDataSource not initialized; cannot persist outbox row");
    }
    await this.ensureOutboxTable();
    await AppDataSource.query(
      `INSERT INTO nfiu_str_outbox (tenant_id, payload, last_error) VALUES ($1, $2, $3)`,
      [tenantId, JSON.stringify(req), lastError],
    );
  }

  private ensureRetryWorker(): void {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(() => {
      void this.retryPending().catch((err) => {
        console.error(`[NfiuApiClient] outbox retry cycle failed: ${String(err)}`);
      });
    }, RETRY_INTERVAL_MS);
    if (typeof this.retryTimer.unref === "function") {
      this.retryTimer.unref();
    }
  }

  private async retryPending(): Promise<void> {
    if (!AppDataSource.isInitialized) return;
    await this.ensureOutboxTable();
    const rows: Array<{ id: string; tenant_id: string; payload: StrRequest; attempts: number; max_attempts: number }> =
      await AppDataSource.query(
        `SELECT id, tenant_id, payload, attempts, max_attempts FROM nfiu_str_outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50`,
      );
    for (const row of rows) {
      try {
        await this.http.post("/api/strs", row.payload, {
          headers: { "x-tenant-id": row.tenant_id },
        });
        await AppDataSource.query(
          `UPDATE nfiu_str_outbox SET status = 'filed', updated_at = now() WHERE id = $1`,
          [row.id],
        );
      } catch (err) {
        const attempts = row.attempts + 1;
        const exhausted = attempts >= row.max_attempts;
        await AppDataSource.query(
          `UPDATE nfiu_str_outbox SET attempts = $2, last_error = $3, status = $4, updated_at = now() WHERE id = $1`,
          [row.id, attempts, err instanceof Error ? err.message : String(err), exhausted ? "exhausted" : "pending"],
        );
        if (exhausted) {
          console.error(
            `[NfiuApiClient] CRITICAL: STR outbox row ${row.id} exhausted ${row.max_attempts} retries (tenant=${row.tenant_id} customer=${row.payload?.customer_id}). MANUAL REFILE REQUIRED.`,
          );
          incCounter("nfiu_str_filing_failures_total", {
            service: "payment-hub",
            tenant_id: row.tenant_id ?? "unknown",
          });
        }
      }
    }
  }
}

export const nfiuApiClient = new NfiuApiClient();
