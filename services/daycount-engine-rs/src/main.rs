#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use chrono::{NaiveDate, Datelike};
use std::env;

// Day-Count Convention Engine for Nigerian Banking
// Supports: Actual/365, Actual/360, 30/360 (ISDA), 30E/360 (Eurobond), Actual/Actual

#[derive(Deserialize, Clone, Copy)]
enum DayCountConvention {
    #[serde(rename = "actual_365")]
    Actual365,
    #[serde(rename = "actual_360")]
    Actual360,
    #[serde(rename = "30_360")]
    Thirty360,
    #[serde(rename = "30e_360")]
    ThirtyE360,
    #[serde(rename = "actual_actual")]
    ActualActual,
}

fn day_count_fraction(start: NaiveDate, end: NaiveDate, convention: DayCountConvention) -> (i64, f64) {
    match convention {
        DayCountConvention::Actual365 => {
            let days = (end - start).num_days();
            (days, days as f64 / 365.0)
        }
        DayCountConvention::Actual360 => {
            let days = (end - start).num_days();
            (days, days as f64 / 360.0)
        }
        DayCountConvention::Thirty360 => {
            let mut d1 = start.day() as i64;
            let mut d2 = end.day() as i64;
            let m1 = start.month() as i64;
            let m2 = end.month() as i64;
            let y1 = start.year() as i64;
            let y2 = end.year() as i64;
            if d1 == 31 { d1 = 30; }
            if d2 == 31 && d1 >= 30 { d2 = 30; }
            let days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
            (days, days as f64 / 360.0)
        }
        DayCountConvention::ThirtyE360 => {
            let mut d1 = start.day().min(30) as i64;
            let mut d2 = end.day().min(30) as i64;
            let m1 = start.month() as i64;
            let m2 = end.month() as i64;
            let y1 = start.year() as i64;
            let y2 = end.year() as i64;
            let days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
            (days, days as f64 / 360.0)
        }
        DayCountConvention::ActualActual => {
            let days = (end - start).num_days();
            let year = start.year();
            let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
            let year_days = if is_leap { 366.0 } else { 365.0 };
            (days, days as f64 / year_days)
        }
    }
}

fn calculate_interest_kobo(principal_kobo: i64, annual_rate_pct: f64, fraction: f64) -> i64 {
    let interest = principal_kobo as f64 * (annual_rate_pct / 100.0) * fraction;
    interest.round() as i64
}

#[derive(Deserialize)]
struct AccrueRequest {
    principal_kobo: i64,
    annual_rate_pct: f64,
    start_date: String,
    end_date: String,
    convention: DayCountConvention,
    compounding: Option<String>, // "simple", "daily", "monthly"
}

async fn accrue(req: actix_web::HttpRequest, body: web::Json<AccrueRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let start = match NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d") {
        Ok(d) => d, Err(_) => return HttpResponse::BadRequest().json(json!({"error": "invalid start_date"})),
    };
    let end = match NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d") {
        Ok(d) => d, Err(_) => return HttpResponse::BadRequest().json(json!({"error": "invalid end_date"})),
    };
    
    let (days, fraction) = day_count_fraction(start, end, body.convention);
    let compounding = body.compounding.as_deref().unwrap_or("simple");
    
    let interest_kobo = match compounding {
        "daily" => {
            let daily_rate = body.annual_rate_pct / 100.0 / 365.0;
            let factor = (1.0 + daily_rate).powi(days as i32);
            ((body.principal_kobo as f64 * factor) - body.principal_kobo as f64).round() as i64
        }
        "monthly" => {
            let months = days / 30;
            let monthly_rate = body.annual_rate_pct / 100.0 / 12.0;
            let factor = (1.0 + monthly_rate).powi(months as i32);
            ((body.principal_kobo as f64 * factor) - body.principal_kobo as f64).round() as i64
        }
        _ => calculate_interest_kobo(body.principal_kobo, body.annual_rate_pct, fraction),
    };
    
    HttpResponse::Ok().json(json!({
        "principal_kobo": body.principal_kobo,
        "interest_kobo": interest_kobo,
        "total_kobo": body.principal_kobo + interest_kobo,
        "annual_rate_pct": body.annual_rate_pct,
        "days": days,
        "day_count_fraction": fraction,
        "compounding": compounding,
        "start_date": body.start_date,
        "end_date": body.end_date,
    }))
}

async fn compare_conventions(req: actix_web::HttpRequest, body: web::Json<AccrueRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let start = NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d").unwrap();
    let end = NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d").unwrap();
    let conventions = vec![
        ("actual_365", DayCountConvention::Actual365),
        ("actual_360", DayCountConvention::Actual360),
        ("30_360", DayCountConvention::Thirty360),
        ("30e_360", DayCountConvention::ThirtyE360),
        ("actual_actual", DayCountConvention::ActualActual),
    ];
    let results: Vec<serde_json::Value> = conventions.iter().map(|(name, conv)| {
        let (days, fraction) = day_count_fraction(start, end, *conv);
        let interest = calculate_interest_kobo(body.principal_kobo, body.annual_rate_pct, fraction);
        json!({"convention": name, "days": days, "fraction": fraction, "interest_kobo": interest})
    }).collect();
    HttpResponse::Ok().json(json!({"comparisons": results}))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "daycount-engine-rs", "version": "1.0.0",
        "conventions": ["actual_365", "actual_360", "30_360", "30e_360", "actual_actual"]}))
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9045);
    eprintln!("[daycount-engine-rs] Starting on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/interest/accrue", web::post().to(accrue))
            .route("/api/v1/interest/compare", web::post().to(compare_conventions))
    }).bind(("0.0.0.0", port))?.run().await
}
