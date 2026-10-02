use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use actix_web::HttpMessage;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{info, warn, error};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[derive(Serialize, Deserialize, Clone, sqlx::FromRow)]
struct Valuation {
    id: String,
    collateral_id: String,
    collateral_type: String,
    description: String,
    owner: String,
    market_value: f64,
    forced_sale_value: f64,
    haircut_pct: f64,
    net_realizable_value: f64,
    currency: String,
    valuer: String,
    valuation_date: String,
    expiry_date: String,
    insurance_value: f64,
    insurance_expiry: String,
    lien_status: String,
    status: String,
}

#[derive(Deserialize)]
struct ValuationRequest {
    collateral_type: String,
    market_value: f64,
    age_years: f64,
    location_grade: String,
    condition: String,
}

// Wave-12 (C3-P2-RSVEC): valuations are served from Postgres (was: in-memory
// Mutex<Vec<Valuation>> lost on every restart). Typed columns matching the
// all-scalar Valuation shape; id is the natural/unique key. None => 503 (no
// silent memory fallback).
struct AppState {
    db: Option<PgPool>,
}

const VALUATION_COLS: &str = "id, collateral_id, collateral_type, description, owner, \
     market_value, forced_sale_value, haircut_pct, net_realizable_value, currency, valuer, \
     valuation_date, expiry_date, insurance_value, insurance_expiry, lien_status, status";

async fn init_db(pool: &PgPool) {
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS valuations (
            id TEXT PRIMARY KEY,
            collateral_id TEXT NOT NULL DEFAULT '',
            collateral_type TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            owner TEXT NOT NULL DEFAULT '',
            market_value DOUBLE PRECISION NOT NULL DEFAULT 0,
            forced_sale_value DOUBLE PRECISION NOT NULL DEFAULT 0,
            haircut_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
            net_realizable_value DOUBLE PRECISION NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'NGN',
            valuer TEXT NOT NULL DEFAULT '',
            valuation_date TEXT NOT NULL DEFAULT '',
            expiry_date TEXT NOT NULL DEFAULT '',
            insurance_value DOUBLE PRECISION NOT NULL DEFAULT 0,
            insurance_expiry TEXT NOT NULL DEFAULT '',
            lien_status TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await
    {
        error!("collateral-valuation-rs: valuations DDL failed: {}", e);
    }
}

async fn fetch_valuations(pool: &PgPool) -> Result<Vec<Valuation>, sqlx::Error> {
    sqlx::query_as::<_, Valuation>(&format!(
        "SELECT {} FROM valuations ORDER BY id",
        VALUATION_COLS
    ))
    .fetch_all(pool)
    .await
}


async fn healthz() -> HttpResponse {
    info!("Health check requested");
    // LN-14: fabricated middleware connectivity block removed. This service is a
    // self-contained FSV calculator with in-memory state; it has no kafka, dapr,
    // temporal, postgres, keycloak, permify, redis, mojaloop, opensearch, apisix,
    // tigerbeetle, or lakehouse connections, and healthz no longer claims otherwise.
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "collateral-valuation",
        "types": ["property", "vehicle", "equipment", "securities", "cash_deposit", "guarantee"],
    }))
}

async fn list_valuations(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    info!("Listing valuations");
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "valuation_store_unavailable"}));
        }
    };
    let vals = match fetch_valuations(pool).await {
        Ok(v) => v,
        Err(e) => {
            error!("collateral-valuation-rs: list_valuations query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "valuation_store_unavailable"}));
        }
    };
    let total = vals.len();
    info!("Returning {} valuations", total);
    HttpResponse::Ok().json(serde_json::json!({ "items": vals, "total": total }))
}

async fn compute_fsv(req: actix_web::HttpRequest, body: web::Json<ValuationRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "collateral_valuation", "collection", "compute").await { return resp; }
    let req = body.into_inner();
    info!("Computing FSV for collateral_type: {}, market_value: {}", req.collateral_type, req.market_value);
    if req.market_value <= 0.0 {
        error!("Invalid market_value: {}", req.market_value);
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "market_value must be positive"}));
    }

    let base_haircut: f64 = match req.collateral_type.as_str() {
        "property" => 30.0,
        "vehicle" => 40.0,
        "equipment" => 50.0,
        "securities" => 5.0,
        "cash_deposit" => 0.0,
        "guarantee" => 10.0,
        _ => 35.0,
    };

    let age_adj = (req.age_years * 2.0).min(15.0);
    let location_adj: f64 = match req.location_grade.as_str() {
        "prime" => -5.0,
        "good" => 0.0,
        "average" => 5.0,
        "poor" => 10.0,
        _ => 5.0,
    };
    let condition_adj: f64 = match req.condition.as_str() {
        "excellent" => -3.0,
        "good" => 0.0,
        "fair" => 5.0,
        "poor" => 15.0,
        _ => 5.0,
    };

    let haircut = (base_haircut + age_adj + location_adj + condition_adj).max(0.0).min(80.0);
    let fsv = req.market_value * (1.0 - haircut / 100.0);

    HttpResponse::Ok().json(serde_json::json!({
        "collateralType": req.collateral_type,
        "marketValue": req.market_value,
        "haircutPct": (haircut * 100.0).round() / 100.0,
        "forcedSaleValue": (fsv * 100.0).round() / 100.0,
        "ageAdjustment": age_adj,
        "locationAdjustment": location_adj,
        "conditionAdjustment": condition_adj
    }))
}

async fn valuation_summary(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    info!("Computing valuation summary");
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "valuation_store_unavailable"}));
        }
    };
    let vals = match fetch_valuations(pool).await {
        Ok(v) => v,
        Err(e) => {
            error!("collateral-valuation-rs: valuation_summary query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "valuation_store_unavailable"}));
        }
    };
    let mut total_market = 0.0_f64;
    let mut total_fsv = 0.0_f64;
    let mut by_type: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut by_status: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for v in vals.iter() {
        total_market += v.market_value;
        total_fsv += v.forced_sale_value;
        *by_type.entry(v.collateral_type.clone()).or_insert(0.0) += v.market_value;
        *by_status.entry(v.status.clone()).or_insert(0) += 1;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "totalValuations": vals.len(),
        "totalMarketValue": total_market,
        "totalFSV": total_fsv,
        "avgHaircut": if total_market > 0.0 { ((1.0 - total_fsv / total_market) * 10000.0).round() / 100.0 } else { 0.0 },
        "marketValueByType": by_type,
        "byStatus": by_status
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
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .init();

    info!("Starting collateral-valuation service");

    let addr = std::env::var("ADDR").unwrap_or_else(|_| {
        warn!("ADDR not set, using default 0.0.0.0:8154");
        "0.0.0.0:8154".to_string()
    });

    // Wave-12 (C3-P2-RSVEC): Postgres is the valuation store (was in-memory Vec,
    // always empty — valuations are produced on demand by the FSV calculator).
    // DATABASE_URL optional: when unset the pool is None and reads fail closed
    // (503) rather than falling back to memory.
    let db: Option<PgPool> = match std::env::var("DATABASE_URL") {
        Ok(url) => match sqlx::postgres::PgPoolOptions::new()
            .max_connections(25)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect_lazy(&url)
        {
            Ok(p) => Some(p),
            Err(e) => {
                error!("collateral-valuation-rs: invalid DATABASE_URL: {} — reads will return 503", e);
                None
            }
        },
        Err(_) => {
            warn!("collateral-valuation-rs: DATABASE_URL not set — reads will return 503");
            None
        }
    };
    if let Some(pool) = db.as_ref() {
        init_db(pool).await;
    }

    let state = web::Data::new(AppState { db });

    info!("Binding to address: {}", addr);
    let addr_clone = addr.clone();

    HttpServer::new(move || {
        App::new()
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/valuations", web::get().to(list_valuations))
            .route("/v1/valuations/compute-fsv", web::post().to(compute_fsv))
            .route("/v1/valuations/summary", web::get().to(valuation_summary))
    })
    .bind(&addr)?
    .run()
    .await?;

    info!("collateral-valuation listening on {}", addr_clone);
    Ok(())
}

