use actix_web::{web, App, HttpServer, HttpResponse};
use actix_web::HttpMessage;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, FromRow};
use std::time::Instant;

use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

const PBKDF2_ITERATIONS: u32 = 310_000;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

#[derive(Clone, Serialize, Deserialize)]
struct PinBlock {
    id: String,
    format: String,
    pan_truncated: String,
    block_hex: String,
    algorithm: String,
    key_id: String,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct PinHashRecord {
    id: String,
    account_number: String,
    algorithm: String,
    hash_hex: String,
    salt: String,
    iterations: u32,
    created_at: String,
}

#[derive(Deserialize)]
struct EncodeRequest {
    pan: String,
    pin: String,
    format: Option<String>,
    key_id: Option<String>,
}

#[derive(Deserialize)]
struct HashRequest {
    account_number: String,
    pin: String,
    algorithm: Option<String>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    hash_id: String,
    pin: String,
}

// ── Postgres persistence (W13-FIX-CRIT C6: in-memory PIN-hash HashMap → PG) ──
// PIN hashes were held in Arc<RwLock<HashMap>>: every customer PIN hash was
// lost on restart and verify_pin 404'd. pin_hashes (tenant-scoped) is now the
// system of record. SECURITY: only the PBKDF2 hash + salt are stored — the
// PIN itself is never persisted. Fail-closed: DB down => 503 on all
// hash/verify paths (no in-memory fallback).
// pin_blocks follows the same PG pattern (W14-A4 residual): the in-memory
// in-memory pin-block Vec state is gone — pin_blocks (tenant-scoped, typed cols,
// FromRow) is the system of record, fail-closed 503 on DB error.
#[derive(Clone)]
struct AppState {
    start_time: Instant,
    db: Option<PgPool>,
}

// DB row shape for pin_blocks (typed cols + FromRow).
#[derive(Debug, FromRow)]
#[allow(dead_code)] // tenant_id selected for scoping/audit; not re-serialized
struct PinBlockRow {
    id: String,
    tenant_id: String,
    format: String,
    pan_truncated: String,
    block_hex: String,
    algorithm: String,
    key_id: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<PinBlockRow> for PinBlock {
    fn from(r: PinBlockRow) -> Self {
        PinBlock {
            id: r.id,
            format: r.format,
            pan_truncated: r.pan_truncated,
            block_hex: r.block_hex,
            algorithm: r.algorithm,
            key_id: r.key_id,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

// DB row shape (typed cols + FromRow, canonical wave-12 rust store idiom).
#[derive(Debug, FromRow)]
#[allow(dead_code)] // tenant_id selected for scoping/audit; not re-serialized
struct PinHashRow {
    id: String,
    tenant_id: String,
    account_number: String,
    algorithm: String,
    hash_hex: String,
    salt: String,
    iterations: i32,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<PinHashRow> for PinHashRecord {
    fn from(r: PinHashRow) -> Self {
        PinHashRecord {
            id: r.id,
            account_number: r.account_number,
            algorithm: r.algorithm,
            hash_hex: r.hash_hex,
            salt: r.salt,
            iterations: r.iterations.max(0) as u32,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

fn store_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "store_unavailable",
        "service": "pin-block-engine-rs",
        "detail": detail,
    }))
}

fn require_db(state: &web::Data<AppState>) -> Result<&PgPool, HttpResponse> {
    state.db.as_ref().ok_or_else(|| {
        store_unavailable("DATABASE_URL not configured or unreachable; refusing to drop PIN hash state")
    })
}

// Tenant scoping: verified JWT tenant claim first, then X-Tenant-Id header,
// then the fleet default — mirrors permify_check's tenant resolution.
fn request_tenant(req: &actix_web::HttpRequest) -> String {
    claims_tenant(req)
        .or_else(|| req.headers().get("X-Tenant-Id").and_then(|v| v.to_str().ok()).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string())
}

async fn init_store() -> Option<PgPool> {
    let db_url = match std::env::var("DATABASE_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => {
            eprintln!("[pin-block-engine-rs] DATABASE_URL not set — pin hash endpoints will 503");
            return None;
        }
    };
    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&db_url)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[pin-block-engine-rs] DB connect failed: {} — pin hash endpoints will 503", e);
            return None;
        }
    };
    let schema = [
        r#"CREATE TABLE IF NOT EXISTS pin_hashes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            account_number TEXT NOT NULL,
            algorithm TEXT NOT NULL,
            hash_hex TEXT NOT NULL,
            salt TEXT NOT NULL,
            iterations INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_pin_hashes_tenant ON pin_hashes (tenant_id)"#,
        r#"CREATE TABLE IF NOT EXISTS pin_blocks (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            format TEXT NOT NULL,
            pan_truncated TEXT NOT NULL,
            block_hex TEXT NOT NULL,
            algorithm TEXT NOT NULL,
            key_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_pin_blocks_tenant ON pin_blocks (tenant_id)"#,
    ];
    for stmt in schema {
        if let Err(e) = sqlx::query(stmt).execute(&pool).await {
            eprintln!("[pin-block-engine-rs] schema init failed: {} — pin hash endpoints will 503", e);
            return None;
        }
    }
    eprintln!("[pin-block-engine-rs] postgres store ready (tables pin_hashes, pin_blocks)");
    Some(pool)
}

impl AppState {
    fn new(db: Option<PgPool>) -> Self {
        // No seeded/fake records: only real operations populate the store.
        AppState {
            start_time: Instant::now(),
            db,
        }
    }
}

fn now_utc() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 { return None; }
    (0..s.len()).step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

/// Constant-time byte comparison to avoid timing oracles on PIN hashes.
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// PBKDF2-HMAC-SHA256 with a cryptographically secure random salt.
fn pbkdf2_hash_pin(pin: &str, salt: &[u8], iterations: u32) -> Vec<u8> {
    let mut out = vec![0u8; HASH_LEN];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), salt, iterations, &mut out);
    out
}

fn valid_pin(pin: &str) -> bool {
    pin.len() >= 4 && pin.len() <= 12 && pin.chars().all(|c| c.is_ascii_digit())
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "pin-block-engine-rs",
        "status": "healthy",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "capabilities": ["pbkdf2-hmac-sha256-hashing", "pin-verification"],
        "hsm": {
            "pin_block_encoding": "unavailable — no HSM/3DES backend configured; /v1/pin/blocks/encode fails closed with 503"
        }
    }))
}

async fn list_blocks(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    // Real tenant-scoped query; fail-closed 503 on DB error (no in-memory fallback).
    let rows = match sqlx::query_as::<_, PinBlockRow>(
        "SELECT id, tenant_id, format, pan_truncated, block_hex, algorithm, key_id, created_at FROM pin_blocks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000")
        .bind(&tenant).fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("pin_blocks query failed: {}", e)),
    };
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM pin_blocks WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("pin_blocks count failed: {}", e)),
    };
    let items: Vec<PinBlock> = rows.into_iter().map(PinBlock::from).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total}))
}

async fn encode_pin_block(req: actix_web::HttpRequest, _state: web::Data<AppState>, body: web::Json<EncodeRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "pin_block", "collection", "encode").await { return resp; }
    // Validate inputs, then fail closed: there is no HSM/3DES backend in this
    // service, so a real ISO-0/ISO-3 PIN block cannot be produced. Returning a
    // fabricated block would be a security-critical fake, so we return 503.
    let format = body.format.clone().unwrap_or_else(|| "ISO-0".into());
    if format != "ISO-0" && format != "ISO-3" {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "unsupported_pin_block_format"}));
    }
    if body.pan.len() < 12 || !body.pan.chars().all(|c| c.is_ascii_digit()) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pan"}));
    }
    if !valid_pin(&body.pin) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pin"}));
    }
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "hsm_unavailable",
        "detail": "PIN block encoding requires an HSM (3DES/AES under ZPK); no HSM backend is configured",
        "encoded": false
    }))
}

async fn list_hashes(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    // Listing is capped at 1000 rows, tenant-scoped.
    let rows = match sqlx::query_as::<_, PinHashRow>(
        "SELECT id, tenant_id, account_number, algorithm, hash_hex, salt, iterations, created_at FROM pin_hashes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000")
        .bind(&tenant).fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("pin_hashes query failed: {}", e)),
    };
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM pin_hashes WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("pin_hashes count failed: {}", e)),
    };
    let items: Vec<PinHashRecord> = rows.into_iter().map(PinHashRecord::from).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total}))
}

async fn hash_pin(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<HashRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "pin_block", "collection", "hash").await { return resp; }
    if !valid_pin(&body.pin) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pin", "detail": "PIN must be 4-12 ASCII digits"}));
    }
    let algo = body.algorithm.clone().unwrap_or_else(|| "PBKDF2-SHA256".into());
    if algo != "PBKDF2-SHA256" {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "unsupported_algorithm", "supported": ["PBKDF2-SHA256"]}));
    }
    let mut salt = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    // Wave-11 (RS-29): PBKDF2-310k off the actix worker thread.
    let pin = body.pin.clone();
    let hash = match tokio::task::spawn_blocking(move || pbkdf2_hash_pin(&pin, &salt, PBKDF2_ITERATIONS)).await {
        Ok(h) => h,
        Err(e) => return HttpResponse::InternalServerError().json(json!({"error": "hashing_failed", "detail": e.to_string()})),
    };
    let rec = PinHashRecord {
        id: format!("PH-{}", uuid::Uuid::new_v4()),
        account_number: body.account_number.clone(),
        algorithm: algo.clone(),
        hash_hex: hex_encode(&hash),
        salt: hex_encode(&salt),
        iterations: PBKDF2_ITERATIONS,
        created_at: now_utc(),
    };
    // INSERT-first, tenant-scoped: only the hash + salt are persisted (never
    // the PIN). A DB failure is loud (503) — never hashStored:true on a drop.
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    if let Err(e) = sqlx::query(
        "INSERT INTO pin_hashes (id, tenant_id, account_number, algorithm, hash_hex, salt, iterations) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(&rec.id).bind(&tenant).bind(&rec.account_number).bind(&rec.algorithm)
        .bind(&rec.hash_hex).bind(&rec.salt).bind(rec.iterations as i32)
        .execute(db).await {
        eprintln!("[pin-block-engine-rs] pin_hashes insert failed: {}", e);
        return store_unavailable(&format!("pin_hashes insert failed: {}", e));
    }
    HttpResponse::Created().json(json!({"id": rec.id, "algorithm": algo, "hashStored": true}))
}

async fn verify_pin(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<VerifyRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "pin_block", "collection", "verify").await { return resp; }
    if !valid_pin(&body.pin) {
        // Fail closed: an invalid candidate PIN is never verified.
        return HttpResponse::Ok().json(json!({"hashId": body.hash_id, "verified": false, "reason": "invalid_pin_format"}));
    }
    // Tenant-scoped lookup in Postgres (hash survives restarts).
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    let rec = match sqlx::query_as::<_, PinHashRow>(
        "SELECT id, tenant_id, account_number, algorithm, hash_hex, salt, iterations, created_at FROM pin_hashes WHERE id = $1 AND tenant_id = $2")
        .bind(&body.hash_id).bind(&tenant).fetch_optional(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("pin_hashes lookup failed: {}", e)),
    };
    let rec = match rec {
        Some(r) => PinHashRecord::from(r),
        None => return HttpResponse::NotFound().json(json!({"error": "hash record not found"})),
    };
    let salt = match hex_decode(&rec.salt) {
        Some(s) => s,
        None => return HttpResponse::InternalServerError().json(json!({"error": "corrupt_hash_record"})),
    };
    let expected = match hex_decode(&rec.hash_hex) {
        Some(h) => h,
        None => return HttpResponse::InternalServerError().json(json!({"error": "corrupt_hash_record"})),
    };
    // Wave-11 (RS-30): PBKDF2 off the actix worker thread.
    let pin = body.pin.clone();
    let iterations = rec.iterations;
    let actual = match tokio::task::spawn_blocking(move || pbkdf2_hash_pin(&pin, &salt, iterations)).await {
        Ok(h) => h,
        Err(e) => return HttpResponse::InternalServerError().json(json!({"error": "hashing_failed", "detail": e.to_string()})),
    };
    let verified = ct_eq(&actual, &expected);
    HttpResponse::Ok().json(json!({
        "hashId": body.hash_id,
        "verified": verified,
        "matchedAt": if verified { json!(now_utc()) } else { json!(null) },
    }))
}

async fn get_stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    let blocks: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM pin_blocks WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("pin_blocks count failed: {}", e)),
    };
    let stored: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM pin_hashes WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("pin_hashes count failed: {}", e)),
    };
    let algo_rows = match sqlx::query_as::<_, (String, i64)>("SELECT algorithm, COUNT(*) FROM pin_hashes WHERE tenant_id = $1 GROUP BY algorithm")
        .bind(&tenant).fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("pin_hashes stats failed: {}", e)),
    };
    let algo_counts: std::collections::HashMap<String, i64> = algo_rows.into_iter().collect();
    HttpResponse::Ok().json(json!({
        "pinBlocksEncoded": blocks,
        "pinHashesStored": stored,
        "algorithmBreakdown": algo_counts,
    }))
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
    let port = std::env::var("PORT").unwrap_or_else(|_| "9273".to_string());
    // Fail-closed store: None => all pin hash endpoints 503 (no in-memory fallback).
    let db = init_store().await;
    let state = AppState::new(db);
    println!("PIN Block & Hash Engine (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/pin/blocks", web::get().to(list_blocks))
            .route("/v1/pin/blocks/encode", web::post().to(encode_pin_block))
            .route("/v1/pin/hashes", web::get().to(list_hashes))
            .route("/v1/pin/hashes/create", web::post().to(hash_pin))
            .route("/v1/pin/verify", web::post().to(verify_pin))
            .route("/v1/pin/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
