use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tracing::{info, warn, error};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[derive(Serialize, Deserialize, Clone)]
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

struct AppState {
    valuations: Mutex<Vec<Valuation>>,
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
    let vals = data.valuations.lock().unwrap();
    info!("Returning {} valuations", vals.len());
    HttpResponse::Ok().json(serde_json::json!({ "items": *vals, "total": vals.len() }))
}

async fn compute_fsv(req: actix_web::HttpRequest, body: web::Json<ValuationRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
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
    let vals = data.valuations.lock().unwrap();
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

    // LN-14: no seed data. Valuations are produced on demand by the real FSV
    // calculator (POST /v1/valuations/compute-fsv).
    let valuations: Vec<Valuation> = Vec::new();

    let state = web::Data::new(AppState {
        valuations: Mutex::new(valuations),
    });

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

