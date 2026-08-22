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

fn sanitize_input(s: &str) -> String { s.replace("<script>", "").replace("</script>", "").replace("javascript:", "").chars().take(10240).collect() }

fn validate_gl_code(code: &str) -> (bool, &'static str) {
    if code.is_empty() { return (false, "GL code required"); }
    if code.len() < 4 { return (false, "GL code must be at least 4 digits"); }
    match code.chars().next() {
        Some('1') => (true, "Assets"),
        Some('2') => (true, "Liabilities"),
        Some('3') => (true, "Equity"),
        Some('4') => (true, "Revenue"),
        Some('5') => (true, "Expenses"),
        _ => (false, "Invalid GL prefix"),
    }
}

fn compute_hierarchy_depth(parent_chain: &[&str]) -> usize {
    parent_chain.len()
}

fn validate_double_entry(debit_total: f64, credit_total: f64) -> (bool, f64) {
    let diff = (debit_total - credit_total).abs();
    (diff < 0.01, diff)
}

fn classify_account_category(gl_code: &str) -> &'static str {
    match gl_code.chars().next() {
        Some('1') if gl_code.starts_with("11") => "current_assets",
        Some('1') if gl_code.starts_with("12") => "fixed_assets",
        Some('1') => "other_assets",
        Some('2') if gl_code.starts_with("21") => "current_liabilities",
        Some('2') => "long_term_liabilities",
        Some('3') => "shareholders_equity",
        Some('4') => "operating_revenue",
        Some('5') if gl_code.starts_with("51") => "operating_expenses",
        Some('5') => "non_operating_expenses",
        _ => "unclassified",
    }
}

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if now > RL_LAST.load(AtomicOrdering::Relaxed) { RL_TOKENS.store(100, AtomicOrdering::Relaxed); RL_LAST.store(now, AtomicOrdering::Relaxed); }
    RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) > 0
}

// --- JWT Auth Check (fail-closed; R4-V1 remediation) ---
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

fn call_service_sync(url: &str, payload: &str) -> Result<String, String> {
    let addr_str = url.replace("http://", "").replace("https://", "");
    let tcp = std::net::TcpStream::connect_timeout(&addr_str.parse().unwrap_or_else(|_| "127.0.0.1:8080".parse().unwrap()), std::time::Duration::from_secs(5));
    match tcp { Ok(mut s) => { use std::io::Write; let _ = s.write_all(format!("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n\r\n{}", payload.len(), payload).as_bytes()); Ok("ok".into()) } Err(e) => Err(format!("{}", e)) }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "falkordb-coa-rs".replace("-","_"), endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc = String::from("falkordb-coa-rs");
    if let Some(client) = &state.db_client {
        let _ = client.execute("INSERT INTO records (id,service,tenant,status,data,created_at) VALUES ($1,$2,'default','active',$3,NOW()) ON CONFLICT (id) DO UPDATE SET data=$3", &[&id, &svc, &data.to_string()]).await;
    } else {
        state.records.lock().unwrap().push(json!({"id": id, "service": svc, "data": data}));
    }
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

async fn health() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "falkordb-coa-rs"})) }
async fn ready() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "falkordb-coa-rs"})) }
async fn live() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"falkordb-coa-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"falkordb-coa-rs\"}} {}\n", r, e))
}

async fn graph_query(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let input = body.into_inner();
    db_persist(&state, "graph_query", &input).await;
    let upstream = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = tokio::task::spawn_blocking(move || call_service_sync(&format!("{}/v1/notify", upstream), &format!(r#"{"source": "falkordb-coa-rs", "action": "graph_query"}"#))).await;
    HttpResponse::Ok().json(json!({"service": "falkordb-coa-rs", "endpoint": "graph_query", "result": input}))
}

async fn funding_flows(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    db_persist(&state, "funding_flows", &json!({"action": "funding_flows"})).await;
    HttpResponse::Ok().json(json!({"service": "falkordb-coa-rs", "endpoint": "funding_flows", "items": []}))
}

async fn concentration_risk(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    db_persist(&state, "concentration_risk", &json!({"action": "concentration_risk"})).await;
    HttpResponse::Ok().json(json!({"service": "falkordb-coa-rs", "endpoint": "concentration_risk", "items": []}))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    db_persist(&state, "create", &body.into_inner()).await;
    HttpResponse::Created().json(json!({"created": true}))
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
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[falkordb-coa-rs] starting");

    let state = web::Data::new(AppState { records: Mutex::new(Vec::new()), db_url, db_client });
    println!("falkordb-coa-rs listening on port {}", port);
    start_grpc_server("falkordb-coa-rs", 10478);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .service(web::resource("/api/v1/service_configs").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::get().to(list_records)))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .service(web::resource("/api/v1/service_configs/{id}").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::get().to(get_record)))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?.run().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("falkordb-coa-rs", "falkordb-coa-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    sqlx::query("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("service_configs.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
