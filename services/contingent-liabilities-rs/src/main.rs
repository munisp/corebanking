use actix_web::{web, App, HttpServer, HttpResponse};
use actix_web::HttpMessage;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String,
    redis_url: String,
    postgres_url: String,
    opensearch_url: String,
    keycloak_url: String,
    permify_url: String,
    dapr_url: String,
    fluvio_url: String,
    temporal_url: String,
    mojaloop_url: String,
    tigerbeetle_url: String,
    lakehouse_url: String,
    apisix_url: String,
    openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://localhost:5432/db".into()),
        opensearch_url: std::env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()),
        keycloak_url: std::env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()),
        permify_url: std::env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()),
        dapr_url: std::env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()),
        fluvio_url: std::env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()),
        temporal_url: std::env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()),
        mojaloop_url: std::env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()),
        tigerbeetle_url: std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()),
        lakehouse_url: std::env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()),
        apisix_url: std::env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()),
        openappsec_url: std::env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()),
    }
}

#[derive(Clone, Serialize, Deserialize, sqlx::FromRow)]
struct ContingentLiability {
    id: String,
    liability_type: String,
    counterparty: String,
    description: String,
    max_exposure: f64,
    probability: f64,
    expected_loss: f64,
    currency: String,
    expiry_date: String,
    status: String,
}

fn seed() -> Vec<ContingentLiability> {
    vec![
        ContingentLiability {
            id: "CL-001".into(),
            liability_type: "letter_of_credit".into(),
            counterparty: "Dangote Cement Plc".into(),
            description: "Import LC for clinker shipment".into(),
            max_exposure: 5_000_000_000.0,
            probability: 0.05,
            expected_loss: 250_000_000.0,
            currency: "NGN".into(),
            expiry_date: "2026-09-30".into(),
            status: "active".into(),
        },
        ContingentLiability {
            id: "CL-002".into(),
            liability_type: "performance_guarantee".into(),
            counterparty: "Julius Berger Nigeria".into(),
            description: "Road construction bond".into(),
            max_exposure: 10_000_000_000.0,
            probability: 0.08,
            expected_loss: 800_000_000.0,
            currency: "NGN".into(),
            expiry_date: "2027-12-31".into(),
            status: "active".into(),
        },
    ]
}

// Wave-12 (C3-P2-RSVEC): contingent liabilities are persisted in Postgres (was:
// in-memory Mutex<Vec<ContingentLiability>> re-seeded on every boot). Typed
// columns matching the all-scalar struct; id is the natural/unique key. None =>
// 503 (no silent memory fallback).
struct AppState {
    db: Option<PgPool>,
}

async fn init_db(pool: &PgPool) {
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS contingent_liabilities (
            id TEXT PRIMARY KEY,
            liability_type TEXT NOT NULL DEFAULT '',
            counterparty TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            max_exposure DOUBLE PRECISION NOT NULL DEFAULT 0,
            probability DOUBLE PRECISION NOT NULL DEFAULT 0,
            expected_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'NGN',
            expiry_date TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await
    {
        eprintln!("contingent-liabilities-rs: contingent_liabilities DDL failed: {}", e);
    }
}

/// Idempotent seed of the reference liabilities (was: in-memory seed on every
/// boot). ON CONFLICT DO NOTHING so restarts never duplicate or overwrite.
async fn seed_to_db(pool: &PgPool) {
    for it in seed() {
        if let Err(e) = sqlx::query(
            "INSERT INTO contingent_liabilities (id, liability_type, counterparty, description,
                max_exposure, probability, expected_loss, currency, expiry_date, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(&it.id)
        .bind(&it.liability_type)
        .bind(&it.counterparty)
        .bind(&it.description)
        .bind(it.max_exposure)
        .bind(it.probability)
        .bind(it.expected_loss)
        .bind(&it.currency)
        .bind(&it.expiry_date)
        .bind(&it.status)
        .execute(pool)
        .await
        {
            eprintln!("contingent-liabilities-rs: seed {} failed: {}", it.id, e);
        }
    }
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "contingent-liabilities-rs",
        "status": "healthy"
    }))
}

async fn list_items(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "contingent_liability", "view").await { return resp; } // W12-B5P1DD
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "liability_store_unavailable"}));
        }
    };
    let d = match sqlx::query_as::<_, ContingentLiability>(
        "SELECT id, liability_type, counterparty, description, max_exposure, probability,
                expected_loss, currency, expiry_date, status FROM contingent_liabilities ORDER BY id",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("contingent-liabilities-rs: list_items query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "liability_store_unavailable"}));
        }
    };
    let total = d.len();
    HttpResponse::Ok().json(serde_json::json!({
        "items": d,
        "total": total
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
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8174".into())
        .parse()
        .unwrap_or(8174);

    // Wave-12 (C3-P2-RSVEC): Postgres is the liability store (was in-memory
    // Vec). DATABASE_URL optional: when unset the pool is None and reads fail
    // closed (503) rather than falling back to memory.
    let db: Option<PgPool> = match std::env::var("DATABASE_URL") {
        Ok(url) => match sqlx::postgres::PgPoolOptions::new()
            .max_connections(25)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect_lazy(&url)
        {
            Ok(p) => Some(p),
            Err(e) => {
                eprintln!("contingent-liabilities-rs: invalid DATABASE_URL: {} — reads will return 503", e);
                None
            }
        },
        Err(_) => {
            eprintln!("contingent-liabilities-rs: DATABASE_URL not set — reads will return 503");
            None
        }
    };
    if let Some(pool) = db.as_ref() {
        init_db(pool).await;
        seed_to_db(pool).await;
    }

    let data = web::Data::new(AppState { db });

    println!("Contingent Liabilities Service running on port {}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/contingent-liabilities-rs/list", web::get().to(list_items))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

// Wave-12 B5-P1-D-D: Permify authorization guard module.
mod permify;
