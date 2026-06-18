/**
 * Observability Stack — OpenTelemetry, Prometheus, Grafana dashboards
 *
 * Components:
 * - OpenTelemetry SDK: distributed tracing across all services
 * - Prometheus metrics: request rates, latencies, error rates, business metrics
 * - Grafana dashboards: pre-built dashboards for banking operations
 * - Alert rules: PagerDuty/Opsgenie integration
 */

// ── 1. OpenTelemetry Configuration ──

interface OTelConfig {
  id: string;
  serviceName: string;
  exporter: "otlp" | "jaeger" | "zipkin";
  endpoint: string;
  samplingRate: number;
  propagators: string[];
  instrumentations: string[];
  resourceAttributes: Record<string, string>;
  status: "active" | "disabled";
}

const otelConfigs: OTelConfig[] = [
  { id: "OTEL-001", serviceName: "express-bff", exporter: "otlp", endpoint: "http://otel-collector:4318", samplingRate: 0.1, propagators: ["tracecontext", "baggage", "b3"], instrumentations: ["http", "express", "pg", "redis", "grpc"], resourceAttributes: { "deployment.environment": "production", "service.namespace": "54bank", "service.version": "2.0.0" }, status: "active" },
  { id: "OTEL-002", serviceName: "core-banking-go", exporter: "otlp", endpoint: "http://otel-collector:4317", samplingRate: 0.05, propagators: ["tracecontext", "baggage"], instrumentations: ["net/http", "database/sql", "google.golang.org/grpc"], resourceAttributes: { "deployment.environment": "production", "service.namespace": "54bank", "service.language": "go" }, status: "active" },
  { id: "OTEL-003", serviceName: "tigerbeetle-ledger-rs", exporter: "otlp", endpoint: "http://otel-collector:4317", samplingRate: 0.01, propagators: ["tracecontext"], instrumentations: ["hyper", "tokio", "tonic"], resourceAttributes: { "deployment.environment": "production", "service.namespace": "54bank", "service.language": "rust" }, status: "active" },
  { id: "OTEL-004", serviceName: "kyc-engine-py", exporter: "otlp", endpoint: "http://otel-collector:4317", samplingRate: 0.1, propagators: ["tracecontext", "baggage"], instrumentations: ["requests", "psycopg2", "redis", "celery"], resourceAttributes: { "deployment.environment": "production", "service.namespace": "54bank", "service.language": "python" }, status: "active" },
];

// ── 2. Prometheus Metrics ──

interface PrometheusMetric {
  id: string;
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  help: string;
  labels: string[];
  value: number | Record<string, number>;
  category: "request" | "business" | "infrastructure" | "sla";
}

const prometheusMetrics: PrometheusMetric[] = [
  { id: "PM-001", name: "http_requests_total", type: "counter", help: "Total HTTP requests", labels: ["method", "route", "status_code"], value: 45800000, category: "request" },
  { id: "PM-002", name: "http_request_duration_seconds", type: "histogram", help: "HTTP request latency", labels: ["method", "route"], value: { p50: 0.012, p90: 0.045, p95: 0.085, p99: 0.250 }, category: "request" },
  { id: "PM-003", name: "bank_transfers_total", type: "counter", help: "Total bank transfers processed", labels: ["channel", "status", "currency"], value: 2850000, category: "business" },
  { id: "PM-004", name: "bank_transfer_amount_ngn", type: "counter", help: "Total transfer volume in NGN", labels: ["channel"], value: 15200000000, category: "business" },
  { id: "PM-005", name: "bank_active_accounts", type: "gauge", help: "Current active accounts", labels: ["type", "branch"], value: 2800000, category: "business" },
  { id: "PM-006", name: "bank_loan_portfolio_ngn", type: "gauge", help: "Outstanding loan portfolio in NGN", labels: ["type", "classification"], value: 85000000000, category: "business" },
  { id: "PM-007", name: "bank_aml_alerts_pending", type: "gauge", help: "Pending AML alerts requiring review", labels: ["severity"], value: 120, category: "business" },
  { id: "PM-008", name: "tigerbeetle_transfers_per_second", type: "gauge", help: "TigerBeetle ledger throughput", labels: [], value: 125000, category: "infrastructure" },
  { id: "PM-009", name: "postgres_connections_active", type: "gauge", help: "Active Postgres connections", labels: ["pool"], value: 145, category: "infrastructure" },
  { id: "PM-010", name: "redis_cache_hit_ratio", type: "gauge", help: "Redis cache hit ratio", labels: ["cache_name"], value: 0.987, category: "infrastructure" },
  { id: "PM-011", name: "kafka_consumer_lag", type: "gauge", help: "Kafka consumer group lag", labels: ["topic", "consumer_group"], value: 250, category: "infrastructure" },
  { id: "PM-012", name: "sla_availability_pct", type: "gauge", help: "Platform availability SLA percentage", labels: ["service"], value: 99.95, category: "sla" },
  { id: "PM-013", name: "sla_transfer_latency_p99_ms", type: "gauge", help: "P99 transfer latency SLA", labels: ["channel"], value: 850, category: "sla" },
  { id: "PM-014", name: "sla_nip_success_rate_pct", type: "gauge", help: "NIP transfer success rate", labels: [], value: 99.2, category: "sla" },
];

// ── 3. Grafana Dashboards ──

interface GrafanaDashboard {
  id: string;
  uid: string;
  title: string;
  category: "overview" | "banking" | "infrastructure" | "security" | "compliance";
  panels: number;
  refreshInterval: string;
  timeRange: string;
  description: string;
  url: string;
}

const grafanaDashboards: GrafanaDashboard[] = [
  { id: "GD-001", uid: "54bank-overview", title: "54Bank Platform Overview", category: "overview", panels: 24, refreshInterval: "10s", timeRange: "24h", description: "Platform health: request rates, error rates, latency, active users, service status", url: "/grafana/d/54bank-overview" },
  { id: "GD-002", uid: "54bank-transfers", title: "Transfer Operations", category: "banking", panels: 18, refreshInterval: "5s", timeRange: "24h", description: "Transfer volumes by channel (NIP/internal/Mojaloop/SWIFT), success rates, settlement positions", url: "/grafana/d/54bank-transfers" },
  { id: "GD-003", uid: "54bank-lending", title: "Loan Portfolio", category: "banking", panels: 16, refreshInterval: "1m", timeRange: "30d", description: "Portfolio at risk, IFRS9 staging, disbursements, collections, NPL ratios by product", url: "/grafana/d/54bank-lending" },
  { id: "GD-004", uid: "54bank-treasury", title: "Treasury & FX", category: "banking", panels: 14, refreshInterval: "5s", timeRange: "7d", description: "FX positions, nostro balances, P&L attribution, liquidity ratios (LCR/NSFR)", url: "/grafana/d/54bank-treasury" },
  { id: "GD-005", uid: "54bank-postgres", title: "Postgres Performance", category: "infrastructure", panels: 20, refreshInterval: "10s", timeRange: "6h", description: "Query latency, connection pools, cache hit ratios, table bloat, vacuum status, slow queries", url: "/grafana/d/54bank-postgres" },
  { id: "GD-006", uid: "54bank-tigerbeetle", title: "TigerBeetle Ledger", category: "infrastructure", panels: 12, refreshInterval: "5s", timeRange: "24h", description: "Transfer throughput, account operations, sync lag to Postgres, reconciliation status", url: "/grafana/d/54bank-tigerbeetle" },
  { id: "GD-007", uid: "54bank-kafka", title: "Kafka Event Bus", category: "infrastructure", panels: 15, refreshInterval: "10s", timeRange: "12h", description: "Topic throughput, consumer lag, partition skew, broker health, CDC pipeline status", url: "/grafana/d/54bank-kafka" },
  { id: "GD-008", uid: "54bank-security", title: "Security & WAF", category: "security", panels: 16, refreshInterval: "10s", timeRange: "24h", description: "WAF blocks, auth failures, brute force attempts, DDoS indicators, vulnerability scan results", url: "/grafana/d/54bank-security" },
  { id: "GD-009", uid: "54bank-compliance", title: "Regulatory Compliance", category: "compliance", panels: 14, refreshInterval: "1h", timeRange: "30d", description: "AML alert aging, KYC verification rates, CBN reporting status, Basel III capital adequacy", url: "/grafana/d/54bank-compliance" },
  { id: "GD-010", uid: "54bank-mojaloop", title: "Mojaloop Interoperability", category: "banking", panels: 12, refreshInterval: "10s", timeRange: "24h", description: "Cross-border transfer volumes, settlement windows, corridor analytics, ILP verification rates", url: "/grafana/d/54bank-mojaloop" },
];

// ── 4. Alert Rules ──

interface AlertRule {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  expression: string;
  forDuration: string;
  channel: string[];
  runbook: string;
  status: "active" | "firing" | "resolved" | "silenced";
}

const alertRules: AlertRule[] = [
  { id: "AR-001", name: "High Error Rate", severity: "critical", expression: "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05", forDuration: "2m", channel: ["pagerduty", "slack-critical"], runbook: "Check service health, recent deployments, database connectivity", status: "active" },
  { id: "AR-002", name: "Transfer Failure Spike", severity: "critical", expression: "rate(bank_transfers_total{status=\"failed\"}[5m]) > 10", forDuration: "1m", channel: ["pagerduty", "slack-critical", "sms-oncall"], runbook: "Check NIBSS gateway, Mojaloop connector, settlement engine", status: "active" },
  { id: "AR-003", name: "TigerBeetle Sync Lag", severity: "warning", expression: "tigerbeetle_postgres_sync_lag_seconds > 30", forDuration: "5m", channel: ["slack-ops"], runbook: "Check Kafka CDC pipeline, sync service health, Postgres write performance", status: "active" },
  { id: "AR-004", name: "Database Connection Saturation", severity: "warning", expression: "postgres_connections_active / postgres_connections_max > 0.85", forDuration: "3m", channel: ["slack-ops", "email-dba"], runbook: "Scale PgBouncer, review connection-hogging queries, check for connection leaks", status: "active" },
  { id: "AR-005", name: "AML Alert SLA Breach", severity: "warning", expression: "count(bank_aml_alerts_pending{severity=\"critical\"} > 0) and (time() - bank_aml_alert_created_at > 3600)", forDuration: "0s", channel: ["slack-compliance", "email-compliance-officer"], runbook: "Critical AML alert unreviewed for >1 hour — CBN requires 24h response", status: "active" },
  { id: "AR-006", name: "WAF Attack Surge", severity: "critical", expression: "rate(openappsec_blocks_total[5m]) > 100", forDuration: "1m", channel: ["pagerduty", "slack-security"], runbook: "Potential DDoS or coordinated attack — review WAF logs, consider IP blocking", status: "active" },
  { id: "AR-007", name: "Kafka Consumer Lag", severity: "warning", expression: "kafka_consumer_lag > 10000", forDuration: "5m", channel: ["slack-ops"], runbook: "Consumer falling behind — check consumer health, increase partitions/consumers", status: "active" },
  { id: "AR-008", name: "Platform Availability SLA", severity: "critical", expression: "sla_availability_pct < 99.9", forDuration: "0s", channel: ["pagerduty", "slack-critical", "email-cto"], runbook: "SLA breach — identify failing services, engage incident response", status: "active" },
];

// ── Express Registration ──

export function registerObservability(app: any) {
  app.get("/api/platform/observability/otel-configs", (_req: any, res: any) => {
    res.json({ items: otelConfigs, total: otelConfigs.length });
  });
  app.get("/api/platform/observability/prometheus-metrics", (_req: any, res: any) => {
    res.json({ items: prometheusMetrics, total: prometheusMetrics.length });
  });
  app.get("/api/platform/observability/grafana-dashboards", (_req: any, res: any) => {
    res.json({ items: grafanaDashboards, total: grafanaDashboards.length });
  });
  app.get("/api/platform/observability/alert-rules", (_req: any, res: any) => {
    res.json({ items: alertRules, total: alertRules.length });
  });
  app.get("/api/platform/observability/stats", (_req: any, res: any) => {
    res.json({ otelServices: otelConfigs.length, metricsCount: prometheusMetrics.length, dashboards: grafanaDashboards.length, alertRules: alertRules.length, alertsFiring: alertRules.filter(a => a.status === "firing").length, slaAvailability: 99.95, avgLatencyMs: 12 });
  });
}
