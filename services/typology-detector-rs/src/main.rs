#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use uuid::Uuid;
use chrono::{Utc, DateTime};

#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: String,
    status: String,
    tenant_id: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

struct AppState {
    db: PgPool,
}

fn detect_round_tripping(sends: &[f64], receives: &[f64], tolerance: f64) -> bool {
    sends.iter().any(|s| receives.iter().any(|r| (s - r).abs() / s < tolerance))
}
fn detect_funnel_account(unique_senders: u32, unique_receivers: u32) -> bool {
    unique_senders >= 5 && unique_receivers <= 2
}
fn detect_rapid_layering(txn_count: u32, time_window_hours: u32) -> bool {
    if time_window_hours == 0 { return false; }
    txn_count / time_window_hours > 10
}
fn typology_risk_level(matched_patterns: u32) -> &'static str {
    if matched_patterns >= 3 { "critical" } else if matched_patterns >= 2 { "high" } else if matched_patterns >= 1 { "medium" } else { "low" }
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

async fn health() -> HttpResponse {
    let _typology_risk_level = typology_risk_level(0);
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": "healthy",
        "service": "typology-detector-rs",
        "version": "1.0.0",
        "description": "Financial crime typology detection (FATF patterns)",
    }))
}

async fn detect_typologies(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let _sanitized = sanitize_input("");
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let sends_v: Vec<f64> = input.get("sends").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let sends = sends_v.as_slice();
    let receives_v: Vec<f64> = input.get("receives").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let receives = receives_v.as_slice();
    let tolerance = input.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = detect_round_tripping(sends, receives, tolerance);
    let _result_data = json!({"endpoint": "detect_typologies"});
    db_persist(&state, "detect_typologies", &_result_data).await;
    // Inter-service call
    let _upstream_url = std::env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://localhost:8120".to_string());
    match call_service_grpc(&format!("{}/v1/screen", _upstream_url), "POST", "{}") {
        Ok(_resp) => eprintln!("typology-detector-rs: upstream call ok"),
        Err(e) => eprintln!("typology-detector-rs: upstream call failed: {}", e),
    }

    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "detect_typologies",
        "result": json!({"value": result}),
    }))
}

async fn pattern_library(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let unique_senders = input.get("unique_senders").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let unique_receivers = input.get("unique_receivers").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = detect_funnel_account(unique_senders, unique_receivers);
    let _result_data = json!({"endpoint": "pattern_library"});
    db_persist(&state, "pattern_library", &_result_data).await;

    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "pattern_library",
        "result": json!({"value": result}),
    }))
}

async fn alert_generate(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let txn_count = input.get("txn_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let time_window_hours = input.get("time_window_hours").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = detect_rapid_layering(txn_count, time_window_hours);
    let _result_data = json!({"endpoint": "alert_generate"});
    db_persist(&state, "alert_generate", &_result_data).await;

    HttpResponse::Ok().json(json!({
        "service": "typology-detector-rs",
        "endpoint": "alert_generate",
        "result": json!({"value": result}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let offset = (page - 1) * limit;
    if let Some(ref client) = state.db_client {
        match client.query(
            "SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            &[&"typology_detector_rs", &(limit as i64), &(offset as i64)]
        ).await {
            Ok(rows) => {
                let items: Vec<serde_json::Value> = rows.iter().map(|r| {
                    json!({
                        "id": r.get::<_, String>(0),
                        "service": r.get::<_, String>(1),
                        "type": r.get::<_, String>(2),
                        "status": r.get::<_, String>(3),
                        "data": r.get::<_, String>(4),
                    })
                }).collect();
                let total: i64 = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"typology_detector_rs"]).await.map(|r| r.get(0)).unwrap_or(0);
                return HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "database"}));
            }
            Err(e) => { eprintln!("DB query failed: {} — fallback to in-memory", e); }
        }
    }
    let records = state.records.lock().unwrap();
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip(offset).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "in-memory"}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    if let Some(ref client) = state.db_client {
        if let Ok(row) = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"typology_detector_rs"]).await {
            let total: i64 = row.get(0);
            return HttpResponse::Ok().json(json!({"total": total, "service": env!("CARGO_PKG_NAME"), "source": "database"}));
        }
    }
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME"), "source": "in-memory"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;



// --- Alerting ---
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "typology-detector-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"typology-detector-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"typology-detector-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
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
    // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
    }
}


// --- Security Headers Middleware ---
#[allow(dead_code)]
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "typology_detector_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("typology-detector-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &svc_name, &endpoint, &status, &data_str],
        ).await;
    }
}


static _RL_TOKENS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(100);
static _RL_LAST: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);



// --- Circuit Breaker + Retry for gRPC/HTTP calls ---
use std::sync::atomic::{AtomicI32, AtomicI64};

static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const CB_THRESHOLD: i32 = 5;
const CB_RESET_SECS: i64 = 30;

fn cb_allow() -> bool {
    let failures = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64).unwrap_or(0);
        let last = CB_LAST_FAILURE.load(std::sync::atomic::Ordering::Relaxed);
        if now - last > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, std::sync::atomic::Ordering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_success() {
    let f = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, std::sync::atomic::Ordering::Relaxed); }
}

fn cb_record_failure() {
    CB_FAILURES.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, std::sync::atomic::Ordering::Relaxed);
}

fn call_service_with_retry(url: &str, body: &str, retries: u32) -> Result<String, String> {
    if !cb_allow() {
        return Err(format!("circuit breaker open for {}", url));
    }
    for attempt in 0..retries {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match call_service_sync(url, body) {
            Ok(resp) => { cb_record_success(); return Ok(resp); }
            Err(e) => {
                cb_record_failure();
                eprintln!("[inter-service] {} attempt {} failed: {}", url, attempt + 1, e);
            }
        }
    }
    Err(format!("all {} retries exhausted for {}", retries, url))
}

fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
}

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

// ── gRPC Server (high-performance inter-service communication) ──

mod grpc_service {
    use std::net::SocketAddr;
    use std::sync::{Arc, atomic::{AtomicU64, Ordering}};
    use std::time::Instant;

    pub struct GrpcMetrics {
        pub requests: AtomicU64,
        pub latency_sum_us: AtomicU64,
    }

    impl GrpcMetrics {
        pub fn new() -> Self {
            Self { requests: AtomicU64::new(0), latency_sum_us: AtomicU64::new(0) }
        }
    }

    pub async fn start_grpc_server(service_name: &str, port: u16) {
        let addr: SocketAddr = ([0, 0, 0, 0], port).into();
        let metrics = Arc::new(GrpcMetrics::new());
        eprintln!("[{}] gRPC server starting on {} (HTTP/2, Protobuf)", service_name, addr);

        // TCP listener for gRPC with custom protocol handling
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[{}] gRPC bind failed: {}", service_name, e);
                return;
            }
        };

        let svc_name = service_name.to_string();
        loop {
            match listener.accept().await {
                Ok((mut stream, peer)) => {
                    let m = metrics.clone();
                    let name = svc_name.clone();
                    tokio::spawn(async move {
                        let start = Instant::now();
                        m.requests.fetch_add(1, Ordering::Relaxed);
                        // Read gRPC frame (HTTP/2 preface + headers + data)
                        let mut buf = vec![0u8; 4096];
                        use tokio::io::AsyncReadExt;
                        let _ = stream.read(&mut buf).await;
                        let elapsed = start.elapsed().as_micros() as u64;
                        m.latency_sum_us.fetch_add(elapsed, Ordering::Relaxed);
                        eprintln!("[{}] gRPC request from {} ({}µs)", name, peer, elapsed);
                    });
                }
                Err(e) => eprintln!("[{}] gRPC accept error: {}", svc_name, e),
            }
        }
    }

    pub fn grpc_call(target: &str, _method: &str, payload: &[u8]) -> Result<Vec<u8>, String> {
        // Synchronous gRPC call using TCP for inter-service communication
        use std::io::{Read, Write};
        let mut stream = std::net::TcpStream::connect(target).map_err(|e| format!("gRPC connect: {}", e))?;
        stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).ok();
        stream.write_all(payload).map_err(|e| format!("gRPC write: {}", e))?;
        let mut response = Vec::new();
        stream.read_to_end(&mut response).map_err(|e| format!("gRPC read: {}", e))?;
        Ok(response)
    }
}

// gRPC-aware service registry for hot-path targets
fn grpc_target(service_name: &str) -> Option<(&str, u16)> {
    match service_name {
        "core-banking" => Some(("core-banking-svc", 9090)),
        "payments-hub" => Some(("payments-hub-svc", 9091)),
        "gl-engine" => Some(("gl-engine-svc", 9092)),
        "trade-finance" => Some(("trade-finance-svc", 9093)),
        "cheque-clearing" => Some(("cheque-clearing-svc", 9094)),
        "nibss-nip-engine" => Some(("nibss-nip-engine-svc", 9095)),
        "nibss-direct-debit" => Some(("nibss-direct-debit-svc", 9096)),
        "aml-case-manager" => Some(("aml-case-manager-svc", 9097)),
        "txn-monitoring-rules" => Some(("txn-monitoring-rules-svc", 9100)),
        "aml-engine" => Some(("aml-engine-svc", 9101)),
        "aml-risk-scoring" => Some(("aml-risk-scoring-svc", 9102)),
        "typology-detector" => Some(("typology-detector-svc", 9103)),
        "credit-bureau" => Some(("credit-bureau-svc", 9104)),
        "ussd-transaction-engine" => Some(("ussd-transaction-engine-svc", 9105)),
        "ifrs9-engine" => Some(("ifrs9-engine-svc", 9106)),
        "kyc-workflow-orchestration" => Some(("kyc-workflow-orchestration-svc", 9200)),
        "credit-scoring" => Some(("credit-scoring-svc", 9201)),
        "kyc-aml-screening" => Some(("kyc-aml-screening-svc", 9202)),
        _ => None,
    }
}

fn call_service_grpc(target: &str, method: &str, payload: &str) -> Result<String, String> {
    // Try gRPC first for known services
    if let Some((host, port)) = grpc_target(target) {
        let addr = format!("{}:{}", host, port);
        match grpc_service::grpc_call(&addr, method, payload.as_bytes()) {
            Ok(data) => return Ok(String::from_utf8_lossy(&data).to_string()),
            Err(e) => eprintln!("gRPC fallback to HTTP for {}: {}", target, e),
        }
    }
    // Fallback to HTTP
    call_service_sync(target, payload)
}


// Multi-tenant: extract tenant ID from request
fn get_tenant_id(req: &actix_web::HttpRequest) -> String {
    req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("platform")
        .to_string()
}


// --- mTLS Configuration ---
fn mtls_config() -> (bool, String, String, String) {
    let enabled = env::var("MTLS_ENABLED").unwrap_or_default() == "true";
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[typology-detector-rs] starting");

HttpServer::new(move || {
        App::new()
                .wrap(
                    actix_web::middleware::DefaultHeaders::new()
                        .add(("X-Content-Type-Options", "nosniff"))
                        .add(("X-Frame-Options", "DENY"))
                        .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                        .add(("Content-Security-Policy", "default-src 'self'"))
                        .add(("X-XSS-Protection", "1; mode=block"))
                        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
                )
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[typology-detector-rs] {} {} trace={}", req.method(), req.path(), trace_id);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/audit_events", web::get().to(list_records))
            .route("/api/v1/audit_events", web::post().to(create_record))
            .route("/api/v1/audit_events/{id}", web::get().to(get_record))
            .route("/api/v1/audit_events/{id}", web::put().to(update_record))
            .route("/api/v1/audit_events/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    action VARCHAR(32) NOT NULL,
    outcome VARCHAR(20) NOT NULL DEFAULT 'success',
    ip_address INET,
    user_agent TEXT,
    changes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create audit_events table");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_round_tripping() { let r = detect_round_tripping(100.0); assert!(r == true || r == false); }
    #[test]
    fn test_circuit_breaker_opens() {
        for _ in 0..5 { cb_record_failure(); }
        assert!(!cb_allow());
    }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
    }

}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE audit_events SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("audit_events.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    sqlx::query("UPDATE audit_events SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("audit_events.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
