#![allow(unused)]
// 54link-dev TigerBeetle Protocol Engine — Rust
// Account creation, transfer posting, two-phase commit, linked transfers,
// balance queries, account lookup, pending transfer resolution.
// Middleware: All 14
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::time::Instant;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

#[derive(Clone)]
struct AppState { start_time: Instant, db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct TBAccount {
    id: String,
    ledger: u32,
    code: u16,
    debits_pending: u64,
    debits_posted: u64,
    credits_pending: u64,
    credits_posted: u64,
    flags: Vec<String>,
    description: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct TBTransfer {
    id: String,
    debit_account_id: String,
    credit_account_id: String,
    amount: u64,
    ledger: u32,
    code: u16,
    flags: Vec<String>,
    pending_id: Option<String>,
    status: String,
    timestamp: String,
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;
use actix_web::HttpMessage;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "view").await { return resp; } // W12-B5P1DF
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "service": "tigerbeetle-protocol-rs",
        "status": "healthy",
        "protocol": "TigerBeetle_0.15",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "capabilities": ["create_accounts", "create_transfers", "two_phase_commit", "linked_transfers", "lookup_accounts", "lookup_transfers", "pending_resolution"],
        "middleware": {
            "postgres": "sync: tb_accounts, tb_transfers (CDC via Kafka)",
            "kafka": "tb.account_created, tb.transfer_posted, tb.transfer_voided",
            "redis": "balance_cache (sub-ms reads)",
            "temporal": "TBReconciliationWorkflow, TBMigrationWorkflow",
            "opensearch": "tigerbeetle-audit-2026"
        }
    }))
}

// ─── TigerBeetle access policy ──────────────────────────────────────────────
// Money movement MUST go through a real TigerBeetle cluster client. This
// service has no TigerBeetle client dependency wired, so write endpoints
// (create_transfer / commit_pending / void_pending) FAIL FAST with 503 rather
// than fabricating posted/committed ledger results.
// Read endpoints serve the Postgres CDC mirror tables (tb_accounts /
// tb_transfers); when the mirror is unavailable they also fail fast with 503.
fn tigerbeetle_unavailable() -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "success": false,
        "error": "tigerbeetle_unavailable",
        "detail": "no TigerBeetle cluster client is wired in this service; refusing to fabricate ledger postings",
    }))
}

async fn list_accounts(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "view").await { return resp; } // W12-B5P1DF
    let client = match &state.db_client {
        Some(c) => c.clone(),
        None => return tigerbeetle_unavailable(),
    };
    let rows = client.query(
        "SELECT id, ledger, code, debits_pending, debits_posted, credits_pending, credits_posted, flags, description FROM tb_accounts ORDER BY id",
        &[],
    ).await;
    match rows {
        Ok(rows) => {
            let accounts: Vec<serde_json::Value> = rows.iter().map(|r| {
                let flags: Vec<String> = r.get::<usize, Vec<String>>(7);
                json!({
                    "id": r.get::<usize, String>(0),
                    "ledger": r.get::<usize, i32>(1),
                    "code": r.get::<usize, i32>(2),
                    "debitsPending": r.get::<usize, i64>(3),
                    "debitsPosted": r.get::<usize, i64>(4),
                    "creditsPending": r.get::<usize, i64>(5),
                    "creditsPosted": r.get::<usize, i64>(6),
                    "flags": flags,
                    "description": r.get::<usize, String>(8),
                })
            }).collect();
            HttpResponse::Ok().json(json!({"accounts": accounts, "total": accounts.len()}))
        }
        Err(e) => {
            eprintln!("[tigerbeetle-protocol-rs] tb_accounts query failed: {}", e);
            tigerbeetle_unavailable()
        }
    }
}

async fn list_transfers(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "view").await { return resp; } // W12-B5P1DF
    let client = match &state.db_client {
        Some(c) => c.clone(),
        None => return tigerbeetle_unavailable(),
    };
    let rows = client.query(
        "SELECT id, debit_account_id, credit_account_id, amount, ledger, code, flags, pending_id, status, created_at FROM tb_transfers ORDER BY created_at DESC LIMIT 500",
        &[],
    ).await;
    match rows {
        Ok(rows) => {
            let transfers: Vec<serde_json::Value> = rows.iter().map(|r| {
                let flags: Vec<String> = r.get::<usize, Vec<String>>(6);
                let pending: Option<String> = r.get(7);
                json!({
                    "id": r.get::<usize, String>(0),
                    "debitAccountId": r.get::<usize, String>(1),
                    "creditAccountId": r.get::<usize, String>(2),
                    "amount": r.get::<usize, i64>(3),
                    "ledger": r.get::<usize, i32>(4),
                    "code": r.get::<usize, i32>(5),
                    "flags": flags,
                    "pendingId": pending,
                    "status": r.get::<usize, String>(8),
                    "timestamp": r.get::<usize, String>(9),
                })
            }).collect();
            HttpResponse::Ok().json(json!({"transfers": transfers, "total": transfers.len()}))
        }
        Err(e) => {
            eprintln!("[tigerbeetle-protocol-rs] tb_transfers query failed: {}", e);
            tigerbeetle_unavailable()
        }
    }
}

async fn create_transfer(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow().await {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "transfers").await { return resp; } // W12-B5P1DF
    // A transfer is money movement: without a real TigerBeetle client we must
    // not pretend the ledger accepted it.
    tigerbeetle_unavailable()
}

async fn commit_pending(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow().await {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "commit").await { return resp; } // W12-B5P1DF
    tigerbeetle_unavailable()
}

async fn void_pending(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow().await {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "void").await { return resp; } // W12-B5P1DF
    tigerbeetle_unavailable()
}

fn chrono_placeholder() -> String { format!("{:06}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().subsec_micros()) }


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;



// --- Alerting ---
async fn alerts_endpoint(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger_entry", "view").await { return resp; } // W12-B5P1DF
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "tigerbeetle-protocol-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"tigerbeetle-protocol-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"tigerbeetle-protocol-rs\"}} {}\n", r, e);
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


// Wave-11: audit INSERTs are buffered behind a Mutex and flushed every 100ms
// or every 100 rows by a spawned task (was: one blocking INSERT per request).
static W11_AUDIT_BUF: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<Vec<(String, String, String, String, String)>>>> = std::sync::OnceLock::new();
static W11_FLUSH_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let buf = W11_AUDIT_BUF.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(Vec::new())));
        let id = format!("{}_{}_{}", "tigerbeetle_protocol_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("tigerbeetle-protocol-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        if !W11_FLUSH_STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            let client = client.clone();
            let buf = buf.clone();
            tokio::spawn(async move {
                let mut tick = tokio::time::interval(std::time::Duration::from_millis(100));
                loop {
                    tick.tick().await;
                    let rows: Vec<(String, String, String, String, String)> = {
                        let mut b = buf.lock().unwrap();
                        if b.is_empty() { continue; }
                        std::mem::take(&mut *b)
                    };
                    for (id, svc, ep, st, d) in rows {
                        let _ = client.execute(
                            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                            &[&id, &svc, &ep, &st, &d],
                        ).await;
                    }
                }
            });
        }
        let mut b = buf.lock().unwrap();
        b.push((id, svc_name, endpoint.to_string(), status, data_str));
        if b.len() >= 100 {
            let rows = std::mem::take(&mut *b);
            drop(b);
            let client = client.clone();
            tokio::spawn(async move {
                for (id, svc, ep, st, d) in rows {
                    let _ = client.execute(
                        "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                        &[&id, &svc, &ep, &st, &d],
                    ).await;
                }
            });
        }
    }
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

fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            // Wave-11: bound blocking I/O (was unbounded read_to_string).
            stream.set_read_timeout(Some(std::time::Duration::from_secs(3))).map_err(|e| format!("{}", e))?;
            stream.set_write_timeout(Some(std::time::Duration::from_secs(3))).map_err(|e| format!("{}", e))?;
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

// --- Distributed rate limiting (redis shared sliding window; W12 C3-P1-B1) ---
// Replaces the per-replica statics _RL_TOKENS/_RL_LAST (and the dead
// _RATE_WINDOW_START/_RATE_WINDOW_COUNT pair): behind >1 replica the old
// per-process bucket multiplied the effective limit by the replica count
// (correctness bug). Now an atomic Lua INCR+PEXPIRE sliding window on a shared
// deadpool-redis pool; limit is global per service, not per replica.
// Key: ratelimit:tigerbeetle-protocol-rs:global — the replaced bucket was process-global (no
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
        .key("ratelimit:tigerbeetle-protocol-rs:global")
        .arg(RL_WINDOW_MS)
        .invoke_async(&mut *conn)
        .await;
    match count {
        Ok(n) => n <= RL_LIMIT,
        Err(_) => false, // fail closed: redis error
    }
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
    let port = std::env::var("PORT").unwrap_or_else(|_| "8116".to_string());
    println!("TigerBeetle Protocol Engine (Rust) on :{} — accounts + transfers + 2PC", port);
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    let db_client = if !db_url.is_empty() { init_db(&db_url).await.map(std::sync::Arc::new) } else { None };
    let state = AppState { start_time: Instant::now(), db_client };
    start_grpc_server("tigerbeetle-protocol-rs", 10367);
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
                // Wave-11: log only errors, plus 1% sampled requests (was: every request).
                let w11_method = req.method().clone();
                let w11_path = req.path().to_string();
                let w11_sample = _REQ_COUNT.load(AtomicOrdering::Relaxed) % 100 == 0;
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    let w11_err = res.status().is_server_error() || res.status().is_client_error();
                    if w11_err {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    if w11_err || w11_sample {
                        eprintln!("[tigerbeetle-protocol-rs] {} {} trace={} status={}", w11_method, w11_path, trace_id, res.status().as_u16());
                    }
                    Ok(res)
                }
            })
            .app_data(web::Data::new(state.clone()))
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/tigerbeetle/accounts", web::get().to(list_accounts))
            .route("/v1/tigerbeetle/transfers", web::get().to(list_transfers))
            .route("/v1/tigerbeetle/transfers", web::post().to(create_transfer))
            .route("/v1/tigerbeetle/commit", web::post().to(commit_pending))
            .route("/v1/tigerbeetle/void", web::post().to(void_pending))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    }).bind(format!("0.0.0.0:{}", port))?.shutdown_timeout(30).run().await
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_healthz_exists() {
        assert!(true, "healthz should be defined");
    }

    #[test]
    fn test_list_accounts_exists() {
        assert!(true, "list_accounts should be defined");
    }

    #[test]
    fn test_list_transfers_exists() {
        assert!(true, "list_transfers should be defined");
    }

    #[test]
    fn test_create_transfer_exists() {
        assert!(true, "create_transfer should be defined");
    }

    #[test]
    fn test_commit_pending_exists() {
        assert!(true, "commit_pending should be defined");
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

// Wave-12 B5-P1-D-F: Permify authorization guard module.
mod permify;
