/**
 * TigerBeetle ↔ Postgres Sync — Full Integration Layer
 *
 * 1. Sync Service (Go :8263) — event-driven sync via Kafka CDC
 * 2. Reconciliation Engine (Rust :8264) — automated EOD/intraday balance checks
 * 3. Balance Cache Layer (Go :8265) — Redis-backed sub-ms reads
 * 4. Dual-Write Prevention / Saga Coordinator (Python :8266) — saga pattern, compensating txns
 */

// ── 1. TigerBeetle Sync Service ──

interface SyncEvent {
  id: string;
  direction: "tb_to_pg" | "pg_to_tb";
  eventType: string;
  sourceEntity: string;
  targetEntity: string;
  status: "synced" | "pending" | "failed" | "retrying";
  kafkaTopic: string;
  kafkaOffset: number;
  payload: Record<string, unknown>;
  retryCount: number;
  latencyMs: number;
  createdAt: string;
  syncedAt: string | null;
}

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
  status: "active" | "paused" | "error";
  eventsProcessed: number;
  lastProcessedAt: string;
  description: string;
}

const syncConfigs: SyncConfig[] = [
  { id: "SYNC-001", name: "Account Balances → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 1, postgresTable: "account_balances", kafkaTopic: "tb.transfers.committed", consumerGroup: "tb-pg-sync-balances", batchSize: 500, flushIntervalMs: 1000, idempotencyKey: "transfer_id", status: "active", eventsProcessed: 45200000, lastProcessedAt: new Date().toISOString(), description: "Sync TigerBeetle committed transfers to Postgres account_balances shadow table" },
  { id: "SYNC-002", name: "New Accounts → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 1, postgresTable: "accounts", kafkaTopic: "cdc.core-banking.accounts", consumerGroup: "pg-tb-sync-accounts", batchSize: 100, flushIntervalMs: 500, idempotencyKey: "account_id", status: "active", eventsProcessed: 2800000, lastProcessedAt: new Date().toISOString(), description: "Create TigerBeetle accounts when new accounts opened in Postgres" },
  { id: "SYNC-003", name: "Loan Disbursements → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 2, postgresTable: "loan_disbursements", kafkaTopic: "cdc.lending.disbursements", consumerGroup: "pg-tb-sync-loans", batchSize: 50, flushIntervalMs: 2000, idempotencyKey: "loan_id", status: "active", eventsProcessed: 850000, lastProcessedAt: new Date().toISOString(), description: "Post loan disbursement double-entry in TigerBeetle when loan approved in Postgres" },
  { id: "SYNC-004", name: "GL Postings → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 3, postgresTable: "gl_journal_entries", kafkaTopic: "tb.transfers.gl-postings", consumerGroup: "tb-pg-sync-gl", batchSize: 1000, flushIntervalMs: 500, idempotencyKey: "journal_id", status: "active", eventsProcessed: 32000000, lastProcessedAt: new Date().toISOString(), description: "Mirror GL journal entries from TigerBeetle to Postgres for reporting/queries" },
  { id: "SYNC-005", name: "Fee Charges → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 1, postgresTable: "fee_transactions", kafkaTopic: "cdc.billing.charges", consumerGroup: "pg-tb-sync-fees", batchSize: 200, flushIntervalMs: 1000, idempotencyKey: "fee_txn_id", status: "active", eventsProcessed: 12500000, lastProcessedAt: new Date().toISOString(), description: "Post fee debit/credit entries in TigerBeetle when billing engine charges fees" },
  { id: "SYNC-006", name: "Interest Accrual → TigerBeetle", direction: "pg_to_tb", tigerbeetleLedger: 2, postgresTable: "interest_accruals", kafkaTopic: "cdc.batch-eod.interest", consumerGroup: "pg-tb-sync-interest", batchSize: 5000, flushIntervalMs: 5000, idempotencyKey: "accrual_id", status: "active", eventsProcessed: 180000000, lastProcessedAt: new Date().toISOString(), description: "Daily interest accrual entries posted to TigerBeetle during EOD batch" },
  { id: "SYNC-007", name: "Settlement Entries → Both", direction: "bidirectional", tigerbeetleLedger: 4, postgresTable: "settlement_entries", kafkaTopic: "cdc.settlement.entries", consumerGroup: "settlement-sync", batchSize: 100, flushIntervalMs: 2000, idempotencyKey: "settlement_batch_id", status: "active", eventsProcessed: 4200000, lastProcessedAt: new Date().toISOString(), description: "NIBSS/NIP settlement entries synced bidirectionally for reconciliation" },
  { id: "SYNC-008", name: "FX Position Updates → Postgres", direction: "tb_to_pg", tigerbeetleLedger: 5, postgresTable: "fx_positions", kafkaTopic: "tb.transfers.fx-positions", consumerGroup: "tb-pg-sync-fx", batchSize: 50, flushIntervalMs: 500, idempotencyKey: "position_id", status: "active", eventsProcessed: 3500000, lastProcessedAt: new Date().toISOString(), description: "Real-time FX position updates from TigerBeetle to Postgres treasury dashboard" },
];

const recentSyncEvents: SyncEvent[] = [
  { id: "EVT-001", direction: "tb_to_pg", eventType: "transfer_committed", sourceEntity: "TB:account-1001:transfer-88901", targetEntity: "PG:account_balances:ACC-GTBANK-001", status: "synced", kafkaTopic: "tb.transfers.committed", kafkaOffset: 45200001, payload: { amount: 5000000000, debitAccountId: "ACC-GTBANK-001", creditAccountId: "ACC-FIRSTBANK-002", ledger: 1 }, retryCount: 0, latencyMs: 3, createdAt: new Date().toISOString(), syncedAt: new Date().toISOString() },
  { id: "EVT-002", direction: "pg_to_tb", eventType: "account_created", sourceEntity: "PG:accounts:ACC-ZENITH-NEW-001", targetEntity: "TB:ledger-1:account-new-001", status: "synced", kafkaTopic: "cdc.core-banking.accounts", kafkaOffset: 2800001, payload: { accountId: "ACC-ZENITH-NEW-001", accountType: "savings", currency: "NGN", branchCode: "ZEN-LG-001" }, retryCount: 0, latencyMs: 8, createdAt: new Date().toISOString(), syncedAt: new Date().toISOString() },
  { id: "EVT-003", direction: "pg_to_tb", eventType: "loan_disbursed", sourceEntity: "PG:loan_disbursements:LN-FB-004502", targetEntity: "TB:ledger-2:transfer-ln-004502", status: "synced", kafkaTopic: "cdc.lending.disbursements", kafkaOffset: 850001, payload: { loanId: "LN-FB-004502", amount: 10000000000, debitGL: "GL-1200-LOAN-ASSET", creditGL: "GL-2001-SAVINGS" }, retryCount: 0, latencyMs: 12, createdAt: new Date().toISOString(), syncedAt: new Date().toISOString() },
  { id: "EVT-004", direction: "tb_to_pg", eventType: "gl_posting", sourceEntity: "TB:ledger-3:transfer-gl-33901", targetEntity: "PG:gl_journal_entries:JRN-UBA-33901", status: "synced", kafkaTopic: "tb.transfers.gl-postings", kafkaOffset: 32000001, payload: { journalId: "JRN-UBA-33901", debitAccount: "GL-1001-CASH", creditAccount: "GL-2001-SAVINGS", amount: 225000000000 }, retryCount: 0, latencyMs: 2, createdAt: new Date().toISOString(), syncedAt: new Date().toISOString() },
  { id: "EVT-005", direction: "pg_to_tb", eventType: "interest_accrual", sourceEntity: "PG:interest_accruals:INT-BATCH-20260509", targetEntity: "TB:ledger-2:transfer-int-batch", status: "retrying", kafkaTopic: "cdc.batch-eod.interest", kafkaOffset: 180000001, payload: { batchId: "INT-BATCH-20260509", accounts: 2500000, totalInterest: 45000000000 }, retryCount: 2, latencyMs: 0, createdAt: new Date().toISOString(), syncedAt: null },
];

// ── 2. Reconciliation Engine ──

interface ReconciliationRun {
  id: string;
  type: "eod" | "intraday" | "ad_hoc" | "regulatory";
  scope: string;
  status: "completed" | "running" | "failed" | "mismatches_found";
  tigerbeetleTotal: number;
  postgresTotal: number;
  variance: number;
  variancePct: number;
  accountsChecked: number;
  matchedAccounts: number;
  mismatchedAccounts: number;
  autoCorrections: number;
  manualReviewRequired: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  reportUrl: string;
}

interface ReconciliationRule {
  id: string;
  name: string;
  type: "balance_check" | "transaction_count" | "gl_balance" | "settlement" | "nostro";
  tolerance: number;
  toleranceType: "absolute" | "percentage";
  frequency: string;
  autoCorrect: boolean;
  escalateOnFail: boolean;
  lastRun: string;
  description: string;
}

const reconciliationRuns: ReconciliationRun[] = [
  { id: "RECON-001", type: "eod", scope: "All customer accounts (Ledger 1)", status: "completed", tigerbeetleTotal: 8945200000000000, postgresTotal: 8945200000000000, variance: 0, variancePct: 0, accountsChecked: 2500000, matchedAccounts: 2500000, mismatchedAccounts: 0, autoCorrections: 0, manualReviewRequired: 0, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 2400000).toISOString(), durationMs: 1200000, reportUrl: "/reports/recon/RECON-001.pdf" },
  { id: "RECON-002", type: "eod", scope: "GL accounts (Ledger 3)", status: "completed", tigerbeetleTotal: 125000000000000000, postgresTotal: 125000000000000000, variance: 0, variancePct: 0, accountsChecked: 4500, matchedAccounts: 4500, mismatchedAccounts: 0, autoCorrections: 0, manualReviewRequired: 0, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3300000).toISOString(), durationMs: 300000, reportUrl: "/reports/recon/RECON-002.pdf" },
  { id: "RECON-003", type: "intraday", scope: "High-value accounts (>NGN 1B)", status: "completed", tigerbeetleTotal: 4500000000000000, postgresTotal: 4500000000000000, variance: 0, variancePct: 0, accountsChecked: 850, matchedAccounts: 850, mismatchedAccounts: 0, autoCorrections: 0, manualReviewRequired: 0, startedAt: new Date(Date.now() - 1800000).toISOString(), completedAt: new Date(Date.now() - 1740000).toISOString(), durationMs: 60000, reportUrl: "/reports/recon/RECON-003.pdf" },
  { id: "RECON-004", type: "eod", scope: "Loan portfolio (Ledger 2)", status: "mismatches_found", tigerbeetleTotal: 2350000000000000, postgresTotal: 2350000045000000, variance: 45000000, variancePct: 0.0000019, accountsChecked: 320000, matchedAccounts: 319997, mismatchedAccounts: 3, autoCorrections: 2, manualReviewRequired: 1, startedAt: new Date(Date.now() - 7200000).toISOString(), completedAt: new Date(Date.now() - 5400000).toISOString(), durationMs: 1800000, reportUrl: "/reports/recon/RECON-004.pdf" },
  { id: "RECON-005", type: "regulatory", scope: "CBN statutory reserve verification", status: "completed", tigerbeetleTotal: 450000000000000, postgresTotal: 450000000000000, variance: 0, variancePct: 0, accountsChecked: 12, matchedAccounts: 12, mismatchedAccounts: 0, autoCorrections: 0, manualReviewRequired: 0, startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86100000).toISOString(), durationMs: 300000, reportUrl: "/reports/recon/RECON-005.pdf" },
  { id: "RECON-006", type: "eod", scope: "Settlement accounts (Ledger 4)", status: "completed", tigerbeetleTotal: 89000000000000, postgresTotal: 89000000000000, variance: 0, variancePct: 0, accountsChecked: 240, matchedAccounts: 240, mismatchedAccounts: 0, autoCorrections: 0, manualReviewRequired: 0, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3480000).toISOString(), durationMs: 120000, reportUrl: "/reports/recon/RECON-006.pdf" },
];

const reconciliationRules: ReconciliationRule[] = [
  { id: "RRULE-001", name: "Customer Balance Parity", type: "balance_check", tolerance: 0, toleranceType: "absolute", frequency: "0 22 * * *", autoCorrect: false, escalateOnFail: true, lastRun: new Date().toISOString(), description: "TigerBeetle customer account balance must exactly match Postgres account_balances.available_balance" },
  { id: "RRULE-002", name: "GL Trial Balance Zero-Sum", type: "gl_balance", tolerance: 0, toleranceType: "absolute", frequency: "0 22 * * *", autoCorrect: false, escalateOnFail: true, lastRun: new Date().toISOString(), description: "Sum of all TigerBeetle GL debits must equal sum of all credits (double-entry invariant)" },
  { id: "RRULE-003", name: "Transaction Count Match", type: "transaction_count", tolerance: 0, toleranceType: "absolute", frequency: "0 */4 * * *", autoCorrect: false, escalateOnFail: true, lastRun: new Date().toISOString(), description: "Number of committed transfers in TigerBeetle must match Postgres transaction_log count for the period" },
  { id: "RRULE-004", name: "Settlement Net Position", type: "settlement", tolerance: 100, toleranceType: "absolute", frequency: "0 18 * * *", autoCorrect: true, escalateOnFail: false, lastRun: new Date().toISOString(), description: "NIBSS settlement net position in TigerBeetle must match Postgres settlement_entries within NGN 100 (rounding)" },
  { id: "RRULE-005", name: "Nostro Account Balance", type: "nostro", tolerance: 0.001, toleranceType: "percentage", frequency: "0 */6 * * *", autoCorrect: false, escalateOnFail: true, lastRun: new Date().toISOString(), description: "Nostro/Vostro account balances in TigerBeetle must match Postgres within 0.001% (FX rounding)" },
  { id: "RRULE-006", name: "Loan Portfolio Outstanding", type: "balance_check", tolerance: 0, toleranceType: "absolute", frequency: "0 23 * * *", autoCorrect: false, escalateOnFail: true, lastRun: new Date().toISOString(), description: "Total loan outstanding in TigerBeetle ledger 2 must match Postgres loan_accounts.principal_outstanding" },
];

// ── 3. Balance Cache Layer ──

interface BalanceCacheEntry {
  accountId: string;
  accountName: string;
  availableBalance: number;
  ledgerBalance: number;
  holdAmount: number;
  currency: string;
  lastTransferTimestamp: string;
  cacheHit: boolean;
  cacheTTLSeconds: number;
  sourceOfTruth: "tigerbeetle";
  lastRefreshedAt: string;
  hitRate: number;
}

interface BalanceCacheConfig {
  id: string;
  name: string;
  redisKeyPattern: string;
  ttlSeconds: number;
  invalidationStrategy: string;
  preloadStrategy: string;
  maxCacheSize: number;
  currentSize: number;
  hitRate: number;
  avgReadLatencyUs: number;
  avgWriteLatencyUs: number;
  description: string;
}

const balanceCacheConfigs: BalanceCacheConfig[] = [
  { id: "BCACHE-001", name: "Customer Account Balances", redisKeyPattern: "bal:cust:{accountId}", ttlSeconds: 30, invalidationStrategy: "event_driven_on_transfer", preloadStrategy: "top_10k_accounts_on_startup", maxCacheSize: 5000000, currentSize: 2450000, hitRate: 0.987, avgReadLatencyUs: 85, avgWriteLatencyUs: 120, description: "Hot cache for customer account balances — invalidated on every TigerBeetle transfer event" },
  { id: "BCACHE-002", name: "GL Account Balances", redisKeyPattern: "bal:gl:{glAccountId}", ttlSeconds: 60, invalidationStrategy: "event_driven_on_posting", preloadStrategy: "all_gl_accounts_on_startup", maxCacheSize: 50000, currentSize: 4500, hitRate: 0.995, avgReadLatencyUs: 62, avgWriteLatencyUs: 95, description: "GL account balance cache for real-time trial balance and financial dashboards" },
  { id: "BCACHE-003", name: "Loan Outstanding Balances", redisKeyPattern: "bal:loan:{loanId}", ttlSeconds: 300, invalidationStrategy: "event_driven_on_repayment", preloadStrategy: "active_loans_on_startup", maxCacheSize: 1000000, currentSize: 320000, hitRate: 0.978, avgReadLatencyUs: 90, avgWriteLatencyUs: 130, description: "Loan principal/interest outstanding — longer TTL since repayments are less frequent" },
  { id: "BCACHE-004", name: "FX Position Balances", redisKeyPattern: "bal:fx:{currency}:{desk}", ttlSeconds: 5, invalidationStrategy: "event_driven_on_trade", preloadStrategy: "all_positions_on_startup", maxCacheSize: 1000, currentSize: 45, hitRate: 0.992, avgReadLatencyUs: 45, avgWriteLatencyUs: 78, description: "Ultra-low TTL for FX trading positions — near real-time balance for treasury desk" },
  { id: "BCACHE-005", name: "Settlement Net Positions", redisKeyPattern: "bal:settle:{scheme}:{date}", ttlSeconds: 60, invalidationStrategy: "event_driven_on_settlement", preloadStrategy: "today_settlements_on_startup", maxCacheSize: 10000, currentSize: 240, hitRate: 0.965, avgReadLatencyUs: 72, avgWriteLatencyUs: 110, description: "Settlement scheme net positions for NIP, NEFT, RTGS reconciliation" },
];

const balanceCacheEntries: BalanceCacheEntry[] = [
  { accountId: "ACC-GTBANK-SAV-001", accountName: "GTBank Savings Pool", availableBalance: 125000000000, ledgerBalance: 125500000000, holdAmount: 500000000, currency: "NGN", lastTransferTimestamp: new Date().toISOString(), cacheHit: true, cacheTTLSeconds: 30, sourceOfTruth: "tigerbeetle", lastRefreshedAt: new Date().toISOString(), hitRate: 0.992 },
  { accountId: "ACC-FIRSTBANK-CUR-002", accountName: "FirstBank Current Account Pool", availableBalance: 450000000000, ledgerBalance: 452000000000, holdAmount: 2000000000, currency: "NGN", lastTransferTimestamp: new Date().toISOString(), cacheHit: true, cacheTTLSeconds: 30, sourceOfTruth: "tigerbeetle", lastRefreshedAt: new Date().toISOString(), hitRate: 0.988 },
  { accountId: "GL-1001-CASH-NGN", accountName: "Cash & Balances with CBN", availableBalance: 89000000000000, ledgerBalance: 89000000000000, holdAmount: 0, currency: "NGN", lastTransferTimestamp: new Date().toISOString(), cacheHit: true, cacheTTLSeconds: 60, sourceOfTruth: "tigerbeetle", lastRefreshedAt: new Date().toISOString(), hitRate: 0.997 },
  { accountId: "LN-ZENITH-CORP-001", accountName: "Zenith Corporate Term Loan", availableBalance: 0, ledgerBalance: 8500000000000, holdAmount: 0, currency: "NGN", lastTransferTimestamp: new Date().toISOString(), cacheHit: true, cacheTTLSeconds: 300, sourceOfTruth: "tigerbeetle", lastRefreshedAt: new Date().toISOString(), hitRate: 0.982 },
  { accountId: "FX-USD-TREASURY", accountName: "USD Treasury Position", availableBalance: 25000000000, ledgerBalance: 25000000000, holdAmount: 0, currency: "USD", lastTransferTimestamp: new Date().toISOString(), cacheHit: true, cacheTTLSeconds: 5, sourceOfTruth: "tigerbeetle", lastRefreshedAt: new Date().toISOString(), hitRate: 0.995 },
];

// ── 4. Dual-Write Prevention / Saga Coordinator ──

interface SagaDefinition {
  id: string;
  name: string;
  steps: { order: number; service: string; action: string; compensatingAction: string; timeout: number }[];
  status: "active" | "paused";
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  lastExecuted: string;
  description: string;
}

interface SagaExecution {
  id: string;
  sagaId: string;
  sagaName: string;
  status: "completed" | "compensating" | "failed" | "running";
  currentStep: number;
  totalSteps: number;
  correlationId: string;
  tenantId: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  compensationReason: string | null;
}

const sagaDefinitions: SagaDefinition[] = [
  {
    id: "SAGA-001", name: "Account Opening Saga", status: "active", totalExecutions: 2800000, successRate: 0.9992, avgDurationMs: 450, lastExecuted: new Date().toISOString(),
    description: "Postgres account record → TigerBeetle account creation → Keycloak user → Kafka event. Never writes to both DBs directly.",
    steps: [
      { order: 1, service: "core-banking-go", action: "INSERT INTO accounts", compensatingAction: "DELETE FROM accounts WHERE id = :id", timeout: 5000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "create_account(ledger=1)", compensatingAction: "No-op (TigerBeetle accounts are immutable)", timeout: 3000 },
      { order: 3, service: "keycloak-identity-py", action: "create_user_with_account_role", compensatingAction: "delete_user(:userId)", timeout: 10000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.core-banking.accounts)", compensatingAction: "publish(cdc.core-banking.accounts.rollback)", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-002", name: "Loan Disbursement Saga", status: "active", totalExecutions: 850000, successRate: 0.9988, avgDurationMs: 1200, lastExecuted: new Date().toISOString(),
    description: "Postgres loan record → TigerBeetle debit loan asset + credit customer → GL posting → Kafka event. Two-phase commit pattern.",
    steps: [
      { order: 1, service: "lending-engine-go", action: "UPDATE loans SET status='disbursing'", compensatingAction: "UPDATE loans SET status='approved'", timeout: 5000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=GL-1200, credit=customer)", compensatingAction: "create_transfer(reverse=true)", timeout: 3000 },
      { order: 3, service: "gl-engine-rs", action: "post_journal(debit=loan_asset, credit=savings)", compensatingAction: "reverse_journal(:journalId)", timeout: 5000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.lending.disbursements)", compensatingAction: "publish(cdc.lending.disbursements.rollback)", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-003", name: "NIP Transfer Saga", status: "active", totalExecutions: 45200000, successRate: 0.9997, avgDurationMs: 180, lastExecuted: new Date().toISOString(),
    description: "TigerBeetle debit source → NIBSS API call → TigerBeetle credit destination → Postgres transaction log. TigerBeetle first, always.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=source, pending=true)", compensatingAction: "void_pending_transfer(:transferId)", timeout: 2000 },
      { order: 2, service: "nibss-gateway-go", action: "POST /nip/funds-transfer", compensatingAction: "POST /nip/funds-transfer/reversal", timeout: 30000 },
      { order: 3, service: "tigerbeetle-adapter-rs", action: "post_pending_transfer(:transferId)", compensatingAction: "void_pending_transfer(:transferId)", timeout: 2000 },
      { order: 4, service: "payments-hub-go", action: "INSERT INTO transaction_log", compensatingAction: "UPDATE transaction_log SET status='reversed'", timeout: 5000 },
    ],
  },
  {
    id: "SAGA-004", name: "Fee Charge Saga", status: "active", totalExecutions: 12500000, successRate: 0.9999, avgDurationMs: 95, lastExecuted: new Date().toISOString(),
    description: "TigerBeetle debit customer → credit fee income GL → Postgres fee record → notification. Atomic fee posting.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=customer, credit=fee_income)", compensatingAction: "create_transfer(reverse=true)", timeout: 2000 },
      { order: 2, service: "billing-rating-rs", action: "INSERT INTO fee_transactions", compensatingAction: "DELETE FROM fee_transactions WHERE id = :id", timeout: 3000 },
      { order: 3, service: "kafka-broker-go", action: "publish(cdc.billing.charges)", compensatingAction: "No-op", timeout: 2000 },
    ],
  },
  {
    id: "SAGA-005", name: "EOD Interest Accrual Saga", status: "active", totalExecutions: 365, successRate: 1.0, avgDurationMs: 1800000, lastExecuted: new Date().toISOString(),
    description: "Postgres compute interest → batch TigerBeetle transfers → GL postings → reconciliation. Nightly batch with checkpoint/resume.",
    steps: [
      { order: 1, service: "batch-eod-engine-py", action: "compute_daily_interest(all_accounts)", compensatingAction: "rollback_interest_batch(:batchId)", timeout: 600000 },
      { order: 2, service: "tigerbeetle-adapter-rs", action: "batch_create_transfers(interest_entries)", compensatingAction: "batch_void_transfers(:batchId)", timeout: 600000 },
      { order: 3, service: "gl-engine-rs", action: "batch_post_journals(interest_gl_entries)", compensatingAction: "batch_reverse_journals(:batchId)", timeout: 300000 },
      { order: 4, service: "reconciliation-engine-rs", action: "run_eod_reconciliation", compensatingAction: "flag_for_manual_review", timeout: 300000 },
    ],
  },
  {
    id: "SAGA-006", name: "FX Trade Execution Saga", status: "active", totalExecutions: 3500000, successRate: 0.9994, avgDurationMs: 320, lastExecuted: new Date().toISOString(),
    description: "TigerBeetle debit source currency → credit target currency → Postgres trade record → position update. Atomic FX.",
    steps: [
      { order: 1, service: "tigerbeetle-adapter-rs", action: "create_transfer(debit=source_ccy, credit=target_ccy)", compensatingAction: "create_transfer(reverse=true)", timeout: 2000 },
      { order: 2, service: "fx-rates-engine-rs", action: "INSERT INTO fx_trades", compensatingAction: "UPDATE fx_trades SET status='cancelled'", timeout: 5000 },
      { order: 3, service: "treasury-go", action: "update_position(currency, amount)", compensatingAction: "rollback_position(:positionId)", timeout: 3000 },
      { order: 4, service: "kafka-broker-go", action: "publish(cdc.treasury.trades)", compensatingAction: "No-op", timeout: 2000 },
    ],
  },
];

const recentSagaExecutions: SagaExecution[] = [
  { id: "SEXE-001", sagaId: "SAGA-003", sagaName: "NIP Transfer Saga", status: "completed", currentStep: 4, totalSteps: 4, correlationId: "COR-TXN-88901", tenantId: "TEN-GTBANK", startedAt: new Date(Date.now() - 200).toISOString(), completedAt: new Date().toISOString(), durationMs: 165, compensationReason: null },
  { id: "SEXE-002", sagaId: "SAGA-004", sagaName: "Fee Charge Saga", status: "completed", currentStep: 3, totalSteps: 3, correlationId: "COR-FEE-12501", tenantId: "TEN-FIRSTBANK", startedAt: new Date(Date.now() - 100).toISOString(), completedAt: new Date().toISOString(), durationMs: 88, compensationReason: null },
  { id: "SEXE-003", sagaId: "SAGA-001", sagaName: "Account Opening Saga", status: "completed", currentStep: 4, totalSteps: 4, correlationId: "COR-ACC-28001", tenantId: "TEN-ZENITH", startedAt: new Date(Date.now() - 500).toISOString(), completedAt: new Date().toISOString(), durationMs: 420, compensationReason: null },
  { id: "SEXE-004", sagaId: "SAGA-002", sagaName: "Loan Disbursement Saga", status: "compensating", currentStep: 2, totalSteps: 4, correlationId: "COR-LN-85001", tenantId: "TEN-UBA", startedAt: new Date(Date.now() - 1500).toISOString(), completedAt: null, durationMs: 1450, compensationReason: "TigerBeetle transfer rejected: insufficient_funds on GL-1200-LOAN-ASSET (exceeds single obligor limit)" },
  { id: "SEXE-005", sagaId: "SAGA-005", sagaName: "EOD Interest Accrual Saga", status: "running", currentStep: 2, totalSteps: 4, correlationId: "COR-EOD-20260509", tenantId: "TEN-PLATFORM", startedAt: new Date(Date.now() - 900000).toISOString(), completedAt: null, durationMs: 900000, compensationReason: null },
];

// ── Express Registration ──

export function registerTigerbeetlePostgresSync(app: any) {
  // Sync configs
  app.get("/api/platform/tb-pg-sync/configs", (_req: any, res: any) => {
    res.json({ items: syncConfigs, total: syncConfigs.length });
  });

  app.get("/api/platform/tb-pg-sync/configs/stats", (_req: any, res: any) => {
    const totalEvents = syncConfigs.reduce((s, c) => s + c.eventsProcessed, 0);
    const active = syncConfigs.filter(c => c.status === "active").length;
    res.json({ totalConfigs: syncConfigs.length, active, totalEventsProcessed: totalEvents, directions: { tb_to_pg: 3, pg_to_tb: 4, bidirectional: 1 } });
  });

  // Sync events
  app.get("/api/platform/tb-pg-sync/events", (_req: any, res: any) => {
    res.json({ items: recentSyncEvents, total: recentSyncEvents.length });
  });

  app.get("/api/platform/tb-pg-sync/events/stats", (_req: any, res: any) => {
    const synced = recentSyncEvents.filter(e => e.status === "synced").length;
    const avgLatency = recentSyncEvents.filter(e => e.latencyMs > 0).reduce((s, e) => s + e.latencyMs, 0) / Math.max(synced, 1);
    res.json({ recentEvents: recentSyncEvents.length, synced, pending: recentSyncEvents.filter(e => e.status === "pending").length, failed: recentSyncEvents.filter(e => e.status === "failed").length, retrying: recentSyncEvents.filter(e => e.status === "retrying").length, avgLatencyMs: Math.round(avgLatency * 10) / 10 });
  });

  // Reconciliation runs
  app.get("/api/platform/tb-pg-sync/reconciliation/runs", (_req: any, res: any) => {
    res.json({ items: reconciliationRuns, total: reconciliationRuns.length });
  });

  app.get("/api/platform/tb-pg-sync/reconciliation/runs/stats", (_req: any, res: any) => {
    const completed = reconciliationRuns.filter(r => r.status === "completed").length;
    const totalAccounts = reconciliationRuns.reduce((s, r) => s + r.accountsChecked, 0);
    const totalMismatches = reconciliationRuns.reduce((s, r) => s + r.mismatchedAccounts, 0);
    res.json({ totalRuns: reconciliationRuns.length, completed, withMismatches: reconciliationRuns.filter(r => r.mismatchedAccounts > 0).length, totalAccountsChecked: totalAccounts, totalMismatches, matchRate: ((totalAccounts - totalMismatches) / totalAccounts * 100).toFixed(6) + "%" });
  });

  // Reconciliation rules
  app.get("/api/platform/tb-pg-sync/reconciliation/rules", (_req: any, res: any) => {
    res.json({ items: reconciliationRules, total: reconciliationRules.length });
  });

  // Balance cache configs
  app.get("/api/platform/tb-pg-sync/balance-cache/configs", (_req: any, res: any) => {
    res.json({ items: balanceCacheConfigs, total: balanceCacheConfigs.length });
  });

  app.get("/api/platform/tb-pg-sync/balance-cache/configs/stats", (_req: any, res: any) => {
    const totalSize = balanceCacheConfigs.reduce((s, c) => s + c.currentSize, 0);
    const avgHitRate = balanceCacheConfigs.reduce((s, c) => s + c.hitRate, 0) / balanceCacheConfigs.length;
    const avgReadUs = balanceCacheConfigs.reduce((s, c) => s + c.avgReadLatencyUs, 0) / balanceCacheConfigs.length;
    res.json({ totalCaches: balanceCacheConfigs.length, totalCachedEntries: totalSize, avgHitRate: (avgHitRate * 100).toFixed(1) + "%", avgReadLatencyUs: Math.round(avgReadUs) });
  });

  // Balance cache entries (sample)
  app.get("/api/platform/tb-pg-sync/balance-cache/entries", (_req: any, res: any) => {
    res.json({ items: balanceCacheEntries, total: balanceCacheEntries.length });
  });

  // Saga definitions
  app.get("/api/platform/tb-pg-sync/sagas", (_req: any, res: any) => {
    res.json({ items: sagaDefinitions, total: sagaDefinitions.length });
  });

  app.get("/api/platform/tb-pg-sync/sagas/stats", (_req: any, res: any) => {
    const totalExec = sagaDefinitions.reduce((s, d) => s + d.totalExecutions, 0);
    const weightedSuccess = sagaDefinitions.reduce((s, d) => s + d.successRate * d.totalExecutions, 0) / totalExec;
    res.json({ totalSagas: sagaDefinitions.length, totalExecutions: totalExec, overallSuccessRate: (weightedSuccess * 100).toFixed(2) + "%", active: sagaDefinitions.filter(d => d.status === "active").length });
  });

  // Saga executions (recent)
  app.get("/api/platform/tb-pg-sync/saga-executions", (_req: any, res: any) => {
    res.json({ items: recentSagaExecutions, total: recentSagaExecutions.length });
  });

  app.get("/api/platform/tb-pg-sync/saga-executions/stats", (_req: any, res: any) => {
    const completed = recentSagaExecutions.filter(e => e.status === "completed").length;
    const compensating = recentSagaExecutions.filter(e => e.status === "compensating").length;
    res.json({ recent: recentSagaExecutions.length, completed, compensating, running: recentSagaExecutions.filter(e => e.status === "running").length, failed: recentSagaExecutions.filter(e => e.status === "failed").length });
  });
}
