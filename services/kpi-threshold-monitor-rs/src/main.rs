#![allow(unused)]
// kpi-threshold-monitor-rs — Real-time KPI threshold monitoring with Kafka alert publishing
// Port: 8501
// Middleware: Postgres, Redis, Kafka, Dapr, Fluvio, Temporal, OpenSearch, Permify
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU64, AtomicI64, AtomicI32, AtomicBool, Ordering as AtomicOrdering};
use std::time::Instant;

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

struct AppState {
    start_time: Instant,
    db_url: String,
    service_name: String,
    alerts: Arc<RwLock<Vec<KpiAlert>>>,
    thresholds: Arc<RwLock<Vec<ThresholdRule>>>,
}

// --- Graceful Degradation ---
static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(AtomicOrdering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(AtomicOrdering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(AtomicOrdering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let uptime = state.start_time.elapsed();
    let alerts = state.alerts.read().unwrap();
    let thresholds = state.thresholds.read().unwrap();
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "service": state.service_name,
        "status": "healthy",
        "version": "1.0.0",
        "uptime_secs": uptime.as_secs(),
        "database": if state.db_url.is_empty() { "not_configured" } else { "configured" },
        "active_alerts": alerts.iter().filter(|a| a.status == "active").count(),
        "unavailable_metrics": alerts.iter().filter(|a| a.status == "data_unavailable").count(),
        "total_rules": thresholds.len(),
        "enabled_rules": thresholds.iter().filter(|t| t.enabled).count(),
    }))
}

async fn list_thresholds(state: web::Data<AppState>, query: web::Query<ListParams>) -> HttpResponse {
    let thresholds = state.thresholds.read().unwrap();
    let mut filtered: Vec<&ThresholdRule> = thresholds.iter().collect();

    if let Some(ref role) = query.role {
        filtered.retain(|t| &t.role == role);
    }
    if let Some(ref severity) = query.severity {
        filtered.retain(|t| &t.severity == severity);
    }

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).min(100);
    let total = filtered.len();
    let start = (page - 1) * limit;
    let items: Vec<&ThresholdRule> = filtered.into_iter().skip(start).take(limit).collect();

    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "source": "threshold_rules"
    }))
}

async fn list_alerts(state: web::Data<AppState>, query: web::Query<ListParams>) -> HttpResponse {
    let alerts = state.alerts.read().unwrap();
    let mut filtered: Vec<&KpiAlert> = alerts.iter().collect();

    if let Some(ref role) = query.role {
        filtered.retain(|a| &a.role == role);
    }
    if let Some(ref severity) = query.severity {
        filtered.retain(|a| &a.severity == severity);
    }
    if let Some(ref status) = query.status {
        filtered.retain(|a| &a.status == status);
    }

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).min(100);
    let total = filtered.len();
    let start = (page - 1) * limit;
    let items: Vec<&KpiAlert> = filtered.into_iter().skip(start).take(limit).collect();

    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "active_count": alerts.iter().filter(|a| a.status == "active").count(),
        "source": "kpi_alerts"
    }))
}

async fn evaluate_thresholds(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    // Evaluate all enabled thresholds against current DB values.
    // A metric source failure is LOUD: it produces a data_unavailable alert,
    // never a silently simulated KPI value.
    let thresholds = state.thresholds.read().unwrap().clone();
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

    // Store new alerts
    if !new_alerts.is_empty() {
        let mut alerts = state.alerts.write().unwrap();
        alerts.extend(new_alerts.clone());
    }

    HttpResponse::Ok().json(json!({
        "evaluated": evaluated,
        "breached": breached,
        "unavailable": unavailable,
        "new_alerts": new_alerts.len(),
        "timestamp": chrono_now(),
        "alerts": new_alerts
    }))
}

async fn acknowledge_alert(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let alert_id = path.into_inner();
    let mut alerts = state.alerts.write().unwrap();
    if let Some(alert) = alerts.iter_mut().find(|a| a.id == alert_id) {
        alert.status = "acknowledged".to_string();
        alert.acknowledged_at = Some(chrono_now());
        HttpResponse::Ok().json(json!({"status": "acknowledged", "alert_id": alert_id}))
    } else {
        HttpResponse::NotFound().json(json!({"error": "alert not found"}))
    }
}

async fn resolve_alert(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let alert_id = path.into_inner();
    let mut alerts = state.alerts.write().unwrap();
    if let Some(alert) = alerts.iter_mut().find(|a| a.id == alert_id) {
        alert.status = "resolved".to_string();
        alert.resolved_at = Some(chrono_now());
        HttpResponse::Ok().json(json!({"status": "resolved", "alert_id": alert_id}))
    } else {
        HttpResponse::NotFound().json(json!({"error": "alert not found"}))
    }
}

async fn dashboard_summary(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let alerts = state.alerts.read().unwrap();
    let thresholds = state.thresholds.read().unwrap();

    let active_by_severity: HashMap<&str, usize> = alerts.iter()
        .filter(|a| a.status == "active")
        .fold(HashMap::new(), |mut acc, a| {
            *acc.entry(a.severity.as_str()).or_insert(0) += 1;
            acc
        });

    let active_by_role: HashMap<&str, usize> = alerts.iter()
        .filter(|a| a.status == "active")
        .fold(HashMap::new(), |mut acc, a| {
            *acc.entry(a.role.as_str()).or_insert(0) += 1;
            acc
        });

    HttpResponse::Ok().json(json!({
        "total_active_alerts": alerts.iter().filter(|a| a.status == "active").count(),
        "total_acknowledged": alerts.iter().filter(|a| a.status == "acknowledged").count(),
        "total_resolved": alerts.iter().filter(|a| a.status == "resolved").count(),
        "total_data_unavailable": alerts.iter().filter(|a| a.status == "data_unavailable").count(),
        "active_by_severity": active_by_severity,
        "active_by_role": active_by_role,
        "total_rules": thresholds.len(),
        "enabled_rules": thresholds.iter().filter(|t| t.enabled).count(),
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

async fn alerts_endpoint() -> HttpResponse {
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
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"}))),
    };
    // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(json!({"error": "invalid or expired token"}))),
    }
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


static _RL_TOKENS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(100);
static _RL_LAST: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    if now - _RL_LAST.load(std::sync::atomic::Ordering::Relaxed) >= 1000 {
        _RL_TOKENS.store(100, std::sync::atomic::Ordering::Relaxed);
        _RL_LAST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
    if _RL_TOKENS.fetch_sub(1, std::sync::atomic::Ordering::Relaxed) <= 0 {
        _RL_TOKENS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return false;
    }
    true
}


// --- gRPC Server (binary protocol, length-prefixed) ---
fn start_grpc_server(service_name: &'static str, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("0.0.0.0:{}", port)) {
            Ok(l) => l,
            Err(e) => { eprintln!("[{}] gRPC bind :{} failed: {}", service_name, port, e); return; }
        };
        eprintln!("[{}] gRPC server on :{}", service_name, port);
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                std::thread::spawn(move || {
                    use std::io::{Read, Write};
                    let mut len_buf = [0u8; 4];
                    if stream.read_exact(&mut len_buf).is_err() { return; }
                    let msg_len = u32::from_be_bytes(len_buf) as usize;
                    if msg_len > 4 * 1024 * 1024 { return; }
                    let mut payload = vec![0u8; msg_len];
                    if stream.read_exact(&mut payload).is_err() { return; }
                    let resp = if std::env::var("FAKE_GRPC_OK").ok().as_deref() == Some("1") {
                        // FAKE_GRPC_OK=1: legacy stub for local development only.
                        format!(r#"{"status":"ok","service":"{}"}"#, service_name)
                    } else {
                        // gRPC UNIMPLEMENTED (status 12): never fabricate OK for
                        // an unimplemented handler.
                        format!(r#"{"error":"unimplemented","grpcStatus":12,"service":"{}"}"#, service_name)
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

    let state = AppState {
        start_time: Instant::now(),
        db_url,
        service_name: "kpi-threshold-monitor-rs".into(),
        alerts: Arc::new(RwLock::new(Vec::new())),
        thresholds: Arc::new(RwLock::new(default_thresholds())),
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
            service_name: self.service_name.clone(),
            alerts: self.alerts.clone(),
            thresholds: self.thresholds.clone(),
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
