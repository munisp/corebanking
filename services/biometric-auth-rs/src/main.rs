use actix_web::{web, App, HttpMessage, HttpResponse, HttpServer}; // Wave-12 drive-by: HttpMessage import required by actix-web resolved in the lockfile
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;
use std::time::{Duration, Instant};

// ─── State ──────────────────────────────────────────────────────────────────

// Wave-12 (C3-P0-B5): enrollments and kyc_records are persisted in Postgres
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
    customer_id: Option<String>,
    /// Distance between presented biometric template and enrolled template.
    template_distance: Option<f64>,
    /// Match threshold for the template distance.
    threshold: Option<f64>,
    biometric_score: Option<f64>,
    device_score: Option<f64>,
    behavioral_score: Option<f64>,
    /// Liveness evidence (all three required to compute liveness locally).
    blink_detected: Option<bool>,
    head_movement: Option<bool>,
    texture_score: Option<f64>,
}

// ─── Scoring (real inputs only — no fabricated scores) ─────────────────────

fn match_confidence(template_distance: f64, threshold: f64) -> (bool, f64) {
    let confidence = (1.0 - template_distance / threshold).max(0.0).min(1.0);
    (template_distance <= threshold, confidence)
}

fn multi_factor_score(biometric: f64, device: f64, behavioral: f64) -> f64 {
    biometric * 0.5 + device * 0.3 + behavioral * 0.2
}

fn liveness_score(blink_detected: bool, head_movement: bool, texture_score: f64) -> f64 {
    let mut score = texture_score * 0.4;
    if blink_detected {
        score += 0.3;
    }
    if head_movement {
        score += 0.3;
    }
    score.min(1.0)
}

fn auth_decision(mfa_score: f64, liveness: f64) -> (&'static str, f64) {
    let combined = mfa_score * 0.7 + liveness * 0.3;
    if combined >= 0.8 {
        ("authenticated", combined)
    } else if combined >= 0.5 {
        ("step_up_required", combined)
    } else {
        ("rejected", combined)
    }
}

/// Minimal synchronous HTTP POST used to reach the liveness upstream.
fn http_post_json(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    if !url.starts_with("http://") {
        return Err("only http:// upstream URLs supported by this transport".to_string());
    }
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if host_port.contains(':') {
        host_port.to_string()
    } else {
        format!("{}:80", host_port)
    };
    let mut stream = std::net::TcpStream::connect_timeout(
        &host_port.parse().map_err(|e| format!("{}", e))?,
        Duration::from_secs(5),
    )
    .map_err(|e| format!("connection failed: {}", e))?;
    let host = host_port.split(':').next().unwrap_or("localhost");
    let req = format!(
        "POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, host, body.len(), body
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| format!("{}", e))?;
    let mut resp = String::new();
    stream
        .read_to_string(&mut resp)
        .map_err(|e| format!("{}", e))?;
    Ok(resp)
}

/// Obtain a real liveness score: either from fully-supplied client evidence, or
/// from the configured liveness-detection upstream. Fails closed otherwise.
fn obtain_liveness(body: &VerifyRequest) -> Result<f64, HttpResponse> {
    match (body.blink_detected, body.head_movement, body.texture_score) {
        (Some(b), Some(h), Some(t)) => Ok(liveness_score(b, h, t)),
        _ => {
            if let Ok(base) = std::env::var("LIVENESS_DETECTION_URL") {
                if !base.is_empty() {
                    let payload = json!({
                        "customer_id": body.customer_id,
                        "blink_detected": body.blink_detected,
                        "head_movement": body.head_movement,
                        "texture_score": body.texture_score,
                    })
                    .to_string();
                    let resp = http_post_json(
                        &format!("{}/v1/score/liveness", base.trim_end_matches('/')),
                        &payload,
                    )
                    .map_err(|e| {
                        eprintln!("biometric-auth-rs: liveness upstream failed: {}", e);
                        HttpResponse::ServiceUnavailable().json(json!({
                            "error": "liveness_upstream_unavailable",
                            "decision": "rejected",
                        }))
                    })?;
                    // Response body follows the blank line in a raw HTTP response.
                    let body_str = resp.split("\r\n\r\n").nth(1).unwrap_or("");
                    let parsed: serde_json::Value =
                        serde_json::from_str(body_str).map_err(|_| {
                            HttpResponse::ServiceUnavailable().json(json!({
                                "error": "liveness_upstream_unavailable",
                                "decision": "rejected",
                            }))
                        })?;
                    return parsed
                        .get("overall_score")
                        .and_then(|v| v.as_f64())
                        .ok_or_else(|| {
                            HttpResponse::ServiceUnavailable().json(json!({
                                "error": "liveness_upstream_unavailable",
                                "decision": "rejected",
                            }))
                        });
                }
            }
            // No liveness evidence and no upstream configured: fail closed.
            Err(HttpResponse::UnprocessableEntity().json(json!({
                "error": "liveness_evidence_required",
                "detail": "supply blink_detected, head_movement and texture_score, or configure LIVENESS_DETECTION_URL",
                "decision": "rejected",
            })))
        }
    }
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
        .json(json!({"status": "healthy", "service": "biometric-auth-rs", "version": "1.0.0"}))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "biometric-auth-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"biometric-auth-rs\"} 0\n";
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

async fn enroll(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    if let Err(resp) = permify_check(&req, "biometric_credential", "collection", "enroll").await { return resp; }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "enrollment_store_unavailable",
                "detail": "DATABASE_URL is not configured; refusing to accept an enrollment that cannot be persisted",
            }))
        }
    };
    let payload = body.into_inner();
    if let Err(e) = sqlx::query("INSERT INTO biometric_enrollments (payload) VALUES ($1)")
        .bind(&payload)
        .execute(pool)
        .await
    {
        eprintln!("biometric-auth-rs: enroll insert failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(json!({"error": "enrollment_store_unavailable"}));
    }
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM biometric_enrollments")
        .fetch_one(pool)
        .await
        .unwrap_or(-1);
    HttpResponse::Ok().json(json!({"enrolled": true, "total_enrollments": total}))
}

/// POST /v1/biometric/verify — combine ONLY real supplied scores; missing
/// inputs are rejected (422) and upstream failures fail closed (503).
async fn verify(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<VerifyRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    if let Err(resp) = permify_check(&req, "biometric_credential", "collection", "verify").await { return resp; }

    let (distance, threshold, biometric, device, behavioral) = match (
        body.template_distance,
        body.threshold,
        body.biometric_score,
        body.device_score,
        body.behavioral_score,
    ) {
        (Some(d), Some(t), Some(b), Some(dev), Some(beh)) => (d, t, b, dev, beh),
        _ => {
            return HttpResponse::UnprocessableEntity().json(json!({
                "error": "missing_required_scores",
                "required": ["template_distance", "threshold", "biometric_score", "device_score", "behavioral_score"],
                "decision": "rejected",
            }));
        }
    };
    if threshold <= 0.0 {
        return HttpResponse::UnprocessableEntity()
            .json(json!({"error": "invalid_threshold", "decision": "rejected"}));
    }

    let live = match obtain_liveness(&body) {
        Ok(l) => l,
        Err(resp) => return resp,
    };

    let (matched, confidence) = match_confidence(distance, threshold);
    let mfa = multi_factor_score(biometric, device, behavioral);
    let (decision, combined) = auth_decision(mfa, live);

    db_persist(
        &state,
        "verify",
        &json!({"endpoint": "verify", "decision": decision}),
    )
    .await;
    let status = if decision == "authenticated" {
        actix_web::http::StatusCode::OK
    } else {
        actix_web::http::StatusCode::UNAUTHORIZED
    };
    HttpResponse::build(status).json(json!({
        "matched": matched,
        "confidence": confidence,
        "mfa_score": mfa,
        "liveness_score": live,
        "decision": decision,
        "combined_score": combined,
    }))
}

async fn stats(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": "enrollment_store_unavailable"}))
        }
    };
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM biometric_enrollments")
        .fetch_one(pool)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            eprintln!("biometric-auth-rs: stats count failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": "enrollment_store_unavailable"}));
        }
    };
    HttpResponse::Ok().json(json!({"total_enrollments": total, "service": "biometric-auth-rs"}))
}

// ─── kyc_records CRUD (Wave-12 C3-P0-B5: Postgres-authoritative; no in-memory
// fallback — when the pool is missing or a query fails the handlers return 503
// instead of silently serving volatile state) ────────────────────────────────

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
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM kyc_records")
        .fetch_one(pool)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            eprintln!("biometric-auth-rs: list_records count failed: {}", e);
            return record_store_unavailable();
        }
    };
    let items: Vec<serde_json::Value> = match sqlx::query_scalar(
        "SELECT data FROM kyc_records ORDER BY created_at, id LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind((page - 1) * limit)
    .fetch_all(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("biometric-auth-rs: list_records query failed: {}", e);
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
    if let Err(resp) = permify_check(&req, "service_config", "collection", "create").await { return resp; }
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return record_store_unavailable(),
    };
    let mut rec = body.into_inner();
    rec["id"] = json!(uuid::Uuid::new_v4().to_string());
    rec["created_at"] = json!(chrono::Utc::now().to_rfc3339());
    let id = rec["id"].as_str().unwrap_or_default().to_string();
    if let Err(e) = sqlx::query("INSERT INTO kyc_records (id, data) VALUES ($1, $2)")
        .bind(&id)
        .bind(&rec)
        .execute(pool)
        .await
    {
        eprintln!("biometric-auth-rs: create_record insert failed: {}", e);
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
    match sqlx::query_scalar::<_, serde_json::Value>("SELECT data FROM kyc_records WHERE id = $1")
        .bind(&id)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(r),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => {
            eprintln!("biometric-auth-rs: get_record query failed: {}", e);
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
    if let Err(resp) = permify_check(&req, "service_config", &id, "update").await { return resp; }
    // Merge caller-supplied keys (except "id") into the stored document —
    // same semantics as the previous in-memory merge.
    match sqlx::query_scalar::<_, serde_json::Value>(
        "UPDATE kyc_records SET data = data || ($2::jsonb - 'id'), updated_at = NOW() WHERE id = $1 RETURNING data",
    )
    .bind(&id)
    .bind(&body.into_inner())
    .fetch_optional(pool)
    .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(r),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => { eprintln!("biometric-auth-rs: update_record query failed: {}", e); record_store_unavailable() }
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
    if let Err(resp) = permify_check(&req, "service_config", &id, "delete").await { return resp; }
    match sqlx::query("DELETE FROM kyc_records WHERE id = $1")
        .bind(&id)
        .execute(pool)
        .await
    {
        Ok(res) if res.rows_affected() > 0 => HttpResponse::NoContent().finish(),
        Ok(_) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => {
            eprintln!("biometric-auth-rs: delete_record query failed: {}", e);
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
        .acquire_timeout(Duration::from_secs(5))
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
            // Biometric enrollment payloads (Wave-12: was in-memory Vec).
            let _ = sqlx::query(
                "CREATE TABLE IF NOT EXISTS biometric_enrollments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
            )
            .execute(&pool)
            .await;
            // kyc_records documents (Wave-12: was in-memory Vec).
            let _ = sqlx::query(
                "CREATE TABLE IF NOT EXISTS kyc_records (
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
// or every 100 rows by a spawned task on the shared sqlx pool
// (was: one blocking INSERT per request on a single tokio_postgres::Client).
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
            "biometric_auth_rs",
            endpoint,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let svc_name = String::from("biometric-auth-rs");
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
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8202);
    let db = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await
    } else {
        None
    };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        db,
    });
    println!("biometric-auth-rs on port {}", port);
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
            .route("/v1/biometric/enroll", web::post().to(enroll))
            .route("/v1/biometric/verify", web::post().to(verify))
            .route("/v1/biometric/stats", web::get().to(stats))
            .route("/api/v1/kyc_records", web::get().to(list_records))
            .route("/api/v1/kyc_records", web::post().to(create_record))
            .route("/api/v1/kyc_records/{id}", web::get().to(get_record))
            .route("/api/v1/kyc_records/{id}", web::put().to(update_record))
            .route("/api/v1/kyc_records/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
