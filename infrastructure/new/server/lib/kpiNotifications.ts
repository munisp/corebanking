/**
 * KPI Notifications & Cadence — Threshold breach events + customizable display periods
 * Publishes events via Kafka when KPI thresholds are exceeded.
 * Supports: hourly, daily, weekly, monthly, quarterly, semi-annually, yearly
 *
 * Data doctrine: rules are only evaluated against real values computed from
 * Postgres (via computeKpiMetricValues in ./kpiGateway). A rule whose metric
 * has no computable value is SKIPPED and logged — no breach and no all-clear
 * is ever derived from a hardcoded number. Cadence history comes from the
 * kpi_scores table; when there is no recorded history, the series is empty
 * and marked unavailable. When the database is unreachable, endpoints fail
 * fast with 503.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";
import { publish, getKafkaStatus } from "./kafkaClient";
import { getRedisStatus } from "./redisClient";
import { checkDatabaseHealth } from "./postgresRepository";
import { computeKpiMetricValues, DatabaseUnavailableError } from "./kpiGateway";

// ─── NOTIFICATION TYPES ─────────────────────────────────────────────────────

interface NotificationRule {
  id: string;
  role: string;
  metricId: string;
  metricName: string;
  condition: "gt" | "lt" | "gte" | "lte" | "eq";
  thresholdValue: number;
  severity: "critical" | "warning" | "info";
  channels: ("kafka" | "email" | "sms" | "webhook" | "in_app" | "push")[];
  cooldownMinutes: number;
  enabled: boolean;
  escalationChain: string[];
  createdBy: string;
  description: string;
}

interface NotificationEvent {
  id: string;
  ruleId: string;
  role: string;
  metricId: string;
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  condition: string;
  severity: string;
  status: "fired" | "acknowledged" | "resolved" | "suppressed";
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  channels: string[];
  message: string;
}

type Cadence = "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "semi_annually" | "yearly";

interface CadenceConfig {
  label: string;
  intervalSeconds: number;
  retentionDays: number;
  defaultPeriods: number;
  aggregation: "avg" | "sum" | "min" | "max" | "latest";
}

// ─── CADENCE DEFINITIONS ────────────────────────────────────────────────────

const CADENCE_MAP: Record<Cadence, CadenceConfig> = {
  hourly: { label: "Hourly", intervalSeconds: 3600, retentionDays: 7, defaultPeriods: 24, aggregation: "avg" },
  daily: { label: "Daily", intervalSeconds: 86400, retentionDays: 90, defaultPeriods: 30, aggregation: "avg" },
  weekly: { label: "Weekly", intervalSeconds: 604800, retentionDays: 365, defaultPeriods: 12, aggregation: "avg" },
  monthly: { label: "Monthly", intervalSeconds: 2592000, retentionDays: 730, defaultPeriods: 12, aggregation: "avg" },
  quarterly: { label: "Quarterly", intervalSeconds: 7776000, retentionDays: 1825, defaultPeriods: 8, aggregation: "avg" },
  semi_annually: { label: "Semi-Annual", intervalSeconds: 15552000, retentionDays: 3650, defaultPeriods: 6, aggregation: "avg" },
  yearly: { label: "Yearly", intervalSeconds: 31536000, retentionDays: 7300, defaultPeriods: 5, aggregation: "avg" },
};

// ─── DEFAULT NOTIFICATION RULES ─────────────────────────────────────────────

const DEFAULT_RULES: NotificationRule[] = [
  { id: "nr-001", role: "cro", metricId: "cro_aml_alerts", metricName: "Unresolved AML Alerts", condition: "gt", thresholdValue: 5, severity: "critical", channels: ["kafka", "email", "sms", "in_app"], cooldownMinutes: 15, enabled: true, escalationChain: ["cro", "ceo"], createdBy: "system", description: "AML alerts exceeding safe threshold — immediate escalation required" },
  { id: "nr-002", role: "cro", metricId: "cro_npl", metricName: "NPL Ratio", condition: "gt", thresholdValue: 5.0, severity: "critical", channels: ["kafka", "email", "in_app"], cooldownMinutes: 60, enabled: true, escalationChain: ["credit", "cro", "ceo"], createdBy: "system", description: "NPL ratio exceeds CBN regulatory maximum" },
  { id: "nr-003", role: "cso", metricId: "cso_incidents", metricName: "Active Security Incidents", condition: "gt", thresholdValue: 0, severity: "critical", channels: ["kafka", "email", "sms", "push"], cooldownMinutes: 5, enabled: true, escalationChain: ["cso", "cto", "ceo"], createdBy: "system", description: "Security breach detected — immediate response required" },
  { id: "nr-004", role: "coo", metricId: "coo_fail_rate", metricName: "Failed Transaction Rate", condition: "gt", thresholdValue: 1.0, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 30, enabled: true, escalationChain: ["coo", "cto"], createdBy: "system", description: "Transaction failure rate above acceptable threshold" },
  { id: "nr-005", role: "head_teller", metricId: "htl_cash_variance", metricName: "Cash Variance", condition: "gt", thresholdValue: 10000, severity: "critical", channels: ["kafka", "email", "sms", "in_app"], cooldownMinutes: 15, enabled: true, escalationChain: ["head_teller", "coo", "internal_audit"], createdBy: "system", description: "Cash discrepancy exceeds ₦10,000 — potential fraud" },
  { id: "nr-006", role: "compliance", metricId: "cmp_sar_backlog", metricName: "SAR Backlog", condition: "gt", thresholdValue: 0, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 60, enabled: true, escalationChain: ["compliance", "cro"], createdBy: "system", description: "Overdue SAR filings — regulatory risk" },
  { id: "nr-007", role: "cto", metricId: "cto_error_rate", metricName: "Error Rate (5xx)", condition: "gt", thresholdValue: 0.5, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 15, enabled: true, escalationChain: ["cto", "coo"], createdBy: "system", description: "Server error rate exceeds threshold" },
  { id: "nr-008", role: "treasury", metricId: "trs_liquidity", metricName: "Liquidity Ratio", condition: "lt", thresholdValue: 30, severity: "critical", channels: ["kafka", "email", "sms", "push"], cooldownMinutes: 30, enabled: true, escalationChain: ["treasury", "ceo"], createdBy: "system", description: "Liquidity ratio below CBN minimum requirement" },
  { id: "nr-009", role: "cso", metricId: "cso_unauthorized", metricName: "Unauthorized Access", condition: "gt", thresholdValue: 20, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 15, enabled: true, escalationChain: ["cso", "cto"], createdBy: "system", description: "Unusual spike in unauthorized access attempts" },
  { id: "nr-010", role: "customer_service", metricId: "cs_open_complaints", metricName: "Open Complaints", condition: "gt", thresholdValue: 50, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 60, enabled: true, escalationChain: ["customer_service", "coo"], createdBy: "system", description: "Complaint backlog exceeds capacity" },
  { id: "nr-011", role: "internal_audit", metricId: "aud_maker_checker", metricName: "Maker-Checker Violations", condition: "gt", thresholdValue: 0, severity: "critical", channels: ["kafka", "email", "sms", "in_app"], cooldownMinutes: 5, enabled: true, escalationChain: ["internal_audit", "cro", "ceo"], createdBy: "system", description: "Transaction processed without dual authorization" },
  { id: "nr-012", role: "credit", metricId: "crd_par30", metricName: "PAR > 30 days", condition: "gt", thresholdValue: 10, severity: "warning", channels: ["kafka", "email", "in_app"], cooldownMinutes: 1440, enabled: true, escalationChain: ["credit", "cro"], createdBy: "system", description: "Portfolio at risk exceeds warning level" },
];

// In-memory event store of REAL fired events (production: Kafka + OpenSearch)
const notificationEvents: NotificationEvent[] = [];
let eventCounter = 0;

// ─── EVALUATION ENGINE ──────────────────────────────────────────────────────

function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case "gt": return value > threshold;
    case "lt": return value < threshold;
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    case "eq": return value === threshold;
    default: return false;
  }
}

/**
 * Evaluate all enabled rules against real computed values.
 * Rules whose metric value is null (no computable source) are skipped and
 * logged — they produce neither a breach nor an all-clear.
 */
function evaluateAllRules(values: Record<string, number | null>): { newEvents: NotificationEvent[]; skipped: string[] } {
  const newEvents: NotificationEvent[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  for (const rule of DEFAULT_RULES) {
    if (!rule.enabled) continue;
    const value = values[rule.metricId];
    if (value === null || value === undefined) {
      skipped.push(rule.metricId);
      logger.warn(`[KPI-NOTIFICATION] Skipping rule ${rule.id} (${rule.metricId}) — no real computed value available; not evaluating`);
      continue;
    }
    const breached = evaluateCondition(value, rule.condition, rule.thresholdValue);

    if (breached) {
      // Check cooldown
      const recentEvent = notificationEvents.find(
        e => e.ruleId === rule.id && e.status === "fired" &&
        (Date.now() - new Date(e.firedAt).getTime()) < rule.cooldownMinutes * 60000
      );
      if (recentEvent) continue;

      eventCounter++;
      const event: NotificationEvent = {
        id: `evt-${String(eventCounter).padStart(6, "0")}`,
        ruleId: rule.id,
        role: rule.role,
        metricId: rule.metricId,
        metricName: rule.metricName,
        currentValue: value,
        thresholdValue: rule.thresholdValue,
        condition: rule.condition,
        severity: rule.severity,
        status: "fired",
        firedAt: now,
        channels: rule.channels,
        message: `${rule.metricName} for ${rule.role.toUpperCase()} is ${value} (threshold: ${rule.condition} ${rule.thresholdValue}) — ${rule.description}`,
      };
      notificationEvents.push(event);
      newEvents.push(event);

      // Publish to the real event bus
      publishToKafka("kpi.notifications", event);
    }
  }

  return { newEvents, skipped };
}

function publishToKafka(topic: string, event: NotificationEvent): void {
  const status = getKafkaStatus();
  if (!status.connected) {
    logger.warn(`[KPI-NOTIFICATION] Event bus not connected (mode=${status.mode}) — breach event ${event.id} recorded locally but not published`);
    return;
  }
  publish(topic, event);
  logger.info(`[KPI-NOTIFICATION] topic=${topic} severity=${event.severity} role=${event.role} metric=${event.metricId} value=${event.currentValue}`);
}

// ─── CADENCE DATA (real history only) ───────────────────────────────────────

interface CadencePoint {
  period_end: string;
  period_label: string;
  value: number;
  status: string;
}

/**
 * Fetch recorded score history for a metric from kpi_scores.
 * Returns an empty array when there is no history — the series is never
 * synthesized.
 */
async function fetchCadenceData(metricId: string, cadence: Cadence, periods?: number): Promise<CadencePoint[]> {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  const config = CADENCE_MAP[cadence];
  const numPeriods = periods || config.defaultPeriods;

  const result = await db.execute(
    sql`SELECT period_end, value, status FROM kpi_scores WHERE metric_key = ${metricId} ORDER BY period_end DESC LIMIT ${numPeriods}`
  );
  const rows = (result.rows as Array<{ period_end: string | Date; value: number | string; status: string | null }>).reverse();

  return rows.map(r => {
    const periodEnd = new Date(r.period_end);
    return {
      period_end: periodEnd.toISOString(),
      period_label: formatPeriodLabel(periodEnd, cadence),
      value: Number(r.value),
      status: r.status ?? "unknown",
    };
  });
}

function formatPeriodLabel(dt: Date, cadence: Cadence): string {
  switch (cadence) {
    case "hourly": return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    case "daily": return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "weekly": return `W${getWeekNumber(dt)} ${dt.getFullYear()}`;
    case "monthly": return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    case "quarterly": return `Q${Math.floor(dt.getMonth() / 3) + 1} ${dt.getFullYear()}`;
    case "semi_annually": return `H${dt.getMonth() < 6 ? 1 : 2} ${dt.getFullYear()}`;
    case "yearly": return `${dt.getFullYear()}`;
  }
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
}

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────

function handleNotificationError(res: Response, error: unknown): void {
  if (error instanceof DatabaseUnavailableError) {
    res.status(503).json({ error: "database_unavailable", message: "KPI notification evaluation requires a live Postgres connection" });
    return;
  }
  logger.error("[KPI-NOTIFICATION] endpoint failed", { error: String(error) });
  res.status(500).json({ error: "kpi_notification_failed" });
}

// ─── REGISTER ENDPOINTS ─────────────────────────────────────────────────────

export function registerKPINotifications(app: Express): void {
  // List notification rules
  app.get("/api/kpi/notifications/rules", (_req: Request, res: Response) => {
    const role = _req.query.role as string;
    const severity = _req.query.severity as string;
    let rules = DEFAULT_RULES;
    if (role) rules = rules.filter(r => r.role === role);
    if (severity) rules = rules.filter(r => r.severity === severity);
    res.json({
      rules,
      total: rules.length,
      channels: ["kafka", "email", "sms", "webhook", "in_app", "push"],
      cadences: Object.entries(CADENCE_MAP).map(([key, config]) => ({ key, ...config })),
    });
  });

  // Evaluate rules now (trigger evaluation against real computed values)
  app.post("/api/kpi/notifications/evaluate", async (_req: Request, res: Response) => {
    try {
      const enabledRules = DEFAULT_RULES.filter(r => r.enabled);
      const values = await computeKpiMetricValues(enabledRules.map(r => r.metricId));
      const { newEvents, skipped } = evaluateAllRules(values);
      res.json({
        evaluated: enabledRules.length - skipped.length,
        skippedUnavailable: skipped,
        breached: newEvents.length,
        events: newEvents,
        note: "Rules with no computable metric value were skipped — no breach or all-clear is inferred from missing data",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleNotificationError(res, error);
    }
  });

  // List notification events/history
  app.get("/api/kpi/notifications/events", (req: Request, res: Response) => {
    const role = req.query.role as string;
    const severity = req.query.severity as string;
    const status = req.query.status as string;
    let events = [...notificationEvents].reverse();
    if (role) events = events.filter(e => e.role === role);
    if (severity) events = events.filter(e => e.severity === severity);
    if (status) events = events.filter(e => e.status === status);
    res.json({ events: events.slice(0, 100), total: events.length });
  });

  // Acknowledge notification
  app.post("/api/kpi/notifications/events/:id/acknowledge", (req: Request, res: Response) => {
    const { id } = req.params;
    const event = notificationEvents.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: "event not found" });
    event.status = "acknowledged";
    event.acknowledgedAt = new Date().toISOString();
    event.acknowledgedBy = (req.headers["x-kpi-role"] as string) || "admin";
    res.json(event);
  });

  // Resolve notification
  app.post("/api/kpi/notifications/events/:id/resolve", (req: Request, res: Response) => {
    const { id } = req.params;
    const event = notificationEvents.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: "event not found" });
    event.status = "resolved";
    event.resolvedAt = new Date().toISOString();
    res.json(event);
  });

  // Notification summary dashboard
  app.get("/api/kpi/notifications/summary", (_req: Request, res: Response) => {
    const active = notificationEvents.filter(e => e.status === "fired").length;
    const acknowledged = notificationEvents.filter(e => e.status === "acknowledged").length;
    const resolved = notificationEvents.filter(e => e.status === "resolved").length;
    const critical = notificationEvents.filter(e => e.severity === "critical" && e.status === "fired").length;

    res.json({
      totalRules: DEFAULT_RULES.length,
      enabledRules: DEFAULT_RULES.filter(r => r.enabled).length,
      activeEvents: active,
      acknowledgedEvents: acknowledged,
      resolvedEvents: resolved,
      criticalUnresolved: critical,
      byRole: Array.from(new Set(DEFAULT_RULES.map(r => r.role))).map(role => ({
        role,
        rules: DEFAULT_RULES.filter(r => r.role === role).length,
        activeAlerts: notificationEvents.filter(e => e.role === role && e.status === "fired").length,
      })),
      channels: ["kafka", "email", "sms", "webhook", "in_app", "push"],
      lastEvaluation: new Date().toISOString(),
    });
  });

  // ─── CADENCE ENDPOINTS ──────────────────────────────────────────────────

  // Get available cadences
  app.get("/api/kpi/cadences", (_req: Request, res: Response) => {
    res.json({
      cadences: Object.entries(CADENCE_MAP).map(([key, config]) => ({
        key,
        label: config.label,
        intervalSeconds: config.intervalSeconds,
        retentionDays: config.retentionDays,
        defaultPeriods: config.defaultPeriods,
        aggregation: config.aggregation,
      })),
    });
  });

  // Get KPI data by custom cadence — real recorded history from kpi_scores only
  app.get("/api/kpi/data/:metricId", async (req: Request, res: Response) => {
    const { metricId } = req.params;
    const cadence = (req.query.cadence as Cadence) || "daily";
    const periods = parseInt(req.query.periods as string) || undefined;

    if (!CADENCE_MAP[cadence]) {
      return res.status(400).json({ error: "invalid cadence", validCadences: Object.keys(CADENCE_MAP) });
    }

    try {
      const config = CADENCE_MAP[cadence];
      const [data, values] = await Promise.all([
        fetchCadenceData(metricId, cadence, periods),
        computeKpiMetricValues([metricId]),
      ]);
      const currentValue = values[metricId] ?? null;

      if (data.length === 0) {
        return res.json({
          metricId,
          cadence,
          cadenceLabel: config.label,
          periods: 0,
          retentionDays: config.retentionDays,
          aggregation: config.aggregation,
          status: "unavailable",
          data: [],
          currentValue,
          summary: null,
          message: "No recorded history for this metric in kpi_scores — series is not synthesized",
        });
      }

      res.json({
        metricId,
        cadence,
        cadenceLabel: config.label,
        periods: data.length,
        retentionDays: config.retentionDays,
        aggregation: config.aggregation,
        status: "ok",
        data,
        currentValue,
        summary: {
          avg: Math.round(data.reduce((s, d) => s + d.value, 0) / data.length * 100) / 100,
          min: Math.min(...data.map(d => d.value)),
          max: Math.max(...data.map(d => d.value)),
          trend: data[data.length - 1]?.value > data[0]?.value ? "improving" : data[data.length - 1]?.value < data[0]?.value ? "declining" : "flat",
        },
      });
    } catch (error) {
      handleNotificationError(res, error);
    }
  });

  // Get all metrics for a role by cadence — real recorded history only
  app.get("/api/kpi/data/role/:role", async (req: Request, res: Response) => {
    const { role } = req.params;
    const cadence = (req.query.cadence as Cadence) || "daily";

    // Metric IDs per role
    const roleMetrics: Record<string, string[]> = {
      ceo: ["ceo_aum", "ceo_revenue", "ceo_cir", "ceo_customer_growth", "ceo_car", "ceo_roe", "ceo_digital_adoption", "ceo_npl"],
      coo: ["coo_tps", "coo_fail_rate", "coo_settlement", "coo_uptime", "coo_queue", "coo_latency"],
      cro: ["cro_aml_alerts", "cro_response_time", "cro_sar_timeliness", "cro_false_positive", "cro_npl"],
      cto: ["cto_api_p95", "cto_error_rate", "cto_pool_util", "cto_cache_hit", "cto_availability", "cto_deploy_success"],
      cso: ["cso_incidents", "cso_unauthorized", "cso_vuln_critical", "cso_mfa_adoption", "cso_patch_compliance", "cso_pentest_score"],
      treasury: ["trs_liquidity", "trs_crr", "trs_fx_exposure", "trs_nim", "trs_fx_pnl", "trs_nostro_recon"],
      credit: ["crd_npl", "crd_collection", "crd_turnaround", "crd_par30", "crd_growth"],
      head_teller: ["htl_txn_per_hr", "htl_cash_variance", "htl_wait_time", "htl_reversal_rate", "htl_cross_sell"],
      compliance: ["cmp_kyc_pending", "cmp_ctr_filing", "cmp_sar_backlog", "cmp_kyc_tier", "cmp_expired_docs"],
      customer_service: ["cs_open_complaints", "cs_response_time", "cs_fcr", "cs_sla", "cs_churn"],
      internal_audit: ["aud_maker_checker", "aud_trail_completeness", "aud_exceptions", "aud_sod_violations", "aud_gl_discrepancy"],
    };

    const metrics = roleMetrics[role];
    if (!metrics) return res.status(404).json({ error: "role not found" });
    if (!CADENCE_MAP[cadence]) {
      return res.status(400).json({ error: "invalid cadence", validCadences: Object.keys(CADENCE_MAP) });
    }

    try {
      const result = await Promise.all(metrics.map(async metricId => {
        const data = await fetchCadenceData(metricId, cadence, CADENCE_MAP[cadence].defaultPeriods);
        return { metricId, status: data.length > 0 ? "ok" : "unavailable", data };
      }));

      res.json({ role, cadence, cadenceLabel: CADENCE_MAP[cadence].label, metrics: result });
    } catch (error) {
      handleNotificationError(res, error);
    }
  });

  // Branch geospatial data (for map) — served from the kpi_branches table
  app.get("/api/kpi/branches", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) throw new DatabaseUnavailableError();

      const result = await db.execute(
        sql`SELECT branch_id, name, state, lga, latitude, longitude, revenue_ngn, transactions_daily, customers, npl_pct, deposits_ngn, status FROM kpi_branches ORDER BY branch_id`
      );
      const rows = result.rows as Array<Record<string, unknown>>;

      res.json({
        branches: rows.map(r => ({
          branch_id: r.branch_id,
          name: r.name,
          state: r.state,
          lga: r.lga,
          lat: r.latitude === null ? null : Number(r.latitude),
          lon: r.longitude === null ? null : Number(r.longitude),
          revenue_ngn: r.revenue_ngn === null ? null : Number(r.revenue_ngn),
          transactions_daily: r.transactions_daily === null ? null : Number(r.transactions_daily),
          customers: r.customers === null ? null : Number(r.customers),
          npl_pct: r.npl_pct === null ? null : Number(r.npl_pct),
          deposits_ngn: r.deposits_ngn === null ? null : Number(r.deposits_ngn),
          status: r.status ?? "unknown",
        })),
        total: rows.length,
        source: "kpi_branches table (Postgres)",
      });
    } catch (error) {
      handleNotificationError(res, error);
    }
  });

  // Middleware status — probed from real client helpers; components without a
  // probe are reported as "unknown", never as "connected".
  app.get("/api/kpi/middleware/status", async (_req: Request, res: Response) => {
    const [dbHealth, kafka, redis] = [await checkDatabaseHealth(), getKafkaStatus(), getRedisStatus()];

    const middlewareList = [
      { name: "Apache Kafka", status: kafka.connected ? "connected" : kafka.mode === "memory" ? "memory_mode" : "unavailable", purpose: "KPI event publishing & alert streaming" },
      { name: "Dapr Sidecar", status: "unknown", purpose: "State management, pub/sub, service invocation" },
      { name: "Fluvio Streaming", status: "unknown", purpose: "Real-time KPI metric streaming" },
      { name: "Temporal Workflow", status: "unknown", purpose: "Scheduled KPI evaluation workflows" },
      { name: "PostgreSQL 16", status: dbHealth.healthy ? "connected" : "unavailable", latencyMs: dbHealth.latencyMs, purpose: "Primary data source for all KPI calculations" },
      { name: "Keycloak SSO", status: "unknown", purpose: "Authentication, MFA adoption metrics" },
      { name: "Permify", status: "unknown", purpose: "Fine-grained RBAC for KPI access" },
      { name: "Redis Cache", status: redis.connected ? "connected" : redis.mode === "memory" ? "memory_mode" : "unavailable", purpose: "KPI result caching (30s TTL)" },
      { name: "Mojaloop Hub", status: "unknown", purpose: "Interop transfer KPIs" },
      { name: "OpenSearch", status: "unknown", purpose: "KPI alert indexing & analytics" },
      { name: "OpenAppSec WAF", status: "unknown", purpose: "Security metrics for CSO" },
      { name: "Apache APISIX", status: "unknown", purpose: "API gateway metrics for CTO" },
      { name: "TigerBeetle", status: "unknown", purpose: "Ledger performance KPIs" },
      { name: "Lakehouse (Iceberg+Sedona)", status: "unknown", purpose: "Materialized KPI views, geospatial analytics" },
    ];
    res.json({
      middleware: middlewareList,
      total: middlewareList.length,
      connectedCount: middlewareList.filter(m => m.status === "connected").length,
      note: "Components without a live probe in this process report status \"unknown\" — no component is reported connected without a real check",
    });
  });

  logger.info("[KPINotifications] Registered rules/events/cadence endpoints — evaluation runs only against real computed values");
}
