/**
 * Deep Lakehouse Integration — Banking Domain Services
 *
 * 1. CDC Event Publishing — every banking domain emits structured events to Kafka → Lakehouse
 * 2. Shared Lakehouse Client — unified API for write/query across Go, Rust, Python services
 * 3. Query Federation — services can read back analytics from lakehouse tables
 * 4. Materialized Views — pre-computed aggregations for dashboards
 * 5. Data Lineage — full dependency graph of which service feeds which table
 */

// ── 1. CDC Event Schemas per Banking Domain ──

interface CDCEvent {
  eventId: string;
  eventType: string;
  domain: string;
  service: string;
  table: string;
  schema: string; // bronze | silver | gold
  kafkaTopic: string;
  partitionKey: string;
  payload: Record<string, unknown>;
  metadata: { tenantId: string; userId: string; correlationId: string; timestamp: string; version: number };
}

interface DomainCDCConfig {
  domain: string;
  services: string[];
  tables: { name: string; schema: string; format: string; partitionCols: string[]; retentionDays: number; description: string }[];
  kafkaTopics: string[];
  eventTypes: string[];
  avgEventsPerDay: number;
  avgPayloadBytes: number;
}

const domainCDCConfigs: DomainCDCConfig[] = [
  {
    domain: "core_banking",
    services: ["core-banking-go", "account-opening-go", "dormancy-check-py"],
    tables: [
      { name: "accounts_cdc", schema: "bronze", format: "delta", partitionCols: ["date", "branch_code"], retentionDays: 2555, description: "Raw CDC events from account lifecycle" },
      { name: "account_events", schema: "silver", format: "delta", partitionCols: ["date", "event_type"], retentionDays: 1825, description: "Cleansed account events with standardized schema" },
      { name: "balance_snapshots", schema: "gold", format: "iceberg", partitionCols: ["snapshot_date", "product_type"], retentionDays: 3650, description: "Daily balance aggregations per account" },
      { name: "customer_360", schema: "gold", format: "iceberg", partitionCols: ["region"], retentionDays: 3650, description: "Unified customer view across all products" },
    ],
    kafkaTopics: ["cdc.core-banking.accounts", "cdc.core-banking.balances", "cdc.core-banking.customers"],
    eventTypes: ["account_opened", "account_closed", "account_frozen", "balance_updated", "customer_updated", "dormancy_flagged"],
    avgEventsPerDay: 125000,
    avgPayloadBytes: 2048,
  },
  {
    domain: "payments",
    services: ["payments-hub-go", "nibss-gateway-go", "settlement-engine-rs", "nip-processor-go"],
    tables: [
      { name: "payments_cdc", schema: "bronze", format: "delta", partitionCols: ["date", "channel"], retentionDays: 2555, description: "Raw payment events from all channels" },
      { name: "nip_transfers", schema: "silver", format: "delta", partitionCols: ["date", "source_bank"], retentionDays: 1825, description: "NIP inter-bank transfers with enriched metadata" },
      { name: "settlement_batches", schema: "silver", format: "delta", partitionCols: ["settlement_date", "scheme"], retentionDays: 3650, description: "Settlement batch records per payment scheme" },
      { name: "payment_corridor_analytics", schema: "gold", format: "iceberg", partitionCols: ["month", "corridor"], retentionDays: 3650, description: "Payment volume by corridor (bank-to-bank, MFB, fintech)" },
    ],
    kafkaTopics: ["cdc.payments.transfers", "cdc.payments.settlements", "cdc.payments.nip"],
    eventTypes: ["transfer_initiated", "transfer_completed", "transfer_failed", "transfer_reversed", "settlement_batch_created", "settlement_completed"],
    avgEventsPerDay: 450000,
    avgPayloadBytes: 1536,
  },
  {
    domain: "lending",
    services: ["lending-engine-go", "loan-recovery-go", "credit-bureau-rs", "loan-origination-go"],
    tables: [
      { name: "loan_events", schema: "bronze", format: "delta", partitionCols: ["date", "product_type"], retentionDays: 3650, description: "Loan lifecycle events: application, approval, disbursement, repayment" },
      { name: "disbursements", schema: "silver", format: "delta", partitionCols: ["disbursement_date", "product_type"], retentionDays: 3650, description: "Loan disbursement records with credit scoring" },
      { name: "repayments", schema: "silver", format: "delta", partitionCols: ["payment_date"], retentionDays: 3650, description: "Repayment transactions with delinquency flags" },
      { name: "portfolio_performance", schema: "gold", format: "iceberg", partitionCols: ["month", "product_type"], retentionDays: 3650, description: "PAR analysis, vintage curves, provisioning (IFRS9 staging)" },
    ],
    kafkaTopics: ["cdc.lending.applications", "cdc.lending.disbursements", "cdc.lending.repayments", "cdc.lending.collections"],
    eventTypes: ["loan_applied", "loan_approved", "loan_rejected", "loan_disbursed", "repayment_received", "loan_default", "recovery_action"],
    avgEventsPerDay: 85000,
    avgPayloadBytes: 3072,
  },
  {
    domain: "treasury",
    services: ["treasury-go", "fx-rates-engine-rs", "money-market-rs", "treasury-liquidity-rs"],
    tables: [
      { name: "fx_trades", schema: "bronze", format: "delta", partitionCols: ["trade_date", "currency_pair"], retentionDays: 3650, description: "FX spot and forward trades" },
      { name: "position_snapshots", schema: "silver", format: "delta", partitionCols: ["snapshot_date", "currency"], retentionDays: 3650, description: "Intraday and EOD position snapshots per currency" },
      { name: "yield_curves", schema: "silver", format: "iceberg", partitionCols: ["curve_date", "currency"], retentionDays: 3650, description: "Government and corporate yield curve data" },
      { name: "treasury_pnl", schema: "gold", format: "iceberg", partitionCols: ["month", "desk"], retentionDays: 3650, description: "P&L attribution by desk, instrument, and risk factor" },
    ],
    kafkaTopics: ["cdc.treasury.trades", "cdc.treasury.positions", "cdc.treasury.rates"],
    eventTypes: ["fx_trade_executed", "position_updated", "rate_published", "yield_curve_updated", "pnl_calculated"],
    avgEventsPerDay: 35000,
    avgPayloadBytes: 4096,
  },
  {
    domain: "gl_accounting",
    services: ["gl-engine-rs", "accounting-rules-rs", "ledger-reconciliation-rs"],
    tables: [
      { name: "journal_entries", schema: "bronze", format: "delta", partitionCols: ["posting_date", "branch_code"], retentionDays: 3650, description: "Raw double-entry journal postings" },
      { name: "trial_balance_snapshots", schema: "silver", format: "delta", partitionCols: ["snapshot_date", "currency"], retentionDays: 3650, description: "Daily trial balance per GL account" },
      { name: "gl_postings_enriched", schema: "silver", format: "delta", partitionCols: ["posting_date", "account_class"], retentionDays: 3650, description: "GL postings with account hierarchy and classification" },
      { name: "financial_statements", schema: "gold", format: "iceberg", partitionCols: ["period", "entity"], retentionDays: 3650, description: "Income statement, balance sheet, cash flow pre-computed" },
    ],
    kafkaTopics: ["cdc.gl.postings", "cdc.gl.trial-balance", "cdc.gl.reconciliation"],
    eventTypes: ["journal_posted", "journal_reversed", "trial_balance_computed", "reconciliation_completed", "period_closed"],
    avgEventsPerDay: 320000,
    avgPayloadBytes: 1024,
  },
  {
    domain: "kyc_aml",
    services: ["kyc-engine-py", "aml-screening-py", "kyb-engine-py", "sanctions-screening-go"],
    tables: [
      { name: "kyc_verifications", schema: "bronze", format: "delta", partitionCols: ["date", "verification_type"], retentionDays: 3650, description: "KYC verification events: BVN, NIN, document, liveness" },
      { name: "aml_alerts", schema: "silver", format: "delta", partitionCols: ["date", "risk_level"], retentionDays: 3650, description: "AML transaction monitoring alerts with disposition" },
      { name: "sanctions_checks", schema: "silver", format: "delta", partitionCols: ["date"], retentionDays: 3650, description: "OFAC, EU, UN, EFCC sanctions screening results" },
      { name: "compliance_risk_scores", schema: "gold", format: "iceberg", partitionCols: ["month", "risk_category"], retentionDays: 3650, description: "Customer risk scores for CDD/EDD tiering" },
    ],
    kafkaTopics: ["cdc.kyc.verifications", "cdc.aml.alerts", "cdc.kyc.sanctions"],
    eventTypes: ["kyc_initiated", "kyc_completed", "kyc_failed", "aml_alert_raised", "aml_alert_cleared", "sanctions_match", "risk_score_updated"],
    avgEventsPerDay: 55000,
    avgPayloadBytes: 2560,
  },
  {
    domain: "fraud",
    services: ["fraud-detection-py", "fraud-detection-rs", "risk-scoring-rs"],
    tables: [
      { name: "fraud_events", schema: "bronze", format: "delta", partitionCols: ["date", "fraud_type"], retentionDays: 3650, description: "Raw fraud detection events and alerts" },
      { name: "transaction_features", schema: "silver", format: "delta", partitionCols: ["date"], retentionDays: 1825, description: "ML feature vectors for transaction scoring" },
      { name: "model_predictions", schema: "silver", format: "delta", partitionCols: ["date", "model_version"], retentionDays: 1825, description: "Model inference results with confidence scores" },
      { name: "fraud_analytics", schema: "gold", format: "iceberg", partitionCols: ["month", "fraud_type"], retentionDays: 3650, description: "Fraud rate trends, false positive analysis, model performance" },
    ],
    kafkaTopics: ["cdc.fraud.events", "cdc.fraud.features", "cdc.fraud.predictions"],
    eventTypes: ["fraud_alert_raised", "fraud_confirmed", "fraud_false_positive", "model_scored", "rule_triggered"],
    avgEventsPerDay: 180000,
    avgPayloadBytes: 4096,
  },
  {
    domain: "cards",
    services: ["card-management-go", "card-issuing-go"],
    tables: [
      { name: "card_events", schema: "bronze", format: "delta", partitionCols: ["date", "card_type"], retentionDays: 2555, description: "Card lifecycle: issuance, activation, block, renewal" },
      { name: "authorization_log", schema: "silver", format: "delta", partitionCols: ["date", "merchant_category"], retentionDays: 1825, description: "Authorization requests with merchant and terminal data" },
      { name: "dispute_cases", schema: "silver", format: "delta", partitionCols: ["date", "dispute_type"], retentionDays: 3650, description: "Chargeback and dispute lifecycle tracking" },
      { name: "interchange_analytics", schema: "gold", format: "iceberg", partitionCols: ["month", "card_network"], retentionDays: 3650, description: "Interchange fee optimization and revenue analysis" },
    ],
    kafkaTopics: ["cdc.cards.events", "cdc.cards.authorizations", "cdc.cards.disputes"],
    eventTypes: ["card_issued", "card_activated", "card_blocked", "authorization_approved", "authorization_declined", "dispute_filed", "chargeback_resolved"],
    avgEventsPerDay: 95000,
    avgPayloadBytes: 1536,
  },
  {
    domain: "trade_finance",
    services: ["trade-finance-go", "iso20022-hub-rs", "swift-gateway-go"],
    tables: [
      { name: "lc_events", schema: "bronze", format: "delta", partitionCols: ["date", "lc_type"], retentionDays: 3650, description: "Letter of credit lifecycle events" },
      { name: "trade_documents", schema: "silver", format: "delta", partitionCols: ["date", "document_type"], retentionDays: 3650, description: "Trade document processing and verification" },
      { name: "swift_messages", schema: "silver", format: "delta", partitionCols: ["date", "message_type"], retentionDays: 3650, description: "SWIFT MT/MX messages with ISO 20022 mapping" },
      { name: "trade_corridor_analytics", schema: "gold", format: "iceberg", partitionCols: ["quarter", "corridor"], retentionDays: 3650, description: "Trade volumes by corridor, commodity, and counterparty" },
    ],
    kafkaTopics: ["cdc.trade.lc-events", "cdc.trade.documents", "cdc.trade.swift"],
    eventTypes: ["lc_issued", "lc_amended", "lc_advising", "document_presented", "swift_sent", "swift_received"],
    avgEventsPerDay: 12000,
    avgPayloadBytes: 8192,
  },
  {
    domain: "regulatory",
    services: ["basel-engine-rs", "ifrs9-engine-rs", "lcr-nsfr-rs", "fatca-crs-rs"],
    tables: [
      { name: "regulatory_submissions", schema: "bronze", format: "delta", partitionCols: ["submission_date", "report_type"], retentionDays: 3650, description: "CBN eFASS, NDIC, Basel III submissions" },
      { name: "capital_adequacy", schema: "silver", format: "iceberg", partitionCols: ["computation_date"], retentionDays: 3650, description: "CAR, Tier 1/2 capital, RWA computations" },
      { name: "liquidity_ratios", schema: "silver", format: "iceberg", partitionCols: ["computation_date"], retentionDays: 3650, description: "LCR, NSFR, liquidity gap analysis" },
      { name: "regulatory_dashboards", schema: "gold", format: "iceberg", partitionCols: ["month", "framework"], retentionDays: 3650, description: "Pre-computed regulatory KPIs for executive dashboards" },
    ],
    kafkaTopics: ["cdc.regulatory.submissions", "cdc.regulatory.computations"],
    eventTypes: ["report_generated", "report_submitted", "capital_computed", "liquidity_computed", "stress_test_completed"],
    avgEventsPerDay: 5000,
    avgPayloadBytes: 16384,
  },
];

// ── 2. Shared Lakehouse Client Config ──

interface LakehouseClient {
  language: string;
  module: string;
  functions: string[];
  config: Record<string, string>;
  description: string;
}

const sharedClients: LakehouseClient[] = [
  {
    language: "Go",
    module: "github.com/54bank/lakehouse-client-go",
    functions: ["PublishCDCEvent(topic, key, event)", "QueryTable(sql, params) → ResultSet", "IngestBatch(table, records)", "GetMaterializedView(viewName) → DataFrame", "TrackLineage(source, target, transform)"],
    config: { LAKEHOUSE_URL: "http://lakehouse-rs:8126", KAFKA_BROKERS: "kafka-broker:9092", SCHEMA_REGISTRY: "http://schema-registry:8081" },
    description: "Go client for all Go banking services (79 services)",
  },
  {
    language: "Rust",
    module: "lakehouse-client-rs",
    functions: ["publish_cdc_event(topic, key, event)", "query_table(sql, params) -> ResultSet", "ingest_batch(table, records)", "get_materialized_view(view_name) -> DataFrame", "track_lineage(source, target, transform)"],
    config: { LAKEHOUSE_URL: "http://lakehouse-rs:8126", KAFKA_BROKERS: "kafka-broker:9092", SCHEMA_REGISTRY: "http://schema-registry:8081" },
    description: "Rust client for all Rust services (52 services)",
  },
  {
    language: "Python",
    module: "lakehouse_client",
    functions: ["publish_cdc_event(topic, key, event)", "query_table(sql, params) -> DataFrame", "ingest_batch(table, records)", "get_materialized_view(view_name) -> DataFrame", "track_lineage(source, target, transform)"],
    config: { LAKEHOUSE_URL: "http://lakehouse-rs:8126", KAFKA_BROKERS: "kafka-broker:9092", SCHEMA_REGISTRY: "http://schema-registry:8081" },
    description: "Python client for all Python services (39 services)",
  },
];

// ── 3. Query Federation ──

interface FederatedQuery {
  id: string;
  name: string;
  sql: string;
  sourceTable: string;
  consumingService: string;
  purpose: string;
  executionFrequency: string;
  avgExecutionMs: number;
  rowsReturned: number;
  lastExecuted: string;
}

const federatedQueries: FederatedQuery[] = [
  { id: "FQ-001", name: "Customer Risk Profile", sql: "SELECT customer_id, risk_score, last_kyc_date, aml_alert_count, fraud_score FROM compliance_risk_scores WHERE risk_category IN ('high', 'pep') ORDER BY risk_score DESC", sourceTable: "compliance_risk_scores", consumingService: "kyc-engine-py", purpose: "CDD/EDD tiering for KYC reviews", executionFrequency: "on-demand", avgExecutionMs: 120, rowsReturned: 2500, lastExecuted: new Date().toISOString() },
  { id: "FQ-002", name: "Transaction Feature Vectors", sql: "SELECT customer_id, feature_vector, label FROM transaction_features WHERE date >= CURRENT_DATE - INTERVAL 90 DAY", sourceTable: "transaction_features", consumingService: "fraud-detection-py", purpose: "ML model training data for fraud detection", executionFrequency: "daily", avgExecutionMs: 3500, rowsReturned: 8000000, lastExecuted: new Date().toISOString() },
  { id: "FQ-003", name: "Portfolio PAR Analysis", sql: "SELECT product_type, vintage_month, par_1_30, par_31_60, par_61_90, par_90_plus, ecl_stage FROM portfolio_performance WHERE month >= '2026-01'", sourceTable: "portfolio_performance", consumingService: "lending-engine-go", purpose: "IFRS9 staging and provisioning calculations", executionFrequency: "monthly", avgExecutionMs: 890, rowsReturned: 4500, lastExecuted: new Date().toISOString() },
  { id: "FQ-004", name: "Settlement Reconciliation", sql: "SELECT settlement_date, scheme, total_amount, txn_count, reconciled, unmatched FROM settlement_batches WHERE settlement_date >= CURRENT_DATE - INTERVAL 7 DAY", sourceTable: "settlement_batches", consumingService: "settlement-engine-rs", purpose: "Daily settlement reconciliation with NIBSS", executionFrequency: "daily", avgExecutionMs: 450, rowsReturned: 350, lastExecuted: new Date().toISOString() },
  { id: "FQ-005", name: "Regulatory Capital Inputs", sql: "SELECT asset_class, rwa, exposure, pd, lgd, ead FROM capital_adequacy WHERE computation_date = (SELECT MAX(computation_date) FROM capital_adequacy)", sourceTable: "capital_adequacy", consumingService: "basel-engine-rs", purpose: "Basel III CAR computation inputs", executionFrequency: "monthly", avgExecutionMs: 280, rowsReturned: 1200, lastExecuted: new Date().toISOString() },
  { id: "FQ-006", name: "FX Position Exposure", sql: "SELECT currency, net_position, open_limit, utilization_pct FROM position_snapshots WHERE snapshot_date = CURRENT_DATE ORDER BY ABS(net_position) DESC", sourceTable: "position_snapshots", consumingService: "treasury-go", purpose: "Intraday position monitoring and limit checks", executionFrequency: "every 15min", avgExecutionMs: 85, rowsReturned: 45, lastExecuted: new Date().toISOString() },
  { id: "FQ-007", name: "Card Fraud Patterns", sql: "SELECT merchant_category, fraud_rate, avg_amount, country FROM interchange_analytics WHERE fraud_rate > 0.005 ORDER BY fraud_rate DESC", sourceTable: "interchange_analytics", consumingService: "card-management-go", purpose: "Merchant risk scoring and BIN blocking rules", executionFrequency: "weekly", avgExecutionMs: 350, rowsReturned: 180, lastExecuted: new Date().toISOString() },
  { id: "FQ-008", name: "Customer 360 Lookup", sql: "SELECT * FROM customer_360 WHERE customer_id = :customer_id", sourceTable: "customer_360", consumingService: "core-banking-go", purpose: "Unified customer view for relationship managers", executionFrequency: "on-demand", avgExecutionMs: 25, rowsReturned: 1, lastExecuted: new Date().toISOString() },
];

// ── 4. Materialized Views ──

interface MaterializedView {
  id: string;
  name: string;
  sourceTable: string;
  targetTable: string;
  refreshSchedule: string;
  lastRefreshed: string;
  rowCount: number;
  sizeBytes: number;
  ttlHours: number;
  consumers: string[];
  sql: string;
  status: string;
}

const materializedViews: MaterializedView[] = [
  { id: "MV-001", name: "daily_transaction_summary", sourceTable: "payments_cdc", targetTable: "mv_daily_txn_summary", refreshSchedule: "0 */1 * * *", lastRefreshed: new Date().toISOString(), rowCount: 365, sizeBytes: 45000, ttlHours: 2, consumers: ["dashboard", "core-banking-go"], sql: "SELECT date, channel, COUNT(*) as txn_count, SUM(amount) as total_volume, AVG(amount) as avg_amount FROM payments_cdc GROUP BY date, channel", status: "active" },
  { id: "MV-002", name: "customer_360_summary", sourceTable: "customer_360", targetTable: "mv_customer_360", refreshSchedule: "0 2 * * *", lastRefreshed: new Date().toISOString(), rowCount: 2500000, sizeBytes: 850000000, ttlHours: 24, consumers: ["core-banking-go", "kyc-engine-py", "fraud-detection-py"], sql: "SELECT customer_id, full_name, region, product_count, total_balance, risk_score, last_txn_date FROM customer_360", status: "active" },
  { id: "MV-003", name: "loan_portfolio_par", sourceTable: "portfolio_performance", targetTable: "mv_loan_par", refreshSchedule: "0 3 1 * *", lastRefreshed: new Date().toISOString(), rowCount: 4500, sizeBytes: 1200000, ttlHours: 720, consumers: ["lending-engine-go", "basel-engine-rs", "ifrs9-engine-rs"], sql: "SELECT product_type, vintage_month, par_1_30, par_31_60, par_61_90, par_90_plus, ecl_stage, provision_amount FROM portfolio_performance", status: "active" },
  { id: "MV-004", name: "fraud_model_performance", sourceTable: "fraud_analytics", targetTable: "mv_fraud_perf", refreshSchedule: "0 6 * * *", lastRefreshed: new Date().toISOString(), rowCount: 120, sizeBytes: 250000, ttlHours: 24, consumers: ["fraud-detection-py", "dashboard"], sql: "SELECT month, model_version, precision, recall, f1_score, auc, false_positive_rate FROM fraud_analytics", status: "active" },
  { id: "MV-005", name: "regulatory_kpi_dashboard", sourceTable: "regulatory_dashboards", targetTable: "mv_regulatory_kpi", refreshSchedule: "0 4 1 * *", lastRefreshed: new Date().toISOString(), rowCount: 240, sizeBytes: 180000, ttlHours: 720, consumers: ["dashboard", "basel-engine-rs", "lcr-nsfr-rs"], sql: "SELECT month, framework, car_ratio, tier1_ratio, lcr, nsfr, leverage_ratio FROM regulatory_dashboards", status: "active" },
  { id: "MV-006", name: "fx_position_realtime", sourceTable: "position_snapshots", targetTable: "mv_fx_positions", refreshSchedule: "*/15 * * * *", lastRefreshed: new Date().toISOString(), rowCount: 45, sizeBytes: 28000, ttlHours: 1, consumers: ["treasury-go", "dashboard"], sql: "SELECT currency, net_position, open_limit, utilization_pct, unrealized_pnl FROM position_snapshots WHERE snapshot_date = CURRENT_DATE", status: "active" },
  { id: "MV-007", name: "settlement_reconciliation", sourceTable: "settlement_batches", targetTable: "mv_settlement_recon", refreshSchedule: "0 18 * * *", lastRefreshed: new Date().toISOString(), rowCount: 2100, sizeBytes: 450000, ttlHours: 24, consumers: ["settlement-engine-rs", "gl-engine-rs"], sql: "SELECT settlement_date, scheme, total_amount, reconciled_amount, unmatched_count, break_amount FROM settlement_batches WHERE settlement_date >= CURRENT_DATE - 30", status: "active" },
  { id: "MV-008", name: "aml_risk_heatmap", sourceTable: "compliance_risk_scores", targetTable: "mv_aml_heatmap", refreshSchedule: "0 5 * * *", lastRefreshed: new Date().toISOString(), rowCount: 85000, sizeBytes: 12000000, ttlHours: 24, consumers: ["aml-screening-py", "kyc-engine-py", "dashboard"], sql: "SELECT region, risk_category, customer_count, avg_risk_score, pep_count, high_risk_pct FROM compliance_risk_scores GROUP BY region, risk_category", status: "active" },
];

// ── 5. Data Lineage ──

interface LineageNode {
  id: string;
  name: string;
  type: "service" | "kafka_topic" | "bronze_table" | "silver_table" | "gold_table" | "materialized_view" | "dashboard";
  domain: string;
  metadata: Record<string, string>;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  transformType: "cdc_publish" | "kafka_consume" | "etl_transform" | "aggregation" | "query_federation" | "mv_refresh" | "dashboard_read";
  description: string;
  frequency: string;
  avgLatencyMs: number;
}

const lineageNodes: LineageNode[] = [
  // Services
  { id: "svc:core-banking-go", name: "Core Banking (Go)", type: "service", domain: "core_banking", metadata: { port: "8101", language: "go" } },
  { id: "svc:payments-hub-go", name: "Payments Hub (Go)", type: "service", domain: "payments", metadata: { port: "8107", language: "go" } },
  { id: "svc:lending-engine-go", name: "Lending Engine (Go)", type: "service", domain: "lending", metadata: { port: "8104", language: "go" } },
  { id: "svc:gl-engine-rs", name: "GL Engine (Rust)", type: "service", domain: "gl_accounting", metadata: { port: "8106", language: "rust" } },
  { id: "svc:kyc-engine-py", name: "KYC Engine (Python)", type: "service", domain: "kyc_aml", metadata: { port: "8112", language: "python" } },
  { id: "svc:fraud-detection-py", name: "Fraud Detection (Python)", type: "service", domain: "fraud", metadata: { port: "8115", language: "python" } },
  { id: "svc:treasury-go", name: "Treasury (Go)", type: "service", domain: "treasury", metadata: { port: "8110", language: "go" } },
  { id: "svc:basel-engine-rs", name: "Basel Engine (Rust)", type: "service", domain: "regulatory", metadata: { port: "8140", language: "rust" } },
  // Kafka topics
  { id: "kafka:cdc.core-banking.accounts", name: "cdc.core-banking.accounts", type: "kafka_topic", domain: "core_banking", metadata: { partitions: "12", replication: "3" } },
  { id: "kafka:cdc.payments.transfers", name: "cdc.payments.transfers", type: "kafka_topic", domain: "payments", metadata: { partitions: "24", replication: "3" } },
  { id: "kafka:cdc.lending.disbursements", name: "cdc.lending.disbursements", type: "kafka_topic", domain: "lending", metadata: { partitions: "6", replication: "3" } },
  { id: "kafka:cdc.gl.postings", name: "cdc.gl.postings", type: "kafka_topic", domain: "gl_accounting", metadata: { partitions: "12", replication: "3" } },
  { id: "kafka:cdc.fraud.events", name: "cdc.fraud.events", type: "kafka_topic", domain: "fraud", metadata: { partitions: "12", replication: "3" } },
  // Bronze tables
  { id: "table:accounts_cdc", name: "accounts_cdc", type: "bronze_table", domain: "core_banking", metadata: { format: "delta", rows: "15M" } },
  { id: "table:payments_cdc", name: "payments_cdc", type: "bronze_table", domain: "payments", metadata: { format: "delta", rows: "45M" } },
  { id: "table:loan_events", name: "loan_events", type: "bronze_table", domain: "lending", metadata: { format: "delta", rows: "8.5M" } },
  { id: "table:journal_entries", name: "journal_entries", type: "bronze_table", domain: "gl_accounting", metadata: { format: "delta", rows: "32M" } },
  { id: "table:fraud_events", name: "fraud_events", type: "bronze_table", domain: "fraud", metadata: { format: "delta", rows: "18M" } },
  // Silver tables
  { id: "table:nip_transfers", name: "nip_transfers", type: "silver_table", domain: "payments", metadata: { format: "delta", rows: "14.8M" } },
  { id: "table:transaction_features", name: "transaction_features", type: "silver_table", domain: "fraud", metadata: { format: "delta", rows: "8M" } },
  { id: "table:capital_adequacy", name: "capital_adequacy", type: "silver_table", domain: "regulatory", metadata: { format: "iceberg", rows: "1.2K" } },
  // Gold tables
  { id: "table:customer_360", name: "customer_360", type: "gold_table", domain: "core_banking", metadata: { format: "iceberg", rows: "2.5M" } },
  { id: "table:portfolio_performance", name: "portfolio_performance", type: "gold_table", domain: "lending", metadata: { format: "iceberg", rows: "4.5K" } },
  { id: "table:fraud_analytics", name: "fraud_analytics", type: "gold_table", domain: "fraud", metadata: { format: "iceberg", rows: "120" } },
  // Materialized views
  { id: "mv:daily_txn_summary", name: "MV: Daily Txn Summary", type: "materialized_view", domain: "payments", metadata: { refresh: "hourly" } },
  { id: "mv:customer_360_summary", name: "MV: Customer 360", type: "materialized_view", domain: "core_banking", metadata: { refresh: "daily" } },
  // Dashboard
  { id: "dash:executive", name: "Executive Dashboard", type: "dashboard", domain: "platform", metadata: { consumers: "5" } },
];

const lineageEdges: LineageEdge[] = [
  // Service → Kafka
  { id: "LE-001", source: "svc:core-banking-go", target: "kafka:cdc.core-banking.accounts", transformType: "cdc_publish", description: "Account lifecycle CDC events", frequency: "real-time", avgLatencyMs: 5 },
  { id: "LE-002", source: "svc:payments-hub-go", target: "kafka:cdc.payments.transfers", transformType: "cdc_publish", description: "Payment transfer CDC events", frequency: "real-time", avgLatencyMs: 3 },
  { id: "LE-003", source: "svc:lending-engine-go", target: "kafka:cdc.lending.disbursements", transformType: "cdc_publish", description: "Loan disbursement CDC events", frequency: "real-time", avgLatencyMs: 8 },
  { id: "LE-004", source: "svc:gl-engine-rs", target: "kafka:cdc.gl.postings", transformType: "cdc_publish", description: "GL journal posting CDC events", frequency: "real-time", avgLatencyMs: 2 },
  { id: "LE-005", source: "svc:fraud-detection-py", target: "kafka:cdc.fraud.events", transformType: "cdc_publish", description: "Fraud detection alert events", frequency: "real-time", avgLatencyMs: 12 },
  // Kafka → Bronze
  { id: "LE-006", source: "kafka:cdc.core-banking.accounts", target: "table:accounts_cdc", transformType: "kafka_consume", description: "Kafka → Bronze ingestion", frequency: "micro-batch 30s", avgLatencyMs: 500 },
  { id: "LE-007", source: "kafka:cdc.payments.transfers", target: "table:payments_cdc", transformType: "kafka_consume", description: "Kafka → Bronze ingestion", frequency: "micro-batch 15s", avgLatencyMs: 300 },
  { id: "LE-008", source: "kafka:cdc.lending.disbursements", target: "table:loan_events", transformType: "kafka_consume", description: "Kafka → Bronze ingestion", frequency: "micro-batch 60s", avgLatencyMs: 800 },
  { id: "LE-009", source: "kafka:cdc.gl.postings", target: "table:journal_entries", transformType: "kafka_consume", description: "Kafka → Bronze ingestion", frequency: "micro-batch 30s", avgLatencyMs: 400 },
  { id: "LE-010", source: "kafka:cdc.fraud.events", target: "table:fraud_events", transformType: "kafka_consume", description: "Kafka → Bronze ingestion", frequency: "micro-batch 10s", avgLatencyMs: 200 },
  // Bronze → Silver
  { id: "LE-011", source: "table:payments_cdc", target: "table:nip_transfers", transformType: "etl_transform", description: "Filter NIP transfers, enrich with bank metadata", frequency: "every 6h", avgLatencyMs: 45000 },
  { id: "LE-012", source: "table:fraud_events", target: "table:transaction_features", transformType: "etl_transform", description: "Feature engineering for ML models", frequency: "daily", avgLatencyMs: 120000 },
  // Silver → Gold
  { id: "LE-013", source: "table:accounts_cdc", target: "table:customer_360", transformType: "aggregation", description: "Customer 360 aggregation from all sources", frequency: "daily 02:00", avgLatencyMs: 180000 },
  { id: "LE-014", source: "table:transaction_features", target: "table:fraud_analytics", transformType: "aggregation", description: "Monthly fraud analytics aggregation", frequency: "monthly", avgLatencyMs: 300000 },
  // Query Federation (Gold → Service)
  { id: "LE-015", source: "table:customer_360", target: "svc:core-banking-go", transformType: "query_federation", description: "Customer 360 lookup for relationship managers", frequency: "on-demand", avgLatencyMs: 25 },
  { id: "LE-016", source: "table:transaction_features", target: "svc:fraud-detection-py", transformType: "query_federation", description: "ML training data for fraud models", frequency: "daily", avgLatencyMs: 3500 },
  { id: "LE-017", source: "table:portfolio_performance", target: "svc:lending-engine-go", transformType: "query_federation", description: "PAR analysis for IFRS9 staging", frequency: "monthly", avgLatencyMs: 890 },
  { id: "LE-018", source: "table:capital_adequacy", target: "svc:basel-engine-rs", transformType: "query_federation", description: "RWA inputs for CAR computation", frequency: "monthly", avgLatencyMs: 280 },
  // MV Refresh
  { id: "LE-019", source: "table:payments_cdc", target: "mv:daily_txn_summary", transformType: "mv_refresh", description: "Hourly txn summary materialized view refresh", frequency: "hourly", avgLatencyMs: 15000 },
  { id: "LE-020", source: "table:customer_360", target: "mv:customer_360_summary", transformType: "mv_refresh", description: "Daily customer 360 MV refresh", frequency: "daily", avgLatencyMs: 120000 },
  // Dashboard
  { id: "LE-021", source: "mv:daily_txn_summary", target: "dash:executive", transformType: "dashboard_read", description: "Executive dashboard reads from MV", frequency: "on-demand", avgLatencyMs: 15 },
  { id: "LE-022", source: "mv:customer_360_summary", target: "dash:executive", transformType: "dashboard_read", description: "Customer metrics on executive dashboard", frequency: "on-demand", avgLatencyMs: 20 },
];

// ── Seeded CDC Events (recent) ──

const recentCDCEvents: CDCEvent[] = [
  { eventId: "CDC-001", eventType: "transfer_completed", domain: "payments", service: "payments-hub-go", table: "payments_cdc", schema: "bronze", kafkaTopic: "cdc.payments.transfers", partitionKey: "TEN-GTBANK", payload: { transferId: "TXN-8801", amount: 5000000000, currency: "NGN", channel: "nip", sourceBank: "058", destBank: "044" }, metadata: { tenantId: "TEN-GTBANK", userId: "USR-5501", correlationId: "COR-9901", timestamp: new Date().toISOString(), version: 1 } },
  { eventId: "CDC-002", eventType: "loan_disbursed", domain: "lending", service: "lending-engine-go", table: "loan_events", schema: "bronze", kafkaTopic: "cdc.lending.disbursements", partitionKey: "TEN-FIRSTBANK", payload: { loanId: "LN-4502", amount: 10000000000, currency: "NGN", product: "corporate_term_loan", tenor: 60 }, metadata: { tenantId: "TEN-FIRSTBANK", userId: "USR-3301", correlationId: "COR-7701", timestamp: new Date().toISOString(), version: 1 } },
  { eventId: "CDC-003", eventType: "journal_posted", domain: "gl_accounting", service: "gl-engine-rs", table: "journal_entries", schema: "bronze", kafkaTopic: "cdc.gl.postings", partitionKey: "TEN-ZENITH", payload: { journalId: "JRN-3301", debitAccount: "1001-0001", creditAccount: "2001-0001", amount: 225000000000, narration: "Interbank placement" }, metadata: { tenantId: "TEN-ZENITH", userId: "USR-2201", correlationId: "COR-5501", timestamp: new Date().toISOString(), version: 1 } },
  { eventId: "CDC-004", eventType: "fraud_alert_raised", domain: "fraud", service: "fraud-detection-py", table: "fraud_events", schema: "bronze", kafkaTopic: "cdc.fraud.events", partitionKey: "TEN-UBA", payload: { alertId: "FRD-1101", ruleTriggered: "velocity_check", score: 0.92, transactionId: "TXN-9902", amount: 15000000 }, metadata: { tenantId: "TEN-UBA", userId: "SYSTEM", correlationId: "COR-4401", timestamp: new Date().toISOString(), version: 1 } },
  { eventId: "CDC-005", eventType: "kyc_completed", domain: "kyc_aml", service: "kyc-engine-py", table: "kyc_verifications", schema: "bronze", kafkaTopic: "cdc.kyc.verifications", partitionKey: "TEN-ACCESS", payload: { verificationId: "KYC-6601", customerId: "CUS-8801", verificationType: "bvn_nin_match", result: "verified", bvnMatch: true, ninMatch: true }, metadata: { tenantId: "TEN-ACCESS", userId: "USR-7701", correlationId: "COR-3301", timestamp: new Date().toISOString(), version: 1 } },
];

// ── Express Registration ──

export function registerLakehouseIntegration(app: any) {
  // Domain CDC configs
  app.get("/api/platform/lakehouse/domains", (_req: any, res: any) => {
    res.json({ items: domainCDCConfigs, total: domainCDCConfigs.length });
  });

  app.get("/api/platform/lakehouse/domains/stats", (_req: any, res: any) => {
    const totalTables = domainCDCConfigs.reduce((s, d) => s + d.tables.length, 0);
    const totalTopics = domainCDCConfigs.reduce((s, d) => s + d.kafkaTopics.length, 0);
    const totalEvents = domainCDCConfigs.reduce((s, d) => s + d.avgEventsPerDay, 0);
    const totalServices = domainCDCConfigs.reduce((s, d) => s + d.services.length, 0);
    res.json({ domains: domainCDCConfigs.length, totalTables, totalTopics, totalEventsPerDay: totalEvents, totalServices, avgPayloadBytes: 4096 });
  });

  // Shared clients
  app.get("/api/platform/lakehouse/clients", (_req: any, res: any) => {
    res.json({ items: sharedClients, total: sharedClients.length });
  });

  app.get("/api/platform/lakehouse/clients/stats", (_req: any, res: any) => {
    res.json({ totalClients: sharedClients.length, languages: sharedClients.map(c => c.language), servicesUsing: 170 });
  });

  // Query federation
  app.get("/api/platform/lakehouse/queries", (_req: any, res: any) => {
    res.json({ items: federatedQueries, total: federatedQueries.length });
  });

  app.get("/api/platform/lakehouse/queries/stats", (_req: any, res: any) => {
    const totalRows = federatedQueries.reduce((s, q) => s + q.rowsReturned, 0);
    const avgMs = federatedQueries.reduce((s, q) => s + q.avgExecutionMs, 0) / federatedQueries.length;
    res.json({ totalQueries: federatedQueries.length, totalRowsReturned: totalRows, avgExecutionMs: Math.round(avgMs) });
  });

  // Materialized views
  app.get("/api/platform/lakehouse/materialized-views", (_req: any, res: any) => {
    res.json({ items: materializedViews, total: materializedViews.length });
  });

  app.get("/api/platform/lakehouse/materialized-views/stats", (_req: any, res: any) => {
    const totalRows = materializedViews.reduce((s, v) => s + v.rowCount, 0);
    const totalSize = materializedViews.reduce((s, v) => s + v.sizeBytes, 0);
    res.json({ totalViews: materializedViews.length, totalRows, totalSizeBytes: totalSize, active: materializedViews.filter(v => v.status === "active").length });
  });

  // Data lineage
  app.get("/api/platform/lakehouse/lineage/nodes", (_req: any, res: any) => {
    res.json({ items: lineageNodes, total: lineageNodes.length });
  });

  app.get("/api/platform/lakehouse/lineage/edges", (_req: any, res: any) => {
    res.json({ items: lineageEdges, total: lineageEdges.length });
  });

  app.get("/api/platform/lakehouse/lineage/stats", (_req: any, res: any) => {
    const nodesByType: Record<string, number> = {};
    lineageNodes.forEach(n => { nodesByType[n.type] = (nodesByType[n.type] || 0) + 1; });
    const edgesByType: Record<string, number> = {};
    lineageEdges.forEach(e => { edgesByType[e.transformType] = (edgesByType[e.transformType] || 0) + 1; });
    res.json({ totalNodes: lineageNodes.length, totalEdges: lineageEdges.length, nodesByType, edgesByType });
  });

  // Recent CDC events
  app.get("/api/platform/lakehouse/cdc-events", (_req: any, res: any) => {
    res.json({ items: recentCDCEvents, total: recentCDCEvents.length });
  });

  app.get("/api/platform/lakehouse/cdc-events/stats", (_req: any, res: any) => {
    const domains = Array.from(new Set(recentCDCEvents.map(e => e.domain))).length;
    res.json({ recentEvents: recentCDCEvents.length, domains, totalEventsToday: 1362000, avgLatencyMs: 4.2 });
  });
}
