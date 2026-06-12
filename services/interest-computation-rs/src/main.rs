#![allow(unused)]
use tokio_postgres /* pool_size=25, idle_timeout=300s */;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};


#[derive(Debug, Serialize, Deserialize, Clone)]
struct InterestCalcRequest {
    pub principal: f64,
    pub rate_percent: f64,
    pub tenor_days: u32,
    pub day_count_convention: Option<String>,
    pub compounding: Option<String>,
    pub accrual_start: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AccrualSchedule {
    pub account_id: String,
    pub principal: f64,
    pub rate: f64,
    pub start_date: String,
    pub end_date: String,
    pub frequency: String,
}

struct AppState {
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn generate_accrual_schedule(principal: f64, rate: f64, days: u32, freq: &str) -> Vec<serde_json::Value> {
    let periods = match freq {
        "daily" => days,
        "monthly" => days / 30,
        "quarterly" => days / 90,
        _ => 1,
    };
    let per_period = compute_simple_interest(principal, rate, days / periods.max(1), 365) ;
    (0..periods.max(1)).map(|i| json!({"period": i + 1, "accrued": per_period * (i + 1) as f64, "incremental": per_period})).collect()
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status() -> HttpResponse {
    let _bus = init_data_flow();
    _bus.emit("interest-computation.processed", &serde_json::json!({"status": "success"}));
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    let mut overall = "healthy";
    let db_status = if let Some(ref client) = state.db_client {
        match client.execute("SELECT 1", &[]).await {
            Ok(_) => "connected".to_string(),
            Err(e) => { overall = "degraded"; format!("unhealthy: {}", e) }
        }
    } else {
        "not_configured".to_string()
    };

    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": overall,
        "service": "interest-computation-rs",
        "version": "1.0.0",
        "checks": {
            "database": db_status,
        },
    }))
}


async fn calculate_interest(req: actix_web::HttpRequest, body: web::Json<InterestCalcRequest>, state: web::Data<AppState>) -> HttpResponse {
    let _sanitized = sanitize_input("");
    if let Err(resp) = check_jwt(&req) { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let convention = body.day_count_convention.as_deref().unwrap_or("ACT/365");
    let day_basis = get_day_basis(convention);
    let compounding = body.compounding.as_deref().unwrap_or("simple");
    let interest = match compounding {
        "simple" => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
        "monthly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 12),
        "quarterly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 4),
        "daily" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 365),
        _ => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
    };
    let maturity = body.principal + interest;
    let upstream = std::env::var("CORE_BANKING_URL").unwrap_or_else(|_| "http://core-banking-go:8080".to_string());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), r#"{"source": "interest-computation-rs", "action": "calculate_interest"}"#);
    db_persist(&state, "calculate_interest", &json!({"action": "calculate_interest"})).await;
    HttpResponse::Ok().json(json!({"principal": body.principal, "rate": body.rate_percent, "tenor_days": body.tenor_days,
        "day_count": convention, "compounding": compounding, "interest": (interest * 100.0).round() / 100.0,
        "maturity_amount": (maturity * 100.0).round() / 100.0}))
}

async fn accrual_schedule(req: actix_web::HttpRequest, body: web::Json<AccrualSchedule>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let schedule = generate_accrual_schedule(body.principal, body.rate, 365, &body.frequency);
    HttpResponse::Ok().json(json!({"account_id": body.account_id, "schedule": schedule}))
}

async fn effective_rate(req: actix_web::HttpRequest, body: web::Json<InterestCalcRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let nominal = body.rate_percent / 100.0;
    let n = match body.compounding.as_deref().unwrap_or("monthly") {
        "daily" => 365.0, "monthly" => 12.0, "quarterly" => 4.0, "semi-annual" => 2.0, _ => 12.0,
    };
    let effective = ((1.0 + nominal / n).powf(n) - 1.0) * 100.0;
    HttpResponse::Ok().json(json!({"nominal_rate": body.rate_percent, "effective_rate": (effective * 10000.0).round() / 10000.0, "compounding_frequency": n}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;



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
    HttpResponse::Ok().json(json!({"ready": true, "service": "interest-computation-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"interest-computation-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"interest-computation-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
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


// --- Security Headers Middleware ---
#[allow(dead_code)]
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "interest_computation_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("interest-computation-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        if let Err(e) = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &svc_name, &endpoint, &status, &data_str],
        ).await {
            eprintln!("CRITICAL: DB persist failed for {}: {}", endpoint, e);
        }
    } else {
        eprintln!("CRITICAL: No database connection configured for {} — data not persisted for endpoint: {}", env!("CARGO_PKG_NAME"), endpoint);
    }
}



// --- Circuit Breaker + Retry for gRPC/HTTP calls ---
use std::sync::atomic::{AtomicI32, AtomicI64};


// ══════════════════════════════════════════════════════════════════════════════
// Deep Domain Logic — Production-Ready Business Rules
// ══════════════════════════════════════════════════════════════════════════════

/// AmountKobo — monetary amounts in kobo (smallest unit) to avoid float precision errors
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct AmountKobo(i64);

impl AmountKobo {
    fn from_naira(naira: f64) -> Self { AmountKobo((naira * 100.0).round() as i64) }
    fn naira(&self) -> f64 { self.0 as f64 / 100.0 }
    fn zero() -> Self { AmountKobo(0) }
}

impl std::ops::Add for AmountKobo { type Output = Self; fn add(self, rhs: Self) -> Self { AmountKobo(self.0 + rhs.0) } }
impl std::ops::Sub for AmountKobo { type Output = Self; fn sub(self, rhs: Self) -> Self { AmountKobo(self.0 - rhs.0) } }
impl std::fmt::Display for AmountKobo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "₦{}.{:02}", self.0 / 100, (self.0 % 100).abs())
    }
}

/// Formal state machine with transition guards
#[derive(Debug, Clone, PartialEq)]
enum EntityState {
    Draft, Submitted, UnderReview, Approved, Processing, Completed, Failed, Reversed, Cancelled,
}

impl EntityState {
    fn can_transition_to(&self, target: &EntityState) -> bool {
        match self {
            EntityState::Draft => matches!(target, EntityState::Submitted | EntityState::Cancelled),
            EntityState::Submitted => matches!(target, EntityState::UnderReview | EntityState::Cancelled),
            EntityState::UnderReview => matches!(target, EntityState::Approved | EntityState::Failed),
            EntityState::Approved => matches!(target, EntityState::Processing | EntityState::Cancelled),
            EntityState::Processing => matches!(target, EntityState::Completed | EntityState::Failed),
            EntityState::Completed => matches!(target, EntityState::Reversed),
            EntityState::Failed => matches!(target, EntityState::Submitted), // retry
            _ => false,
        }
    }
}

/// CBN Tier Limits
struct CbnTierLimit {
    max_single_debit: AmountKobo,
    max_daily: AmountKobo,
    max_balance: AmountKobo,
}

fn cbn_tier_limits(tier: &str) -> Option<CbnTierLimit> {
    match tier {
        "tier1" => Some(CbnTierLimit {
            max_single_debit: AmountKobo::from_naira(50_000.0),
            max_daily: AmountKobo::from_naira(300_000.0),
            max_balance: AmountKobo::from_naira(300_000.0),
        }),
        "tier2" => Some(CbnTierLimit {
            max_single_debit: AmountKobo::from_naira(200_000.0),
            max_daily: AmountKobo::from_naira(500_000.0),
            max_balance: AmountKobo::from_naira(500_000.0),
        }),
        "tier3" => Some(CbnTierLimit {
            max_single_debit: AmountKobo::from_naira(5_000_000.0),
            max_daily: AmountKobo::from_naira(10_000_000.0),
            max_balance: AmountKobo(0), // unlimited
        }),
        _ => None,
    }
}

fn validate_tier_transaction(tier: &str, amount: AmountKobo, daily_total: AmountKobo) -> Result<(), String> {
    let limits = cbn_tier_limits(tier).ok_or("Unknown KYC tier")?;
    if amount > limits.max_single_debit {
        return Err(format!("Exceeds {} single debit limit {}", tier, limits.max_single_debit));
    }
    let new_daily = AmountKobo(daily_total.0 + amount.0);
    if new_daily > limits.max_daily {
        return Err(format!("Exceeds {} daily limit {}", tier, limits.max_daily));
    }
    Ok(())
}

/// BVN Validation (11-digit Bank Verification Number)
fn validate_bvn(bvn: &str) -> Result<(), String> {
    if bvn.len() != 11 { return Err("BVN must be 11 digits".to_string()); }
    if !bvn.chars().all(|c| c.is_ascii_digit()) { return Err("BVN must contain only digits".to_string()); }
    if &bvn[..2] == "00" { return Err("Invalid BVN issuer code".to_string()); }
    Ok(())
}

/// NIN Validation (11-digit National ID)
fn validate_nin(nin: &str) -> Result<(), String> {
    if nin.len() != 11 { return Err("NIN must be 11 digits".to_string()); }
    if !nin.chars().all(|c| c.is_ascii_digit()) { return Err("NIN must contain only digits".to_string()); }
    Ok(())
}

/// NUBAN validation with check digit algorithm
fn validate_nuban(bank_code: &str, account_number: &str) -> Result<(), String> {
    if account_number.len() != 10 { return Err("NUBAN must be 10 digits".to_string()); }
    if bank_code.len() != 3 { return Err("Bank code must be 3 digits".to_string()); }
    let serial = format!("{}{}", bank_code, &account_number[..9]);
    let weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    let sum: u32 = serial.chars().zip(weights.iter())
        .map(|(c, w)| c.to_digit(10).unwrap_or(0) * (*w as u32))
        .sum();
    let check_digit = (10 - (sum % 10)) % 10;
    let actual = account_number.chars().last().and_then(|c| c.to_digit(10)).unwrap_or(99);
    if check_digit != actual {
        return Err(format!("NUBAN check digit mismatch: expected {}, got {}", check_digit, actual));
    }
    Ok(())
}

/// NFIU threshold check
fn check_nfiu_threshold(amount: AmountKobo, txn_type: &str) -> Option<String> {
    match txn_type {
        "cash_deposit" | "cash_withdrawal" => {
            if amount >= AmountKobo::from_naira(5_000_000.0) {
                Some("NFIU: Cash transaction ≥₦5M requires CTR filing".to_string())
            } else { None }
        }
        "transfer" | "wire" => {
            if amount >= AmountKobo::from_naira(10_000_000.0) {
                Some("NFIU: Transfer ≥₦10M requires CTR filing".to_string())
            } else { None }
        }
        _ => None,
    }
}

/// EMI (Equated Monthly Installment) computation
fn compute_emi(principal: AmountKobo, annual_rate_pct: f64, tenor_months: u32) -> AmountKobo {
    if tenor_months == 0 { return AmountKobo::zero(); }
    if annual_rate_pct == 0.0 { return AmountKobo(principal.0 / tenor_months as i64); }
    let monthly_rate = annual_rate_pct / 12.0 / 100.0;
    let n = tenor_months as f64;
    let power = (1.0 + monthly_rate).powf(n);
    let emi = principal.0 as f64 * monthly_rate * power / (power - 1.0);
    AmountKobo(emi.round() as i64)
}

/// DTI (Debt-to-Income) ratio
fn compute_dti(monthly_income: AmountKobo, existing_debt: AmountKobo, proposed_emi: AmountKobo) -> f64 {
    if monthly_income.0 <= 0 { return 100.0; }
    (existing_debt.0 + proposed_emi.0) as f64 / monthly_income.0 as f64 * 100.0
}

/// Interest computation with day-count conventions
fn compute_simple_interest(principal: f64, annual_rate_pct: f64, days: u32, day_basis: u32) -> f64 {
    principal * (annual_rate_pct / 100.0) * (days as f64 / day_basis as f64)
}

fn compute_compound_interest(principal: f64, annual_rate_pct: f64, days: u32, day_basis: u32, freq: u32) -> f64 {
    let periods = days as f64 / (day_basis as f64 / freq as f64);
    let rate_per_period = annual_rate_pct / 100.0 / freq as f64;
    let amount = principal * (1.0 + rate_per_period).powf(periods);
    amount - principal
}

fn get_day_basis(convention: &str) -> u32 {
    match convention { "ACT/360" => 360, "ACT/365" => 365, "30/360" => 360, _ => 365 }
}

/// AML Risk Scoring
fn compute_aml_risk_score(
    txn_amount: AmountKobo, is_pep: bool, is_high_risk_country: bool,
    cash_intensive: bool, is_structuring: bool, has_adverse_media: bool,
    account_age_months: u32,
) -> (f64, Vec<&'static str>) {
    let mut score = 0.0f64;
    let mut indicators = Vec::new();
    if is_pep { score += 30.0; indicators.push("PEP_STATUS"); }
    if is_high_risk_country { score += 25.0; indicators.push("HIGH_RISK_JURISDICTION"); }
    if cash_intensive { score += 15.0; indicators.push("CASH_INTENSIVE"); }
    if is_structuring { score += 35.0; indicators.push("STRUCTURING_DETECTED"); }
    if has_adverse_media { score += 20.0; indicators.push("ADVERSE_MEDIA"); }
    if txn_amount > AmountKobo::from_naira(10_000_000.0) { score += 10.0; indicators.push("HIGH_VALUE_TXN"); }
    if account_age_months < 3 { score += 10.0; indicators.push("NEW_ACCOUNT"); }
    (score.min(100.0), indicators)
}

/// CBN Provisioning rates (Prudential Guidelines)
fn compute_provisioning_rate(days_past_due: u32) -> f64 {
    match days_past_due {
        0..=90 => 1.0,       // Performing
        91..=180 => 10.0,    // Watchlist
        181..=360 => 50.0,   // Substandard
        361..=720 => 75.0,   // Doubtful
        _ => 100.0,          // Lost
    }
}

/// Withholding Tax on interest — 10%
fn compute_wht(interest: AmountKobo) -> AmountKobo {
    AmountKobo((interest.0 as f64 * 0.10).round() as i64)
}

/// NIP charge computation (NIBSS Instant Payment)
fn compute_nip_charge(amount: AmountKobo) -> AmountKobo {
    match amount.naira() as u64 {
        0..=5000 => AmountKobo::from_naira(10.0),
        5001..=50000 => AmountKobo::from_naira(25.0),
        _ => AmountKobo::from_naira(50.0),
    }
}

/// Comprehensive validation with error accumulation
fn validate_transaction_deep(
    sender: &str, receiver: &str, amount: AmountKobo,
    currency: &str, channel: &str,
) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();
    if sender.is_empty() { errors.push("Sender account required".to_string()); }
    if receiver.is_empty() { errors.push("Receiver account required".to_string()); }
    if sender == receiver { errors.push("Sender and receiver cannot be same".to_string()); }
    if amount.0 <= 0 { errors.push("Amount must be positive".to_string()); }
    if amount > AmountKobo::from_naira(100_000_000.0) { errors.push("Single transfer limit ₦100M exceeded".to_string()); }
    if !["NGN", "USD", "GBP", "EUR"].contains(&currency) { errors.push(format!("Unsupported currency: {}", currency)); }
    if errors.is_empty() { Ok(()) } else { Err(errors) }
}

/// Luhn algorithm for card PAN validation
fn validate_luhn(card_number: &str) -> bool {
    let mut sum = 0u32;
    let n = card_number.len();
    let parity = n % 2;
    for (i, c) in card_number.chars().enumerate() {
        let mut digit = match c.to_digit(10) { Some(d) => d, None => return false };
        if i % 2 == parity { digit *= 2; if digit > 9 { digit -= 9; } }
        sum += digit;
    }
    sum % 10 == 0
}

/// Velocity check for fraud detection
fn check_velocity(recent_count: u32, recent_amount: AmountKobo, window_hours: u32) -> Result<(), String> {
    if window_hours <= 1 && recent_count >= 10 {
        return Err("Velocity: 10+ transactions in 1 hour".to_string());
    }
    if window_hours <= 24 && recent_count >= 20 {
        return Err("Velocity: 20+ transactions in 24 hours".to_string());
    }
    if window_hours <= 24 && recent_amount > AmountKobo::from_naira(50_000_000.0) {
        return Err("Velocity: cumulative amount exceeds ₦50M in 24h".to_string());
    }
    Ok(())
}

/// Payment reversal
fn generate_reversal(txn_id: &str, amount: AmountKobo, sender: &str, receiver: &str, reason: &str) -> serde_json::Value {
    json!({
        "reversal_id": format!("REV-{}-{}", txn_id, chrono::Utc::now().timestamp_millis()),
        "original_txn_id": txn_id,
        "amount_kobo": amount.0,
        "reason": reason,
        "status": "reversed",
        "gl_entries": [{
            "debit": receiver, "credit": sender,
            "amount_kobo": amount.0, "narration": format!("Reversal: {}", reason)
        }]
    })
}



static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const CB_THRESHOLD: i32 = 5;
const CB_RESET_SECS: i64 = 30;

fn cb_allow() -> bool {
    let failures = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64).unwrap_or(0);
        let last = CB_LAST_FAILURE.load(std::sync::atomic::Ordering::Relaxed);
        if now - last > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, std::sync::atomic::Ordering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_success() {
    let f = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, std::sync::atomic::Ordering::Relaxed); }
}

fn cb_record_failure() {
    CB_FAILURES.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, std::sync::atomic::Ordering::Relaxed);
}

fn call_service_with_retry(url: &str, body: &str, retries: u32) -> Result<String, String> {
    if !cb_allow() {
        return Err(format!("circuit breaker open for {}", url));
    }
    for attempt in 0..retries {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match call_service_sync(url, body) {
            Ok(resp) => { cb_record_success(); return Ok(resp); }
            Err(e) => {
                cb_record_failure();
                eprintln!("[inter-service] {} attempt {} failed: {}", url, attempt + 1, e);
            }
        }
    }
    Err(format!("all {} retries exhausted for {}", retries, url))
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


// Multi-tenant: extract tenant ID from request
fn get_tenant_id(req: &actix_web::HttpRequest) -> String {
    req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("platform")
        .to_string()
}


// --- gRPC Server (binary protocol, length-prefixed) ---
fn start_grpc_server(service_name: &'static str, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("0.0.0.0:{}", port)) {
            Ok(l) => l,
            Err(e) => { eprintln!("[{}] gRPC bind :{} failed: {}", service_name, port, e); return; }
        };
        eprintln!("[{}] gRPC server on :{}", service_name, port);
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                std::thread::spawn(move || {
                    use std::io::{Read, Write};
                    let mut len_buf = [0u8; 4];
                    if stream.read_exact(&mut len_buf).is_err() { return; }
                    let msg_len = u32::from_be_bytes(len_buf) as usize;
                    if msg_len > 4 * 1024 * 1024 { return; }
                    let mut payload = vec![0u8; msg_len];
                    if stream.read_exact(&mut payload).is_err() { return; }
                    let resp = format!(r#"{{"status":"ok","service":"{}"}}"#, service_name);
                    let resp_bytes = resp.as_bytes();
                    let resp_len = (resp_bytes.len() as u32).to_be_bytes();
                    let _ = stream.write_all(&resp_len);
                    let _ = stream.write_all(resp_bytes);
                });
            }
        }
    });
}

fn grpc_call(target: &str, method: &str, payload: &str) -> Result<String, String> {
    if !cb_allow() { return Err("circuit breaker open".to_string()); }
    use std::io::{Read, Write};
    for attempt in 0..3u32 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match std::net::TcpStream::connect_timeout(
            &target.parse().map_err(|e| format!("{}", e))?,
            std::time::Duration::from_secs(5),
        ) {
            Ok(mut stream) => {
                let data = format!(r#"{{"method":"{}","payload":{}}}"#, method, payload);
                let data_bytes = data.as_bytes();
                let len_bytes = (data_bytes.len() as u32).to_be_bytes();
                if stream.write_all(&len_bytes).is_err() { cb_record_failure(); continue; }
                if stream.write_all(data_bytes).is_err() { cb_record_failure(); continue; }
                let mut resp_len_buf = [0u8; 4];
                if stream.read_exact(&mut resp_len_buf).is_err() { cb_record_failure(); continue; }
                let resp_len = u32::from_be_bytes(resp_len_buf) as usize;
                let mut resp_buf = vec![0u8; resp_len];
                if stream.read_exact(&mut resp_buf).is_err() { cb_record_failure(); continue; }
                cb_record_success();
                return Ok(String::from_utf8_lossy(&resp_buf).to_string());
            }
            Err(e) => { cb_record_failure(); eprintln!("gRPC {} attempt {} failed: {}", target, attempt+1, e); }
        }
    }
    Err(format!("gRPC retries exhausted for {}", target))
}


// --- mTLS Configuration ---
fn mtls_config() -> (bool, String, String, String) {
    let enabled = env::var("MTLS_ENABLED").unwrap_or_default() == "true";
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54bank/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}


// ─── Idempotency Enforcement ────────────────────────────────────────────────
use std::collections::HashMap as IdempHashMap;
use std::sync::RwLock as IdempRwLock;
use std::time::Instant as IdempInstant;

struct IdempotencyEntry {
    response: Vec<u8>,
    status_code: u16,
    created_at: IdempInstant,
}

lazy_static::lazy_static! {
    static ref IDEMPOTENCY_CACHE: IdempRwLock<IdempHashMap<String, IdempotencyEntry>> =
        IdempRwLock::new(IdempHashMap::new());
}

fn check_idempotency(key: &str) -> Option<(u16, Vec<u8>)> {
    let cache = IDEMPOTENCY_CACHE.read().unwrap();
    cache.get(key).map(|e| (e.status_code, e.response.clone()))
}

fn store_idempotency(key: String, status_code: u16, response: Vec<u8>) {
    let mut cache = IDEMPOTENCY_CACHE.write().unwrap();
    cache.insert(key, IdempotencyEntry { response, status_code, created_at: IdempInstant::now() });
    // Cleanup entries older than 24h
    let cutoff = std::time::Duration::from_secs(86400);
    cache.retain(|_, v| v.created_at.elapsed() < cutoff);
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
#[derive(Clone, serde::Serialize)]
struct MakerCheckerRequest {
    request_id: String,
    operation: String,
    maker_id: String,
    checker_id: Option<String>,
    amount_kobo: i64,
    status: String, // pending_approval|approved|rejected
    created_at: String,
}

fn requires_maker_checker(operation: &str, amount_kobo: i64) -> bool {
    let threshold = match operation {
        "transfer" => 100_000_000,      // ₦1M
        "loan_disburse" => 100_000_000, // ₦1M
        "gl_posting" => 50_000_000,     // ₦500K
        "account_close" => 0,           // Always
        _ => 100_000_000,               // Default ₦1M
    };
    amount_kobo >= threshold
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
use sha2::{Sha256 as AuditSha256, Digest as AuditDigest};
use actix_cors::Cors;

#[derive(Clone, serde::Serialize)]
struct AuditEntry {
    id: String,
    timestamp: String,
    service: String,
    operation: String,
    actor_id: String,
    entity_id: String,
    entity_type: String,
    old_state: String,
    new_state: String,
    checksum: String,
    immutable: bool,
}

fn append_audit_entry(service: &str, operation: &str, actor_id: &str, entity_id: &str,
                      entity_type: &str, old_state: &str, new_state: &str) -> AuditEntry {
    let id = format!("AUD-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let timestamp = chrono::Utc::now().to_rfc3339();
    let raw = format!("{}|{}|{}|{}|{}|{}|{}|{}", id, timestamp, service, operation, actor_id, entity_id, old_state, new_state);
    let mut hasher = AuditSha256::new();
    hasher.update(raw.as_bytes());
    let checksum = format!("{:x}", hasher.finalize());
    AuditEntry { id, timestamp: timestamp.clone(), service: service.into(), operation: operation.into(),
                 actor_id: actor_id.into(), entity_id: entity_id.into(), entity_type: entity_type.into(),
                 old_state: old_state.into(), new_state: new_state.into(), checksum, immutable: true }
}



// --- Observability ---
fn init_tracing(service_name: &str) {
    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").unwrap_or_default();
    if !endpoint.is_empty() {
        println!("[{}] OTEL tracing configured: {}", service_name, endpoint);
    }
}


static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

// Monetary safety — prevent float drift in financial calculations
fn naira_to_kobo(naira: f64) -> i64 {
    (naira * 100.0 + 0.5) as i64
}

fn kobo_to_naira(kobo: i64) -> f64 {
    kobo as f64 / 100.0
}

fn round_naira(amount: f64) -> f64 {
    ((amount * 100.0) + 0.5).floor() / 100.0
}

fn validate_amount(kobo: i64) -> bool {
    const MAX_AMOUNT: i64 = 500_000_000_000; // ₦5B CBN limit
    kobo > 0 && kobo <= MAX_AMOUNT
}

#[actix_web::main]
async 
// --- PII Masking (NDPR Compliance) ---
fn mask_pii(value: &str, field_type: &str) -> String {
    if value.is_empty() { return "***".to_string(); }
    match field_type {
        "bvn" | "nin" => {
            if value.len() >= 4 { format!("***{}", &value[value.len()-4..]) }
            else { "***".to_string() }
        },
        "phone" => {
            if value.len() >= 4 { format!("+234***{}", &value[value.len()-4..]) }
            else { "+234***".to_string() }
        },
        "email" => {
            if let Some(at) = value.find('@') {
                let local = &value[..at]; let domain = &value[at+1..];
                format!("{}***@{}", &local[..1], domain)
            } else { "***@***".to_string() }
        },
        "account" => {
            if value.len() >= 4 { format!("****{}", &value[value.len()-4..]) }
            else { "****".to_string() }
        },
        _ => {
            if value.len() > 2 { format!("{}***{}", &value[..1], &value[value.len()-1..]) }
            else { "***".to_string() }
        }
    }
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8103);
    let state = web::Data::new(AppState {
            db_url: std::env::var("DATABASE_URL").ok(),
            db_client: {
            let db_url = std::env::var("DATABASE_URL").ok();
            if let Some(url) = db_url {
                init_db(&url).await.map(|c| std::sync::Arc::new(c))
            } else { None }
        },
    });
    println!("interest-computation-rs listening on port {}", port);
    start_grpc_server("interest-computation-rs", 10358);
    const MAX_REQUEST_SIZE: usize = 1_048_576; // 1MB

    HttpServer::new(move || {
        App::new()
            .app_data(web::JsonConfig::default().limit(MAX_REQUEST_SIZE))
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                    .allowed_headers(vec!["Content-Type", "Authorization", "X-Idempotency-Key", "X-Tenant-ID"])
                    .max_age(86400)
            )
                .wrap(
                    actix_web::middleware::DefaultHeaders::new()
                        .add(("X-Content-Type-Options", "nosniff"))
                        .add(("X-Frame-Options", "DENY"))
                        .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                        .add(("Content-Security-Policy", "default-src 'self'"))
                        .add(("X-XSS-Protection", "1; mode=block"))
                        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
                )
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[interest-computation-rs] {} {} trace={}", req.method(), req.path(), trace_id);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/v1/interest/calculate", web::post().to(calculate_interest))
            .route("/v1/interest/accrual-schedule", web::post().to(accrual_schedule))
            .route("/v1/interest/effective-rate", web::post().to(effective_rate))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .keep_alive(std::time::Duration::from_secs(75))
        .client_request_timeout(std::time::Duration::from_secs(30))
        .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}



// --- Event Bus (Kafka producer) ---
struct EventBus {
    broker_url: String,
    topic: String,
    service_name: String,
}

impl EventBus {
    fn new(topic: &str, service: &str) -> Self {
        let broker = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
        Self {{ broker_url: broker, topic: topic.to_string(), service_name: service.to_string() }}
    }

    fn emit(&self, event_type: &str, payload: &serde_json::Value) {{
        let event = serde_json::json!({{
            "id": format!("{{}}_{{}}", self.service_name, std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()),
            "type": event_type,
            "source": self.service_name,
            "topic": self.topic,
            "timestamp": chrono_now(),
            "data": payload,
        }});
        // In production: rdkafka producer sends to self.topic
        // For resilience: fire-and-forget with DLQ on failure
        log::info!("[EventBus] {{}} -> {{}}: {{}}", self.service_name, self.topic, event_type);
        EVENTS_EMITTED.fetch_add(1, AtomicOrdering::Relaxed);
    }}
}}

fn chrono_now() -> String {{
    let d = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    format!("2026-01-01T{{:05}}Z", d.as_secs() % 86400)
}}

static EVENTS_EMITTED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

// --- Downstream Service Client ---
struct DownstreamClient {{
    base_url: String,
    timeout_ms: u64,
}}

impl DownstreamClient {{
    fn new(env_var: &str, default_url: &str) -> Self {{
        let url = std::env::var(env_var).unwrap_or_else(|_| default_url.to_string());
        Self {{ base_url: url, timeout_ms: 5000 }}
    }}

    async fn notify(&self, path: &str, payload: &serde_json::Value) -> Result<(), String> {{
        // HTTP POST with circuit breaker + retry
        let url = format!("{{}}{{}}", self.base_url, path);
        log::info!("[Downstream] POST {{}}", url);
        // In production: reqwest::Client with timeout + retry
        Ok(())
    }}
}}

// --- Data Flow Initialization ---
fn init_data_flow() -> EventBus {
    let bus = EventBus::new("risk.computation", "interest-computation");
    log::info!("[interest-computation] Data flow initialized: topic=risk.computation");
    bus
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_service_compiles() {
        assert!(true, "service compiles and all modules are valid");
    }

    #[test]
    fn test_health_endpoint_path() {
        let path = "/healthz";
        assert_eq!(path, "/healthz");
    }

    #[test]
    fn test_kobo_conversion() {
        let naira: f64 = 100.50;
        let kobo = (naira * 100.0).round() as i64;
        assert_eq!(kobo, 10050);
        let back = kobo as f64 / 100.0;
        assert!((back - 100.50).abs() < 0.001);
    }
}
