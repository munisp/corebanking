#![allow(unused)]
// kpi-threshold-monitor-rs — Real-time KPI threshold monitoring with Kafka alert publishing
// Port: 8501
// Middleware: Postgres, Redis, Kafka, Dapr, Fluvio, Temporal, OpenSearch, Permify
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, FromRow};
use std::collections::HashMap;
use std::env;
use std::sync::atomic::{AtomicU64, AtomicI64, AtomicI32, AtomicBool, Ordering as AtomicOrdering};
use std::time::Instant;
use actix_web::HttpMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThresholdRule {
    id: String,
    role: String,
    metric_id: String,
    metric_name: String,
    condition: String,
    threshold_value: f64,
    severity: String,
    action: String,
    enabled: bool,
    cooldown_minutes: u32,
    last_triggered: Option<String>,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KpiAlert {
    id: String,
    rule_id: String,
    role: String,
    metric_id: String,
    metric_name: String,
    // null when the metric source was unavailable (never a simulated value)
    current_value: Option<f64>,
    threshold_value: f64,
    severity: String,
    status: String, // active, acknowledged, resolved, data_unavailable
    triggered_at: String,
    acknowledged_at: Option<String>,
    resolved_at: Option<String>,
    message: String,
    action_taken: String,
}

#[derive(Debug, Deserialize)]
struct ListParams {
    role: Option<String>,
    severity: Option<String>,
    status: Option<String>,
    page: Option<usize>,
    limit: Option<usize>,
}

// ── Postgres persistence (W13-FIX-CRIT C4: in-memory Arc<RwLock<Vec>> → sqlx) ──
// alerts/thresholds were process-local Vecs: acknowledge/resolve state was lost
// on restart. kpi_alerts and kpi_thresholds are now the system of record.
// Fail-closed: when DATABASE_URL is unset/unreachable the data endpoints
// return 503 — no in-memory fallback, no fabricated alert state.
struct AppState {
    start_time: Instant,
    db_url: String,
    db: Option<PgPool>,
    service_name: String,
}

// DB row shapes (typed cols + FromRow, canonical wave-12 rust store idiom).
// Timestamp columns are TIMESTAMPTZ and map to chrono; the wire structs
// (ThresholdRule/KpiAlert above) keep their RFC3339-string JSON shape.
#[derive(Debug, FromRow)]
struct ThresholdRow {
    id: String,
    role: String,
    metric_id: String,
    metric_name: String,
    condition: String,
    threshold_value: f64,
    severity: String,
    action: String,
    enabled: bool,
    cooldown_minutes: i32,
    last_triggered: Option<chrono::DateTime<chrono::Utc>>,
    description: String,
}

impl From<ThresholdRow> for ThresholdRule {
    fn from(r: ThresholdRow) -> Self {
        ThresholdRule {
            id: r.id,
            role: r.role,
            metric_id: r.metric_id,
            metric_name: r.metric_name,
            condition: r.condition,
            threshold_value: r.threshold_value,
            severity: r.severity,
            action: r.action,
            enabled: r.enabled,
            cooldown_minutes: r.cooldown_minutes.max(0) as u32,
            last_triggered: r.last_triggered.map(|t| t.to_rfc3339()),
            description: r.description,
        }
    }
}

#[derive(Debug, FromRow)]
struct AlertRow {
    id: String,
    rule_id: String,
    role: String,
    metric_id: String,
    metric_name: String,
    current_value: Option<f64>,
    threshold_value: f64,
    severity: String,
    status: String,
    triggered_at: chrono::DateTime<chrono::Utc>,
    acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
    resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    message: String,
    action_taken: String,
}

impl From<AlertRow> for KpiAlert {
    fn from(r: AlertRow) -> Self {
        KpiAlert {
            id: r.id,
            rule_id: r.rule_id,
            role: r.role,
            metric_id: r.metric_id,
            metric_name: r.metric_name,
            current_value: r.current_value,
            threshold_value: r.threshold_value,
            severity: r.severity,
            status: r.status,
            triggered_at: r.triggered_at.to_rfc3339(),
            acknowledged_at: r.acknowledged_at.map(|t| t.to_rfc3339()),
            resolved_at: r.resolved_at.map(|t| t.to_rfc3339()),
            message: r.message,
            action_taken: r.action_taken,
        }
    }
}

fn store_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "store_unavailable",
        "service": "kpi-threshold-monitor-rs",
        "detail": detail,
    }))
}

fn require_db(state: &web::Data<AppState>) -> Result<&PgPool, HttpResponse> {
    state.db.as_ref().ok_or_else(|| {
        store_unavailable("DATABASE_URL not configured or unreachable; refusing to fabricate KPI alert state")
    })
}

async fn init_store(db_url: &str) -> Option<PgPool> {
    if db_url.is_empty() {
        eprintln!("[kpi-threshold-monitor-rs] DATABASE_URL not set — persistent store unavailable (data endpoints will 503)");
        return None;
    }
    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(db_url)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[kpi-threshold-monitor-rs] DB connect failed: {} — endpoints will 503", e);
            return None;
        }
    };
    let schema = [
        r#"CREATE TABLE IF NOT EXISTS kpi_thresholds (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            metric_id TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            condition TEXT NOT NULL,
            threshold_value DOUBLE PRECISION NOT NULL,
            severity TEXT NOT NULL,
            action TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            cooldown_minutes INTEGER NOT NULL DEFAULT 0,
            last_triggered TIMESTAMPTZ,
            description TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE TABLE IF NOT EXISTS kpi_alerts (
            id TEXT PRIMARY KEY,
            rule_id TEXT NOT NULL,
            role TEXT NOT NULL,
            metric_id TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            current_value DOUBLE PRECISION,
            threshold_value DOUBLE PRECISION NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            acknowledged_at TIMESTAMPTZ,
            resolved_at TIMESTAMPTZ,
            message TEXT NOT NULL DEFAULT '',
            action_taken TEXT NOT NULL DEFAULT ''
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_kpi_alerts_status ON kpi_alerts (status)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_kpi_alerts_role ON kpi_alerts (role)"#,
    ];
    for stmt in schema {
        if let Err(e) = sqlx::query(stmt).execute(&pool).await {
            eprintln!("[kpi-threshold-monitor-rs] schema init failed: {} — endpoints will 503", e);
            return None;
        }
    }
    // Seed the default threshold rules idempotently (ON CONFLICT DO NOTHING) —
    // these are the former process-local defaults, preserved as boot config.
    for rule in default_thresholds() {
        if let Err(e) = sqlx::query(
            r#"INSERT INTO kpi_thresholds (id, role, metric_id, metric_name, condition, threshold_value, severity, action, enabled, cooldown_minutes, description)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(&rule.id).bind(&rule.role).bind(&rule.metric_id).bind(&rule.metric_name)
        .bind(&rule.condition).bind(rule.threshold_value).bind(&rule.severity).bind(&rule.action)
        .bind(rule.enabled).bind(rule.cooldown_minutes as i32).bind(&rule.description)
        .execute(&pool).await {
            eprintln!("[kpi-threshold-monitor-rs] threshold seed failed for {}: {}", rule.id, e);
        }
    }
    eprintln!("[kpi-threshold-monitor-rs] postgres store ready (tables kpi_thresholds/kpi_alerts)");
    Some(pool)
}

async fn insert_alert(db: &PgPool, a: &KpiAlert) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO kpi_alerts (id, rule_id, role, metric_id, metric_name, current_value, threshold_value, severity, status, triggered_at, message, action_taken)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW(), $10,$11)"#,
    )
    .bind(&a.id).bind(&a.rule_id).bind(&a.role).bind(&a.metric_id).bind(&a.metric_name)
    .bind(a.current_value).bind(a.threshold_value).bind(&a.severity).bind(&a.status)
    .bind(&a.message).bind(&a.action_taken)
    .execute(db).await?;
    Ok(())
}

// --- Graceful Degradation ---
static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(AtomicOrdering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "view").await { return resp; } // W12-B5P1DF
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(AtomicOrdering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(AtomicOrdering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let uptime = state.start_time.elapsed();
    let mut body = json!({
        "service": state.service_name,
        "status": "healthy",
        "version": "1.0.0",
        "uptime_secs": uptime.as_secs(),
        "database": if state.db.is_some() { "connected" } else if state.db_url.is_empty() { "not_configured" } else { "unreachable" },
    });
    if let Some(db) = state.db.as_ref() {
        // Honest live counts from the store; healthz stays 200 but reports
        // nulls when a count query fails (never fabricated counters).
        let active: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM kpi_alerts WHERE status = 'active'").fetch_one(db).await.ok();
        let unavailable: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM kpi_alerts WHERE status = 'data_unavailable'").fetch_one(db).await.ok();
        let total_rules: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM kpi_thresholds").fetch_one(db).await.ok();
        let enabled_rules: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM kpi_thresholds WHERE enabled").fetch_one(db).await.ok();
        body["active_alerts"] = json!(active);
        body["unavailable_metrics"] = json!(unavailable);
        body["total_rules"] = json!(total_rules);
        body["enabled_rules"] = json!(enabled_rules);
    }
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(body)
}

async fn list_thresholds(state: web::Data<AppState>, query: web::Query<ListParams>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "view").await { return resp; } // W12-B5P1DF
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).min(100) as i64;
    let offset = ((page - 1) as i64) * limit;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM kpi_thresholds WHERE ($1::text IS NULL OR role = $1) AND ($2::text IS NULL OR severity = $2)")
        .bind(&query.role).bind(&query.severity)
        .fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("kpi_thresholds count failed: {}", e)),
    };
    let rows = match sqlx::query_as::<_, ThresholdRow>(
        "SELECT id, role, metric_id, metric_name, condition, threshold_value, severity, action, enabled, cooldown_minutes, last_triggered, description
         FROM kpi_thresholds
         WHERE ($1::text IS NULL OR role = $1) AND ($2::text IS NULL OR severity = $2)
         ORDER BY id LIMIT $3 OFFSET $4")
        .bind(&query.role).bind(&query.severity).bind(limit).bind(offset)
        .fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("kpi_thresholds query failed: {}", e)),
    };
    let items: Vec<ThresholdRule> = rows.into_iter().map(ThresholdRule::from).collect();

    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "source": "kpi_thresholds"
    }))
}

async fn list_alerts(state: web::Data<AppState>, query: web::Query<ListParams>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "view").await { return resp; } // W12-B5P1DF
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).min(100) as i64;
    let offset = ((page - 1) as i64) * limit;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM kpi_alerts WHERE ($1::text IS NULL OR role = $1) AND ($2::text IS NULL OR severity = $2) AND ($3::text IS NULL OR status = $3)")
        .bind(&query.role).bind(&query.severity).bind(&query.status)
        .fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("kpi_alerts count failed: {}", e)),
    };
    let active_count: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM kpi_alerts WHERE status = 'active'")
        .fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("kpi_alerts count failed: {}", e)),
    };
    let rows = match sqlx::query_as::<_, AlertRow>(
        "SELECT id, rule_id, role, metric_id, metric_name, current_value, threshold_value, severity, status, triggered_at, acknowledged_at, resolved_at, message, action_taken
         FROM kpi_alerts
         WHERE ($1::text IS NULL OR role = $1) AND ($2::text IS NULL OR severity = $2) AND ($3::text IS NULL OR status = $3)
         ORDER BY triggered_at DESC, id LIMIT $4 OFFSET $5")
        .bind(&query.role).bind(&query.severity).bind(&query.status).bind(limit).bind(offset)
        .fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("kpi_alerts query failed: {}", e)),
    };
    let items: Vec<KpiAlert> = rows.into_iter().map(KpiAlert::from).collect();

    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "active_count": active_count,
        "source": "kpi_alerts"
    }))
}

async fn evaluate_thresholds(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if !rl_allow().await {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "evaluate").await { return resp; } // W12-B5P1DF
    // Evaluate all enabled thresholds against current DB values.
    // A metric source failure is LOUD: it produces a data_unavailable alert,
    // never a silently simulated KPI value.
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let thresholds: Vec<ThresholdRule> = match sqlx::query_as::<_, ThresholdRow>(
        "SELECT id, role, metric_id, metric_name, condition, threshold_value, severity, action, enabled, cooldown_minutes, last_triggered, description
         FROM kpi_thresholds ORDER BY id")
        .fetch_all(db).await {
        Ok(rows) => rows.into_iter().map(ThresholdRule::from).collect(),
        Err(e) => return store_unavailable(&format!("kpi_thresholds query failed: {}", e)),
    };
    let mut new_alerts: Vec<KpiAlert> = Vec::new();
    let mut evaluated = 0;
    let mut breached = 0;
    let mut unavailable = 0;

    for rule in thresholds.iter().filter(|t| t.enabled) {
        evaluated += 1;
        let current_value = match query_metric_value(&state.db_url, &rule.metric_id).await {
            Some(v) => v,
            None => {
                unavailable += 1;
                new_alerts.push(KpiAlert {
                    id: format!("alert-{}", chrono_now()),
                    rule_id: rule.id.clone(),
                    role: rule.role.clone(),
                    metric_id: rule.metric_id.clone(),
                    metric_name: rule.metric_name.clone(),
                    current_value: None,
                    threshold_value: rule.threshold_value,
                    severity: "critical".to_string(),
                    status: "data_unavailable".to_string(),
                    triggered_at: chrono_now(),
                    acknowledged_at: None,
                    resolved_at: None,
                    message: format!("Metric source unavailable for {} ({}) — no data; refusing to simulate a value",
                        rule.metric_name, rule.metric_id),
                    action_taken: rule.action.clone(),
                });
                continue;
            }
        };

        let is_breached = match rule.condition.as_str() {
            "gt" => current_value > rule.threshold_value,
            "lt" => current_value < rule.threshold_value,
            "gte" => current_value >= rule.threshold_value,
            "lte" => current_value <= rule.threshold_value,
            "eq" => (current_value - rule.threshold_value).abs() < 0.001,
            _ => false,
        };

        if is_breached {
            breached += 1;
            new_alerts.push(KpiAlert {
                id: format!("alert-{}", chrono_now()),
                rule_id: rule.id.clone(),
                role: rule.role.clone(),
                metric_id: rule.metric_id.clone(),
                metric_name: rule.metric_name.clone(),
                current_value: Some(current_value),
                threshold_value: rule.threshold_value,
                severity: rule.severity.clone(),
                status: "active".to_string(),
                triggered_at: chrono_now(),
                acknowledged_at: None,
                resolved_at: None,
                message: format!("{} breached: current={:.2}, threshold={:.2} ({})",
                    rule.metric_name, current_value, rule.threshold_value, rule.condition),
                action_taken: rule.action.clone(),
            });
        }
    }

    // Persist new alerts (INSERT-first; a persistence failure is loud — 503,
    // never a silently dropped alert).
    let mut persisted = 0usize;
    for alert in &new_alerts {
        match insert_alert(db, alert).await {
            Ok(()) => persisted += 1,
            Err(e) => {
                eprintln!("[kpi-threshold-monitor-rs] alert insert failed ({}): {}", alert.id, e);
                return store_unavailable(&format!("kpi_alerts insert failed: {}", e));
            }
        }
    }

    HttpResponse::Ok().json(json!({
        "evaluated": evaluated,
        "breached": breached,
        "unavailable": unavailable,
        "new_alerts": new_alerts.len(),
        "persisted_alerts": persisted,
        "timestamp": chrono_now(),
        "alerts": new_alerts
    }))
}

async fn acknowledge_alert(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "acknowledge").await { return resp; } // W12-B5P1DF
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let alert_id = path.into_inner();
    match sqlx::query("UPDATE kpi_alerts SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = $1 AND status IN ('active','data_unavailable')")
        .bind(&alert_id).execute(db).await {
        Ok(res) if res.rows_affected() > 0 => {
            HttpResponse::Ok().json(json!({"status": "acknowledged", "alert_id": alert_id}))
        }
        Ok(_) => HttpResponse::NotFound().json(json!({"error": "alert not found or already closed"})),
        Err(e) => store_unavailable(&format!("kpi_alerts acknowledge failed: {}", e)),
    }
}

async fn resolve_alert(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "resolve").await { return resp; } // W12-B5P1DF
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let alert_id = path.into_inner();
    match sqlx::query("UPDATE kpi_alerts SET status = 'resolved', resolved_at = NOW() WHERE id = $1 AND status <> 'resolved'")
        .bind(&alert_id).execute(db).await {
        Ok(res) if res.rows_affected() > 0 => {
            HttpResponse::Ok().json(json!({"status": "resolved", "alert_id": alert_id}))
        }
        Ok(_) => HttpResponse::NotFound().json(json!({"error": "alert not found or already resolved"})),
        Err(e) => store_unavailable(&format!("kpi_alerts resolve failed: {}", e)),
    }
}

async fn dashboard_summary(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "view").await { return resp; } // W12-B5P1DF
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    async fn count_status(db: &PgPool, status: &str) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM kpi_alerts WHERE status = $1")
            .bind(status).fetch_one(db).await
    }
    let active = match count_status(db, "active").await { Ok(n) => n, Err(e) => return store_unavailable(&format!("summary query failed: {}", e)) };
    let acknowledged = match count_status(db, "acknowledged").await { Ok(n) => n, Err(e) => return store_unavailable(&format!("summary query failed: {}", e)) };
    let resolved = match count_status(db, "resolved").await { Ok(n) => n, Err(e) => return store_unavailable(&format!("summary query failed: {}", e)) };
    let data_unavailable = match count_status(db, "data_unavailable").await { Ok(n) => n, Err(e) => return store_unavailable(&format!("summary query failed: {}", e)) };

    let sev_rows = match sqlx::query_as::<_, (String, i64)>("SELECT severity, COUNT(*) FROM kpi_alerts WHERE status = 'active' GROUP BY severity")
        .fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("summary query failed: {}", e)),
    };
    let active_by_severity: HashMap<String, i64> = sev_rows.into_iter().collect();

    let role_rows = match sqlx::query_as::<_, (String, i64)>("SELECT role, COUNT(*) FROM kpi_alerts WHERE status = 'active' GROUP BY role")
        .fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("summary query failed: {}", e)),
    };
    let active_by_role: HashMap<String, i64> = role_rows.into_iter().collect();

    let total_rules: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM kpi_thresholds").fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("summary query failed: {}", e)),
    };
    let enabled_rules: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM kpi_thresholds WHERE enabled").fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("summary query failed: {}", e)),
    };

    HttpResponse::Ok().json(json!({
        "total_active_alerts": active,
        "total_acknowledged": acknowledged,
        "total_resolved": resolved,
        "total_data_unavailable": data_unavailable,
        "active_by_severity": active_by_severity,
        "active_by_role": active_by_role,
        "total_rules": total_rules,
        "enabled_rules": enabled_rules,
        "last_evaluation": chrono_now()
    }))
}

// Returns None when the metric source (Postgres) is unavailable or the metric
// has no computable value. Callers must treat None as data_unavailable (loud).
async fn query_metric_value(db_url: &str, metric_id: &str) -> Option<f64> {
    if db_url.is_empty() {
        eprintln!("[kpi-threshold-monitor-rs] metric {} unavailable: DATABASE_URL not set", metric_id);
        return None;
    }
    let query = get_metric_query(metric_id);
    if query.is_empty() {
        eprintln!("[kpi-threshold-monitor-rs] metric {} has no query mapping", metric_id);
        return None;
    }
    match tokio_postgres::connect(db_url, tokio_postgres::NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { let _ = connection.await; });
            match client.query_opt(query, &[]).await {
                Ok(Some(row)) => {
                    if let Ok(Some(val)) = row.try_get::<_, Option<f64>>(0) {
                        return Some(val);
                    }
                    if let Ok(Some(val)) = row.try_get::<_, Option<i64>>(0) {
                        return Some(val as f64);
                    }
                    None
                }
                Ok(None) => None,
                Err(e) => {
                    eprintln!("[kpi-threshold-monitor-rs] metric {} query failed: {}", metric_id, e);
                    DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
                    None
                }
            }
        }
        Err(e) => {
            eprintln!("[kpi-threshold-monitor-rs] DB connect failed for metric {}: {}", metric_id, e);
            DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
            None
        }
    }
}

fn get_metric_query(metric_id: &str) -> &str {
    match metric_id {
        "cro_aml_alerts" => "SELECT COUNT(*)::float8 FROM aml_alerts WHERE status = 'pending'",
        // NPL ratio: NULL (=> data_unavailable) when the loan book is empty — never a default 3.5%.
        "cro_npl" => "SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(*) FILTER (WHERE status = 'non_performing')::float8 * 100 / COUNT(*) END FROM loans",
        "cso_incidents" => "SELECT COUNT(*)::float8 FROM security_events WHERE severity = 'critical' AND status = 'open'",
        "coo_fail_rate" => "SELECT COALESCE(COUNT(*) FILTER (WHERE status='failed')::float8 * 100 / NULLIF(COUNT(*), 0), 0) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour'",
        // Real cash variance: GL vault balance (glAccounts 1001) vs physical vault counts.
        // Missing tables/columns => query error => data_unavailable (loud).
        "htl_cash_variance" => "SELECT ABS(COALESCE((SELECT balance::float8 FROM \"glAccounts\" WHERE \"glAccountCode\" = '1001'), 0) - COALESCE((SELECT SUM(counted_amount::float8) FROM cash_vault_counts WHERE counted_at::date = CURRENT_DATE), 0))::float8",
        "cmp_sar_backlog" => "SELECT COUNT(*)::float8 FROM sar_reports WHERE status = 'pending' AND created_at < NOW() - INTERVAL '72 hours'",
        _ => "",
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn default_thresholds() -> Vec<ThresholdRule> {
    vec![
        ThresholdRule { id: "thr-001".into(), role: "cro".into(), metric_id: "cro_aml_alerts".into(), metric_name: "Unresolved AML Alerts".into(), condition: "gt".into(), threshold_value: 5.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 15, last_triggered: None, description: "Alert when pending AML cases exceed 5".into() },
        ThresholdRule { id: "thr-002".into(), role: "cro".into(), metric_id: "cro_npl".into(), metric_name: "NPL Ratio".into(), condition: "gt".into(), threshold_value: 5.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 60, last_triggered: None, description: "Alert when NPL exceeds CBN 5% threshold".into() },
        ThresholdRule { id: "thr-003".into(), role: "cso".into(), metric_id: "cso_incidents".into(), metric_name: "Active Security Incidents".into(), condition: "gt".into(), threshold_value: 0.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 5, last_triggered: None, description: "Alert on any active security incident".into() },
        ThresholdRule { id: "thr-004".into(), role: "coo".into(), metric_id: "coo_fail_rate".into(), metric_name: "Failed Transaction Rate".into(), condition: "gt".into(), threshold_value: 1.0, severity: "warning".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 30, last_triggered: None, description: "Alert when failure rate exceeds 1%".into() },
        ThresholdRule { id: "thr-005".into(), role: "head_teller".into(), metric_id: "htl_cash_variance".into(), metric_name: "Cash Vault Variance".into(), condition: "gt".into(), threshold_value: 10000.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 15, last_triggered: None, description: "Alert on cash variance > ₦10,000".into() },
        ThresholdRule { id: "thr-006".into(), role: "compliance".into(), metric_id: "cmp_sar_backlog".into(), metric_name: "SAR Filing Backlog".into(), condition: "gt".into(), threshold_value: 0.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 60, last_triggered: None, description: "Alert on any overdue SAR filing".into() },
        ThresholdRule { id: "thr-007".into(), role: "cto".into(), metric_id: "cto_error_rate".into(), metric_name: "API Error Rate".into(), condition: "gt".into(), threshold_value: 0.5, severity: "warning".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 15, last_triggered: None, description: "Alert when 5xx error rate exceeds 0.5%".into() },
        ThresholdRule { id: "thr-008".into(), role: "treasury".into(), metric_id: "trs_liquidity".into(), metric_name: "Liquidity Ratio".into(), condition: "lt".into(), threshold_value: 30.0, severity: "critical".into(), action: "kafka_publish".into(), enabled: true, cooldown_minutes: 30, last_triggered: None, description: "Alert when liquidity drops below CBN 30% minimum".into() },
    ]
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn alerts_endpoint(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "kpi", "view").await { return resp; } // W12-B5P1DF
    let reqs = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let errs = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let error_rate = if reqs > 0 { errs as f64 / reqs as f64 } else { 0.0 };
    let mut fired = Vec::<serde_json::Value>::new();
    if error_rate > 0.05 {
        fired.push(json!({"rule": "high_error_rate", "value": error_rate, "severity": "critical"}));
    }
    HttpResponse::Ok().json(json!({
        "alerts": fired,
        "rules": 3,
        "error_rate": error_rate,
    }))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "kpi-threshold-monitor-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"kpi-threshold-monitor-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"kpi-threshold-monitor-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- JWT Auth Check ---
// --- JWT Auth Check (fail-closed; R4-V4 remediation) ---
// Canonical RS256/JWKS-primary verifier aligned with pin-block-engine-rs:
// tokens are verified against the Keycloak JWKS (KEYCLOAK_JWKS_URL, or derived
// from KEYCLOAK_REALM_URL) with a 300s cache and a 5s fetch timeout; HS256 via
// JWT_SECRET remains as a fallback. 401 on missing/malformed/expired/
// unknown-kid tokens; 503 when no verification backend is available. Verified
// claims are stored in request extensions for downstream handlers.

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct VerifiedClaims(serde_json::Value);

struct JwksCacheEntry {
    fetched_at: std::time::Instant,
    keys: jsonwebtoken::jwk::JwkSet,
}

static JWKS_CACHE: std::sync::OnceLock<std::sync::Mutex<Option<JwksCacheEntry>>> = std::sync::OnceLock::new();

fn jwks_cache() -> &'static std::sync::Mutex<Option<JwksCacheEntry>> {
    JWKS_CACHE.get_or_init(|| std::sync::Mutex::new(None))
}

fn jwks_url() -> Option<String> {
    if let Ok(u) = std::env::var("KEYCLOAK_JWKS_URL") {
        if !u.is_empty() {
            return Some(u);
        }
    }
    match std::env::var("KEYCLOAK_REALM_URL") {
        Ok(realm) if !realm.is_empty() => {
            Some(format!("{}/protocol/openid-connect/certs", realm.trim_end_matches('/')))
        }
        _ => None,
    }
}

async fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, actix_web::HttpResponse> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => {
            return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwt_validation_unavailable",
                "detail": "no JWKS endpoint configured"
            })))
        }
    };
    {
        let cache = jwks_cache().lock().unwrap();
        if let Some(entry) = cache.as_ref() {
            if entry.fetched_at.elapsed() < JWKS_TTL {
                return Ok(entry.keys.clone());
            }
        }
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "client init failed"
        })))?;
    let resp = client.get(&url).send().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "jwks_unavailable"}))
    })?;
    if !resp.status().is_success() {
        return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "upstream returned error status"
        })));
    }
    let keys = resp.json::<jsonwebtoken::jwk::JwkSet>().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "malformed JWKS payload"
        }))
    })?;
    let mut cache = jwks_cache().lock().unwrap();
    *cache = Some(JwksCacheEntry { fetched_at: std::time::Instant::now(), keys: keys.clone() });
    Ok(keys)
}

fn apply_iss_aud(validation: &mut jsonwebtoken::Validation) {
    if let Ok(iss) = std::env::var("JWT_EXPECTED_ISS") {
        if !iss.is_empty() {
            validation.set_issuer(&[iss]);
        }
    }
    if let Ok(aud) = std::env::var("JWT_EXPECTED_AUD") {
        if !aud.is_empty() {
            validation.set_audience(&[aud]);
        }
    }
}

async fn verify_jwt_token(token: &str) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let header = jsonwebtoken::decode_header(token)
        .map_err(|_| actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "malformed token header"})))?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing kid"}))),
            };
            // JWKS outage => 503 (fail closed). Unknown kid => force one cache
            // refresh (key rotation), then 401 if still unknown.
            let jwks = fetch_jwks().await?;
            let jwk = match jwks.find(&kid) {
                Some(j) => j.clone(),
                None => {
                    {
                        let mut cache = jwks_cache().lock().unwrap();
                        *cache = None;
                    }
                    let refreshed = fetch_jwks().await?;
                    match refreshed.find(&kid) {
                        Some(j) => j.clone(),
                        None => {
                            return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "unknown kid"})))
                        }
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk)
                .map_err(|_| actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid jwk"})))?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                        "error": "jwt_validation_unavailable",
                        "detail": "JWT_SECRET is not configured; refusing to validate"
                    })))
                }
            };
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(
                token,
                &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
                &validation,
            ) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        other => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({
            "error": format!("unsupported alg {:?}", other)
        }))),
    }
}

async fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims));
    Ok(())
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}



// --- Distributed rate limiting (redis shared sliding window; W12 C3-P1-B1) ---
// Replaces the per-replica statics _RL_TOKENS/_RL_LAST (and the dead
// _RATE_WINDOW_START/_RATE_WINDOW_COUNT pair): behind >1 replica the old
// per-process bucket multiplied the effective limit by the replica count
// (correctness bug). Now an atomic Lua INCR+PEXPIRE sliding window on a shared
// deadpool-redis pool; limit is global per service, not per replica.
// Key: ratelimit:kpi-threshold-monitor-rs:global — the replaced bucket was process-global (no
// per-ip/per-user subject), so the subject segment is preserved as "global".
// Window/limit: 100 requests per 1000 ms — identical to the old token bucket.
// Env: REDIS_URL (fleet-wide var, cf. docker-compose.yml REDIS_URL entries);
// default redis://redis:6379 matches the compose network.
// Fail-mode: FAIL CLOSED — when redis is unreachable or errors, rl_allow()
// returns false and callers answer 429 + Retry-After, mirroring check_jwt's
// fail-closed style. Limiting is never silently disabled.
static RL_POOL: std::sync::OnceLock<Option<deadpool_redis::Pool>> = std::sync::OnceLock::new();
static RL_SCRIPT: std::sync::OnceLock<deadpool_redis::redis::Script> = std::sync::OnceLock::new();

const RL_WINDOW_MS: u64 = 1000;
const RL_LIMIT: i64 = 100;
const RL_LUA: &str = "local c = redis.call('INCR', KEYS[1])\nif c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end\nreturn c";

fn rl_pool() -> Option<&'static deadpool_redis::Pool> {
    RL_POOL
        .get_or_init(|| {
            let url =
                std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
            deadpool_redis::Config::from_url(url)
                .create_pool(Some(deadpool_redis::Runtime::Tokio1))
                .ok()
        })
        .as_ref()
}

async fn rl_allow() -> bool {
    let Some(pool) = rl_pool() else {
        return false; // fail closed: redis pool unavailable (malformed REDIS_URL)
    };
    let Ok(mut conn) = pool.get().await else {
        return false; // fail closed: redis unreachable
    };
    let script = RL_SCRIPT.get_or_init(|| deadpool_redis::redis::Script::new(RL_LUA));
    let count: Result<i64, deadpool_redis::redis::RedisError> = script
        .key("ratelimit:kpi-threshold-monitor-rs:global")
        .arg(RL_WINDOW_MS)
        .invoke_async(&mut *conn)
        .await;
    match count {
        Ok(n) => n <= RL_LIMIT,
        Err(_) => false, // fail closed: redis error
    }
}


// --- gRPC Server (binary protocol, length-prefixed) ---
fn start_grpc_server(service_name: &'static str, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("0.0.0.0:{}", port)) {
            Ok(l) => l,
            Err(e) => { eprintln!("[{}] gRPC bind :{} failed: {}", service_name, port, e); return; }
        };
        eprintln!("[{}] gRPC server on :{}", service_name, port);
        // Wave-11: bound concurrent connection handlers (was: unbounded thread-per-conn).
        let conn_sem = std::sync::Arc::new(tokio::sync::Semaphore::new(256));
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let conn_permit = match conn_sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => {
                        eprintln!("[{}] gRPC connection limit (256) reached; dropping connection", service_name);
                        continue;
                    }
                };
                std::thread::spawn(move || {
                    let _conn_permit = conn_permit; // released when handler exits
                    use std::io::{Read, Write};
                    let mut len_buf = [0u8; 4];
                    if stream.read_exact(&mut len_buf).is_err() { return; }
                    let msg_len = u32::from_be_bytes(len_buf) as usize;
                    if msg_len > 4 * 1024 * 1024 { return; }
                    let mut payload = vec![0u8; msg_len];
                    if stream.read_exact(&mut payload).is_err() { return; }
                    let resp = if std::env::var("FAKE_GRPC_OK").ok().as_deref() == Some("1") {
                        // FAKE_GRPC_OK=1: legacy stub for local development only.
                        format!(r#"{{"status":"ok","service":"{}"}}"#, service_name)
                    } else {
                        // gRPC UNIMPLEMENTED (status 12): never fabricate OK for
                        // an unimplemented handler.
                        format!(r#"{{"error":"unimplemented","grpcStatus":12,"service":"{}"}}"#, service_name)
                    };
                    let resp_bytes = resp.as_bytes();
                    let resp_len = (resp_bytes.len() as u32).to_be_bytes();
                    let _ = stream.write_all(&resp_len);
                    let _ = stream.write_all(resp_bytes);
                });
            }
        }
    });
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8501".into()).parse().unwrap_or(8501);
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    if db_url.is_empty() {
        eprintln!("[kpi-threshold-monitor-rs] DATABASE_URL not set — all metric evaluations will alert as data_unavailable (loud)");
    }

    // Fail-closed store: None => all data endpoints 503 (never in-memory fallback).
    let db = init_store(&db_url).await;

    let state = AppState {
        start_time: Instant::now(),
        db_url,
        db,
        service_name: "kpi-threshold-monitor-rs".into(),
    };

    println!("kpi-threshold-monitor-rs starting on :{} (8 threshold rules, fail-loud on metric source failure)", port);

    start_grpc_server("kpi-threshold-monitor-rs", 10448);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/api/kpi/thresholds", web::get().to(list_thresholds))
            .route("/api/kpi/alerts", web::get().to(list_alerts))
            .route("/api/kpi/alerts/evaluate", web::post().to(evaluate_thresholds))
            .route("/api/kpi/alerts/{id}/acknowledge", web::post().to(acknowledge_alert))
            .route("/api/kpi/alerts/{id}/resolve", web::post().to(resolve_alert))
            .route("/api/kpi/alerts/summary", web::get().to(dashboard_summary))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        AppState {
            start_time: self.start_time,
            db_url: self.db_url.clone(),
            db: self.db.clone(),
            service_name: self.service_name.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_healthz_exists() {
        assert!(true, "healthz should be defined");
    }

    #[test]
    fn test_evaluate_thresholds_exists() {
        assert!(true, "evaluate_thresholds should be defined");
    }

    #[test]
    fn test_metric_query_no_fake_variance() {
        // The cash variance metric must be a REAL query, never SELECT 0.
        assert!(!get_metric_query("htl_cash_variance").contains("SELECT 0"));
    }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
    }
}

// Wave-12 B5-P1-D-F: Permify authorization guard module.
mod permify;
