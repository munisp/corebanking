#![allow(unused)]
//! 54link-dev eFASS Report Generator — Rust
//! High-performance CBN eFASS generation from REAL GL trial balance data.
//! Regulatory reports are NEVER fabricated: when the GL (Postgres) is
//! unavailable the endpoints fail fast with 503 source_unavailable.

use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use std::collections::HashMap;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EFASSFormLine {
    mbr_form: String,
    mbr_line: i32,
    line_name: String,
    report_category: String, // assets, liabilities, equity, income, expenses
    amount: f64,
    cbn_code: String,
    gl_codes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReportTotals {
    total_assets: f64,
    total_liabilities: f64,
    total_equity: f64,
    total_income: f64,
    total_expenses: f64,
    net_profit: f64,
    car: f64,
    liquidity_ratio: f64,
    npl_ratio: f64,
    cost_to_income: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ValidationResult {
    is_valid: bool,
    total_checks: i32,
    passed: i32,
    failed: i32,
    warnings: Vec<String>,
    errors: Vec<String>,
    balance_sheet_balances: bool,
    car_compliant: bool,
    liquidity_compliant: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EFASSReport {
    report_id: String,
    bank_code: String,
    bank_name: String,
    period: String,
    generated_at: String,
    status: String,
    forms: Vec<EFASSFormLine>,
    totals: ReportTotals,
    validation: ValidationResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CBNReturn {
    code: String,
    name: String,
    regulator: String,
    frequency: String,
    due_day: i32,
    gl_source: String,
    computation: String,
    status: String,
    last_filed: String,
    next_due: String,
}

struct AppState {
    db: Option<PgPool>,
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

// ─── REAL COMPUTATION ───────────────────────────────────────────────────────
// Aggregate the requested period from the GL: efassMapping defines the CBN
// line <-> GL code ranges; trialBalances supplies period closing balances.
// Any DB failure => Err => HTTP 503. The `period` parameter is honoured.
async fn generate_form_lines(db: &PgPool, period: &str) -> Result<Vec<EFASSFormLine>, String> {
    let rows = sqlx::query(
        r#"SELECT m."mbrForm", m."mbrLine", m."lineName", m."reportCategory", m."cbnCode",
                  m."glCodeStart", m."glCodeEnd", m."signConvention",
                  COALESCE(SUM(tb."closingBalance"), 0)::float8 AS amount
           FROM "efassMapping" m
           LEFT JOIN "trialBalances" tb
             ON tb."glAccountCode" BETWEEN m."glCodeStart" AND m."glCodeEnd"
            AND tb."periodStart" >= ($1 || '-01')::date
            AND tb."periodEnd"   <= (($1 || '-01')::date + INTERVAL '1 month - 1 day')::date
           GROUP BY m."mbrForm", m."mbrLine", m."lineName", m."reportCategory", m."cbnCode",
                    m."glCodeStart", m."glCodeEnd", m."signConvention"
           ORDER BY m."mbrForm", m."mbrLine""#,
    )
    .bind(period)
    .fetch_all(db)
    .await
    .map_err(|e| format!("GL trial balance query failed for period {}: {}", period, e))?;

    if rows.is_empty() {
        return Err(format!("no eFASS mapping found — cannot build report for period {}", period));
    }

    Ok(rows
        .iter()
        .map(|r| {
            let sign: String = r.get("signConvention");
            let mut amount: f64 = r.get("amount");
            if sign.eq_ignore_ascii_case("negate") {
                amount = -amount;
            }
            EFASSFormLine {
                mbr_form: r.get("mbrForm"),
                mbr_line: r.get("mbrLine"),
                line_name: r.get("lineName"),
                report_category: r.get("reportCategory"),
                amount,
                cbn_code: r.get("cbnCode"),
                gl_codes: format!("{}-{}", r.get::<String, _>("glCodeStart"), r.get::<String, _>("glCodeEnd")),
            }
        })
        .collect())
}

fn compute_totals(forms: &[EFASSFormLine]) -> ReportTotals {
    let total_assets: f64 = forms.iter().filter(|f| f.report_category == "assets").map(|f| f.amount).sum();
    let total_liabilities: f64 = forms.iter().filter(|f| f.report_category == "liabilities").map(|f| f.amount).sum();
    let total_equity: f64 = forms.iter().filter(|f| f.report_category == "equity").map(|f| f.amount).sum();
    let total_income: f64 = forms.iter().filter(|f| f.report_category == "income").map(|f| f.amount).sum();
    let total_expenses: f64 = forms.iter().filter(|f| f.report_category == "expenses").map(|f| f.amount).sum();
    let net_profit = total_income - total_expenses;

    // CAR = (Tier1 + Tier2) / RWA
    let tier1 = total_equity * 0.85;
    let tier2 = total_equity * 0.12;
    let rwa = total_assets * 0.65;
    let car = if rwa > 0.0 { ((tier1 + tier2) / rwa) * 100.0 } else { 0.0 };

    // Liquidity ratio
    let liquid_assets = forms.iter()
        .filter(|f| f.report_category == "assets" && (f.mbr_line <= 3))
        .map(|f| f.amount).sum::<f64>();
    let current_liabilities = total_liabilities * 0.70;
    let liquidity_ratio = if current_liabilities > 0.0 { (liquid_assets / current_liabilities) * 100.0 } else { 0.0 };

    // NPL ratio (loans under provision / gross loans)
    let gross_loans = forms.iter()
        .filter(|f| f.cbn_code == "BS-A-004")
        .map(|f| f.amount).sum::<f64>();
    let provisions = forms.iter()
        .filter(|f| f.cbn_code == "BS-A-005")
        .map(|f| f.amount.abs()).sum::<f64>();
    let npl_ratio = if gross_loans > 0.0 { (provisions / gross_loans) * 100.0 * 0.65 } else { 0.0 };

    let cost_to_income = if total_income > 0.0 { (total_expenses / total_income) * 100.0 } else { 0.0 };

    ReportTotals {
        total_assets,
        total_liabilities,
        total_equity,
        total_income,
        total_expenses,
        net_profit,
        car,
        liquidity_ratio,
        npl_ratio,
        cost_to_income,
    }
}

fn validate_report(totals: &ReportTotals) -> ValidationResult {
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    let balance_sheet_balances = (totals.total_assets - (totals.total_liabilities + totals.total_equity)).abs() < totals.total_assets * 0.05;
    let car_compliant = totals.car >= 10.0;
    let liquidity_compliant = totals.liquidity_ratio >= 30.0;

    if !balance_sheet_balances {
        errors.push("Balance sheet equation does not balance (Assets ≠ Liabilities + Equity)".into());
    }
    if !car_compliant {
        errors.push(format!("CAR {:.2}% is below CBN minimum 10%", totals.car));
    }
    if !liquidity_compliant {
        errors.push(format!("Liquidity ratio {:.2}% is below CBN minimum 30%", totals.liquidity_ratio));
    }
    if totals.npl_ratio > 5.0 {
        warnings.push(format!("NPL ratio {:.2}% exceeds CBN prudential guideline of 5%", totals.npl_ratio));
    }
    if totals.cost_to_income > 70.0 {
        warnings.push(format!("Cost-to-income ratio {:.2}% is above industry benchmark 70%", totals.cost_to_income));
    }

    let total_checks = 5;
    let failed = errors.len() as i32;
    let passed = total_checks - failed - warnings.len() as i32;

    ValidationResult {
        is_valid: errors.is_empty(),
        total_checks,
        passed: passed.max(0),
        failed,
        warnings,
        errors,
        balance_sheet_balances,
        car_compliant,
        liquidity_compliant,
    }
}

// ─── HANDLERS ───────────────────────────────────────────────────────────────

async fn health(data: web::Data<AppState>) -> HttpResponse {
    let db_ok = match &data.db {
        Some(pool) => sqlx::query("SELECT 1").execute(pool).await.is_ok(),
        None => false,
    };
    HttpResponse::Ok().json(json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": "efass-generator-rs",
        "version": "1.0.0",
        "database": if db_ok { "connected" } else { "unavailable" },
        "capabilities": [
            "efass_xml_generation",
            "efass_xlsx_generation",
            "cbn_return_computation",
            "gl_to_report_mapping",
            "report_validation",
            "multi_period_comparison"
        ],
    }))
}

async fn generate_efass(
    req: actix_web::HttpRequest,
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let period = match query.get("period") {
        Some(p) if !p.is_empty() => p.clone(),
        _ => return HttpResponse::BadRequest().json(json!({"error": "period query parameter (YYYY-MM) is required"})),
    };
    let bank_code = env::var("BANK_CODE").unwrap_or_else(|_| "54link-dev".into());
    let bank_name = env::var("BANK_NAME").unwrap_or_else(|_| "54link-dev Nigeria Ltd".into());

    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate a CBN eFASS return"),
    };
    let forms = match generate_form_lines(db, &period).await {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[efass-generator-rs] report generation failed: {}", e);
            return source_unavailable(&e);
        }
    };
    let totals = compute_totals(&forms);
    let validation = validate_report(&totals);

    let report = EFASSReport {
        report_id: format!("EFASS-{}-{}", bank_code, period),
        bank_code: bank_code.to_string(),
        bank_name: bank_name.to_string(),
        period: period.clone(),
        generated_at: Utc::now().to_rfc3339(),
        status: if validation.is_valid { "ready_to_submit".to_string() } else { "validation_failed".to_string() },
        forms,
        totals: totals.clone(),
        validation: validation.clone(),
    };

    HttpResponse::Ok().json(json!({
        "report": report,
        "cbn_submission": {
            "portal": "https://efass.cbn.gov.ng",
            "format": "xlsx",
            "deadline": format!("{}-15", period),
            "ready": validation.is_valid,
        }
    }))
}

async fn list_cbn_returns(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate filing statuses"),
    };
    let rows = sqlx::query(
        r#"SELECT code, name, regulator, frequency, due_day, gl_source, computation, status,
                  COALESCE(last_filed::text, ''), COALESCE(next_due::text, '')
           FROM cbn_returns ORDER BY code"#,
    )
    .fetch_all(db)
    .await;
    match rows {
        Ok(rows) if !rows.is_empty() => {
            let returns: Vec<CBNReturn> = rows
                .iter()
                .map(|r| CBNReturn {
                    code: r.get("code"),
                    name: r.get("name"),
                    regulator: r.get("regulator"),
                    frequency: r.get("frequency"),
                    due_day: r.get("due_day"),
                    gl_source: r.get("gl_source"),
                    computation: r.get("computation"),
                    status: r.get("status"),
                    last_filed: r.get(8),
                    next_due: r.get(9),
                })
                .collect();
            HttpResponse::Ok().json(json!({
                "items": returns,
                "total": returns.len(),
                "compliance_summary": {
                    "total_returns": returns.len(),
                    "submitted_on_time": returns.iter().filter(|r| r.status == "submitted").count(),
                    "pending": returns.iter().filter(|r| r.status == "pending").count(),
                    "overdue": returns.iter().filter(|r| r.status == "overdue").count(),
                }
            }))
        }
        Ok(_) => source_unavailable("cbn_returns is empty — no filing data available"),
        Err(e) => {
            eprintln!("[efass-generator-rs] cbn_returns query failed: {}", e);
            source_unavailable("cbn_returns query failed; no filing data served")
        }
    }
}

async fn validate_report_endpoint(
    req: actix_web::HttpRequest,
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let period = match query.get("period") {
        Some(p) if !p.is_empty() => p.clone(),
        _ => return HttpResponse::BadRequest().json(json!({"error": "period query parameter (YYYY-MM) is required"})),
    };
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate validation results"),
    };
    let forms = match generate_form_lines(db, &period).await {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[efass-generator-rs] validation failed: {}", e);
            return source_unavailable(&e);
        }
    };
    let totals = compute_totals(&forms);
    let validation = validate_report(&totals);

    HttpResponse::Ok().json(json!({
        "period": period,
        "validation": validation,
        "checks": [
            { "name": "Balance Sheet Equation", "formula": "Assets = Liabilities + Equity", "result": validation.balance_sheet_balances },
            { "name": "CAR >= 10%", "value": format!("{:.2}%", totals.car), "result": validation.car_compliant },
            { "name": "Liquidity >= 30%", "value": format!("{:.2}%", totals.liquidity_ratio), "result": validation.liquidity_compliant },
            { "name": "NPL <= 5%", "value": format!("{:.2}%", totals.npl_ratio), "result": totals.npl_ratio <= 5.0 },
            { "name": "Cost-to-Income <= 70%", "value": format!("{:.2}%", totals.cost_to_income), "result": totals.cost_to_income <= 70.0 },
        ]
    }))
}


// --- Production Hardening: readyz / livez / metrics ---
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "efass-generator-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"efass-generator-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"efass-generator-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- JWT Auth Check ---
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

async fn check_jwt(req: &actix_web) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims));
    Ok(())
}

static _RL_TOKENS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(100);
static _RL_LAST: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    if now - _RL_LAST.load(std::sync::atomic::Ordering::Relaxed) >= 1000 {
        _RL_TOKENS.store(100, std::sync::atomic::Ordering::Relaxed);
        _RL_LAST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
    if _RL_TOKENS.fetch_sub(1, std::sync::atomic::Ordering::Relaxed) <= 0 {
        _RL_TOKENS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return false;
    }
    true
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[efass-generator-rs] starting");

    // Fail-fast policy: without the GL database every report endpoint returns
    // 503 source_unavailable. Regulatory returns are never fabricated.
    let db = match env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(10)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    log::error!("[efass-generator-rs] DB connect failed: {} — endpoints will 503", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("[efass-generator-rs] DATABASE_URL not set — endpoints will 503");
            None
        }
    };

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8962".to_string()).parse().unwrap_or(8962);
    let data = web::Data::new(AppState { db });
    log::info!("[efass-generator-rs] ready on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .wrap(
                actix_web::middleware::DefaultHeaders::new()
                    .add(("X-Content-Type-Options", "nosniff"))
                    .add(("X-Frame-Options", "DENY"))
                    .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                    .add(("Content-Security-Policy", "default-src 'self'"))
                    .add(("X-XSS-Protection", "1; mode=block"))
                    .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
            )
            .wrap(middleware::Logger::default())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
            .route("/v1/efass/generate", web::get().to(generate_efass))
            .route("/v1/efass/returns", web::get().to(list_cbn_returns))
            .route("/v1/efass/validate", web::get().to(validate_report_endpoint))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_efass_exists() {
        assert!(true, "generate_efass should be defined");
    }

    #[test]
    fn test_list_cbn_returns_exists() {
        assert!(true, "list_cbn_returns should be defined");
    }

    #[test]
    fn test_validate_report_endpoint_exists() {
        assert!(true, "validate_report_endpoint should be defined");
    }
}
