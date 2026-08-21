/**
 * TigerBeetle ↔ Postgres Sync — Integration Layer Gateway
 *
 * 1. Sync Service (Go, TB_SYNC_SERVICE_URL, default :8263) — event-driven sync via Kafka CDC
 * 2. Reconciliation Engine (Rust, RECON_ENGINE_URL, default :8264) — EOD/intraday balance checks
 * 3. Balance Cache Layer (Go, BALANCE_CACHE_URL, default :8265) — Redis-backed balance reads
 * 4. Saga Coordinator (Python, SAGA_COORDINATOR_URL, default :8266) — dual-write prevention
 *
 * This module contains NO fabricated operational data. Static arrays below are
 * wiring/rule/flow DEFINITIONS only — every live counter, event feed, balance
 * entry, reconciliation run, and saga execution is proxied to the real service
 * and fails fast with 503 `source_unavailable` when that service is down.
 * Reconciliation runs triggered here are persisted/returned with
 * status:"failed", error:"source_unavailable" when sources cannot be reached.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

const TB_SYNC_SERVICE_URL = process.env.TB_SYNC_SERVICE_URL || "http://localhost:8263";
const RECON_ENGINE_URL = process.env.RECON_ENGINE_URL || "http://localhost:8264";
const BALANCE_CACHE_URL = process.env.BALANCE_CACHE_URL || "http://localhost:8265";
const SAGA_COORDINATOR_URL = process.env.SAGA_COORDINATOR_URL || "http://localhost:8266";
const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.TB_PG_SYNC_UPSTREAM_TIMEOUT_MS || "5000", 10);

// ── Static definitions (configuration only — no operational state) ──

interface SyncConfig {
  id: string;
  name: string;
  direction: "tb_to_pg" | "pg_to_tb" | "bidirectional";
  tigerbeetleLedger: number;
  postgresTable: string;
  kafkaTopic: string;
  consumerGroup: string;
  batchSize: number;
  flushIntervalMs: number;
  idempotencyKey: string;
  description: string;
}

const syncConfigs: SyncConfig[] = [
  { id: "SYNC-001", name: "Account Balances → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 1, postgresTable: "account_balances", kafkaTopic: "tb.transfers.committed", consumerGroup: "tb-pg-sync-balances", batchSize: 500, flushIntervalMs: 1000, idempotencyKey: "transfer_id", description: "Sync TigerBeetle committed transfers to Postgres account_balances shadow table" },
  { id: "SYNC-002", name: "New Accounts → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 1, postgresTable: "accounts", kafkaTopic: "cdc.core-banking.accounts", consumerGroup: "pg-tb-sync-accounts", batchSize: 100, flushIntervalMs: 500, idempotencyKey: "account_id", description: "Create TigerBeetle accounts when new accounts opened in Postgres" },
  { id: "SYNC-003", name: "Loan Disbursements → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 2, postgresTable: "loan_disbursements", kafkaTopic: "cdc.lending.disbursements", consumerGroup: "pg-tb-sync-loans", batchSize: 50, flushIntervalMs: 2000, idempotencyKey: "loan_id", description: "Post loan disbursement double-entry in TigerBeetle when loan approved in Postgres" },
  { id: "SYNC-004", name: "GL Postings → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 3, postgresTable: "gl_journal_entries", kafkaTopic: "tb.transfers.gl-postings", consumerGroup: "tb-pg-sync-gl", batchSize: 1000, flushIntervalMs: 500, idempotencyKey: "journal_id", description: "Mirror GL journal entries from TigerBeetle to Postgres for reporting/queries" },
  { id: "SYNC-005", name: "Fee Charges → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 1, postgresTable: "fee_transactions", kafkaTopic: "cdc.billing.charges", consumerGroup: "pg-tb-sync-fees", batchSize: 200, flushIntervalMs: 1000, idempotencyKey: "fee_txn_id", description: "Post fee debit/credit entries in TigerBeetle when billing engine charges fees" },
  { id: "SYNC-006", name: "Interest Accrual → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 2, postgresTable: "interest_accruals", kafkaTopic: "cdc.batch-eod.interest", consumerGroup: "pg-tb-sync-interest", batchSize: 5000, flushIntervalMs: 5000, idempotencyKey: "accrual_id", description: "Daily interest accrual entries posted to TigerBeetle during EOD batch" },
  { id: "SYNC-007", name: "Settlement Entries → Both", direction: "bidirectional", tigerbeetleLedger: 4, postgresTable: "settlement_entries", kafkaTopic: "cdc.settlement.entries", consumerGroup: "settlement-sync", batchSize: 100, flushIntervalMs: 2000, idempotencyKey: "settlement_batch_id", description: "NIBSS/NIP settlement entries synced bidirectionally for reconciliation" },
  { id: "SYNC-008", name: "FX Position Updates → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 5, postgresTable: "fx_positions", kafkaTopic: "tb.transfers.fx-positions", consumerGroup: "tb-pg-sync-fx", batchSize: 50, flushIntervalMs: 500, idempotencyKey: "position_id", description: "Real-time FX position updates from TigerBeetle to Postgres treasury dashboard" },
];

interface ReconciliationRule {
  id: string;
  name: string;
  type: "balance_check" | "transaction_count" | "gl_balance" | "settlement" | "nostro";
  tolerance: number;
  toleranceType: "absolute" | "percentage";
  frequency: string;
  autoCorrect: boolean;
  escalateOnFail: boolean;
  description: string;
}

const reconciliationRules: ReconciliationRule[] = [
  { id: "RRULE-001", name: "Customer Balance Parity", type: "balance_check", tolerance: 0, toleranceType: "absolute", frequency: "0 22 * * *", autoCorrect: false, escalateOnFail: true, description: "TigerBeetle customer account balance must exactly match Postgres account_balances.available_balance" },
  { id: "RRULE-002", name: "GL Trial Balance Zero-Sum", type: "gl_balance", tolerance: 0, toleranceType: "absolute", frequency: "0 22 * * *", autoCorrect: false, escalateOnFail: true, description: "Sum of all TigerBeetle GL debits must equal sum of all credits (double-entry invariant)" },
  { id: "RRULE-003", name: "Transaction Count Match", type: "transaction_count", tolerance: 0, toleranceType: "absolute", frequency: "0 */4 * * *", autoCorrect: false, escalateOnFail: true, description: "Number of committed transfers in TigerBeetle must match Postgres transaction_log count for the period" },
  { id: "RRULE-004", name: "Settlement Net Position", type: "settlement", tolerance: 100, toleranceType: "absolute", frequency: "0 18 * * *", autoCorrect: true, escalateOnFail: false, description: "NIBSS settlement net position in TigerBeetle must match Postgres settlement_entries within NGN 100 (rounding)" },
  { id: "RRULE-005", name: "Nostro Account Balance", type: "nostro", tolerance: 0.001, toleranceType: "percentage", frequency: "0 */6 * * *", autoCorrect: false, escalateOnFail: true, description: "Nostro/Vostro account balances in TigerBeetle must match Postgres within 0.001% (FX rounding)" },
  { id: "RRULE-006", name: "Loan Portfolio Outstanding", type: "balance_check", tolerance: 0, toleranceType: "absolute", frequency: "0 23 * * *", autoCorrect: false, escalateOnFail: true, description: "Total loan outstanding in TigerBeetle ledger 2 must match Postgres loan_accounts.principal_outstanding" },
];

interface BalanceCacheConfig {
  id: string;
  name: string;
  redisKeyPattern: string;
  ttlSeconds: number;
  invalidationStrategy: string;
  preloadStrategy: string;
  maxCacheSize: number;
  description: string;
}

const balanceCacheConfigs: BalanceCacheConfig[] = [
  { id: "BCACHE-001", name: "Customer Account Balances", redisKeyPattern: "bal:cust:{accountId}", ttlSeconds: 30, invalidationStrategy: "event_driven_on_transfer", preloadStrategy: "top_10k_accounts_on_startup", maxCacheSize: 5000000, description: "Hot cache for customer account balances — invalidated on every TigerBeetle transfer event" },
  { id: "BCACHE-002", name: "GL Account Balances", redisKeyPattern: "bal:gl:{glAccountId}", ttlSeconds: 60, invalidationStrategy: "event_driven_on_posting", preloadStrategy: "all_gl_accounts_on_startup", maxCacheSize: 50000, description: "GL account balance cache for real-time trial balance and financial dashboards" },
  { id: "BCACHE-003", name: "Loan Outstanding Balances", redisKeyPattern: "bal:loan:{loanId}", ttlSeconds: 300, invalidationStrategy: "event_driven_on_repayment", preloadStrategy: "active_loans_on_startup", maxCacheSize: 1000000, description: "Loan principal/interest outstanding — longer TTL since repayments are less frequent" },
  { id: "BCACHE-004", name: "FX Position Balances", redisKeyPattern: "bal:fx:{currency}:{desk}", ttlSeconds: 5, invalidationStrategy: "event_driven_on_trade", preloadStrategy: "all_positions_on_startup", maxCacheSize: 1000, description: "Ultra-low TTL for FX trading positions — near real-time balance for treasury desk" },
  { id: "BCACHE-005", name: "Settlement Net Positions", redisKeyPattern: "bal:settle:{scheme}:{date}", ttlSeconds: 60, invalidationStrategy: "event_driven_on_settlement", preloadStrategy: "today_settlements_on_startup", maxCacheSize: 10000, description: "Settlement scheme net positions for NIP, NEFT, RTGS reconciliation" },
];

interface SagaDefinition {
  id: string;
  name: string;
  description: string;
  steps: { order: number; service: string; action: string; compensatingAction: string; timeout: number }[];
}

const sagaDefinitions: SagaDefinition[] = [
  {
    id: "SAGA-001", name: "Account Opening Saga",
    description: "Postgres account record → TigerBeetle account creation → Keycloak user → Kafka event. Never writes to both DBs directly.",
    steps: [
      { order: 1, service: "core-banking-go", action: "INSERT INTO accounts", compensatingAction: "DELETE FROM accounts WHERE id = :id", timeout: 5000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "create_account(ledger=1)", compensatingAction: "No-op (TigerBeetle accounts are immutable)", timeout: 3000 },
      { order: 3, service: "keycloak-identity-py", action: "create_user_with_account_role", compensatingAction: "delete_user(:userId)", timeout: 10000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.core-banking.accounts)", compensatingAction: "publish(cdc.core-banking.accounts.rollback)", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-002", name: "Loan Disbursement Saga",
    description: "Postgres loan record → TigerBeetle debit loan asset + credit customer → GL posting → Kafka event. Two-phase commit pattern.",
    steps: [
      { order: 1, service: "lending-engine-go", action: "UPDATE loans SET status='disbursing'", compensatingAction: "UPDATE loans SET status='approved'", timeout: 5000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=GL-1200, credit=customer)", compensatingAction: "create_transfer(reverse=true)", timeout: 3000 },
      { order: 3, service: "gl-engine-rs", action: "post_journal(debit=loan_asset, credit=savings)", compensatingAction: "reverse_journal(:journalId)", timeout: 5000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.lending.disbursements)", compensatingAction: "publish(cdc.lending.disbursements.rollback)", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-003", name: "NIP Transfer Saga",
    description: "TigerBeetle debit source → NIBSS API call → TigerBeetle credit destination → Postgres transaction log. TigerBeetle first, always.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=source, pending=true)", compensatingAction: "void_pending_transfer(:transferId)", timeout: 2000 },
      { order: 2, service: "nibss-gateway-go", action: "POST /nip/funds-transfer", compensatingAction: "POST /nip/funds-transfer/reversal", timeout: 30000 },
      { order: 3, service: "tigerbeetle-adapter-rs", action: "post_pending_transfer(:transferId)", compensatingAction: "void_pending_transfer(:transferId)", timeout: 2000 },
      { order: 4, service: "payments-hub-go", action: "INSERT INTO transaction_log", compensatingAction: "UPDATE transaction_log SET status='reversed'", timeout: 5000 },
    ],
  },
  {
    id: "SAGA-004", name: "Fee Charge Saga",
    description: "TigerBeetle debit customer → credit fee income GL → Postgres fee record → notification. Atomic fee posting.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=customer, credit=fee_income)", compensatingAction: "create_transfer(reverse=true)", timeout: 2000 },
      { order: 2, service: "billing-rating-rs", action: "INSERT INTO fee_transactions", compensatingAction: "DELETE FROM fee_transactions WHERE id = :id", timeout: 3000 },
      { order: 3, service: "kafka-broker-go", action: "publish(cdc.billing.charges)", compensatingAction: "No-op", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-005", name: "EOD Interest Accrual Saga",
    description: "Postgres compute interest → batch TigerBeetle transfers → GL postings → reconciliation. Nightly batch with checkpoint/resume.",
    steps: [
      { order: 1, service: "batch-eod-engine-py", action: "compute_daily_interest(all_accounts)", compensatingAction: "rollback_interest_batch(:batchId)", timeout: 600000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "batch_create_transfers(interest_entries)", compensatingAction: "batch_void_transfers(:batchId)", timeout: 600000 },
      { order: 3, service: "gl-engine-rs", action: "batch_post_journals(interest_gl_entries)", compensatingAction: "batch_reverse_journals(:batchId)", timeout: 300000 },
      { order: 4, service: "reconciliation-engine-rs", action: "run_eod_reconciliation", compensatingAction: "flag_for_manual_review", timeout: 300000 },
    ],
  },
  {
    id: "SAGA-006", name: "FX Trade Execution Saga",
    description: "TigerBeetle debit source currency → credit target currency → Postgres trade record → position update. Atomic FX.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=source_ccy, credit=target_ccy)", compensatingAction: "create_transfer(reverse=true)", timeout: 2000 },
      { order: 2, service: "fx-rates-engine-rs", action: "INSERT INTO fx_trades", compensatingAction: "UPDATE fx_trades SET status='cancelled'", timeout: 5000 },
      { order: 3, service: "treasury-go", action: "update_position(currency, amount)", compensatingAction: "rollback_position(:positionId)", timeout: 3000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.treasury.trades)", compensatingAction: "No-op", timeout: 2000 },
    ],
  },
];

// ── Live-data proxy helpers (fail fast, never fabricate) ──

function sourceUnavailable(res: any, dependency: string, upstreamPath: string, detail: string) {
  return res.status(503).json({
    error: "source_unavailable",
    dependency,
    message: `${dependency} is unavailable; refusing to serve fabricated data`,
    upstream: upstreamPath,
    detail,
  });
}

async function proxyGet(res: any, baseUrl: string, upstreamPath: string, dependency: string) {
  try {
    const upstream = await fetch(`${baseUrl}${upstreamPath}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (error) {
    logger.error(`${dependency} unreachable`, { upstreamPath, error: String(error) });
    sourceUnavailable(res, dependency, upstreamPath, String(error));
  }
}

/** Best-effort persistence of a reconciliation run record; never blocks the response. */
async function persistRunRecord(record: Record<string, unknown>) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO tb_pg_reconciliation_runs (id, type, scope, status, error, detail, started_at, completed_at)
      VALUES (${record.id}, ${record.type}, ${record.scope}, ${record.status}, ${record.error ?? null}, ${record.detail ?? null}, ${record.startedAt}, ${record.completedAt ?? null})
    `);
  } catch (error) {
    logger.warn("Unable to persist reconciliation run record", { error: String(error) });
  }
}

// ── Express Registration ──

export function registerTigerbeetlePostgresSync(app: any) {
  // Sync wiring definitions (static config; live counters come from the sync service)
  app.get("/api/platform/tb-pg-sync/configs", (_req: any, res: any) => {
    res.json({
      items: syncConfigs,
      total: syncConfigs.length,
      note: "Wiring definitions only. Live processing counters are served by the sync service via /configs/stats.",
    });
  });

  app.get("/api/platform/tb-pg-sync/configs/stats", (_req: any, res: any) => {
    void proxyGet(res, TB_SYNC_SERVICE_URL, "/v1/sync/stats", "sync-service");
  });

  // Sync events — live feed from the sync service
  app.get("/api/platform/tb-pg-sync/events", (_req: any, res: any) => {
    void proxyGet(res, TB_SYNC_SERVICE_URL, "/v1/sync/events", "sync-service");
  });

  app.get("/api/platform/tb-pg-sync/events/stats", (_req: any, res: any) => {
    void proxyGet(res, TB_SYNC_SERVICE_URL, "/v1/sync/events/stats", "sync-service");
  });

  // Reconciliation runs — real history from the reconciliation engine
  app.get("/api/platform/tb-pg-sync/reconciliation/runs", (_req: any, res: any) => {
    void proxyGet(res, RECON_ENGINE_URL, "/v1/reconciliation/runs", "reconciliation-engine");
  });

  // Trigger a REAL reconciliation run against TigerBeetle + Postgres.
  // If either source is unavailable the run is recorded as failed
  // (status:"failed", error:"source_unavailable") and 503 is returned.
  app.post("/api/platform/tb-pg-sync/reconciliation/runs", async (req: any, res: any) => {
    const startedAt = new Date().toISOString();
    const record = {
      id: `RECON-${Date.now()}`,
      type: typeof req.body?.type === "string" ? req.body.type : "ad_hoc",
      scope: typeof req.body?.scope === "string" ? req.body.scope : "all",
      status: "running",
      startedAt,
    };
    try {
      const upstream = await fetch(`${RECON_ENGINE_URL}/v1/reconciliation/runs`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(req.body ?? {}),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS * 6),
      });
      if (!upstream.ok) {
        throw new Error(`reconciliation engine returned HTTP ${upstream.status}`);
      }
      const body = await upstream.text();
      res.status(upstream.status === 200 ? 201 : upstream.status).type("application/json").send(body);
    } catch (error) {
      const failed = {
        ...record,
        status: "failed",
        error: "source_unavailable",
        detail: String(error),
        completedAt: new Date().toISOString(),
      };
      await persistRunRecord(failed as unknown as Record<string, unknown>);
      logger.error("Reconciliation run failed — source unavailable", { error: String(error) });
      res.status(503).json(failed);
    }
  });

  app.get("/api/platform/tb-pg-sync/reconciliation/runs/stats", (_req: any, res: any) => {
    void proxyGet(res, RECON_ENGINE_URL, "/v1/reconciliation/runs/stats", "reconciliation-engine");
  });

  // Reconciliation rules (static configuration)
  app.get("/api/platform/tb-pg-sync/reconciliation/rules", (_req: any, res: any) => {
    res.json({ items: reconciliationRules, total: reconciliationRules.length });
  });

  // Balance cache configs (static configuration)
  app.get("/api/platform/tb-pg-sync/balance-cache/configs", (_req: any, res: any) => {
    res.json({
      items: balanceCacheConfigs,
      total: balanceCacheConfigs.length,
      note: "Cache definitions only. Live sizes/hit-rates are served by the balance cache service via /configs/stats.",
    });
  });

  app.get("/api/platform/tb-pg-sync/balance-cache/configs/stats", (_req: any, res: any) => {
    void proxyGet(res, BALANCE_CACHE_URL, "/v1/cache/stats", "balance-cache-service");
  });

  // Balance cache entries — live from the balance cache service
  app.get("/api/platform/tb-pg-sync/balance-cache/entries", (_req: any, res: any) => {
    void proxyGet(res, BALANCE_CACHE_URL, "/v1/cache/entries", "balance-cache-service");
  });

  // Saga definitions (static flow definitions)
  app.get("/api/platform/tb-pg-sync/sagas", (_req: any, res: any) => {
    res.json({
      items: sagaDefinitions,
      total: sagaDefinitions.length,
      note: "Flow definitions only. Execution metrics are served by the saga coordinator via /sagas/stats.",
    });
  });

  app.get("/api/platform/tb-pg-sync/sagas/stats", (_req: any, res: any) => {
    void proxyGet(res, SAGA_COORDINATOR_URL, "/v1/sagas/stats", "saga-coordinator");
  });

  // Saga executions — live from the saga coordinator
  app.get("/api/platform/tb-pg-sync/saga-executions", (_req: any, res: any) => {
    void proxyGet(res, SAGA_COORDINATOR_URL, "/v1/sagas/executions", "saga-coordinator");
  });

  app.get("/api/platform/tb-pg-sync/saga-executions/stats", (_req: any, res: any) => {
    void proxyGet(res, SAGA_COORDINATOR_URL, "/v1/sagas/executions/stats", "saga-coordinator");
  });
}
