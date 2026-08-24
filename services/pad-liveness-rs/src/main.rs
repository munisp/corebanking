#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::env;
use chrono::Utc;
use uuid::Uuid;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct ChallengeRequest {
    session_id: String,
    user_id: String,
    device_fingerprint: Option<String>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    session_id: String,
    challenge_id: String,
    texture_score: f64,
    depth_score: f64,
    motion_score: f64,
    reflection_score: f64,
    challenge_response: String,
    frame_count: u32,
    capture_duration_ms: u64,
    device_model: Option<String>,
    os_version: Option<String>,
}

const CHALLENGES: &[&str] = &[
    "blink_both", "blink_left", "blink_right",
    "turn_left", "turn_right", "turn_up", "turn_down",
    "smile", "open_mouth", "raise_eyebrows",
    "nod_yes", "shake_no",
];

fn generate_challenge_sequence() -> Vec<String> {
    use rand::seq::SliceRandom;
    let mut rng = rand::thread_rng();
    let mut challenges: Vec<&str> = CHALLENGES.to_vec();
    challenges.shuffle(&mut rng);
    challenges.into_iter().take(3).map(|s| s.to_string()).collect()
}

async fn create_challenge(req: actix_web::HttpRequest, body: web::Json<ChallengeRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let challenge_id = Uuid::new_v4().to_string();
    let sequence = generate_challenge_sequence();
    let now = Utc::now().to_rfc3339();
    let seq_json = serde_json::to_string(&sequence).unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO liveness_challenges (challenge_id, session_id, user_id, sequence, created_at) VALUES ($1, $2, $3, $4, $5)",
            &[&challenge_id, &body.session_id, &body.user_id, &seq_json, &now],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "challenge_id": challenge_id,
        "session_id": body.session_id,
        "user_id": body.user_id,
        "sequence": sequence,
        "timeout_seconds": 30,
        "min_frames": 15,
        "created_at": now,
        "requirements": {
            "min_face_size_px": 200,
            "min_resolution": "640x480",
            "require_depth": true,
            "require_ir": false,
            "max_attempts": 3
        }
    }))
}

async fn verify_liveness(req: actix_web::HttpRequest, body: web::Json<VerifyRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let mut scores = Vec::new();
    let mut flags = Vec::new();
    let mut is_live = true;

    if body.texture_score < 0.65 {
        flags.push("TEXTURE_ANOMALY: possible print/screen attack");
        is_live = false;
    }
    scores.push(("texture", body.texture_score));

    if body.depth_score < 0.60 {
        flags.push("DEPTH_FLAT: no 3D depth detected, possible 2D attack");
        is_live = false;
    }
    scores.push(("depth", body.depth_score));

    if body.motion_score < 0.50 {
        flags.push("MOTION_STATIC: insufficient natural micro-movement");
        is_live = false;
    }
    scores.push(("motion", body.motion_score));

    if body.reflection_score < 0.55 {
        flags.push("REFLECTION_ANOMALY: specular highlights inconsistent with live face");
        is_live = false;
    }
    scores.push(("reflection", body.reflection_score));

    let responses: Vec<&str> = body.challenge_response.split(',').collect();
    if responses.len() < 3 {
        flags.push("CHALLENGE_INCOMPLETE: not all challenges completed");
        is_live = false;
    }
    if body.frame_count < 15 {
        flags.push("LOW_FRAME_COUNT: possible frame injection attack");
        is_live = false;
    }
    if body.capture_duration_ms < 2000 || body.capture_duration_ms > 60000 {
        flags.push("TIMING_ANOMALY: capture duration outside expected range");
        is_live = false;
    }

    let composite: f64 = scores.iter().map(|(_, s)| s).sum::<f64>() / scores.len() as f64;
    let confidence = if is_live { composite } else { composite * 0.3 };
    let pad_level = if composite >= 0.85 { "ISO_30107_3_LEVEL_2" } else if composite >= 0.70 { "ISO_30107_3_LEVEL_1" } else { "BELOW_STANDARD" };
    let recommendation = if is_live { "ACCEPT" } else if flags.len() <= 2 { "RETRY" } else { "REJECT_FRAUD_REVIEW" };

    let verification_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let flags_json = serde_json::to_string(&flags).unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO liveness_verifications (verification_id, session_id, challenge_id, is_live, confidence, composite_score, pad_level, flags, recommendation, verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            &[&verification_id, &body.session_id, &body.challenge_id, &is_live, &confidence, &composite, &pad_level.to_string(), &flags_json, &recommendation.to_string(), &now],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "verification_id": verification_id,
        "session_id": body.session_id,
        "challenge_id": body.challenge_id,
        "is_live": is_live,
        "confidence": confidence,
        "composite_score": composite,
        "pad_level": pad_level,
        "scores": scores.iter().map(|(k, v)| json!({"name": *k, "value": v})).collect::<Vec<_>>(),
        "flags": flags,
        "timestamp": now,
        "recommendation": recommendation,
    }))
}

async fn stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Some(ref db) = state.db {
        let row = db.query_one(
            "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_live = true) as live_count FROM liveness_verifications", &[],
        ).await;
        if let Ok(row) = row {
            let total: i64 = row.get(0);
            let live_count: i64 = row.get(1);
            let attack_count = total - live_count;
            let attack_rate = if total > 0 { attack_count as f64 / total as f64 } else { 0.0 };
            return HttpResponse::Ok().json(json!({
                "total_verifications": total,
                "live_count": live_count,
                "attack_count": attack_count,
                "attack_rate": attack_rate,
                "source": "postgresql",
            }));
        }
    }
    HttpResponse::Ok().json(json!({"total_verifications": 0, "source": "no_database"}))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "pad-liveness-rs", "version": "1.0.0", "database": db_status,
        "capabilities": ["texture_analysis", "depth_estimation", "challenge_response", "injection_detection", "timing_validation"]}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS liveness_challenges (
                    challenge_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT NOT NULL,
                    sequence TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS liveness_verifications (
                    verification_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, challenge_id TEXT NOT NULL,
                    is_live BOOLEAN NOT NULL, confidence DOUBLE PRECISION NOT NULL, composite_score DOUBLE PRECISION NOT NULL,
                    pad_level TEXT NOT NULL, flags TEXT NOT NULL DEFAULT '[]', recommendation TEXT NOT NULL,
                    verified_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_lv_session ON liveness_verifications(session_id);",
            ).await;
            eprintln!("[pad-liveness-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[pad-liveness-rs] DB connect failed: {}", e); None }
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9031);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;
    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
    });
    eprintln!("[pad-liveness-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/liveness/challenge", web::post().to(create_challenge))
            .route("/api/v1/liveness/verify", web::post().to(verify_liveness))
            .route("/api/v1/liveness/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?.run().await
}
