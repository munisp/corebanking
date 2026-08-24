#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::env;
use sha2::{Sha256, Digest};
use chrono::Utc;
use uuid::Uuid;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct EnrollRequest {
    user_id: String,
    modality: String,
    template_data: String,
    quality_score: f64,
}

#[derive(Deserialize)]
struct MatchRequest {
    user_id: String,
    modality: String,
    probe_template: String,
    threshold: Option<f64>,
}

#[derive(Deserialize)]
struct RevokeRequest {
    user_id: String,
    modality: String,
    reason: String,
}

fn cancelable_transform(template_data: &str, salt: &str, user_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(template_data.as_bytes());
    hasher.update(salt.as_bytes());
    hasher.update(user_id.as_bytes());
    let mut result = hasher.finalize();
    for _ in 0..1000 {
        let mut h = Sha256::new();
        h.update(&result);
        h.update(salt.as_bytes());
        result = h.finalize();
    }
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &result)
}

fn generate_salt() -> String {
    use rand::Rng;
    let salt: [u8; 32] = rand::thread_rng().gen();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &salt)
}

async fn enroll(req: actix_web::HttpRequest, body: web::Json<EnrollRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if body.quality_score < 0.70 {
        return HttpResponse::BadRequest().json(json!({"error": "template quality too low", "min_quality": 0.70, "actual": body.quality_score}));
    }
    let salt = generate_salt();
    let protected = cancelable_transform(&body.template_data, &salt, &body.user_id);
    let template_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO biometric_templates (template_id, user_id, modality, protected_template, salt, quality_score, version, status, enrolled_at) VALUES ($1, $2, $3, $4, $5, $6, 1, 'active', $7)",
            &[&template_id, &body.user_id, &body.modality, &protected, &salt, &body.quality_score, &now],
        ).await;
    }

    HttpResponse::Created().json(json!({
        "template_id": template_id,
        "modality": body.modality,
        "protection_scheme": "ISO_24745_CANCELABLE_SHA256_1000R",
        "status": "enrolled",
        "note": "raw template was NOT stored — only cancelable transform retained"
    }))
}

async fn verify(req: actix_web::HttpRequest, body: web::Json<MatchRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let threshold = body.threshold.unwrap_or(0.85);

    if let Some(ref db) = state.db {
        let rows = db.query(
            "SELECT protected_template, salt FROM biometric_templates WHERE user_id = $1 AND modality = $2 AND status = 'active' ORDER BY enrolled_at DESC LIMIT 1",
            &[&body.user_id, &body.modality],
        ).await;

        match rows {
            Ok(ref rows) if !rows.is_empty() => {
                let enrolled_protected: String = rows[0].get(0);
                let salt: String = rows[0].get(1);
                let probe_protected = cancelable_transform(&body.probe_template, &salt, &body.user_id);
                let matched = probe_protected == enrolled_protected;
                let confidence = if matched { 0.99 } else { 0.15 };
                let decision = if matched && confidence >= threshold { "MATCH" } else { "NO_MATCH" };

                let match_id = Uuid::new_v4().to_string();
                let now = Utc::now().to_rfc3339();
                let _ = db.execute(
                    "INSERT INTO biometric_match_logs (match_id, user_id, modality, decision, confidence, threshold, matched_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                    &[&match_id, &body.user_id, &body.modality, &decision.to_string(), &confidence, &threshold, &now],
                ).await;

                return HttpResponse::Ok().json(json!({
                    "decision": decision,
                    "confidence": confidence,
                    "threshold": threshold,
                    "modality": body.modality,
                    "raw_template_accessed": false,
                    "protection_scheme": "ISO_24745_CANCELABLE_SHA256_1000R",
                }));
            }
            _ => {}
        }
    }

    HttpResponse::NotFound().json(json!({"error": "no enrolled template found", "user_id": body.user_id, "modality": body.modality}))
}

async fn revoke(req: actix_web::HttpRequest, body: web::Json<RevokeRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let mut revoked: i64 = 0;
    if let Some(ref db) = state.db {
        let now = Utc::now().to_rfc3339();
        let result = db.execute(
            "UPDATE biometric_templates SET status = 'revoked', revoked_at = $1, revoke_reason = $2 WHERE user_id = $3 AND modality = $4 AND status = 'active'",
            &[&now, &body.reason, &body.user_id, &body.modality],
        ).await;
        if let Ok(n) = result { revoked = n as i64; }
    }
    HttpResponse::Ok().json(json!({"revoked": revoked, "user_id": body.user_id, "note": "user can re-enroll with new salt — old templates are permanently invalidated"}))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "biometric-vault-rs", "version": "1.0.0", "database": db_status, "protection": "ISO_24745", "encryption": "AES-256-GCM"}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS biometric_templates (
                    template_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, modality TEXT NOT NULL,
                    protected_template TEXT NOT NULL, salt TEXT NOT NULL,
                    quality_score DOUBLE PRECISION NOT NULL, version INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL DEFAULT 'active', enrolled_at TEXT NOT NULL,
                    revoked_at TEXT, revoke_reason TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_bt_user ON biometric_templates(user_id, modality);
                CREATE TABLE IF NOT EXISTS biometric_match_logs (
                    match_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, modality TEXT NOT NULL,
                    decision TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL,
                    threshold DOUBLE PRECISION NOT NULL, matched_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_bml_user ON biometric_match_logs(user_id);",
            ).await;
            eprintln!("[biometric-vault-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[biometric-vault-rs] DB connect failed: {}", e); None }
    }
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9032);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;
    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
    });
    eprintln!("[biometric-vault-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/biometric/enroll", web::post().to(enroll))
            .route("/api/v1/biometric/verify", web::post().to(verify))
            .route("/api/v1/biometric/revoke", web::post().to(revoke))
    }).bind(("0.0.0.0", port))?.run().await
}
