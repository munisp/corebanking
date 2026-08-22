use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct Derivative {
    id: String,
    instrument_type: String, // irs, ccs, fra, cap, floor, collar, fx_option, swaption
    trade_id: String,
    counterparty: String,
    counterparty_id: String,
    notional: f64,
    currency: String,
    secondary_currency: Option<String>,
    fixed_rate: Option<f64>,
    floating_index: Option<String>, // CBN_MPR, NIBOR_3M, NIBOR_6M, LIBOR_3M, SOFR
    floating_spread: Option<f64>,
    strike_price: Option<f64>,
    option_type: Option<String>, // call, put
    start_date: String,
    maturity_date: String,
    payment_frequency: String, // monthly, quarterly, semi_annual, annual
    day_count: String,
    mtm_value: f64,
    collateral_posted: f64,
    collateral_received: f64,
    hedge_designation: Option<String>, // fair_value, cash_flow, net_investment, none
    status: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct ValuationResult {
    trade_id: String,
    instrument_type: String,
    notional: f64,
    mtm_value: f64,
    pv01: f64,
    delta: Option<f64>,
    gamma: Option<f64>,
    vega: Option<f64>,
    cva: f64,
    dva: f64,
}

#[derive(Deserialize)]
struct PricingRequest {
    instrument_type: String,
    notional: f64,
    fixed_rate: Option<f64>,
    floating_index: Option<String>,
    tenor_years: f64,
    strike: Option<f64>,
    volatility: Option<f64>,
}

struct AppState {
    derivatives: Mutex<Vec<Derivative>>,
}

fn seed() -> Vec<Derivative> {
    vec![
        Derivative {
            id: "DRV-001".into(), instrument_type: "irs".into(), trade_id: "IRS-2026-001".into(),
            counterparty: "Access Bank PLC".into(), counterparty_id: "ABP-001".into(),
            notional: 50_000_000_000.0, currency: "NGN".into(), secondary_currency: None,
            fixed_rate: Some(16.5), floating_index: Some("CBN_MPR".into()), floating_spread: Some(2.0),
            strike_price: None, option_type: None,
            start_date: "2026-01-15".into(), maturity_date: "2031-01-15".into(),
            payment_frequency: "quarterly".into(), day_count: "ACT/360".into(),
            mtm_value: 1_250_000_000.0, collateral_posted: 0.0, collateral_received: 500_000_000.0,
            hedge_designation: Some("cash_flow".into()), status: "active".into(),
        },
        Derivative {
            id: "DRV-002".into(), instrument_type: "ccs".into(), trade_id: "CCS-2026-001".into(),
            counterparty: "Standard Chartered Bank".into(), counterparty_id: "SCB-001".into(),
            notional: 100_000_000.0, currency: "USD".into(), secondary_currency: Some("NGN".into()),
            fixed_rate: Some(5.5), floating_index: Some("SOFR".into()), floating_spread: Some(1.5),
            strike_price: None, option_type: None,
            start_date: "2026-03-01".into(), maturity_date: "2029-03-01".into(),
            payment_frequency: "semi_annual".into(), day_count: "30/360".into(),
            mtm_value: -15_000_000.0, collateral_posted: 10_000_000.0, collateral_received: 0.0,
            hedge_designation: Some("fair_value".into()), status: "active".into(),
        },
        Derivative {
            id: "DRV-003".into(), instrument_type: "fra".into(), trade_id: "FRA-2026-001".into(),
            counterparty: "First Bank of Nigeria".into(), counterparty_id: "FBN-001".into(),
            notional: 20_000_000_000.0, currency: "NGN".into(), secondary_currency: None,
            fixed_rate: Some(18.0), floating_index: Some("NIBOR_3M".into()), floating_spread: None,
            strike_price: None, option_type: None,
            start_date: "2026-06-15".into(), maturity_date: "2026-09-15".into(),
            payment_frequency: "quarterly".into(), day_count: "ACT/360".into(),
            mtm_value: 350_000_000.0, collateral_posted: 0.0, collateral_received: 200_000_000.0,
            hedge_designation: None, status: "active".into(),
        },
        Derivative {
            id: "DRV-004".into(), instrument_type: "cap".into(), trade_id: "CAP-2026-001".into(),
            counterparty: "Zenith Bank PLC".into(), counterparty_id: "ZBP-001".into(),
            notional: 10_000_000_000.0, currency: "NGN".into(), secondary_currency: None,
            fixed_rate: None, floating_index: Some("CBN_MPR".into()), floating_spread: None,
            strike_price: Some(20.0), option_type: Some("call".into()),
            start_date: "2026-02-01".into(), maturity_date: "2028-02-01".into(),
            payment_frequency: "quarterly".into(), day_count: "ACT/360".into(),
            mtm_value: 450_000_000.0, collateral_posted: 200_000_000.0, collateral_received: 0.0,
            hedge_designation: Some("cash_flow".into()), status: "active".into(),
        },
        Derivative {
            id: "DRV-005".into(), instrument_type: "fx_option".into(), trade_id: "FXO-2026-001".into(),
            counterparty: "Citibank Nigeria".into(), counterparty_id: "CITI-001".into(),
            notional: 50_000_000.0, currency: "USD".into(), secondary_currency: Some("NGN".into()),
            fixed_rate: None, floating_index: None, floating_spread: None,
            strike_price: Some(1550.0), option_type: Some("put".into()),
            start_date: "2026-04-01".into(), maturity_date: "2026-10-01".into(),
            payment_frequency: "monthly".into(), day_count: "ACT/365".into(),
            mtm_value: 2_500_000.0, collateral_posted: 0.0, collateral_received: 1_000_000.0,
            hedge_designation: Some("cash_flow".into()), status: "active".into(),
        },
        Derivative {
            id: "DRV-006".into(), instrument_type: "swaption".into(), trade_id: "SWN-2025-001".into(),
            counterparty: "GTBank PLC".into(), counterparty_id: "GTB-001".into(),
            notional: 30_000_000_000.0, currency: "NGN".into(), secondary_currency: None,
            fixed_rate: Some(17.0), floating_index: Some("NIBOR_6M".into()), floating_spread: Some(1.0),
            strike_price: Some(17.0), option_type: Some("call".into()),
            start_date: "2025-12-01".into(), maturity_date: "2026-06-01".into(),
            payment_frequency: "semi_annual".into(), day_count: "ACT/360".into(),
            mtm_value: -800_000_000.0, collateral_posted: 500_000_000.0, collateral_received: 0.0,
            hedge_designation: None, status: "expired".into(),
        },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok", "version": env_or("VERSION", "0.0.1")})) 
}

async fn list_derivatives(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let d = data.derivatives.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

async fn price_derivative(req: actix_web::HttpRequest, body: web::Json<PricingRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let req = body.into_inner();
    if req.notional <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "notional must be positive"}));
    }
    if req.tenor_years <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "tenor_years must be positive"}));
    }
    let valid_types = ["irs", "ccs", "fra", "cap", "floor", "collar", "fx_option", "swaption"];
    if !valid_types.contains(&req.instrument_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "invalid instrument_type"}));
    }
    // Simplified pricing models
    let (mtm, pv01, delta, gamma, vega, cva, dva) = match req.instrument_type.as_str() {
        "irs" => {
            let rate = req.fixed_rate.unwrap_or(16.5);
            let mtm = req.notional * (rate - 18.75) / 100.0 * req.tenor_years * 0.5;
            let pv01 = req.notional * 0.0001 * req.tenor_years;
            (mtm, pv01, None, None, None, req.notional * 0.002, req.notional * 0.001)
        },
        "fra" => {
            let rate = req.fixed_rate.unwrap_or(18.0);
            let mtm = req.notional * (rate - 18.75) / 100.0 * (req.tenor_years / 4.0);
            let pv01 = req.notional * 0.0001 * req.tenor_years;
            (mtm, pv01, None, None, None, req.notional * 0.001, req.notional * 0.0005)
        },
        "cap" | "floor" | "collar" | "fx_option" | "swaption" => {
            let vol = req.volatility.unwrap_or(20.0);
            let strike = req.strike.unwrap_or(20.0);
            let premium = req.notional * vol / 100.0 * (req.tenor_years).sqrt() * 0.05;
            let d = Some(0.55);
            let g = Some(0.02);
            let v = Some(req.notional * 0.001 * req.tenor_years);
            (premium, req.notional * 0.0001, d, g, v, req.notional * 0.0015, req.notional * 0.0008)
        },
        _ => {
            let mtm = req.notional * 0.01 * req.tenor_years;
            (mtm, req.notional * 0.0001, None, None, None, req.notional * 0.002, req.notional * 0.001)
        }
    };
    HttpResponse::Ok().json(ValuationResult {
        trade_id: "PRICING-QUOTE".into(), instrument_type: req.instrument_type,
        notional: req.notional, mtm_value: (mtm * 100.0).round() / 100.0,
        pv01: (pv01 * 100.0).round() / 100.0,
        delta, gamma, vega,
        cva: (cva * 100.0).round() / 100.0, dva: (dva * 100.0).round() / 100.0,
    })
}

async fn portfolio_risk(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let d = data.derivatives.lock().unwrap();
    let total_notional: f64 = d.iter().filter(|x| x.status == "active").map(|x| x.notional).sum();
    let total_mtm: f64 = d.iter().filter(|x| x.status == "active").map(|x| x.mtm_value).sum();
    let total_collateral_posted: f64 = d.iter().map(|x| x.collateral_posted).sum();
    let total_collateral_received: f64 = d.iter().map(|x| x.collateral_received).sum();
    let net_exposure = total_mtm - total_collateral_received + total_collateral_posted;
    let mut by_type: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for drv in d.iter() { *by_type.entry(drv.instrument_type.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({
        "totalTrades": d.len(),
        "activeTrades": d.iter().filter(|x| x.status == "active").count(),
        "totalNotional": total_notional, "totalMtM": total_mtm,
        "collateralPosted": total_collateral_posted, "collateralReceived": total_collateral_received,
        "netExposure": net_exposure, "byType": by_type,
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
    let port = env_or("PORT", "8080");
    let state = web::Data::new(AppState { derivatives: Mutex::new(seed()) });
    eprintln!("OTC Derivatives service on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/derivatives", web::get().to(list_derivatives))
            .route("/v1/derivatives/price", web::post().to(price_derivative))
            .route("/v1/derivatives/risk", web::get().to(portfolio_risk))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
