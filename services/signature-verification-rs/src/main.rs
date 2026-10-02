use actix_web::{web, App, HttpMessage, HttpResponse, HttpServer}; // Wave-12 drive-by: HttpMessage import required by actix-web resolved in the lockfile
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::time::Instant;

// ─── State ──────────────────────────────────────────────────────────────────

// Wave-12 (C3-P0-B5): service_configs records are persisted in Postgres
// (was: Mutex<Vec<..>> memory-only, lost on every restart). The pool replaces
// the single tokio_postgres::Client; None means DATABASE_URL was unset or the
// initial connect failed — handlers then fail closed with 503 (no in-memory
// fallback).
struct AppState {
    start_time: Instant,
    db: Option<PgPool>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    /// Message that was signed: raw UTF-8 string, or base64 when message_encoding == "base64".
    message: String,
    message_encoding: Option<String>,
    /// Base64-encoded signature bytes.
    signature: String,
    /// Base64-encoded public key bytes (raw 32-byte ed25519 key for EdDSA).
    public_key: String,
    /// Signature algorithm, e.g. "EdDSA" / "ed25519".
    alg: String,
}

#[derive(Serialize)]
struct VerifyResponse {
    verified: bool,
    alg: String,
}

// ─── Real cryptographic verification ────────────────────────────────────────

fn verify_ed25519(message: &[u8], sig_b64: &str, key_b64: &str) -> Result<bool, String> {
    let sig_bytes = B64
        .decode(sig_b64)
        .map_err(|e| format!("invalid base64 signature: {}", e))?;
    let key_bytes = B64
        .decode(key_b64)
        .map_err(|e| format!("invalid base64 public key: {}", e))?;
    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| "signature must be 64 bytes".to_string())?;
    let key_arr: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "public key must be 32 bytes".to_string())?;
    let signature = Signature::from_bytes(&sig_arr);
    let key = VerifyingKey::from_bytes(&key_arr)
        .map_err(|e| format!("invalid ed25519 public key: {}", e))?;
    Ok(key.verify(message, &signature).is_ok())
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

static JWKS_CACHE: std::sync::OnceLock<std::sync::Mutex<Option<JwksCacheEntry>>> =
    std::sync::OnceLock::new();

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
        Ok(realm) if !realm.is_empty() => Some(format!(
            "{}/protocol/openid-connect/certs",
            realm.trim_end_matches('/')
        )),
        _ => None,
    }
}

async fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, actix_web::HttpResponse> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => {
            return Err(
                actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                    "error": "jwt_validation_unavailable",
                    "detail": "no JWKS endpoint configured"
                })),
            )
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
        .map_err(|_| {
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "client init failed"
            }))
        })?;
    let resp = client.get(&url).send().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"error": "jwks_unavailable"}))
    })?;
    if !resp.status().is_success() {
        return Err(
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "upstream returned error status"
            })),
        );
    }
    let keys = resp
        .json::<jsonwebtoken::jwk::JwkSet>()
        .await
        .map_err(|_| {
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "malformed JWKS payload"
            }))
        })?;
    let mut cache = jwks_cache().lock().unwrap();
    *cache = Some(JwksCacheEntry {
        fetched_at: std::time::Instant::now(),
        keys: keys.clone(),
    });
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
    let header = jsonwebtoken::decode_header(token).map_err(|_| {
        actix_web::HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "malformed token header"}))
    })?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => {
                    return Err(actix_web::HttpResponse::Unauthorized()
                        .json(serde_json::json!({"error": "missing kid"})))
                }
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
                            return Err(actix_web::HttpResponse::Unauthorized()
                                .json(serde_json::json!({"error": "unknown kid"})))
                        }
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk).map_err(|_| {
                actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid jwk"}))
            })?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err(actix_web::HttpResponse::ServiceUnavailable().json(
                        serde_json::json!({
                            "error": "jwt_validation_unavailable",
                            "detail": "JWT_SECRET is not configured; refusing to validate"
                        }),
                    ))
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
                Err(_) => Err(actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        other => Err(
            actix_web::HttpResponse::Unauthorized().json(serde_json::json!({
                "error": format!("unsupported alg {:?}", other)
            })),
        ),
    }
}

// Wave-12 drive-by compile fix: was `req: &actix_web` (expected type, found
// crate — the file did not compile as shipped).
async fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz"
        || path == "/readyz"
        || path == "/livez"
        || path == "/metrics"
        || path == "/health"
    {
        return Ok(());
    }
    let header = match req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
    {
        Some(h) => h,
        None => {
            return Err(HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "missing Authorization header"})))
        }
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => {
            return Err(HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "invalid auth header"})))
        }
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims));
    Ok(())
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn health() -> HttpResponse {
    HttpResponse::Ok()
        .insert_header(("content-security-policy", "default-src 'self'"))
        .json(json!({
            "status": "healthy",
            "service": "signature-verification-rs",
            "supported_algorithms": ["EdDSA"],
        }))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "signature-verification-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body =
        "# TYPE requests_total counter\nrequests_total{service=\"signature-verification-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(
    state: web::Data<AppState>,
    req: actix_web::HttpRequest,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    HttpResponse::Ok().json(json!({
        "db_available": state.db.is_some(),
        "mode": if state.db.is_some() { "normal" } else { "degraded" },
    }))
}

async fn verify_signature(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<VerifyRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }

    if let Err(resp) = permify_check(&req, "signature_verification", &body.alg, "verify").await { return resp; }
    let alg = body.alg.trim();
    let message = match body.message_encoding.as_deref() {
        Some("base64") => match B64.decode(&body.message) {
            Ok(m) => m,
            Err(e) => {
                return HttpResponse::UnprocessableEntity()
                    .json(json!({"error": format!("invalid base64 message: {}", e)}))
            }
        },
        _ => body.message.clone().into_bytes(),
    };

    // Verify the ACTUAL signature bytes. Never verify on algorithm name alone.
    let verified = match alg {
        "EdDSA" | "ed25519" | "ED25519" => {
            match verify_ed25519(&message, &body.signature, &body.public_key) {
                Ok(v) => v,
                Err(e) => {
                    return HttpResponse::UnprocessableEntity()
                        .json(json!({"error": e, "verified": false}))
                }
            }
        }
        _ => {
            // No crypto backend for this algorithm: fail closed, never claim verified.
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "crypto_backend_unavailable",
                "alg": alg,
                "verified": false,
                "detail": "no verification backend configured for this algorithm",
            }));
        }
    };

    db_persist(
        &state,
        "verify_signature",
        &json!({"alg": alg, "verified": verified}),
    )
    .await;
    let status = if verified {
        actix_web::http::StatusCode::OK
    } else {
        actix_web::http::StatusCode::UNAUTHORIZED
    };
    HttpResponse::build(status).json(VerifyResponse {
        verified,
        alg: alg.to_string(),
    })
}

// ─── service_configs CRUD (Wave-12 C3-P0-B5: Postgres-authoritative, backed
// by the per-service signature_records table; no in-memory fallback — when the
// pool is missing or a query fails the handlers return 503) ──────────────────

fn record_store_unavailable() -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({"error": "record_store_unavailable"}))
}

async fn list_records(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let page: i64 = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = query
        .get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(20);
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM signature_records")
        .fetch_one(pool)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            eprintln!(
                "signature-verification-rs: list_records count failed: {}",
                e
            );
            return record_store_unavailable();
        }
    };
    let items: Vec<serde_json::Value> = match sqlx::query_scalar(
        "SELECT data FROM signature_records ORDER BY created_at, id LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind((page - 1) * limit)
    .fetch_all(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!(
                "signature-verification-rs: list_records query failed: {}",
                e
            );
            return record_store_unavailable();
        }
    };
    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "source": "database",
    }))
}

async fn create_record(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let mut rec = body.into_inner();
    let id = uuid::Uuid::new_v4().to_string();
    if let Err(resp) = permify_check(&req, "signature_verification", &id, "verify").await { return resp; }
    rec["id"] = json!(id);
    rec["created_at"] = json!(chrono::Utc::now().to_rfc3339());
    if let Err(e) = sqlx::query("INSERT INTO signature_records (id, data) VALUES ($1, $2)")
        .bind(&id)
        .bind(&rec)
        .execute(pool)
        .await
    {
        eprintln!(
            "signature-verification-rs: create_record insert failed: {}",
            e
        );
        return record_store_unavailable();
    }
    db_persist(&state, "create_record", &rec).await;
    HttpResponse::Created().json(rec)
}

async fn get_record(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let id = path.into_inner();
    match sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT data FROM signature_records WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(r),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => {
            eprintln!("signature-verification-rs: get_record query failed: {}", e);
            record_store_unavailable()
        }
    }
}

async fn update_record(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "signature_verification", &id, "override").await { return resp; }
    // Merge caller-supplied keys (except "id") into the stored document —
    // same semantics as the previous in-memory merge.
    match sqlx::query_scalar::<_, serde_json::Value>(
        "UPDATE signature_records SET data = data || ($2::jsonb - 'id'), updated_at = NOW() WHERE id = $1 RETURNING data",
    )
    .bind(&id)
    .bind(&body.into_inner())
    .fetch_optional(pool)
    .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(r),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => { eprintln!("signature-verification-rs: update_record query failed: {}", e); record_store_unavailable() }
    }
}

async fn delete_record(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "signature_verification", &id, "override").await { return resp; }
    match sqlx::query("DELETE FROM signature_records WHERE id = $1")
        .bind(&id)
        .execute(pool)
        .await
    {
        Ok(res) if res.rows_affected() > 0 => HttpResponse::NoContent().finish(),
        Ok(_) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => {
            eprintln!(
                "signature-verification-rs: delete_record query failed: {}",
                e
            );
            record_store_unavailable()
        }
    }
}

// ─── Persistence ────────────────────────────────────────────────────────────

// Wave-12 (C3-P0-B5): shared sqlx pool (max 25) replaces the single
// tokio_postgres::Client, aligned with the tigerbeetle-batch-engine-rs
// Wave-11 convention. DDL applied at connect; None on failure (fail closed).
async fn init_db(db_url: &str) -> Option<PgPool> {
    match sqlx::postgres::PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(db_url)
        .await
    {
        Ok(pool) => {
            let _ = sqlx::query(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )",
            )
            .execute(&pool)
            .await;
            // service_configs documents (Wave-12: was in-memory Vec). Per-service
            // table name avoids colliding with other services' service_configs.
            let _ = sqlx::query(
                "CREATE TABLE IF NOT EXISTS signature_records (
                    id TEXT PRIMARY KEY,
                    data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
            )
            .execute(&pool)
            .await;
            Some(pool)
        }
        Err(e) => {
            eprintln!(
                "DB connect failed: {} — DB endpoints will fail closed (503)",
                e
            );
            None
        }
    }
}

// Wave-11: audit INSERTs are buffered behind a Mutex and flushed every 100ms
// or every 100 rows by a spawned task (was: one blocking INSERT per request).
static W11_AUDIT_BUF: std::sync::OnceLock<
    std::sync::Arc<std::sync::Mutex<Vec<(String, String, String, String, String)>>>,
> = std::sync::OnceLock::new();
static W11_FLUSH_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref pool) = state.db {
        let buf =
            W11_AUDIT_BUF.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(Vec::new())));
        let id = format!(
            "{}_{}_{}",
            "signature_verification_rs",
            endpoint,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let svc_name = String::from("signature-verification-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        if !W11_FLUSH_STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            let pool = pool.clone();
            let buf = buf.clone();
            tokio::spawn(async move {
                let mut tick = tokio::time::interval(std::time::Duration::from_millis(100));
                loop {
                    tick.tick().await;
                    let rows: Vec<(String, String, String, String, String)> = {
                        let mut b = buf.lock().unwrap();
                        if b.is_empty() {
                            continue;
                        }
                        std::mem::take(&mut *b)
                    };
                    for (id, svc, ep, st, d) in rows {
                        let _ = sqlx::query(
                            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                        ).bind(id).bind(svc).bind(ep).bind(st).bind(d).execute(&pool).await;
                    }
                }
            });
        }
        let mut b = buf.lock().unwrap();
        b.push((id, svc_name, endpoint.to_string(), status, data_str));
        if b.len() >= 100 {
            let rows = std::mem::take(&mut *b);
            drop(b);
            let pool = pool.clone();
            tokio::spawn(async move {
                for (id, svc, ep, st, d) in rows {
                    let _ = sqlx::query(
                        "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                    ).bind(id).bind(svc).bind(ep).bind(st).bind(d).execute(&pool).await;
                }
            });
        }
    }
}


// --- Permify authorization (W12-B5-P0-D2) ---
// Every mutating handler performs a REAL Permify permission check AFTER
// check_jwt has authenticated the caller. Subject = verified JWT sub (from
// VerifiedClaims in request extensions), tenant = X-Tenant-Id header or
// PERMIFY_DEFAULT_TENANT, resource = domain entity id, permission per action
// (schema: services/auth-service/schemas/permify/v2-kyc-compliance.fragment).
// FAIL-CLOSED: Permify unreachable/non-200 => 503; denied => 403.
// Canonical pattern: services/permify-authz-go/main.go:428 (REST check) and
// services/auth-service/adapters/permify.py check_permission.
fn permify_base_url() -> String {
    match std::env::var("PERMIFY_URL") {
        Ok(u) if !u.is_empty() => u.trim_end_matches('/').to_string(),
        _ => "http://permify:3476".to_string(),
    }
}

async fn permify_check(req: &actix_web::HttpRequest, entity_type: &str, entity_id: &str, permission: &str) -> Result<(), HttpResponse> {
    let subject = {
        let ext = req.extensions();
        ext.get::<VerifiedClaims>()
            .and_then(|c| c.0.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()))
    };
    let subject = match subject {
        Some(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"}))),
    };
    if entity_id.is_empty() {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"})));
    }
    let tenant_id = req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string());
    let payload = serde_json::json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_base_url(), tenant_id);
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
        Ok(c) => c,
        Err(_) => return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify client init failed (fail-closed)"}))),
    };
    let resp = match client.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[permify] FAIL-CLOSED check {} on {}:{} unreachable: {}", permission, entity_type, entity_id, e);
            return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})));
        }
    };
    if !resp.status().is_success() {
        return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})));
    }
    let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({}));
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED")
        || body.get("can").and_then(|v| v.as_bool()) == Some(true);
    if !allowed {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8249);
    let db = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await
    } else {
        None
    };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        db,
    });
    println!("signature-verification-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(
                actix_web::middleware::DefaultHeaders::new()
                    .add(("X-Content-Type-Options", "nosniff"))
                    .add(("X-Frame-Options", "DENY"))
                    .add((
                        "Strict-Transport-Security",
                        "max-age=31536000; includeSubDomains",
                    ))
                    .add(("Content-Security-Policy", "default-src 'self'"))
                    .add(("Referrer-Policy", "strict-origin-when-cross-origin")),
            )
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/signature/verify", web::post().to(verify_signature))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route(
                "/api/v1/service_configs/{id}",
                web::delete().to(delete_record),
            )
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
