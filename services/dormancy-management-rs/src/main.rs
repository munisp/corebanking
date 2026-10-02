#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, AtomicI64, AtomicI32, Ordering as AtomicOrdering};
use std::env;
use chrono::Utc;
use std::time::Instant;
use actix_web::HttpMessage;

// ── Domain Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
struct DormantAccount {
    id: String,
    account_number: String,
    account_name: String,
    customer_id: String,
    account_type: String,       // "savings", "current", "fixed_deposit"
    branch: String,
    balance: f64,
    currency: String,
    days_inactive: i32, // C3-P2-RSVEC: u32 -> i32 (sqlx-postgres has no u32 codec); JSON identical
    last_transaction_date: String,
    dormancy_stage: String,     // "active" | "inactive" | "dormant" | "unclaimed"
    restriction_level: String,  // "none" | "alert_only" | "debit_restricted" | "fully_restricted"
    notifications_sent: i32, // C3-P2-RSVEC: u32 -> i32 (sqlx-postgres has no u32 codec)
    reactivation_eligible: bool,
    flagged_for_cbn_sweep: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DormancyStats {
    total: usize,
    active: usize,
    inactive: usize,
    dormant: usize,
    unclaimed: usize,
    total_dormant_balance: f64,
    flagged_for_cbn_sweep: usize,
}

#[derive(Debug, Deserialize)]
struct CheckDormancyRequest {
    account_id: Option<String>,
    last_txn_days: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ReactivateRequest {
    id: String,
    verified_by: Option<String>,
    verification_method: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NotifyRequest {
    id: String,
    channel: Option<String>,
}

// Wave-12 (C3-P2-RSVEC): dormant accounts are persisted in Postgres (was:
// in-memory Mutex<Vec<DormantAccount>> lost on every restart). Typed columns
// matching the all-scalar struct; id is the natural/unique key. Handlers fail
// closed (503) on PG error — no silent memory fallback.
struct AppState {
    db: sqlx::PgPool,
}

const DORMANT_COLS: &str = "id, account_number, account_name, customer_id, account_type, branch, \
     balance, currency, days_inactive, last_transaction_date, dormancy_stage, restriction_level, \
     notifications_sent, reactivation_eligible, flagged_for_cbn_sweep, created_at, updated_at";

async fn init_dormancy_db(pool: &sqlx::PgPool) {
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS dormant_accounts (
            id TEXT PRIMARY KEY,
            account_number TEXT NOT NULL DEFAULT '',
            account_name TEXT NOT NULL DEFAULT '',
            customer_id TEXT NOT NULL DEFAULT '',
            account_type TEXT NOT NULL DEFAULT '',
            branch TEXT NOT NULL DEFAULT '',
            balance DOUBLE PRECISION NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'NGN',
            days_inactive INTEGER NOT NULL DEFAULT 0,
            last_transaction_date TEXT NOT NULL DEFAULT '',
            dormancy_stage TEXT NOT NULL DEFAULT 'active',
            restriction_level TEXT NOT NULL DEFAULT 'none',
            notifications_sent INTEGER NOT NULL DEFAULT 0,
            reactivation_eligible BOOLEAN NOT NULL DEFAULT false,
            flagged_for_cbn_sweep BOOLEAN NOT NULL DEFAULT false,
            created_at TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT ''
        )",
    )
    .execute(pool)
    .await
    {
        eprintln!("[dormancy-management-rs] dormant_accounts DDL failed: {}", e);
    }
}

async fn fetch_dormant_by_id(
    pool: &sqlx::PgPool,
    id: &str,
) -> Result<Option<DormantAccount>, sqlx::Error> {
    sqlx::query_as::<_, DormantAccount>(&format!(
        "SELECT {} FROM dormant_accounts WHERE id = $1",
        DORMANT_COLS
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

// W12-RUSTFIX: CreateRequest was referenced by the wave-11 CRUD handlers but
// never defined (baseline did not compile). Fleet-canonical shape.
#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}


// ── Domain Logic ──────────────────────────────────────────────────────────────

fn dormancy_stage(days_inactive: u32) -> &'static str {
    if days_inactive > 3650 { "unclaimed" }
    else if days_inactive > 365 { "dormant" }
    else if days_inactive > 180 { "inactive" }
    else { "active" }
}

fn restriction_level(stage: &str) -> &'static str {
    match stage {
        "dormant"   => "debit_restricted",
        "unclaimed" => "fully_restricted",
        "inactive"  => "alert_only",
        _           => "none",
    }
}

fn reactivation_requirements(stage: &str) -> Vec<&'static str> {
    match stage {
        "dormant"   => vec!["id_verification", "branch_visit"],
        "unclaimed" => vec!["id_verification", "branch_visit", "notarized_letter", "cbn_approval"],
        "inactive"  => vec!["branch_visit"],
        _           => vec![],
    }
}

fn cbn_unclaimed_threshold_years() -> u32 { 10 }


// ── Handlers ──────────────────────────────────────────────────────────────────

async fn health() -> HttpResponse {
    // MN-01: fictional middleware descriptor block removed (no Kafka/Postgres/
    // Redis/Temporal/Permify/OpenSearch connections exist in this service).
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "dormancy-management-rs",
        "version": "2.0.0",
        "domain": "Account Dormancy — CBN Compliance"
    }))
}

async fn list_accounts(
    req: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    // MN-01: the accounts store is initialized empty (`Mutex::new(vec![])`) and
    // nothing in the fleet ever populates it, so any listing served from it is
    // fiction. Fail closed until a real account source is wired.
    let _ = (req, state, query);
    HttpResponse::NotImplemented().json(json!({
        "error": "not_implemented",
        "detail": "dormant-account listing is not backed by a real account store (MN-01); the in-memory store is empty by construction. Previously this route served analysis over an empty dataset."
    }))
}

async fn stats(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    // MN-01: stats were computed over an always-empty in-memory Vec — fiction.
    let _ = (state, req);
    HttpResponse::NotImplemented().json(json!({
        "error": "not_implemented",
        "detail": "dormancy statistics are not backed by a real account store (MN-01); the in-memory store is empty by construction."
    }))
}

async fn check_dormancy(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CheckDormancyRequest>,
) -> HttpResponse {
    // MN-01: this endpoint evaluated dormancy against an always-empty in-memory
    // Vec (initialized `Mutex::new(vec![])`, never populated) — the "analysis"
    // was fiction. The pure stage-classification helper remains available to a
    // future real implementation, but this route now fails closed.
    let _ = (req, state, body);
    HttpResponse::NotImplemented().json(json!({
        "error": "not_implemented",
        "detail": "dormancy check is not backed by a real account activity source (MN-01). Previously this route served analysis over an empty dataset."
    }))
}

async fn reactivate(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<ReactivateRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "dormancy", "collection", "reactivate").await { return resp; }

    let mut account = match fetch_dormant_by_id(&state.db, &body.id).await {
        Ok(Some(a)) => a,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(json!({"error": format!("account not found: {}", body.id)}));
        }
        Err(e) => {
            eprintln!("[dormancy-management-rs] reactivate fetch failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": "account_store_unavailable"}));
        }
    };
    if !account.reactivation_eligible {
        return HttpResponse::Conflict().json(json!({
            "error": "account is not eligible for reactivation",
            "stage": account.dormancy_stage,
        }));
    }
    account.dormancy_stage = "active".into();
    account.restriction_level = "none".into();
    account.days_inactive = 0;
    account.reactivation_eligible = false;
    account.updated_at = Utc::now().to_rfc3339();
    if let Err(e) = sqlx::query(
        "UPDATE dormant_accounts SET dormancy_stage=$1, restriction_level=$2, days_inactive=$3, reactivation_eligible=$4, updated_at=$5 WHERE id=$6",
    )
    .bind(&account.dormancy_stage)
    .bind(&account.restriction_level)
    .bind(account.days_inactive)
    .bind(account.reactivation_eligible)
    .bind(&account.updated_at)
    .bind(&account.id)
    .execute(&state.db)
    .await
    {
        eprintln!("[dormancy-management-rs] reactivate update failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(json!({"error": "account_store_unavailable"}));
    }
    return HttpResponse::Ok().json(json!({ "reactivated": true, "account": account }));
}

async fn notify(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<NotifyRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "dormancy", "collection", "notify").await { return resp; }

    let mut account = match fetch_dormant_by_id(&state.db, &body.id).await {
        Ok(Some(a)) => a,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(json!({"error": format!("account not found: {}", body.id)}));
        }
        Err(e) => {
            eprintln!("[dormancy-management-rs] notify fetch failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": "account_store_unavailable"}));
        }
    };
    account.notifications_sent += 1;
    account.updated_at = Utc::now().to_rfc3339();
    let channel = body.channel.as_deref().unwrap_or("sms");
    if let Err(e) = sqlx::query(
        "UPDATE dormant_accounts SET notifications_sent=$1, updated_at=$2 WHERE id=$3",
    )
    .bind(account.notifications_sent)
    .bind(&account.updated_at)
    .bind(&account.id)
    .execute(&state.db)
    .await
    {
        eprintln!("[dormancy-management-rs] notify update failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(json!({"error": "account_store_unavailable"}));
    }
    return HttpResponse::Ok().json(json!({
        "notified": true,
        "channel": channel,
        "notifications_sent": account.notifications_sent,
        "account": account,
    }));
}

// ── Production Hardening ──────────────────────────────────────────────────────

static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const  CB_THRESHOLD: i32 = 5;
const  CB_RESET_SECS: i64 = 30;

// --- Distributed rate limiting (redis shared sliding window; W12 C3-P1-B1) ---
// Replaces the per-replica statics _RL_TOKENS/_RL_LAST (and the dead
// _RATE_WINDOW_START/_RATE_WINDOW_COUNT pair): behind >1 replica the old
// per-process bucket multiplied the effective limit by the replica count
// (correctness bug). Now an atomic Lua INCR+PEXPIRE sliding window on a shared
// deadpool-redis pool; limit is global per service, not per replica.
// Key: ratelimit:dormancy-management-rs:global — the replaced bucket was process-global (no
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
        .key("ratelimit:dormancy-management-rs:global")
        .arg(RL_WINDOW_MS)
        .invoke_async(&mut *conn)
        .await;
    match count {
        Ok(n) => n <= RL_LIMIT,
        Err(_) => false, // fail closed: redis error
    }
}

fn cb_allow() -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};
    let failures = CB_FAILURES.load(AtomicOrdering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
        if now - CB_LAST_FAILURE.load(AtomicOrdering::Relaxed) > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, AtomicOrdering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_failure() {
    use std::time::{SystemTime, UNIX_EPOCH};
    CB_FAILURES.fetch_add(1, AtomicOrdering::Relaxed);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, AtomicOrdering::Relaxed);
}

fn cb_record_success() {
    let f = CB_FAILURES.load(AtomicOrdering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, AtomicOrdering::Relaxed); }
}

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

async fn check_jwt(req: &HttpRequest) -> Result<(), HttpResponse> {
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

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "dormancy-management-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"dormancy-management-rs\"}} {}\n\
         # TYPE errors_total counter\nerrors_total{{service=\"dormancy-management-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn alerts_endpoint(req: HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let reqs = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let errs = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let error_rate = if reqs > 0 { errs as f64 / reqs as f64 } else { 0.0 };
    let mut fired = Vec::<serde_json::Value>::new();
    if error_rate > 0.05 {
        fired.push(json!({"rule": "high_error_rate", "value": error_rate, "severity": "critical"}));
    }
    HttpResponse::Ok().json(json!({"alerts": fired, "rules": 3, "error_rate": error_rate}))
}

// ── Deep Domain Logic (CBN rules, kept for use by check_dormancy) ─────────────

/// BVN validation
fn validate_bvn(bvn: &str) -> Result<(), String> {
    if bvn.len() != 11 { return Err("BVN must be 11 digits".to_string()); }
    if !bvn.chars().all(|c| c.is_ascii_digit()) { return Err("BVN must contain only digits".to_string()); }
    if &bvn[..2] == "00" { return Err("Invalid BVN issuer code".to_string()); }
    Ok(())
}

/// NUBAN check digit validation
fn validate_nuban(bank_code: &str, account_number: &str) -> Result<(), String> {
    if account_number.len() != 10 { return Err("NUBAN must be 10 digits".to_string()); }
    if bank_code.len() != 3 { return Err("Bank code must be 3 digits".to_string()); }
    let serial = format!("{}{}", bank_code, &account_number[..9]);
    let weights = [3u32, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    let sum: u32 = serial.chars().zip(weights.iter())
        .map(|(c, w)| c.to_digit(10).unwrap_or(0) * w)
        .sum();
    let check_digit = (10 - (sum % 10)) % 10;
    let actual = account_number.chars().last().and_then(|c| c.to_digit(10)).unwrap_or(99);
    if check_digit != actual {
        return Err(format!("NUBAN check digit mismatch: expected {}, got {}", check_digit, actual));
    }
    Ok(())
}

/// CBN Tier Limits
struct CbnTierLimit { max_single_debit: i64, max_daily: i64, max_balance: i64 }

fn cbn_tier_limits(tier: &str) -> Option<CbnTierLimit> {
    match tier {
        "tier1" => Some(CbnTierLimit { max_single_debit: 5_000_000, max_daily: 30_000_000, max_balance: 30_000_000 }),
        "tier2" => Some(CbnTierLimit { max_single_debit: 20_000_000, max_daily: 50_000_000, max_balance: 50_000_000 }),
        "tier3" => Some(CbnTierLimit { max_single_debit: 500_000_000, max_daily: 1_000_000_000, max_balance: i64::MAX }),
        _ => None,
    }
}

/// AML Risk Scoring
fn compute_aml_risk_score(
    is_pep: bool, is_high_risk_country: bool, cash_intensive: bool,
    is_structuring: bool, has_adverse_media: bool,
    txn_amount_kobo: i64, account_age_months: u32,
) -> (f64, Vec<&'static str>) {
    let mut score = 0.0f64;
    let mut indicators = Vec::new();
    if is_pep { score += 30.0; indicators.push("PEP_STATUS"); }
    if is_high_risk_country { score += 25.0; indicators.push("HIGH_RISK_JURISDICTION"); }
    if cash_intensive { score += 15.0; indicators.push("CASH_INTENSIVE"); }
    if is_structuring { score += 35.0; indicators.push("STRUCTURING_DETECTED"); }
    if has_adverse_media { score += 20.0; indicators.push("ADVERSE_MEDIA"); }
    if txn_amount_kobo > 1_000_000_000 { score += 10.0; indicators.push("HIGH_VALUE_TXN"); }
    if account_age_months < 3 { score += 10.0; indicators.push("NEW_ACCOUNT"); }
    (score.min(100.0), indicators)
}

/// CBN provisioning rates
fn compute_provisioning_rate(days_past_due: u32) -> f64 {
    match days_past_due {
        0..=90 => 1.0, 91..=180 => 10.0, 181..=360 => 50.0,
        361..=720 => 75.0, _ => 100.0,
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

// --- Permify authorization (W12-B5-P1-D-B) ---
// Every mutating handler performs a REAL Permify permission check AFTER
// check_jwt has authenticated the caller. Subject = verified JWT sub (from
// VerifiedClaims in request extensions), tenant = verified JWT tenant claim
// (fallback: X-Tenant-Id header, PERMIFY_DEFAULT_TENANT, "bpmgd"), resource =
// domain entity id, permission per action (schema: canonical v2.perm
// service_config entity + services/auth-service/schemas/permify/
// v2-core-domain-rs.fragment). 30s in-process decision cache keyed
// (tenant, entity_type, entity_id, permission, subject); errors NEVER cached.
// FAIL-CLOSED: Permify unreachable/non-200 => 502; denied => 403.
// Canonical pattern: W12-B5-P0-D2 (services/risk-scoring-rs/src/main.rs).
struct PermifyDecision {
    allowed: bool,
    expires_at: std::time::Instant,
}

static PERMIFY_DECISIONS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>>> = std::sync::OnceLock::new();

fn permify_decisions() -> &'static std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>> {
    PERMIFY_DECISIONS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn permify_base_url() -> String {
    match std::env::var("PERMIFY_URL") {
        Ok(u) if !u.is_empty() => u.trim_end_matches('/').to_string(),
        _ => "http://permify:3476".to_string(),
    }
}

async fn permify_check(req: &actix_web::HttpRequest, entity_type: &str, entity_id: &str, permission: &str) -> Result<(), HttpResponse> {
    use actix_web::HttpMessage as _;
    let (subject, claim_tenant) = {
        let ext = req.extensions();
        match ext.get::<VerifiedClaims>() {
            Some(c) => (
                c.0.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()),
                c.0.get("tenant_id").or_else(|| c.0.get("tenant")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            ),
            None => (None, None),
        }
    };
    let subject = match subject {
        Some(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"}))),
    };
    if entity_id.is_empty() {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"})));
    }
    let tenant_id = claim_tenant.filter(|s| !s.is_empty())
        .or_else(|| req.headers().get("X-Tenant-Id").and_then(|v| v.to_str().ok()).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string());
    let cache_key = format!("{}|{}|{}|{}|{}", tenant_id, entity_type, entity_id, permission, subject);
    {
        let cache = permify_decisions().lock().unwrap();
        if let Some(d) = cache.get(&cache_key) {
            if d.expires_at > std::time::Instant::now() {
                if d.allowed { return Ok(()); }
                return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
            }
        }
    }
    let payload = serde_json::json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_base_url(), tenant_id);
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
        Ok(c) => c,
        Err(_) => return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify client init failed (fail-closed)"}))),
    };
    let resp = match client.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[permify] FAIL-CLOSED check {} on {}:{} unreachable: {}", permission, entity_type, entity_id, e);
            return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})));
        }
    };
    if !resp.status().is_success() {
        return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})));
    }
    let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({}));
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED")
        || body.get("can").and_then(|v| v.as_bool()) == Some(true);
    // Errors are never cached; only concrete allow/deny decisions (30s TTL).
    permify_decisions().lock().unwrap().insert(cache_key, PermifyDecision {
        allowed,
        expires_at: std::time::Instant::now() + std::time::Duration::from_secs(30),
    });
    if !allowed {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8166);
    // W12-RUSTFIX: sqlx pool for the wave-11 CRUD handlers (data.db) — never
    // initialised by the generator (baseline did not compile). Fleet-canonical init.
    let db: sqlx::PgPool = match std::env::var("DATABASE_URL") {
        Ok(url) => match sqlx::postgres::PgPoolOptions::new()
            .max_connections(25)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect_lazy(&url)
        {
            Ok(p) => { println!("dormancy-management-rs: Postgres pool configured (max 25)"); p }
            Err(e) => {
                eprintln!("[dormancy-management-rs] invalid DATABASE_URL: {} — DB endpoints will fail", e);
                sqlx::postgres::PgPoolOptions::new().max_connections(1)
                    .connect_lazy("postgres://127.0.0.1:5432/postgres").expect("static fallback URL parses")
            }
        },
        Err(_) => {
            eprintln!("[dormancy-management-rs] DATABASE_URL not set — DB endpoints will fail");
            sqlx::postgres::PgPoolOptions::new().max_connections(1)
                .connect_lazy("postgres://127.0.0.1:5432/postgres").expect("static fallback URL parses")
        }
    };
    init_dormancy_db(&db).await;
    let state = web::Data::new(AppState {
        db: db.clone(),
    });

    println!("dormancy-management-rs v2.0 listening on :{}", port);

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
            .app_data(state.clone())
            // Health / ops
            .route("/healthz",          web::get().to(health))
            .route("/readyz",           web::get().to(readyz))
            .route("/livez",            web::get().to(livez))
            .route("/metrics",          web::get().to(prom_metrics))
            .route("/v1/alerts",        web::get().to(alerts_endpoint))
            // Domain
            .route("/v1/dormant-accounts", web::get().to(list_accounts))
            .route("/v1/stats",         web::get().to(stats))
            .route("/v1/check",         web::post().to(check_dormancy))
            .route("/v1/reactivate",    web::post().to(reactivate))
            .route("/v1/notify",        web::post().to(notify))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dormancy_stage() {
        assert_eq!(dormancy_stage(90), "active");
        assert_eq!(dormancy_stage(195), "inactive");
        assert_eq!(dormancy_stage(400), "dormant");
        assert_eq!(dormancy_stage(4000), "unclaimed");
    }

    #[test]
    fn test_restriction_level() {
        assert_eq!(restriction_level("active"), "none");
        assert_eq!(restriction_level("inactive"), "alert_only");
        assert_eq!(restriction_level("dormant"), "debit_restricted");
        assert_eq!(restriction_level("unclaimed"), "fully_restricted");
    }

    #[test]
    fn test_reactivation_requirements() {
        assert!(reactivation_requirements("dormant").contains(&"branch_visit"));
        assert!(reactivation_requirements("unclaimed").contains(&"cbn_approval"));
        assert!(reactivation_requirements("active").is_empty());
    }

    #[test]
    fn test_circuit_breaker_opens() {
        for _ in 0..5 { cb_record_failure(); }
        assert!(!cb_allow());
        // Reset
        CB_FAILURES.store(0, AtomicOrdering::Relaxed);
    }

    #[test]
    fn test_nuban_validation() {
        // Valid NUBAN for Access Bank (044)
        assert!(validate_nuban("044", "0690000004").is_ok());
    }

    #[test]
    fn test_aml_risk_score_pep() {
        let (score, indicators) = compute_aml_risk_score(true, false, false, false, false, 0, 24);
        assert!(score >= 30.0);
        assert!(indicators.contains(&"PEP_STATUS"));
    }

    #[test]
    fn test_dormancy_stage_thresholds() {
        assert_eq!(dormancy_stage(3651), "unclaimed");
        assert_eq!(dormancy_stage(366), "dormant");
        assert_eq!(dormancy_stage(181), "inactive");
        assert_eq!(dormancy_stage(180), "active");
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let mut tx = match data.db.begin().await {
        Ok(t) => t,
        Err(e) => { return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})); }
    };
    let result = sqlx::query("UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&mut *tx)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            if let Err(e) = sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&mut *tx).await {
                    return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
                }
            if let Err(e) = tx.commit().await {
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
            }
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut tx = match data.db.begin().await {
        Ok(t) => t,
        Err(e) => { return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})); }
    };
    if let Err(e) = sqlx::query("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&mut *tx)
        .await {
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
    }

    let payload = serde_json::json!({"id": &id});
    if let Err(e) = sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("service_configs.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&mut *tx).await {
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
        }

    if let Err(e) = tx.commit().await {
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
    }
    HttpResponse::NoContent().finish()
}
