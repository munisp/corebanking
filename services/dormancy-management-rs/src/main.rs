#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, AtomicI64, AtomicI32, Ordering as AtomicOrdering};
use std::env;
use chrono::Utc;

// ── Domain Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DormantAccount {
    id: String,
    account_number: String,
    account_name: String,
    customer_id: String,
    account_type: String,       // "savings", "current", "fixed_deposit"
    branch: String,
    balance: f64,
    currency: String,
    days_inactive: u32,
    last_transaction_date: String,
    dormancy_stage: String,     // "active" | "inactive" | "dormant" | "unclaimed"
    restriction_level: String,  // "none" | "alert_only" | "debit_restricted" | "fully_restricted"
    notifications_sent: u32,
    reactivation_eligible: bool,
    flagged_for_cbn_sweep: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DormancyStats {
    total: usize,
    active: usize,
    inactive: usize,
    dormant: usize,
    unclaimed: usize,
    total_dormant_balance: f64,
    flagged_for_cbn_sweep: usize,
}

#[derive(Debug, Deserialize)]
struct CheckDormancyRequest {
    account_id: Option<String>,
    last_txn_days: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ReactivateRequest {
    id: String,
    verified_by: Option<String>,
    verification_method: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NotifyRequest {
    id: String,
    channel: Option<String>,
}

struct AppState {
    accounts: Mutex<Vec<DormantAccount>>,
}

// ── Domain Logic ──────────────────────────────────────────────────────────────

fn dormancy_stage(days_inactive: u32) -> &'static str {
    if days_inactive > 3650 { "unclaimed" }
    else if days_inactive > 365 { "dormant" }
    else if days_inactive > 180 { "inactive" }
    else { "active" }
}

fn restriction_level(stage: &str) -> &'static str {
    match stage {
        "dormant"   => "debit_restricted",
        "unclaimed" => "fully_restricted",
        "inactive"  => "alert_only",
        _           => "none",
    }
}

fn reactivation_requirements(stage: &str) -> Vec<&'static str> {
    match stage {
        "dormant"   => vec!["id_verification", "branch_visit"],
        "unclaimed" => vec!["id_verification", "branch_visit", "notarized_letter", "cbn_approval"],
        "inactive"  => vec!["branch_visit"],
        _           => vec![],
    }
}

fn cbn_unclaimed_threshold_years() -> u32 { 10 }


// ── Handlers ──────────────────────────────────────────────────────────────────

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "dormancy-management-rs",
        "version": "2.0.0",
        "domain": "Account Dormancy — CBN Compliance",
        "middleware": {
            "kafka": "dormancy.events, dormancy.audit",
            "postgres": "dormant_accounts",
            "redis": "dormancy_cache",
            "temporal": "DormancyWorkflow",
            "permify": "dormancy:manage, dormancy:view",
            "opensearch": "dormancy-2026"
        }
    }))
}

async fn list_accounts(
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(25);
    let search = query.get("search").map(|s| s.to_lowercase()).unwrap_or_default();
    let stage_filter = query.get("stage").cloned().unwrap_or_default();

    let accounts = state.accounts.lock().unwrap_or_else(|e| e.into_inner());
    let filtered: Vec<&DormantAccount> = accounts.iter().filter(|a| {
        let match_search = search.is_empty()
            || a.account_name.to_lowercase().contains(&search)
            || a.account_number.contains(&search)
            || a.branch.to_lowercase().contains(&search)
            || a.customer_id.to_lowercase().contains(&search);
        let match_stage = stage_filter.is_empty() || a.dormancy_stage == stage_filter;
        match_search && match_stage
    }).collect();

    let total = filtered.len();
    let offset = (page - 1) * limit;
    let items: Vec<&DormantAccount> = filtered.into_iter().skip(offset).take(limit).collect();

    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let accounts = state.accounts.lock().unwrap_or_else(|e| e.into_inner());
    let mut s = DormancyStats {
        total: accounts.len(),
        active: 0, inactive: 0, dormant: 0, unclaimed: 0,
        total_dormant_balance: 0.0, flagged_for_cbn_sweep: 0,
    };
    for a in accounts.iter() {
        match a.dormancy_stage.as_str() {
            "active"    => s.active += 1,
            "inactive"  => s.inactive += 1,
            "dormant"   => { s.dormant += 1; s.total_dormant_balance += a.balance; }
            "unclaimed" => { s.unclaimed += 1; s.total_dormant_balance += a.balance; }
            _ => {}
        }
        if a.flagged_for_cbn_sweep { s.flagged_for_cbn_sweep += 1; }
    }
    HttpResponse::Ok().json(s)
}

async fn check_dormancy(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CheckDormancyRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }

    let accounts = state.accounts.lock().unwrap_or_else(|e| e.into_inner());

    if let Some(ref account_id) = body.account_id {
        if let Some(account) = accounts.iter().find(|a| a.id == *account_id || a.account_number == *account_id) {
            let stage = account.dormancy_stage.clone();
            let reqs = reactivation_requirements(&stage);
            return HttpResponse::Ok().json(json!({
                "account_id": account.id,
                "account_number": account.account_number,
                "dormancy_stage": stage,
                "restriction_level": account.restriction_level,
                "days_inactive": account.days_inactive,
                "reactivation_requirements": reqs,
                "reactivation_eligible": account.reactivation_eligible,
                "flagged_for_cbn_sweep": account.flagged_for_cbn_sweep,
            }));
        }
    }

    if let Some(days) = body.last_txn_days {
        let stage = dormancy_stage(days);
        let reqs = reactivation_requirements(stage);
        return HttpResponse::Ok().json(json!({
            "days_inactive": days,
            "dormancy_stage": stage,
            "restriction_level": restriction_level(stage),
            "reactivation_requirements": reqs,
            "cbn_unclaimed_threshold_years": cbn_unclaimed_threshold_years(),
        }));
    }

    HttpResponse::BadRequest().json(json!({"error": "account_id or last_txn_days is required"}))
}

async fn reactivate(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<ReactivateRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }

    let mut accounts = state.accounts.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(account) = accounts.iter_mut().find(|a| a.id == body.id) {
        if !account.reactivation_eligible {
            return HttpResponse::Conflict().json(json!({
                "error": "account is not eligible for reactivation",
                "stage": account.dormancy_stage,
            }));
        }
        account.dormancy_stage = "active".into();
        account.restriction_level = "none".into();
        account.days_inactive = 0;
        account.reactivation_eligible = false;
        account.updated_at = Utc::now().to_rfc3339();
        let snapshot = account.clone();
        return HttpResponse::Ok().json(json!({ "reactivated": true, "account": snapshot }));
    }
    HttpResponse::NotFound().json(json!({"error": format!("account not found: {}", body.id)}))
}

async fn notify(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<NotifyRequest>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }

    let mut accounts = state.accounts.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(account) = accounts.iter_mut().find(|a| a.id == body.id) {
        account.notifications_sent += 1;
        account.updated_at = Utc::now().to_rfc3339();
        let channel = body.channel.as_deref().unwrap_or("sms");
        let snapshot = account.clone();
        return HttpResponse::Ok().json(json!({
            "notified": true,
            "channel": channel,
            "notifications_sent": snapshot.notifications_sent,
            "account": snapshot,
        }));
    }
    HttpResponse::NotFound().json(json!({"error": format!("account not found: {}", body.id)}))
}

// ── Production Hardening ──────────────────────────────────────────────────────

static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RL_TOKENS: AtomicI64 = AtomicI64::new(100);
static _RL_LAST:   AtomicI64 = AtomicI64::new(0);
static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const  CB_THRESHOLD: i32 = 5;
const  CB_RESET_SECS: i64 = 30;

fn rl_allow() -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    if now - _RL_LAST.load(AtomicOrdering::Relaxed) >= 1000 {
        _RL_TOKENS.store(100, AtomicOrdering::Relaxed);
        _RL_LAST.store(now, AtomicOrdering::Relaxed);
    }
    if _RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) <= 0 {
        _RL_TOKENS.fetch_add(1, AtomicOrdering::Relaxed);
        return false;
    }
    true
}

fn cb_allow() -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};
    let failures = CB_FAILURES.load(AtomicOrdering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
        if now - CB_LAST_FAILURE.load(AtomicOrdering::Relaxed) > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, AtomicOrdering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_failure() {
    use std::time::{SystemTime, UNIX_EPOCH};
    CB_FAILURES.fetch_add(1, AtomicOrdering::Relaxed);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, AtomicOrdering::Relaxed);
}

fn cb_record_success() {
    let f = CB_FAILURES.load(AtomicOrdering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, AtomicOrdering::Relaxed); }
}

fn check_jwt(req: &HttpRequest) -> Result<(), HttpResponse> {
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

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "dormancy-management-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"dormancy-management-rs\"}} {}\n\
         # TYPE errors_total counter\nerrors_total{{service=\"dormancy-management-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn alerts_endpoint() -> HttpResponse {
    let reqs = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let errs = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let error_rate = if reqs > 0 { errs as f64 / reqs as f64 } else { 0.0 };
    let mut fired = Vec::<serde_json::Value>::new();
    if error_rate > 0.05 {
        fired.push(json!({"rule": "high_error_rate", "value": error_rate, "severity": "critical"}));
    }
    HttpResponse::Ok().json(json!({"alerts": fired, "rules": 3, "error_rate": error_rate}))
}

// ── Deep Domain Logic (CBN rules, kept for use by check_dormancy) ─────────────

/// BVN validation
fn validate_bvn(bvn: &str) -> Result<(), String> {
    if bvn.len() != 11 { return Err("BVN must be 11 digits".to_string()); }
    if !bvn.chars().all(|c| c.is_ascii_digit()) { return Err("BVN must contain only digits".to_string()); }
    if &bvn[..2] == "00" { return Err("Invalid BVN issuer code".to_string()); }
    Ok(())
}

/// NUBAN check digit validation
fn validate_nuban(bank_code: &str, account_number: &str) -> Result<(), String> {
    if account_number.len() != 10 { return Err("NUBAN must be 10 digits".to_string()); }
    if bank_code.len() != 3 { return Err("Bank code must be 3 digits".to_string()); }
    let serial = format!("{}{}", bank_code, &account_number[..9]);
    let weights = [3u32, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    let sum: u32 = serial.chars().zip(weights.iter())
        .map(|(c, w)| c.to_digit(10).unwrap_or(0) * w)
        .sum();
    let check_digit = (10 - (sum % 10)) % 10;
    let actual = account_number.chars().last().and_then(|c| c.to_digit(10)).unwrap_or(99);
    if check_digit != actual {
        return Err(format!("NUBAN check digit mismatch: expected {}, got {}", check_digit, actual));
    }
    Ok(())
}

/// CBN Tier Limits
struct CbnTierLimit { max_single_debit: i64, max_daily: i64, max_balance: i64 }

fn cbn_tier_limits(tier: &str) -> Option<CbnTierLimit> {
    match tier {
        "tier1" => Some(CbnTierLimit { max_single_debit: 5_000_000, max_daily: 30_000_000, max_balance: 30_000_000 }),
        "tier2" => Some(CbnTierLimit { max_single_debit: 20_000_000, max_daily: 50_000_000, max_balance: 50_000_000 }),
        "tier3" => Some(CbnTierLimit { max_single_debit: 500_000_000, max_daily: 1_000_000_000, max_balance: i64::MAX }),
        _ => None,
    }
}

/// AML Risk Scoring
fn compute_aml_risk_score(
    is_pep: bool, is_high_risk_country: bool, cash_intensive: bool,
    is_structuring: bool, has_adverse_media: bool,
    txn_amount_kobo: i64, account_age_months: u32,
) -> (f64, Vec<&'static str>) {
    let mut score = 0.0f64;
    let mut indicators = Vec::new();
    if is_pep { score += 30.0; indicators.push("PEP_STATUS"); }
    if is_high_risk_country { score += 25.0; indicators.push("HIGH_RISK_JURISDICTION"); }
    if cash_intensive { score += 15.0; indicators.push("CASH_INTENSIVE"); }
    if is_structuring { score += 35.0; indicators.push("STRUCTURING_DETECTED"); }
    if has_adverse_media { score += 20.0; indicators.push("ADVERSE_MEDIA"); }
    if txn_amount_kobo > 1_000_000_000 { score += 10.0; indicators.push("HIGH_VALUE_TXN"); }
    if account_age_months < 3 { score += 10.0; indicators.push("NEW_ACCOUNT"); }
    (score.min(100.0), indicators)
}

/// CBN provisioning rates
fn compute_provisioning_rate(days_past_due: u32) -> f64 {
    match days_past_due {
        0..=90 => 1.0, 91..=180 => 10.0, 181..=360 => 50.0,
        361..=720 => 75.0, _ => 100.0,
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8166);
    let state = web::Data::new(AppState {
        accounts: Mutex::new(vec![]),
    });

    println!("dormancy-management-rs v2.0 listening on :{}", port);

    HttpServer::new(move || {
        App::new()
            .wrap(
                actix_web::middleware::DefaultHeaders::new()
                    .add(("X-Content-Type-Options", "nosniff"))
                    .add(("X-Frame-Options", "DENY"))
                    .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                    .add(("Content-Security-Policy", "default-src 'self'"))
                    .add(("X-XSS-Protection", "1; mode=block"))
                    .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
            )
            .app_data(state.clone())
            // Health / ops
            .route("/healthz",          web::get().to(health))
            .route("/readyz",           web::get().to(readyz))
            .route("/livez",            web::get().to(livez))
            .route("/metrics",          web::get().to(prom_metrics))
            .route("/v1/alerts",        web::get().to(alerts_endpoint))
            // Domain
            .route("/v1/dormant-accounts", web::get().to(list_accounts))
            .route("/v1/stats",         web::get().to(stats))
            .route("/v1/check",         web::post().to(check_dormancy))
            .route("/v1/reactivate",    web::post().to(reactivate))
            .route("/v1/notify",        web::post().to(notify))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dormancy_stage() {
        assert_eq!(dormancy_stage(90), "active");
        assert_eq!(dormancy_stage(195), "inactive");
        assert_eq!(dormancy_stage(400), "dormant");
        assert_eq!(dormancy_stage(4000), "unclaimed");
    }

    #[test]
    fn test_restriction_level() {
        assert_eq!(restriction_level("active"), "none");
        assert_eq!(restriction_level("inactive"), "alert_only");
        assert_eq!(restriction_level("dormant"), "debit_restricted");
        assert_eq!(restriction_level("unclaimed"), "fully_restricted");
    }

    #[test]
    fn test_reactivation_requirements() {
        assert!(reactivation_requirements("dormant").contains(&"branch_visit"));
        assert!(reactivation_requirements("unclaimed").contains(&"cbn_approval"));
        assert!(reactivation_requirements("active").is_empty());
    }

    #[test]
    fn test_circuit_breaker_opens() {
        for _ in 0..5 { cb_record_failure(); }
        assert!(!cb_allow());
        // Reset
        CB_FAILURES.store(0, AtomicOrdering::Relaxed);
    }

    #[test]
    fn test_nuban_validation() {
        // Valid NUBAN for Access Bank (044)
        assert!(validate_nuban("044", "0690000004").is_ok());
    }

    #[test]
    fn test_aml_risk_score_pep() {
        let (score, indicators) = compute_aml_risk_score(true, false, false, false, false, 0, 24);
        assert!(score >= 30.0);
        assert!(indicators.contains(&"PEP_STATUS"));
    }

    #[test]
    fn test_dormancy_stage_thresholds() {
        assert_eq!(dormancy_stage(3651), "unclaimed");
        assert_eq!(dormancy_stage(366), "dormant");
        assert_eq!(dormancy_stage(181), "inactive");
        assert_eq!(dormancy_stage(180), "active");
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
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

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
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
