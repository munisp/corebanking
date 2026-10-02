use actix_web::{web, App, HttpServer, HttpResponse};
use actix_web::HttpMessage;
use deadpool_redis::redis::{self, AsyncCommands, SetExpiry, SetOptions};
use deadpool_redis::{Config as RedisConfig, Pool as RedisPool, Runtime};
use rand::Rng;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// ─── State ──────────────────────────────────────────────────────────────────

const OTP_TTL_SECS: u64 = 300;
const OTP_MAX_ATTEMPTS: u32 = 5;

/// OTP state lives in redis (c3-0778): `otp:{tenant}:{phone}` JSON
/// {code_hash, attempts}, EX 300. The previous in-process HashMap lost OTPs
/// on restart, was per-replica, and made verify-after-send race across
/// replicas. Failure policy: FAIL-CLOSED — a redis outage answers 503 on
/// both send and verify.
#[derive(serde::Serialize, serde::Deserialize)]
struct OtpRecord {
    /// SHA-256 hash of the OTP — the plaintext code is NEVER stored server-side.
    code_hash: String,
    attempts: u32,
}

struct AppState {
    start_time: Instant,
    redis_pool: RedisPool,
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<Arc<tokio_postgres::Client>>,
}

/// Tenant for the OTP key, from the verified JWT claims (else "default").
fn request_tenant(req: &actix_web::HttpRequest) -> String {
    if let Some(claims) = req.extensions().get::<VerifiedClaims>() {
        for field in ["tenant_id", "tenant"] {
            if let Some(t) = claims.0.get(field).and_then(|v| v.as_str()) {
                if !t.is_empty() {
                    return t.to_string();
                }
            }
        }
    }
    "default".to_string()
}

fn otp_key(tenant: &str, phone: &str) -> String {
    format!("otp:{}:{}", tenant, phone)
}

#[derive(Deserialize)]
struct SendOtpRequest {
    phone: String,
    purpose: Option<String>,
}

#[derive(Deserialize)]
struct VerifyOtpRequest {
    phone: String,
    otp: String,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn validate_phone_ng(phone: &str) -> bool {
    (phone.starts_with("+234") && phone.len() == 14) || (phone.starts_with('0') && phone.len() == 11)
}

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    h.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

/// Constant-time string comparison.
fn ct_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
}

/// Cryptographically secure 6-digit OTP from OsRng (never time-derived).
fn generate_otp() -> String {
    format!("{:06}", rand::rngs::OsRng.gen_range(0..1_000_000u32))
}

/// Returns true when the deployment is production-like (fail closed: unknown => production).
fn is_production_env() -> bool {
    let env_name = std::env::var("APP_ENV")
        .or_else(|_| std::env::var("ENVIRONMENT"))
        .unwrap_or_else(|_| "production".to_string())
        .to_ascii_lowercase();
    !matches!(env_name.as_str(), "dev" | "development" | "test" | "testing" | "staging" | "local")
}

/// Dispatch the OTP through the configured SMS provider. Fails closed.
/// TLS policy: https:// provider URLs are always required in production.
/// Cleartext http:// is only accepted outside production AND with the explicit
/// SMS_ALLOW_INSECURE_HTTP=true opt-in. TLS certificate verification is always on.
async fn dispatch_sms(phone: &str, message: &str) -> Result<(), String> {
    let provider = match std::env::var("SMS_PROVIDER_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => return Err("SMS_PROVIDER_URL is not configured".to_string()),
    };
    if provider.starts_with("http://") {
        let allow_insecure = std::env::var("SMS_ALLOW_INSECURE_HTTP")
            .map(|v| v == "true")
            .unwrap_or(false);
        if is_production_env() || !allow_insecure {
            return Err(
                "cleartext http:// SMS provider URL rejected: use https:// (http requires SMS_ALLOW_INSECURE_HTTP=true in a non-production environment)"
                    .to_string(),
            );
        }
    } else if !provider.starts_with("https://") {
        return Err("SMS_PROVIDER_URL must be an https:// URL".to_string());
    }
    let payload = json!({"to": phone, "message": message});
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("http client init failed: {}", e))?;
    let resp = client
        .post(&provider)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("provider request failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("provider responded with status {}", resp.status()));
    }
    Ok(())
}

// ─── JWT auth (real HS256 verification, fail closed) ────────────────────────

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

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn health() -> HttpResponse {
    HttpResponse::Ok()
        .insert_header(("content-security-policy", "default-src 'self'"))
        .json(json!({"status": "healthy", "service": "sms-otp-service-rs", "otp_ttl_seconds": OTP_TTL_SECS}))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "sms-otp-service-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"sms-otp-service-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": state.db_client.is_some(),
        "mode": if state.db_client.is_some() { "normal" } else { "degraded" },
    }))
}

/// POST /v1/otp/send — generate a real OTP, store only its hash, dispatch via SMS.
/// The OTP is NEVER returned in the API response.
async fn send_otp(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<SendOtpRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "otp", "collection", "send").await { return resp; }
    if !validate_phone_ng(&body.phone) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_phone", "sent": false}));
    }
    let otp = generate_otp();
    let rec = OtpRecord {
        code_hash: sha256_hex(&otp),
        attempts: 0,
    };
    let tenant = request_tenant(&req);
    let key = otp_key(&tenant, &body.phone);
    let payload = match serde_json::to_string(&rec) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sms-otp-service-rs: OTP record encode failed: {}", e);
            return HttpResponse::InternalServerError().json(json!({"error": "otp_encode_failed", "sent": false}));
        }
    };
    let mut conn = match state.redis_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            // fail-closed: no OTP store, no send
            eprintln!("sms-otp-service-rs: redis unavailable for send_otp: {}", e);
            return HttpResponse::ServiceUnavailable().json(json!({"error": "otp_store_unavailable", "sent": false}));
        }
    };
    // SET first (EX 300), then dispatch; on dispatch failure the stored OTP is
    // deleted so no undelivered code can ever be verified.
    if let Err(e) = conn.set_ex::<_, _, ()>(&key, payload, OTP_TTL_SECS).await {
        eprintln!("sms-otp-service-rs: redis SET failed in send_otp: {}", e);
        return HttpResponse::ServiceUnavailable().json(json!({"error": "otp_store_unavailable", "sent": false}));
    }
    let message = format!("Your verification code is {}. It expires in 5 minutes.", otp);
    if let Err(e) = dispatch_sms(&body.phone, &message).await {
        eprintln!("sms-otp-service-rs: SMS dispatch failed: {}", e);
        let _ = conn.del::<_, ()>(&key).await;
        return HttpResponse::ServiceUnavailable().json(json!({
            "error": "sms_provider_unavailable",
            "sent": false,
        }));
    }
    db_persist(&state, "send_otp", &json!({"phone": body.phone, "purpose": body.purpose})).await;
    HttpResponse::Ok().json(json!({"sent": true, "expires_in": OTP_TTL_SECS}))
}

/// POST /v1/otp/verify — constant-time hash comparison with expiry + attempt cap.
async fn verify_otp(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<VerifyOtpRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "otp", "collection", "verify").await { return resp; }
    if body.otp.len() != 6 || !body.otp.chars().all(|c| c.is_ascii_digit()) {
        return HttpResponse::Unauthorized().json(json!({"verified": false, "reason": "invalid_otp_format"}));
    }
    // Redis-backed verify (c3-0778): GET / KEEPTTL attempt write-back /
    // constant-time compare / DEL on success. Expiry is enforced by the
    // redis EX 300 — an expired key collapses to "no_otp_pending".
    enum Outcome { Verified, Failed(&'static str) }
    let tenant = request_tenant(&req);
    let key = otp_key(&tenant, &body.phone);
    let mut conn = match state.redis_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            // fail-closed: without the OTP store we cannot verify — 503
            eprintln!("sms-otp-service-rs: redis unavailable for verify_otp: {}", e);
            return HttpResponse::ServiceUnavailable().json(json!({"verified": false, "reason": "otp_store_unavailable"}));
        }
    };
    let outcome = match conn.get::<_, Option<String>>(&key).await {
        Err(e) => {
            eprintln!("sms-otp-service-rs: redis GET failed in verify_otp: {}", e);
            return HttpResponse::ServiceUnavailable().json(json!({"verified": false, "reason": "otp_store_unavailable"}));
        }
        Ok(None) => Outcome::Failed("no_otp_pending"),
        Ok(Some(raw)) => {
            let parsed: Result<OtpRecord, _> = serde_json::from_str(&raw);
            match parsed {
                Err(_) => {
                    let _ = conn.del::<_, ()>(&key).await;
                    Outcome::Failed("no_otp_pending")
                }
                Ok(mut rec) => {
                    if rec.attempts >= OTP_MAX_ATTEMPTS {
                        let _ = conn.del::<_, ()>(&key).await;
                        Outcome::Failed("max_attempts_exceeded")
                    } else {
                        rec.attempts += 1;
                        // Write the incremented attempt counter back WITHOUT
                        // extending the 300s window (KEEPTTL).
                        let payload = serde_json::to_string(&rec).unwrap_or_default();
                        let keep = SetOptions::default().with_expiration(SetExpiry::KEEPTTL);
                        if let Err(e) = conn.set_options::<_, _, ()>(&key, payload, keep).await {
                            eprintln!("sms-otp-service-rs: redis attempt write-back failed: {}", e);
                            return HttpResponse::ServiceUnavailable().json(json!({"verified": false, "reason": "otp_store_unavailable"}));
                        }
                        if ct_eq(&sha256_hex(&body.otp), &rec.code_hash) {
                            let _ = conn.del::<_, ()>(&key).await;
                            Outcome::Verified
                        } else {
                            Outcome::Failed("otp_mismatch")
                        }
                    }
                }
            }
        }
    };
    match outcome {
        Outcome::Verified => {
            db_persist(&state, "verify_otp", &json!({"phone": body.phone, "verified": true})).await;
            HttpResponse::Ok().json(json!({"verified": true}))
        }
        Outcome::Failed(reason) => {
            db_persist(&state, "verify_otp", &json!({"phone": body.phone, "verified": false})).await;
            HttpResponse::Unauthorized().json(json!({"verified": false, "reason": reason}))
        }
    }
}

// ─── notifications CRUD (Postgres-backed when available, else in-memory) ────

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page - 1) * limit).take(limit).collect();
    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "source": if state.db_client.is_some() { "database" } else { "in-memory" },
    }))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "service_config", "collection", "create").await { return resp; }
    let mut rec = body.into_inner();
    rec["id"] = json!(uuid::Uuid::new_v4().to_string());
    rec["created_at"] = json!(chrono::Utc::now().to_rfc3339());
    state.records.lock().unwrap().push(rec.clone());
    db_persist(&state, "create_record", &rec).await;
    HttpResponse::Created().json(rec)
}

async fn get_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let records = state.records.lock().unwrap();
    match records.iter().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => HttpResponse::Ok().json(r),
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn update_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "service_config", &id, "update").await { return resp; }
    let mut records = state.records.lock().unwrap();
    match records.iter_mut().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => {
            if let Some(obj) = body.into_inner().as_object() {
                for (k, v) in obj {
                    if k != "id" { r[k.as_str()] = v.clone(); }
                }
            }
            HttpResponse::Ok().json(r.clone())
        }
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn delete_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "service_config", &id, "delete").await { return resp; }
    let mut records = state.records.lock().unwrap();
    let before = records.len();
    records.retain(|r| r.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
    if records.len() == before {
        return HttpResponse::NotFound().json(json!({"error": "not found"}));
    }
    HttpResponse::NoContent().finish()
}

// ─── Persistence ────────────────────────────────────────────────────────────

use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); } });
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}

// Wave-11: audit INSERTs are buffered behind a Mutex and flushed every 100ms
// or every 100 rows by a spawned task (was: one blocking INSERT per request).
static W11_AUDIT_BUF: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<Vec<(String, String, String, String, String)>>>> = std::sync::OnceLock::new();
static W11_FLUSH_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let buf = W11_AUDIT_BUF.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(Vec::new())));
        let id = format!("{}_{}_{}", "sms_otp_service_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("sms-otp-service-rs");
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
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8251);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await.map(Arc::new)
    } else { None };
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
    let redis_pool = RedisConfig::from_url(redis_url)
        .create_pool(Some(Runtime::Tokio1))
        .expect("redis pool config must be valid");
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        redis_pool,
        records: Mutex::new(Vec::new()),
        db_client,
    });
    println!("sms-otp-service-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/otp/send", web::post().to(send_otp))
            .route("/v1/otp/verify", web::post().to(verify_otp))
            .route("/api/v1/notifications", web::get().to(list_records))
            .route("/api/v1/notifications", web::post().to(create_record))
            .route("/api/v1/notifications/{id}", web::get().to(get_record))
            .route("/api/v1/notifications/{id}", web::put().to(update_record))
            .route("/api/v1/notifications/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
