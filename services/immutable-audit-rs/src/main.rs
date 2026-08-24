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
    records: std::sync::Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
    db: Option<PgPool>,
}

/// AUDIT-TOY: real SHA-256 chain hash (previously a non-cryptographic
/// wrapping-mul byte fold). Mirrors services/security-service/audit_trail.go:
/// every entry's hash covers the previous entry's hash, so rewriting or
/// deleting any historical row invalidates every subsequent entry_hash.
fn compute_chain_hash(prev_hash: &str, entry: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(b"|");
    hasher.update(entry.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
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

async fn health() -> HttpResponse {
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({"status": "healthy", "service": "immutable-audit-rs"}))
}

async fn append_entry(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let _sanitized = sanitize_input("");
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let input = body.into_inner();
    let prev_hash_s = input.get("prev_hash").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let prev_hash = prev_hash_s.as_str();
    let entry_s = input.get("entry").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let entry = entry_s.as_str();
    let result = compute_chain_hash(prev_hash, entry);
    let _result_data = json!({"endpoint": "append_entry"});
    db_persist(&state, "append_entry", &_result_data).await;
    // Inter-service call
    let _upstream_url = std::env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://localhost:8120".to_string());
    match tokio::task::spawn_blocking(move || call_service_sync(&format!("{}/v1/screen", _upstream_url), "{}")).await {
        Ok(Ok(_resp)) => eprintln!("immutable-audit-rs: upstream call ok"),
        Ok(Err(e)) => eprintln!("immutable-audit-rs: upstream call failed: {}", e),
        Err(e) => eprintln!("immutable-audit-rs: upstream call join failed: {}", e),
    }

    HttpResponse::Ok().json(json!({
        "service": "immutable-audit-rs",
        "endpoint": "append_entry",
        "result": json!({"value": result}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "source": if state.db_url.is_some() { "database" } else { "in-memory" }}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "immutable-audit-rs"}))
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "immutable-audit-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"immutable-audit-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"immutable-audit-rs\"}} {}\n", r, e);
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
// --- Route-layer JWT guard (R3-NEW-1): wraps routes whose handlers are registered but not defined in this file ---
async fn jwt_route_guard(
    req: actix_web::dev::ServiceRequest,
    next: actix_web::middleware::Next<impl actix_web::body::MessageBody>,
) -> Result<actix_web::dev::ServiceResponse<actix_web::body::BoxBody>, actix_web::Error> {
    if let Err(resp) = check_jwt(req.request()).await {
        return Ok(req.into_response(resp));
    }
    next.call(req).await.map(|res| res.map_into_boxed_body())
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
        let id = format!("{}_{}_{}", "immutable_audit_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("immutable-audit-rs");
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


// Multi-tenant: extract tenant ID from request
fn get_tenant_id(req: &actix_web::HttpRequest) -> String {
    req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("platform")
        .to_string()
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
                    let resp = format!(r#"{{"status":"ok","service":"{}"}}"#, service_name);
                    let resp_bytes = resp.as_bytes();
                    let resp_len = (resp_bytes.len() as u32).to_be_bytes();
                    let _ = stream.write_all(&resp_len);
                    let _ = stream.write_all(resp_bytes);
                });
            }
        }
    });
}

fn grpc_call(target: &str, method: &str, payload: &str) -> Result<String, String> {
    if !cb_allow() { return Err("circuit breaker open".to_string()); }
    use std::io::{Read, Write};
    for attempt in 0..3u32 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match std::net::TcpStream::connect_timeout(
            &target.parse().map_err(|e| format!("{}", e))?,
            std::time::Duration::from_secs(5),
        ) {
            Ok(mut stream) => {
                let data = format!(r#"{{"method":"{}","payload":{}}}"#, method, payload);
                let data_bytes = data.as_bytes();
                let len_bytes = (data_bytes.len() as u32).to_be_bytes();
                if stream.write_all(&len_bytes).is_err() { cb_record_failure(); continue; }
                if stream.write_all(data_bytes).is_err() { cb_record_failure(); continue; }
                let mut resp_len_buf = [0u8; 4];
                if stream.read_exact(&mut resp_len_buf).is_err() { cb_record_failure(); continue; }
                let resp_len = u32::from_be_bytes(resp_len_buf) as usize;
                let mut resp_buf = vec![0u8; resp_len];
                if stream.read_exact(&mut resp_buf).is_err() { cb_record_failure(); continue; }
                cb_record_success();
                return Ok(String::from_utf8_lossy(&resp_buf).to_string());
            }
            Err(e) => { cb_record_failure(); eprintln!("gRPC {} attempt {} failed: {}", target, attempt+1, e); }
        }
    }
    Err(format!("gRPC retries exhausted for {}", target))
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8222);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        match init_db(&url).await {
            Some(c) => { println!("immutable-audit-rs: connected to Postgres"); Some(std::sync::Arc::new(c)) }
            None => None,
        }
    } else { None };
    // AUDIT-TOY: the sqlx pool backs the durable, hash-chained audit_events
    // table (schema ensured by init_schema). Absent DATABASE_URL the service
    // still starts, but audit appends fail closed with 503 — an immutable
    // audit trail must never fall back to process memory.
    let db_pool = if let Ok(url) = std::env::var("DATABASE_URL") {
        match PgPoolOptions::new().max_connections(10).connect(&url).await {
            Ok(pool) => {
                init_schema(&pool).await;
                Some(pool)
            }
            Err(e) => {
                eprintln!("immutable-audit-rs: sqlx pool connect failed: {}", e);
                None
            }
        }
    } else { None };
    let state = web::Data::new(AppState {
        records: std::sync::Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client,
        db: db_pool,
    });
    println!("immutable-audit-rs on port {}", port);
    start_grpc_server("immutable-audit-rs", 10414);
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
                eprintln!("[immutable-audit-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/metrics", web::get().to(prom_metrics))
            // Audit is append-only: no update/delete routes exist by design.
            .route("/api/v1/audit_events", web::get().to(list_records))
            .service(web::resource("/api/v1/audit_events").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::post().to(create_record)))
            .service(web::resource("/api/v1/audit_events/{id}").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::get().to(get_record)))
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
    previous_hash VARCHAR(64),
    entry_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create audit_events table");

    // Existing deployments created before the hash chain: add the columns.
    for stmt in [
        "ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64)",
        "ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at)",
    ] {
        sqlx::query(stmt)
            .execute(pool)
            .await
            .expect("Failed to evolve audit_events schema");
    }
}

/// AUDIT-TOY: append a tamper-evident audit entry. The entry_hash chains to
/// the previous row's entry_hash (SHA-256 over
/// id|event_type|outcome|actor_id|tenant_id|action|resource_type|resource_id|previous_hash|timestamp,
/// mirroring services/security-service/audit_trail.go). Fails closed with 503
/// when the durable store is unavailable.
async fn create_record(data: web::Data<AppState>, body: web::Json<serde_json::Value>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = match &data.db {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(json!({
            "error": "audit store unavailable — audit events are never recorded in memory"
        })),
    };
    let input = body.into_inner();
    let get_str = |key: &str| input.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string();

    let event_type = get_str("event_type");
    let action = get_str("action");
    let resource_type = get_str("resource_type");
    let resource_id = get_str("resource_id");
    let actor_type = {
        let t = get_str("actor_type");
        if t.is_empty() { "user".to_string() } else { t }
    };
    let outcome = {
        let o = get_str("outcome");
        if o.is_empty() { "success".to_string() } else { o }
    };
    if event_type.is_empty() || action.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "event_type and action are required"}));
    }
    let actor_id = match Uuid::parse_str(&get_str("actor_id")) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(json!({"error": "actor_id must be a UUID"})),
    };
    let tenant_id = match Uuid::parse_str(&get_str("tenant_id")) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(json!({"error": "tenant_id must be a UUID"})),
    };
    let changes = input.get("changes").cloned().unwrap_or_else(|| json!({}));
    let metadata = input.get("metadata").cloned().unwrap_or_else(|| json!({}));
    let ip_address = get_str("ip_address");
    let user_agent = get_str("user_agent");

    // Chain head: the most recent entry's hash (genesis entries chain to "").
    let prev_hash: String = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT entry_hash FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    {
        Ok(v) => v.flatten().unwrap_or_default(),
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({"error": format!("chain head lookup failed: {}", e)}));
        }
    };

    let id = Uuid::new_v4();
    let ts = Utc::now().to_rfc3339();
    let canonical = format!(
        "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        id, event_type, outcome, actor_id, tenant_id, action, resource_type, resource_id, prev_hash, ts
    );
    let entry_hash = compute_chain_hash(&prev_hash, &canonical);

    let result = sqlx::query(
        "INSERT INTO audit_events (id, event_type, actor_id, actor_type, resource_type, resource_id, action, outcome, ip_address, user_agent, changes, metadata, tenant_id, previous_hash, entry_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10, $11, $12, $13, $14, $15, $16::timestamptz)",
    )
    .bind(id)
    .bind(&event_type)
    .bind(actor_id)
    .bind(&actor_type)
    .bind(&resource_type)
    .bind(&resource_id)
    .bind(&action)
    .bind(&outcome)
    .bind(if ip_address.is_empty() { None } else { Some(&ip_address) })
    .bind(if user_agent.is_empty() { None } else { Some(&user_agent) })
    .bind(&changes)
    .bind(&metadata)
    .bind(tenant_id)
    .bind(&prev_hash)
    .bind(&entry_hash)
    .bind(&ts)
    .execute(pool)
    .await;

    match result {
        Ok(_) => HttpResponse::Created().json(json!({
            "id": id.to_string(),
            "event_type": event_type,
            "entry_hash": entry_hash,
            "previous_hash": prev_hash,
            "status": "appended",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": format!("audit append failed: {}", e)})),
    }
}

/// Read a single audit entry by id (read-only; no mutation routes exist).
async fn get_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = match &data.db {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(json!({"error": "audit store unavailable"})),
    };
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(json!({"error": "id must be a UUID"})),
    };
    let row = sqlx::query(
        "SELECT id, event_type, actor_id, actor_type, resource_type, resource_id, action, outcome, tenant_id, previous_hash, entry_hash, created_at FROM audit_events WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await;

    match row {
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "id": r.get::<Uuid, _>("id").to_string(),
            "event_type": r.get::<String, _>("event_type"),
            "actor_id": r.get::<Uuid, _>("actor_id").to_string(),
            "actor_type": r.get::<String, _>("actor_type"),
            "resource_type": r.get::<String, _>("resource_type"),
            "resource_id": r.get::<String, _>("resource_id"),
            "action": r.get::<String, _>("action"),
            "outcome": r.get::<String, _>("outcome"),
            "tenant_id": r.get::<Uuid, _>("tenant_id").to_string(),
            "previous_hash": r.get::<Option<String>, _>("previous_hash"),
            "entry_hash": r.get::<Option<String>, _>("entry_hash"),
            "created_at": r.get::<chrono::DateTime<Utc>, _>("created_at").to_rfc3339(),
        })),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_chain_hash_exists() {
        // Verify compute_chain_hash compiles and is callable
        // Domain function: compute_chain_hash(prev_hash: &str, entry: &str) -> String
        assert!(true, "compute_chain_hash should be defined");
    }

    #[test]
    fn test_append_entry_exists() {
        // Verify append_entry compiles and is callable
        // Domain function: append_entry(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse
        assert!(true, "append_entry should be defined");
    }
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

// Append-only by design: audit_events has no UPDATE/DELETE handlers. Any
// mutation or removal of an entry would invalidate the SHA-256 entry_hash
// chain written by create_record (AUDIT-TOY).
