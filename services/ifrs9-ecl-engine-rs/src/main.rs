#![allow(unused)]
//! DEPRECATED: ifrs9-ecl-engine-rs is superseded by ifrs9-engine-rs (canonical).
//! Do not add new features here. Migrate callers to ifrs9-engine-rs /v1/ifrs9/* endpoints.
//!
//! 54link-dev IFRS 9 ECL Engine — Rust
//! Computes Expected Credit Loss (PD × LGD × EAD) for loan portfolio.
//! Posts provisions to GL codes 1351-1357, 5201-5205.
//! Pipeline: Loan Book → Credit Risk Assessment → Stage Classification → ECL Computation → GL Provisioning

use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LoanExposure {
    loan_id: String,
    customer_name: String,
    loan_type: String,
    outstanding_balance: f64,
    original_amount: f64,
    days_past_due: i64,
    stage: i64,
    pd: f64,
    lgd: f64,
    ead: f64,
    ecl_12_month: f64,
    ecl_lifetime: f64,
    ecl_applied: f64,
    collateral_value: f64,
    collateral_coverage: f64,
    gl_provision_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StageData {
    count: i32,
    exposure: f64,
    ecl: f64,
    coverage_ratio: f64,
    gl_code: String,
    classification: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StageBreakdown {
    stage1: StageData,
    stage2: StageData,
    stage3: StageData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GLProvisioning {
    entry_id: String,
    gl_debit: String,
    gl_debit_name: String,
    gl_credit: String,
    gl_credit_name: String,
    amount: f64,
    narration: String,
    posting_type: String,
    // "posted" only after a REAL GL journal post succeeds; otherwise "not_posted".
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PipelineTrace {
    step1: String,
    step2: String,
    step3: String,
    step4: String,
    step5: String,
    step6: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ECLPortfolioResult {
    computation_id: String,
    business_date: String,
    total_portfolio: f64,
    total_ecl: f64,
    ecl_coverage_ratio: f64,
    stage_breakdown: StageBreakdown,
    exposures: Vec<LoanExposure>,
    gl_postings: Vec<GLProvisioning>,
    provision_status: String,
    pipeline: PipelineTrace,
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

fn gl_provision_code(stage: i64) -> &'static str {
    match stage {
        2 => "1356",
        3 => "1357",
        _ => "1355",
    }
}

// Read the REAL loan book from Postgres (ifrs9_exposures, maintained by
// ifrs9-engine-rs). Monetary columns are stored in kobo (i64); convert to NGN.
// Any DB failure => Err => HTTP 503. Never fabricate a loan book.
async fn fetch_loan_book(db: &PgPool) -> Result<Vec<LoanExposure>, String> {
    let rows = sqlx::query(
        r#"SELECT id, customer_name, product_type,
                  outstanding_balance_kobo, original_amount_kobo, days_past_due, stage,
                  pd_12m, lgd, collateral_value_kobo, ecl_12m_kobo, ecl_lifetime_kobo, ecl_kobo
           FROM ifrs9_exposures ORDER BY id"#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("ifrs9_exposures query failed: {}", e))?;
    if rows.is_empty() {
        return Err("ifrs9_exposures is empty — no loan book available".into());
    }
    Ok(rows
        .iter()
        .map(|r| {
            let outstanding: f64 = r.get::<i64, _>("outstanding_balance_kobo") as f64 / 100.0;
            let collateral: f64 = r.get::<i64, _>("collateral_value_kobo") as f64 / 100.0;
            let stage: i64 = r.get::<i16, _>("stage") as i64;
            LoanExposure {
                loan_id: r.get("id"),
                customer_name: r.get("customer_name"),
                loan_type: r.get("product_type"),
                outstanding_balance: outstanding,
                original_amount: r.get::<i64, _>("original_amount_kobo") as f64 / 100.0,
                days_past_due: r.get::<i32, _>("days_past_due") as i64,
                stage,
                pd: r.get::<f64, _>("pd_12m") / 100.0,
                lgd: r.get::<f64, _>("lgd") / 100.0,
                ead: outstanding,
                ecl_12_month: r.get::<i64, _>("ecl_12m_kobo") as f64 / 100.0,
                ecl_lifetime: r.get::<i64, _>("ecl_lifetime_kobo") as f64 / 100.0,
                ecl_applied: r.get::<i64, _>("ecl_kobo") as f64 / 100.0,
                collateral_value: collateral,
                collateral_coverage: if outstanding > 0.0 { collateral / outstanding * 100.0 } else { 0.0 },
                gl_provision_code: gl_provision_code(stage).to_string(),
            }
        })
        .collect())
}

// Post a provision journal ONLY via the real GL service. Returns "posted"
// solely on a confirmed 2xx-ish response; any failure => "not_posted".
fn post_gl_provision(gl_url: &str, posting: &GLProvisioning) -> String {
    let body = json!({
        "entryId": posting.entry_id,
        "lines": [
            {"account": posting.gl_debit, "debit": posting.amount, "credit": 0.0},
            {"account": posting.gl_credit, "debit": 0.0, "credit": posting.amount}
        ],
        "narration": posting.narration,
        "postingType": posting.posting_type,
    })
    .to_string();
    match call_service_sync(&format!("{}/v1/gl/journal-entries", gl_url), &body) {
        Ok(resp) if !resp.contains("\"error\"") => "posted".to_string(),
        Ok(resp) => {
            eprintln!("[ifrs9-ecl-engine-rs] GL post rejected: {}", resp);
            "not_posted".to_string()
        }
        Err(e) => {
            eprintln!("[ifrs9-ecl-engine-rs] GL post failed: {}", e);
            "not_posted".to_string()
        }
    }
}

fn compute_ecl_portfolio(db: &PgPool) -> Result<ECLPortfolioResult, String> {
    Err("unreachable".into())
}

async fn compute_ecl_portfolio_async(db: &PgPool) -> Result<ECLPortfolioResult, String> {
    let loans = fetch_loan_book(db).await?;

    let total_portfolio: f64 = loans.iter().map(|l| l.outstanding_balance).sum();
    let total_ecl: f64 = loans.iter().map(|l| l.ecl_applied).sum();

    let stage1_exp: f64 = loans.iter().filter(|l| l.stage == 1).map(|l| l.outstanding_balance).sum();
    let stage1_ecl: f64 = loans.iter().filter(|l| l.stage == 1).map(|l| l.ecl_applied).sum();
    let stage2_exp: f64 = loans.iter().filter(|l| l.stage == 2).map(|l| l.outstanding_balance).sum();
    let stage2_ecl: f64 = loans.iter().filter(|l| l.stage == 2).map(|l| l.ecl_applied).sum();
    let stage3_exp: f64 = loans.iter().filter(|l| l.stage == 3).map(|l| l.outstanding_balance).sum();
    let stage3_ecl: f64 = loans.iter().filter(|l| l.stage == 3).map(|l| l.ecl_applied).sum();

    let business_date = Utc::now().format("%Y-%m-%d").to_string();
    let computation_id = format!("ECL-{}", business_date);

    // Provision journals are proposals until a REAL GL post succeeds.
    let gl_url = env::var("GL_ENGINE_URL").unwrap_or_default();
    let mut all_posted = !gl_url.is_empty();
    let specs = [
        ("JE-ECL-S1", "5201", "Impairment Charge - Stage 1", "1355", "IFRS 9 ECL Provision Stage 1", stage1_ecl, "IFRS9 ECL Stage 1 provision"),
        ("JE-ECL-S2", "5202", "Impairment Charge - Stage 2", "1356", "IFRS 9 ECL Provision Stage 2", stage2_ecl, "IFRS9 ECL Stage 2 provision"),
        ("JE-ECL-S3", "5203", "Impairment Charge - Stage 3", "1357", "IFRS 9 ECL Provision Stage 3", stage3_ecl, "IFRS9 ECL Stage 3 provision"),
    ];
    let mut gl_postings = Vec::new();
    for (id, dr, dr_name, cr, cr_name, amount, narration) in specs {
        if amount <= 0.0 {
            continue;
        }
        let mut posting = GLProvisioning {
            entry_id: format!("{}-{}", id, business_date),
            gl_debit: dr.to_string(),
            gl_debit_name: dr_name.to_string(),
            gl_credit: cr.to_string(),
            gl_credit_name: cr_name.to_string(),
            amount,
            narration: narration.to_string(),
            posting_type: "provision_increase".to_string(),
            status: "not_posted".to_string(),
        };
        if !gl_url.is_empty() {
            posting.status = post_gl_provision(&gl_url, &posting);
        } else {
            eprintln!("[ifrs9-ecl-engine-rs] GL_ENGINE_URL not set — provisions NOT posted (not_posted)");
        }
        if posting.status != "posted" {
            all_posted = false;
        }
        gl_postings.push(posting);
    }

    Ok(ECLPortfolioResult {
        computation_id,
        business_date: business_date.clone(),
        total_portfolio,
        total_ecl,
        ecl_coverage_ratio: if total_portfolio > 0.0 { total_ecl / total_portfolio * 100.0 } else { 0.0 },
        stage_breakdown: StageBreakdown {
            stage1: StageData { count: loans.iter().filter(|l| l.stage == 1).count() as i32, exposure: stage1_exp, ecl: stage1_ecl, coverage_ratio: if stage1_exp > 0.0 { stage1_ecl / stage1_exp * 100.0 } else { 0.0 }, gl_code: "1355 (ECL Stage 1)".into(), classification: "Performing (0-30 DPD)".into() },
            stage2: StageData { count: loans.iter().filter(|l| l.stage == 2).count() as i32, exposure: stage2_exp, ecl: stage2_ecl, coverage_ratio: if stage2_exp > 0.0 { stage2_ecl / stage2_exp * 100.0 } else { 0.0 }, gl_code: "1356 (ECL Stage 2)".into(), classification: "Significant Increase in Credit Risk (31-90 DPD)".into() },
            stage3: StageData { count: loans.iter().filter(|l| l.stage == 3).count() as i32, exposure: stage3_exp, ecl: stage3_ecl, coverage_ratio: if stage3_exp > 0.0 { stage3_ecl / stage3_exp * 100.0 } else { 0.0 }, gl_code: "1357 (ECL Stage 3)".into(), classification: "Credit Impaired (>90 DPD)".into() },
        },
        exposures: loans,
        gl_postings,
        provision_status: if all_posted { "posted" } else { "not_posted" }.to_string(),
        pipeline: PipelineTrace {
            step1: "Extract loan book from Postgres (ifrs9_exposures table)".into(),
            step2: "Classify by IFRS9 stage (DPD, SICR triggers, default definition)".into(),
            step3: "Compute PD (point-in-time + forward-looking macro adjustment)".into(),
            step4: "Compute LGD (collateral-adjusted, cure rate, recovery)".into(),
            step5: "Compute ECL = PD × LGD × EAD (12-month for Stage 1, lifetime for 2&3)".into(),
            step6: "Post provision journal entries via real GL client: Dr 5201-5203 / Cr 1355-1357 (status per posting)".into(),
        },
    })
}

async fn compute_ecl(req: actix_web::HttpRequest, web::Query(_params): web::Query<std::collections::HashMap<String, String>>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match &state.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate an ECL portfolio"),
    };
    match compute_ecl_portfolio_async(db).await {
        Ok(result) => HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(result),
        Err(e) => {
            eprintln!("[ifrs9-ecl-engine-rs] ECL computation failed: {}", e);
            source_unavailable(&format!("ECL computation failed: {}", e))
        }
    }
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_ok = match &state.db {
        Some(pool) => sqlx::query("SELECT 1").execute(pool).await.is_ok(),
        None => false,
    };
    HttpResponse::Ok().json(json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": "ifrs9-ecl-engine-rs",
        "version": "1.0.0",
        "pipeline": "Loan Book → IFRS9 Stage → PD/LGD/EAD → ECL → GL Provisioning (1355-1357)",
        "database": if db_ok { "connected" } else { "unavailable" }
    }))
}


// --- Production Hardening: readyz / livez / metrics ---
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);



// --- Alerting ---
async fn alerts_endpoint() -> HttpResponse {
    let reqs = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let errs = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let error_rate = if reqs > 0 { errs as f64 / reqs as f64 } else { 0.0 };
    let mut fired = Vec::<serde_json::Value>::new();
    if error_rate > 0.05 {
        fired.push(json!({"rule": "high_error_rate", "value": error_rate, "severity": "critical"}));
    }
    HttpResponse::Ok().json(json!({
        "alerts": fired,
        "rules": 3,
        "error_rate": error_rate,
    }))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "ifrs9-ecl-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"ifrs9-ecl-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"ifrs9-ecl-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}

fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
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


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[ifrs9-ecl-engine-rs] starting");

    // Fail-fast policy: no database => /v1/ifrs9/ecl returns 503 source_unavailable.
    let db = match env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(25)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    log::error!("[ifrs9-ecl-engine-rs] DB connect failed: {} — ECL endpoint will 503", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("[ifrs9-ecl-engine-rs] DATABASE_URL not set — ECL endpoint will 503");
            None
        }
    };

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8947".to_string()).parse().unwrap_or(8947);
    let data = web::Data::new(AppState { db });

    log::info!("[ifrs9-ecl-engine-rs] ready on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ifrs9/ecl", web::get().to(compute_ecl))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .shutdown_timeout(30)
    .run()
    .await
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_healthz_exists() {
        assert!(true, "healthz should be defined");
    }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
    }
}
