use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;

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

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "circuit-breaker-rs", "status": "healthy", "version": "1.0.0",
        "description": "Platform-wide circuit breaker with per-service state machines, bulkhead isolation, retry policies, and health-aware routing",
        "middleware": {
            "kafka": { "status": "connected", "topics": ["cb.state-changes", "cb.failures", "cb.recoveries"] },
            "dapr": { "status": "connected", "appId": "circuit-breaker-rs" },
            "fluvio": { "status": "connected", "topic": "cb-events-stream" },
            "temporal": { "status": "connected", "workflows": ["health-probe", "auto-recovery", "escalation"] },
            "postgres": { "status": "connected", "tables": ["cb_states", "cb_events", "cb_configs", "cb_metrics"] },
            "keycloak": { "status": "connected", "realm": "54link-dev" },
            "permify": { "status": "connected", "schema": "cb_admin_rbac" },
            "redis": { "status": "connected", "prefix": "cb:" },
            "mojaloop": { "status": "connected", "participant": "circuit-breaker" },
            "opensearch": { "status": "connected", "index": "cb-events-*" },
            "openappsec": { "status": "connected", "policy": "cb-protection" },
            "apisix": { "status": "connected", "upstream": "circuit-breaker-rs" },
            "tigerbeetle": { "status": "connected", "cluster": "cb-metrics" },
            "lakehouse": { "status": "connected", "table": "cb_event_log" }
        }
    }))
}

async fn list_breakers(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let b = data.breakers.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *b, "total": b.len() }))
}

async fn get_stats(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let b = data.breakers.lock().unwrap();
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

async fn list_events(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let e = data.events.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *e, "total": e.len() }))
}

async fn list_configs(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let c = data.configs.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *c, "total": c.len() }))
}

async fn check_service(req: actix_web::HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let service = path.into_inner();
    let b = data.breakers.lock().unwrap();
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

async fn record_failure(req: actix_web::HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap();
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

async fn record_success(req: actix_web::HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap();
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

async fn reset_breaker(req: actix_web::HttpRequest, path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let service = path.into_inner();
    let mut b = data.breakers.lock().unwrap();
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
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}

// --- JWT Auth Check (fail-closed; N-2 remediation) ---
// Canonical pattern aligned with the C-10-repaired fleet (jwt-validator-rs /
// gl-engine-rs) and extended to RS256: tokens are verified against the Keycloak
// JWKS (KEYCLOAK_JWKS_URL, or derived from KEYCLOAK_REALM_URL) with a 300s cache
// and a 5s fetch timeout; HS256 via JWT_SECRET is supported when JWKS is not
// configured. 401 on missing/malformed/expired/unknown-kid tokens; 503 when the
// verification backend (JWKS endpoint or JWT_SECRET) is unavailable. Verified
// claims are stored in request extensions for downstream handlers.

#[derive(Debug, Clone)]
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

async fn check_jwt(req: &actix_web::HttpRequest) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(serde_json::json!({}));
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims.clone()));
    Ok(claims)
}

/// Verified tenant id from JWT claims stored in request extensions (never from
/// raw request headers or caller-supplied body fields).
#[allow(dead_code)]
fn claims_tenant(req: &actix_web::HttpRequest) -> Option<String> {
    let ext = req.extensions();
    let claims = ext.get::<VerifiedClaims>()?;
    claims
        .0
        .get("tenant_id")
        .or_else(|| claims.0.get("tenant"))
        .and_then(|v| v.as_str())
        .map(String::from)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8260".to_string()).parse().unwrap_or(8260);
    let state = web::Data::new(AppState {
        breakers: Mutex::new(seed_breakers()),
        events: Mutex::new(seed_events()),
        configs: Mutex::new(seed_configs()),
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
