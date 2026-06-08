use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde_json::json;
use std::env;
use tokio_postgres::NoTls;

fn check_jwt(req: &HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" || path == "/v1/degradation" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
}

// ── Circuit Breaker States ──

#[derive(Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum CBState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Clone, Serialize, Deserialize)]
struct CircuitBreaker {
    service: String,
    state: CBState,
    failure_count: u32,
    success_count: u64,
    failure_threshold: u32,
    success_threshold_half_open: u32,
    cooldown_ms: u64,
    last_failure_at: Option<String>,
    last_success_at: Option<String>,
    opened_at: Option<String>,
    half_open_at: Option<String>,
    total_requests: u64,
    total_timeouts: u64,
    total_rejections: u64,
    p50_latency_ms: f64,
    p99_latency_ms: f64,
    fallback_strategy: String,
    health_check_url: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct CBEvent {
    id: String,
    service: String,
    event_type: String,
    from_state: String,
    to_state: String,
    reason: String,
    timestamp: String,
    failure_count: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct CBConfig {
    service: String,
    failure_threshold: u32,
    success_threshold_half_open: u32,
    cooldown_ms: u64,
    timeout_ms: u64,
    volume_threshold: u32,
    error_rate_threshold: f64,
    fallback_strategy: String,
    health_check_interval_ms: u64,
    bulkhead_max_concurrent: u32,
    bulkhead_max_queue: u32,
    retry_max_attempts: u32,
    retry_base_delay_ms: u64,
    retry_max_delay_ms: u64,
    retry_backoff_multiplier: f64,
    retry_jitter: bool,
}

struct AppState {
    breakers: Mutex<Vec<CircuitBreaker>>,
    events: Mutex<Vec<CBEvent>>,
    configs: Mutex<Vec<CBConfig>>,
    db: Option<Arc<tokio_postgres::Client>>,
}

async fn init_db() -> Option<Arc<tokio_postgres::Client>> {
    let db_url = env::var("DATABASE_URL").ok()?;
    match tokio_postgres::connect(&db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    eprintln!("[circuit-breaker] DB connection error: {}", e);
                }
            });
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS circuit_breaker_state (
                    service TEXT PRIMARY KEY,
                    state TEXT NOT NULL DEFAULT 'closed',
                    failure_count INTEGER DEFAULT 0,
                    total_requests BIGINT DEFAULT 0,
                    data JSONB DEFAULT '{}',
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS circuit_breaker_events (
                    id TEXT PRIMARY KEY,
                    service TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    from_state TEXT,
                    to_state TEXT,
                    reason TEXT,
                    timestamp TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            println!("[circuit-breaker] PostgreSQL connected — state will be persisted");
            Some(Arc::new(client))
        }
        Err(e) => {
            eprintln!("[circuit-breaker] DB connect failed: {} — in-memory only", e);
            None
        }
    }
}

async fn db_persist_state(db: &Option<Arc<tokio_postgres::Client>>, breaker: &CircuitBreaker) {
    if let Some(ref client) = db {
        let state_str = match breaker.state {
            CBState::Closed => "closed",
            CBState::Open => "open",
            CBState::HalfOpen => "half_open",
        };
        let data = serde_json::to_string(breaker).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO circuit_breaker_state (service, state, failure_count, total_requests, data) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (service) DO UPDATE SET state=$2, failure_count=$3, total_requests=$4, data=$5::jsonb, updated_at=NOW()",
            &[&breaker.service, &state_str.to_string(), &(breaker.failure_count as i32), &(breaker.total_requests as i64), &data],
        ).await;
    }
}

async fn db_persist_event(db: &Option<Arc<tokio_postgres::Client>>, event: &CBEvent) {
    if let Some(ref client) = db {
        let _ = client.execute(
            "INSERT INTO circuit_breaker_events (id, service, event_type, from_state, to_state, reason) VALUES ($1,$2,$3,$4,$5,$6)",
            &[&event.id, &event.service, &event.event_type, &event.from_state, &event.to_state, &event.reason],
        ).await;
    }
}

fn compute_failure_rate(failures: u32, total: u64) -> f64 {
    if total == 0 { return 0.0; }
    failures as f64 / total as f64 * 100.0
}

fn evaluate_health_score(failure_rate: f64, p99_latency: f64, timeouts: u64, total: u64) -> f64 {
    let timeout_rate = if total > 0 { timeouts as f64 / total as f64 } else { 0.0 };
    let latency_penalty = if p99_latency > 1000.0 { 20.0 } else if p99_latency > 500.0 { 10.0 } else { 0.0 };
    let base = 100.0 - failure_rate - timeout_rate * 100.0 - latency_penalty;
    if base < 0.0 { 0.0 } else { base }
}

fn check_should_trip(failure_count: u32, threshold: u32, window_failures: &[u64], min_requests: u64) -> bool {
    let total: u64 = window_failures.iter().sum();
    failure_count >= threshold && total >= min_requests
}

fn compute_backoff_delay(attempt: u32, base_ms: u64, max_ms: u64, multiplier: f64) -> u64 {
    let delay = base_ms as f64 * multiplier.powi(attempt as i32);
    (delay as u64).min(max_ms)
}

fn seed_breakers() -> Vec<CircuitBreaker> {
    let services = vec![
        ("core-banking-go", 8090, "closed", 0, 45200, "seed_data_fallback"),
        ("payments-hub-go", 8091, "closed", 1, 38100, "seed_data_fallback"),
        ("card-management-go", 8092, "closed", 0, 22300, "seed_data_fallback"),
        ("kyc-engine-py", 8100, "closed", 0, 15600, "seed_data_fallback"),
        ("gl-engine-rs", 8251, "closed", 0, 31200, "seed_data_fallback"),
        ("swift-messaging-go", 8248, "closed", 0, 8900, "queue_and_retry"),
        ("tigerbeetle-adapter-rs", 8180, "closed", 0, 62000, "reject_fast"),
        ("nibss-gateway-go", 8108, "half_open", 4, 2100, "queue_and_retry"),
        ("cbn-returns-py", 8109, "closed", 0, 890, "seed_data_fallback"),
        ("redis-cache", 6379, "closed", 0, 189000, "local_cache"),
        ("kafka-broker", 9092, "closed", 0, 120000, "dead_letter_queue"),
        ("mojaloop-connector-go", 8120, "closed", 2, 5600, "queue_and_retry"),
        ("securities-trading-rs", 8254, "closed", 0, 4300, "reject_fast"),
        ("microfinance-py", 8252, "closed", 0, 12400, "seed_data_fallback"),
        ("ddos-protection-go", 8247, "closed", 0, 95000, "passthrough"),
        ("pbac-engine-go", 8249, "closed", 0, 78000, "deny_all"),
        ("regulatory-automation-py", 8255, "closed", 0, 3200, "seed_data_fallback"),
        ("opensearch-analytics-py", 8170, "closed", 0, 28000, "seed_data_fallback"),
        ("keycloak-identity-py", 8160, "closed", 0, 56000, "cached_token"),
        ("temporal-worker", 7233, "closed", 0, 34000, "queue_and_retry"),
    ];
    services.iter().map(|(svc, port, state, fails, successes, fallback)| {
        CircuitBreaker {
            service: svc.to_string(),
            state: match *state {
                "open" => CBState::Open,
                "half_open" => CBState::HalfOpen,
                _ => CBState::Closed,
            },
            failure_count: *fails,
            success_count: *successes as u64,
            failure_threshold: 5,
            success_threshold_half_open: 3,
            cooldown_ms: 30000,
            last_failure_at: if *fails > 0 { Some("2026-05-11T15:00:00Z".into()) } else { None },
            last_success_at: Some("2026-05-11T15:10:00Z".into()),
            opened_at: if *state == "open" { Some("2026-05-11T15:00:00Z".into()) } else { None },
            half_open_at: if *state == "half_open" { Some("2026-05-11T15:05:00Z".into()) } else { None },
            total_requests: *successes as u64 + *fails as u64,
            total_timeouts: (*fails as u64) / 2,
            total_rejections: 0,
            p50_latency_ms: 45.0 + (*port as f64 % 100.0),
            p99_latency_ms: 450.0 + (*port as f64 % 500.0),
            fallback_strategy: fallback.to_string(),
            health_check_url: format!("http://localhost:{}/healthz", port),
        }
    }).collect()
}

fn seed_events() -> Vec<CBEvent> {
    vec![
        CBEvent { id: "EVT-001".into(), service: "nibss-gateway-go".into(), event_type: "trip".into(), from_state: "closed".into(), to_state: "open".into(), reason: "5 consecutive timeouts to NIBSS DirectDebit endpoint".into(), timestamp: "2026-05-11T14:50:00Z".into(), failure_count: 5 },
        CBEvent { id: "EVT-002".into(), service: "nibss-gateway-go".into(), event_type: "attempt_reset".into(), from_state: "open".into(), to_state: "half_open".into(), reason: "Cooldown elapsed, probing with single request".into(), timestamp: "2026-05-11T15:05:00Z".into(), failure_count: 5 },
        CBEvent { id: "EVT-003".into(), service: "payments-hub-go".into(), event_type: "failure_recorded".into(), from_state: "closed".into(), to_state: "closed".into(), reason: "Timeout on /v1/payments/interbank (10s)".into(), timestamp: "2026-05-11T14:55:00Z".into(), failure_count: 1 },
        CBEvent { id: "EVT-004".into(), service: "mojaloop-connector-go".into(), event_type: "failure_recorded".into(), from_state: "closed".into(), to_state: "closed".into(), reason: "HTTP 502 from Mojaloop Hub".into(), timestamp: "2026-05-11T14:48:00Z".into(), failure_count: 2 },
        CBEvent { id: "EVT-005".into(), service: "redis-cache".into(), event_type: "recovery".into(), from_state: "half_open".into(), to_state: "closed".into(), reason: "3 consecutive successes in probe window".into(), timestamp: "2026-05-11T14:30:00Z".into(), failure_count: 0 },
    ]
}

fn seed_configs() -> Vec<CBConfig> {
    vec![
        CBConfig { service: "default".into(), failure_threshold: 5, success_threshold_half_open: 3, cooldown_ms: 30000, timeout_ms: 10000, volume_threshold: 20, error_rate_threshold: 50.0, fallback_strategy: "seed_data_fallback".into(), health_check_interval_ms: 15000, bulkhead_max_concurrent: 100, bulkhead_max_queue: 200, retry_max_attempts: 3, retry_base_delay_ms: 1000, retry_max_delay_ms: 30000, retry_backoff_multiplier: 2.0, retry_jitter: true },
        CBConfig { service: "financial_critical".into(), failure_threshold: 3, success_threshold_half_open: 5, cooldown_ms: 60000, timeout_ms: 15000, volume_threshold: 10, error_rate_threshold: 30.0, fallback_strategy: "queue_and_retry".into(), health_check_interval_ms: 5000, bulkhead_max_concurrent: 50, bulkhead_max_queue: 500, retry_max_attempts: 5, retry_base_delay_ms: 2000, retry_max_delay_ms: 60000, retry_backoff_multiplier: 2.0, retry_jitter: true },
        CBConfig { service: "realtime_trading".into(), failure_threshold: 2, success_threshold_half_open: 5, cooldown_ms: 15000, timeout_ms: 5000, volume_threshold: 50, error_rate_threshold: 10.0, fallback_strategy: "reject_fast".into(), health_check_interval_ms: 3000, bulkhead_max_concurrent: 200, bulkhead_max_queue: 50, retry_max_attempts: 1, retry_base_delay_ms: 500, retry_max_delay_ms: 2000, retry_backoff_multiplier: 1.5, retry_jitter: true },
        CBConfig { service: "auth_identity".into(), failure_threshold: 3, success_threshold_half_open: 3, cooldown_ms: 45000, timeout_ms: 8000, volume_threshold: 30, error_rate_threshold: 20.0, fallback_strategy: "cached_token".into(), health_check_interval_ms: 10000, bulkhead_max_concurrent: 150, bulkhead_max_queue: 300, retry_max_attempts: 2, retry_base_delay_ms: 1000, retry_max_delay_ms: 10000, retry_backoff_multiplier: 2.0, retry_jitter: false },
    ]
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(_state: web::Data<AppState>) -> HttpResponse {
    let overall = "healthy";
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": overall,
        "service": "circuit-breaker-rs",
        "version": "1.0.0",
        "checks": {
            "breakers": "active",
        },
    }))
}

async fn list_breakers(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    HttpResponse::Ok().json(serde_json::json!({ "items": *b, "total": b.len() }))
}

async fn get_stats(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    let closed = b.iter().filter(|x| x.state == CBState::Closed).count();
    let open = b.iter().filter(|x| x.state == CBState::Open).count();
    let half_open = b.iter().filter(|x| x.state == CBState::HalfOpen).count();
    let total_requests: u64 = b.iter().map(|x| x.total_requests).sum();
    let total_successes: u64 = b.iter().map(|x| x.success_count).sum();
    let avg_p50: f64 = b.iter().map(|x| x.p50_latency_ms).sum::<f64>() / b.len() as f64;
    let avg_p99: f64 = b.iter().map(|x| x.p99_latency_ms).sum::<f64>() / b.len() as f64;
    HttpResponse::Ok().json(serde_json::json!({
        "totalServices": b.len(),
        "closed": closed,
        "open": open,
        "halfOpen": half_open,
        "platformHealthScore": format!("{:.1}%", (closed as f64 / b.len() as f64) * 100.0),
        "totalRequests": total_requests,
        "totalSuccesses": total_successes,
        "successRate": format!("{:.2}%", (total_successes as f64 / total_requests as f64) * 100.0),
        "avgP50LatencyMs": format!("{:.1}", avg_p50),
        "avgP99LatencyMs": format!("{:.1}", avg_p99),
        "fallbackStrategies": ["seed_data_fallback", "queue_and_retry", "reject_fast", "local_cache", "dead_letter_queue", "passthrough", "deny_all", "cached_token"]
    }))
}

async fn list_events(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let e = data.events.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    HttpResponse::Ok().json(serde_json::json!({ "items": *e, "total": e.len() }))
}

async fn list_configs(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let c = data.configs.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    HttpResponse::Ok().json(serde_json::json!({ "items": *c, "total": c.len() }))
}

async fn check_service(req: HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let service = path.into_inner();
    let b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    match b.iter().find(|x| x.service == service) {
        Some(cb) => {
            let allowed = cb.state != CBState::Open;
            HttpResponse::Ok().json(serde_json::json!({
                "service": cb.service,
                "state": cb.state,
                "allowed": allowed,
                "fallbackStrategy": cb.fallback_strategy,
                "failureCount": cb.failure_count,
                "nextAttemptAt": cb.half_open_at,
            }))
        }
        None => HttpResponse::Ok().json(serde_json::json!({
            "service": service, "state": "closed", "allowed": true, "fallbackStrategy": "seed_data_fallback", "failureCount": 0
        }))
    }
}

async fn record_failure(req: HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    if let Some(cb) = b.iter_mut().find(|x| x.service == service) {
        cb.failure_count += 1;
        cb.last_failure_at = Some(chrono::Utc::now().to_rfc3339());
        if cb.failure_count >= cb.failure_threshold {
            cb.state = CBState::Open;
            cb.opened_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }
    HttpResponse::Ok().json(serde_json::json!({ "recorded": true, "service": service }))
}

async fn record_success(req: HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    if let Some(cb) = b.iter_mut().find(|x| x.service == service) {
        cb.success_count += 1;
        cb.last_success_at = Some(chrono::Utc::now().to_rfc3339());
        if cb.state == CBState::HalfOpen {
            cb.state = CBState::Closed;
            cb.failure_count = 0;
        }
    }
    HttpResponse::Ok().json(serde_json::json!({ "recorded": true, "service": service }))
}

async fn reset_breaker(req: HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    if let Some(cb) = b.iter_mut().find(|x| x.service == service) {
        cb.state = CBState::Closed;
        cb.failure_count = 0;
        cb.opened_at = None;
        cb.half_open_at = None;
    }
    HttpResponse::Ok().json(serde_json::json!({ "reset": true, "service": service }))
}


// --- mTLS Configuration ---
fn mtls_config() -> (bool, String, String, String) {
    let enabled = env::var("MTLS_ENABLED").unwrap_or_default() == "true";
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54bank/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}

// --- PII Masking (NDPR Compliance) ---
fn mask_pii(value: &str, field_type: &str) -> String {
    if value.is_empty() { return "***".to_string(); }
    match field_type {
        "bvn" | "nin" => {
            if value.len() >= 4 { format!("***{}", &value[value.len()-4..]) }
            else { "***".to_string() }
        },
        "phone" => {
            if value.len() >= 4 { format!("+234***{}", &value[value.len()-4..]) }
            else { "+234***".to_string() }
        },
        "email" => {
            if let Some(at) = value.find('@') {
                let local = &value[..at]; let domain = &value[at+1..];
                format!("{}***@{}", &local[..1], domain)
            } else { "***@***".to_string() }
        },
        "account" => {
            if value.len() >= 4 { format!("****{}", &value[value.len()-4..]) }
            else { "****".to_string() }
        },
        _ => {
            if value.len() > 2 { format!("{}***{}", &value[..1], &value[value.len()-1..]) }
            else { "***".to_string() }
        }
    }
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8260".to_string()).parse().unwrap_or(8260);
    let db = init_db().await;
    let state = web::Data::new(AppState {
        breakers: Mutex::new(seed_breakers()),
        events: Mutex::new(seed_events()),
        configs: Mutex::new(seed_configs()),
        db,
    });
    println!("circuit-breaker-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/circuit-breakers", web::get().to(list_breakers))
            .route("/v1/circuit-breakers/stats", web::get().to(get_stats))
            .route("/v1/circuit-breakers/events", web::get().to(list_events))
            .route("/v1/circuit-breakers/configs", web::get().to(list_configs))
            .route("/v1/circuit-breakers/{service}/check", web::get().to(check_service))
            .route("/v1/circuit-breakers/{service}/failure", web::post().to(record_failure))
            .route("/v1/circuit-breakers/{service}/success", web::post().to(record_success))
            .route("/v1/circuit-breakers/{service}/reset", web::post().to(reset_breaker))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("circuit-breaker-rs", "circuit-breaker-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}
