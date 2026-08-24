use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, RwLock};
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

#[derive(Clone)]
struct AppState {
    start_time: Instant,
    pin_blocks: Arc<RwLock<Vec<PinBlock>>>,
    pin_hashes: Arc<RwLock<Vec<PinHashRecord>>>,
}

impl AppState {
    fn new() -> Self {
        // No seeded/fake records: state starts empty and only real operations populate it.
        AppState {
            start_time: Instant::now(),
            pin_blocks: Arc::new(RwLock::new(Vec::new())),
            pin_hashes: Arc::new(RwLock::new(Vec::new())),
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
    let blocks = state.pin_blocks.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *blocks, "total": blocks.len()}))
}

async fn encode_pin_block(req: actix_web::HttpRequest, _state: web::Data<AppState>, body: web::Json<EncodeRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
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
    let hashes = state.pin_hashes.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *hashes, "total": hashes.len()}))
}

async fn hash_pin(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<HashRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !valid_pin(&body.pin) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pin", "detail": "PIN must be 4-12 ASCII digits"}));
    }
    let algo = body.algorithm.clone().unwrap_or_else(|| "PBKDF2-SHA256".into());
    if algo != "PBKDF2-SHA256" {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "unsupported_algorithm", "supported": ["PBKDF2-SHA256"]}));
    }
    let mut salt = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    let hash = pbkdf2_hash_pin(&body.pin, &salt, PBKDF2_ITERATIONS);
    let rec = PinHashRecord {
        id: format!("PH-{}", uuid::Uuid::new_v4()),
        account_number: body.account_number.clone(),
        algorithm: algo.clone(),
        hash_hex: hex_encode(&hash),
        salt: hex_encode(&salt),
        iterations: PBKDF2_ITERATIONS,
        created_at: now_utc(),
    };
    state.pin_hashes.write().unwrap().push(rec.clone());
    HttpResponse::Created().json(json!({"id": rec.id, "algorithm": algo, "hashStored": true}))
}

async fn verify_pin(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<VerifyRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !valid_pin(&body.pin) {
        // Fail closed: an invalid candidate PIN is never verified.
        return HttpResponse::Ok().json(json!({"hashId": body.hash_id, "verified": false, "reason": "invalid_pin_format"}));
    }
    let rec = {
        let hashes = state.pin_hashes.read().unwrap();
        hashes.iter().find(|h| h.id == body.hash_id).cloned()
    };
    let rec = match rec {
        Some(r) => r,
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
    let actual = pbkdf2_hash_pin(&body.pin, &salt, rec.iterations);
    let verified = ct_eq(&actual, &expected);
    HttpResponse::Ok().json(json!({
        "hashId": body.hash_id,
        "verified": verified,
        "matchedAt": if verified { json!(now_utc()) } else { json!(null) },
    }))
}

async fn get_stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let blocks = state.pin_blocks.read().unwrap();
    let hashes = state.pin_hashes.read().unwrap();
    let algo_counts = hashes.iter().fold(std::collections::HashMap::<String,u32>::new(), |mut m, h| {
        *m.entry(h.algorithm.clone()).or_insert(0) += 1;
        m
    });
    HttpResponse::Ok().json(json!({
        "pinBlocksEncoded": blocks.len(),
        "pinHashesStored": hashes.len(),
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9273".to_string());
    let state = AppState::new();
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
