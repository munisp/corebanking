use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct RwaExposure {
    id: String,
    asset_class: String, // sovereign, bank, corporate, retail, mortgage, sme, equity, securitization
    exposure_type: String, // on_balance, off_balance, derivative, repo
    counterparty: String,
    rating: String, // AAA, AA, A, BBB, BB, B, CCC, unrated
    original_exposure: f64,
    credit_conversion_factor: f64,
    ead: f64, // exposure at default
    risk_weight: f64, // percentage
    rwa: f64, // risk-weighted asset
    currency: String,
    maturity_date: String,
    collateral_value: f64,
    collateral_type: String,
    netting_set: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct CapitalRatio {
    id: String,
    report_date: String,
    tier1_common_equity: f64,
    additional_tier1: f64,
    tier2_capital: f64,
    total_capital: f64,
    total_rwa: f64,
    credit_rwa: f64,
    market_rwa: f64,
    operational_rwa: f64,
    cet1_ratio: f64,
    tier1_ratio: f64,
    total_car: f64,
    leverage_ratio: f64,
    lcr: f64, // liquidity coverage ratio
    nsfr: f64, // net stable funding ratio
    countercyclical_buffer: f64,
    systemic_buffer: f64,
    capital_conservation_buffer: f64,
    minimum_cet1: f64,
    minimum_tier1: f64,
    minimum_total: f64,
    cet1_surplus: f64,
    compliant: bool,
}

#[derive(Deserialize)]
struct RwaCalcRequest {
    asset_class: String,
    rating: String,
    exposure: f64,
    collateral_value: Option<f64>,
    maturity_years: Option<f64>,
}

struct AppState {
    db: Option<PgPool>,
}

fn risk_weight(asset_class: &str, rating: &str) -> f64 {
    match (asset_class, rating) {
        ("sovereign", "AAA") | ("sovereign", "AA") => 0.0,
        ("sovereign", "A") => 20.0,
        ("sovereign", "BBB") => 50.0,
        ("sovereign", "BB") | ("sovereign", "B") => 100.0,
        ("sovereign", _) => 150.0,
        ("bank", "AAA") | ("bank", "AA") => 20.0,
        ("bank", "A") => 50.0,
        ("bank", "BBB") | ("bank", "BB") => 100.0,
        ("bank", _) => 150.0,
        ("corporate", "AAA") | ("corporate", "AA") => 20.0,
        ("corporate", "A") => 50.0,
        ("corporate", "BBB") => 100.0,
        ("corporate", _) => 150.0,
        ("retail", _) => 75.0,
        ("mortgage", _) => 35.0,
        ("sme", _) => 85.0,
        ("equity", _) => 100.0,
        ("securitization", "AAA") => 20.0,
        ("securitization", "AA") => 25.0,
        ("securitization", "A") => 50.0,
        ("securitization", _) => 1250.0,
        _ => 100.0,
    }
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

async fn fetch_exposures(db: &PgPool) -> Result<Vec<RwaExposure>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT id, asset_class, exposure_type, counterparty, rating,
                  original_exposure, credit_conversion_factor, ead, risk_weight, rwa,
                  currency, maturity_date, collateral_value, collateral_type, netting_set
           FROM rwa_exposures ORDER BY id"#,
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .iter()
        .map(|r| RwaExposure {
            id: r.get("id"),
            asset_class: r.get("asset_class"),
            exposure_type: r.get("exposure_type"),
            counterparty: r.get("counterparty"),
            rating: r.get("rating"),
            original_exposure: r.get("original_exposure"),
            credit_conversion_factor: r.get("credit_conversion_factor"),
            ead: r.get("ead"),
            risk_weight: r.get("risk_weight"),
            rwa: r.get("rwa"),
            currency: r.get("currency"),
            maturity_date: r.get("maturity_date"),
            collateral_value: r.get("collateral_value"),
            collateral_type: r.get("collateral_type"),
            netting_set: r.get("netting_set"),
        })
        .collect())
}

// Build the capital ratio report from real data:
//   credit RWA = SUM(rwa) over rwa_exposures
//   capital components + market/operational RWA from latest capital_positions row
// Never fabricate ratios: any missing upstream data => error => HTTP 503.
async fn compute_capital_ratio(db: &PgPool) -> Result<CapitalRatio, String> {
    let exposures = fetch_exposures(db)
        .await
        .map_err(|e| format!("rwa_exposures query failed: {}", e))?;
    let credit_rwa: f64 = exposures.iter().map(|e| e.rwa).sum();

    let row = sqlx::query(
        r#"SELECT id, report_date, tier1_common_equity, additional_tier1, tier2_capital,
                  market_rwa, operational_rwa, leverage_exposure, lcr, nsfr,
                  countercyclical_buffer, systemic_buffer, capital_conservation_buffer,
                  minimum_cet1, minimum_tier1, minimum_total
           FROM capital_positions ORDER BY report_date DESC LIMIT 1"#,
    )
    .fetch_optional(db)
    .await
    .map_err(|e| format!("capital_positions query failed: {}", e))?
    .ok_or_else(|| "capital_positions is empty — no capital data available".to_string())?;

    let cet1: f64 = row.get("tier1_common_equity");
    let at1: f64 = row.get("additional_tier1");
    let t2: f64 = row.get("tier2_capital");
    let market_rwa: f64 = row.get("market_rwa");
    let operational_rwa: f64 = row.get("operational_rwa");
    let leverage_exposure: f64 = row.get("leverage_exposure");
    let total_cap = cet1 + at1 + t2;
    let total_rwa = credit_rwa + market_rwa + operational_rwa;
    if total_rwa <= 0.0 {
        return Err("total RWA is zero — cannot compute capital ratios without exposure data".into());
    }
    let minimum_total: f64 = row.get("minimum_total");
    let minimum_cet1: f64 = row.get("minimum_cet1");

    Ok(CapitalRatio {
        id: row.get("id"),
        report_date: row.get("report_date"),
        tier1_common_equity: cet1,
        additional_tier1: at1,
        tier2_capital: t2,
        total_capital: total_cap,
        total_rwa,
        credit_rwa,
        market_rwa,
        operational_rwa,
        cet1_ratio: (cet1 / total_rwa * 10000.0).round() / 100.0,
        tier1_ratio: ((cet1 + at1) / total_rwa * 10000.0).round() / 100.0,
        total_car: (total_cap / total_rwa * 10000.0).round() / 100.0,
        leverage_ratio: if leverage_exposure > 0.0 {
            ((cet1 + at1) / leverage_exposure * 10000.0).round() / 100.0
        } else {
            0.0
        },
        lcr: row.get("lcr"),
        nsfr: row.get("nsfr"),
        countercyclical_buffer: row.get("countercyclical_buffer"),
        systemic_buffer: row.get("systemic_buffer"),
        capital_conservation_buffer: row.get("capital_conservation_buffer"),
        minimum_cet1,
        minimum_tier1: row.get("minimum_tier1"),
        minimum_total,
        cet1_surplus: (cet1 / total_rwa * 100.0) - minimum_cet1,
        compliant: (total_cap / total_rwa * 100.0) >= minimum_total,
    })
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok", "service": "basel-engine"
    }))
}

async fn list_exposures(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve fabricated RWA exposures"),
    };
    match fetch_exposures(db).await {
        Ok(e) => HttpResponse::Ok().json(serde_json::json!({ "items": e, "total": e.len() })),
        Err(err) => {
            eprintln!("[basel-engine-rs] exposures query failed: {}", err);
            source_unavailable("rwa_exposures query failed; no data served")
        }
    }
}

async fn capital_ratios(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve fabricated capital ratios"),
    };
    match compute_capital_ratio(db).await {
        Ok(c) => HttpResponse::Ok().json(serde_json::json!({ "items": [c], "total": 1 })),
        Err(e) => {
            eprintln!("[basel-engine-rs] capital computation failed: {}", e);
            source_unavailable(&format!("capital ratio computation failed: {}", e))
        }
    }
}

async fn calculate_rwa(req: actix_web::HttpRequest, body: web::Json<RwaCalcRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let req = body.into_inner();
    if req.exposure <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "exposure must be positive"}));
    }
    let valid_classes = ["sovereign", "bank", "corporate", "retail", "mortgage", "sme", "equity", "securitization"];
    if !valid_classes.contains(&req.asset_class.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "invalid asset_class"}));
    }
    let rw = risk_weight(&req.asset_class, &req.rating);
    let collateral = req.collateral_value.unwrap_or(0.0);
    let ead = (req.exposure - collateral * 0.8).max(0.0); // 80% LGD mitigation
    let rwa = ead * rw / 100.0;
    let capital_charge = rwa * 0.15; // 15% CBN minimum CAR
    HttpResponse::Ok().json(serde_json::json!({
        "assetClass": req.asset_class, "rating": req.rating,
        "originalExposure": req.exposure, "collateralValue": collateral,
        "ead": (ead * 100.0).round() / 100.0,
        "riskWeight": rw, "rwa": (rwa * 100.0).round() / 100.0,
        "capitalCharge": (capital_charge * 100.0).round() / 100.0,
    }))
}

async fn pillar3(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve fabricated Pillar 3 disclosure"),
    };
    let exposures = match fetch_exposures(db).await {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[basel-engine-rs] pillar3 exposures query failed: {}", err);
            return source_unavailable("rwa_exposures query failed; no disclosure served");
        }
    };
    let capital = match compute_capital_ratio(db).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[basel-engine-rs] pillar3 capital computation failed: {}", e);
            return source_unavailable(&format!("capital ratio computation failed: {}", e));
        }
    };
    let mut by_asset_class: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for e in exposures.iter() {
        *by_asset_class.entry(e.asset_class.clone()).or_insert(0.0) += e.rwa;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "pillar3Disclosure": {
            "reportDate": capital.report_date.clone(),
            "capitalRatios": capital,
            "rwaByAssetClass": by_asset_class,
            "totalExposures": exposures.len(),
            "regulatoryMinimums": { "cet1": 6.0, "tier1": 8.0, "totalCar": 15.0, "lcr": 100.0, "nsfr": 100.0 },
            "buffers": { "capitalConservation": 2.5, "countercyclical": 0.0, "systemic": 1.0 },
        }
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
    let db = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    eprintln!("[basel-engine-rs] DB connect failed: {} — regulatory endpoints will 503 (fail-fast)", e);
                    None
                }
            }
        }
        _ => {
            eprintln!("[basel-engine-rs] DATABASE_URL not set — regulatory endpoints will 503 (fail-fast)");
            None
        }
    };
    let _ = env_or("PORT", "8163");
    let state = web::Data::new(AppState { db });
    println!("Basel III/IV Engine on :8163");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/basel/exposures", web::get().to(list_exposures))
            .route("/v1/basel/capital", web::get().to(capital_ratios))
            .route("/v1/basel/calculate-rwa", web::post().to(calculate_rwa))
            .route("/v1/basel/pillar3", web::get().to(pillar3))
    })
    .bind("0.0.0.0:8163")?
    .run()
    .await
}
