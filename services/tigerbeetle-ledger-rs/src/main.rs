use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use uuid::Uuid;
use chrono::{Utc, DateTime};

#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: String,
    status: String,
    tenant_id: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

struct AppState {
    db: PgPool,
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
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[tigerbeetle-ledger-rs] starting");

    // FAIL FAST (M-21): DATABASE_URL is required; no default/compiled-in database credentials.
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set - refusing to boot with default database credentials");

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;
    log::info!("[tigerbeetle-ledger-rs] database connected, schema initialized");

    let keycloak_url = env::var("KEYCLOAK_REALM_URL").unwrap_or_else(|_| "http://keycloak:8080/realms/54bank".to_string());
    let kafka_brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "localhost:6379".to_string());
    let opensearch_url = env::var("OPENSEARCH_ENDPOINT").unwrap_or_else(|_| "http://opensearch:9200".to_string());
    let permify_url = env::var("PERMIFY_ENDPOINT").unwrap_or_else(|_| "http://permify:3476".to_string());

    log::info!("[tigerbeetle-ledger-rs] middleware: keycloak={} kafka={} redis={} opensearch={} permify={}",
        keycloak_url, kafka_brokers, redis_url, opensearch_url, permify_url);

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8809".to_string()).parse().unwrap_or(8809);
    let data = web::Data::new(AppState { db: pool });

    log::info!("[tigerbeetle-ledger-rs] ready on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .wrap(middleware::Logger::default())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create service_configs table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(64) NOT NULL,
        aggregate_id VARCHAR(128) NOT NULL,
        payload JSONB NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .ok();

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)")
        .execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)")
        .execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)")
        .execute(pool).await.ok();
}

async fn health(data: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "tigerbeetle-ledger-rs",
        "version": "1.0.0"
    }))
}

async fn readyz(data: web::Data<AppState>) -> HttpResponse {
    match sqlx::query("SELECT 1").execute(&data.db).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"status": "ready"})),
        Err(e) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"status": "not ready", "error": e.to_string()})),
    }
}

async fn metrics(data: web::Data<AppState>) -> HttpResponse {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM service_configs")
        .fetch_one(&data.db).await.unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({
        "service": "tigerbeetle-ledger-rs",
        "total_records": count
    }))
}

async fn list_records(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // Tenant identity comes from verified JWT claims (request extensions), never raw headers.
    let tenant_id = claims_tenant(&req).unwrap_or_default();

    let rows = sqlx::query("SELECT id, status, created_at FROM service_configs WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT 50")
        .bind(tenant_id)
        .fetch_all(&data.db)
        .await;

    match rows {
        Ok(rows) => {
            let records: Vec<serde_json::Value> = rows.iter().map(|r| {
                serde_json::json!({
                    "id": r.get::<Uuid, _>("id").to_string(),
                    "status": r.get::<String, _>("status"),
                    "created_at": r.get::<DateTime<Utc>, _>("created_at").to_rfc3339()
                })
            }).collect();
            let count = records.len();
            HttpResponse::Ok().json(serde_json::json!({"data": records, "count": count}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn create_record(data: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // Tenant identity comes from verified JWT claims (request extensions), never raw headers/body.
    let tenant_id = claims_tenant(&req).unwrap_or_else(|| "default".to_string());

    let status = body.status.clone().unwrap_or_else(|| "active".to_string());

    let result = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO service_configs (tenant_id, status) VALUES ($1::uuid, $2) RETURNING id"
    )
    .bind(&tenant_id)
    .bind(&status)
    .fetch_one(&data.db)
    .await;

    match result {
        Ok(id) => {
            let payload = serde_json::json!({"id": id.to_string(), "status": &status, "tenant_id": &tenant_id});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.created")
                .bind(id.to_string())
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Created().json(serde_json::json!({"id": id.to_string(), "status": "created"}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn get_record(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let result = sqlx::query("SELECT id, status, created_at FROM service_configs WHERE id = $1::uuid")
        .bind(&id)
        .fetch_optional(&data.db)
        .await;

    match result {
        Ok(Some(row)) => HttpResponse::Ok().json(serde_json::json!({
            "id": row.get::<Uuid, _>("id").to_string(),
            "status": row.get::<String, _>("status"),
            "created_at": row.get::<DateTime<Utc>, _>("created_at").to_rfc3339()
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "not found"})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn update_record(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    sqlx::query("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("service_configs.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
