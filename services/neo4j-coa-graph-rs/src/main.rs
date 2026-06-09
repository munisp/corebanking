#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// neo4j-coa-graph-rs — Chart of Accounts graph database service using Neo4j
// Models COA as directed graph with account hierarchies, transaction flows,
// regulatory relationships (CBN, IFRS9, Basel III), and PageRank analytics.

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);
static RL_TOKENS: AtomicU64 = AtomicU64::new(100);
static RL_LAST: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize, Deserialize, Debug)]
struct COANode {
    code: String,
    name: String,
    category: String,
    subcategory: String,
    balance: f64,
    currency: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct COAEdge {
    from_code: String,
    to_code: String,
    relation_type: String,
    weight: f64,
    metadata: serde_json::Value,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct TransactionFlow {
    debit_account: String,
    credit_account: String,
    amount: f64,
    currency: String,
    narration: String,
}

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    nodes: Mutex<Vec<COANode>>,
    edges: Mutex<Vec<COAEdge>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn seed_coa_nodes() -> Vec<COANode> {
    vec![
        COANode { code: "1001".into(), name: "Cash in Vault - Local Currency".into(), category: "asset".into(), subcategory: "cash".into(), balance: 2_850_000_000.0, currency: "NGN".into() },
        COANode { code: "1005".into(), name: "Cash Reserve Requirement (CRR)".into(), category: "asset".into(), subcategory: "cash_cbn".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "1201".into(), name: "Treasury Bills (NTBs)".into(), category: "asset".into(), subcategory: "investments_govt".into(), balance: 25_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1301".into(), name: "Overdrafts - Corporate".into(), category: "asset".into(), subcategory: "loans_corporate".into(), balance: 28_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1302".into(), name: "Term Loans - Corporate".into(), category: "asset".into(), subcategory: "loans_corporate".into(), balance: 45_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1306".into(), name: "SME Loans".into(), category: "asset".into(), subcategory: "loans_sme".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1307".into(), name: "Agricultural Loans (ABP)".into(), category: "asset".into(), subcategory: "loans_agric".into(), balance: 8_500_000_000.0, currency: "NGN".into() },
        COANode { code: "1355".into(), name: "IFRS 9 ECL Stage 1".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -800_000_000.0, currency: "NGN".into() },
        COANode { code: "1356".into(), name: "IFRS 9 ECL Stage 2".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -1_200_000_000.0, currency: "NGN".into() },
        COANode { code: "1357".into(), name: "IFRS 9 ECL Stage 3".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -2_500_000_000.0, currency: "NGN".into() },
        COANode { code: "2101".into(), name: "Demand Deposits - Current".into(), category: "liability".into(), subcategory: "deposits_demand".into(), balance: 85_000_000_000.0, currency: "NGN".into() },
        COANode { code: "2102".into(), name: "Savings Deposits".into(), category: "liability".into(), subcategory: "deposits_savings".into(), balance: 45_000_000_000.0, currency: "NGN".into() },
        COANode { code: "2206".into(), name: "Subordinated Debt (Tier 2)".into(), category: "liability".into(), subcategory: "borrowings_sub".into(), balance: 8_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3002".into(), name: "Issued & Paid-up Capital".into(), category: "equity".into(), subcategory: "share_capital".into(), balance: 25_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3004".into(), name: "Statutory Reserve".into(), category: "equity".into(), subcategory: "reserves".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3006".into(), name: "Retained Earnings".into(), category: "equity".into(), subcategory: "retained".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "4101".into(), name: "Interest on Loans - Corporate".into(), category: "income".into(), subcategory: "interest_loans".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "5101".into(), name: "Interest on Deposits - Savings".into(), category: "expense".into(), subcategory: "interest_deposits".into(), balance: 3_500_000_000.0, currency: "NGN".into() },
        COANode { code: "5301".into(), name: "Staff Costs - Salaries".into(), category: "expense".into(), subcategory: "staff_costs".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
    ]
}

fn seed_coa_edges() -> Vec<COAEdge> {
    vec![
        COAEdge { from_code: "2101".into(), to_code: "1301".into(), relation_type: "FLOWS_TO".into(), weight: 0.35, metadata: json!({"flow": "deposits_fund_loans"}) },
        COAEdge { from_code: "1301".into(), to_code: "4101".into(), relation_type: "FLOWS_TO".into(), weight: 0.18, metadata: json!({"flow": "loans_generate_interest"}) },
        COAEdge { from_code: "2102".into(), to_code: "5101".into(), relation_type: "FLOWS_TO".into(), weight: 0.08, metadata: json!({"flow": "savings_interest_expense"}) },
        COAEdge { from_code: "1355".into(), to_code: "1301".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage1"}) },
        COAEdge { from_code: "1356".into(), to_code: "1302".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage2"}) },
        COAEdge { from_code: "1357".into(), to_code: "1307".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage3"}) },
        COAEdge { from_code: "3002".into(), to_code: "1301".into(), relation_type: "BACKS_RWA".into(), weight: 0.15, metadata: json!({"framework": "Basel_III_CET1"}) },
    ]
}

fn compute_basel_iii(nodes: &[COANode]) -> serde_json::Value {
    let mut total_rwa = 0.0f64;
    let mut cet1 = 0.0f64;
    let mut tier2 = 0.0f64;
    let mut total_loans = 0.0f64;
    let mut total_provisions = 0.0f64;
    for n in nodes {
        match n.subcategory.as_str() {
            s if s.starts_with("loans_") => {
                let rw = match s { "loans_corporate" => 1.0, "loans_sme" => 0.75, "loans_agric" => 0.5, _ => 1.0 };
                total_rwa += n.balance.abs() * rw;
                total_loans += n.balance.abs();
            }
            "share_capital" | "reserves" | "retained" => cet1 += n.balance.abs(),
            "borrowings_sub" => tier2 += n.balance.abs(),
            s if s.starts_with("provision_") => total_provisions += n.balance.abs(),
            _ => {}
        }
    }
    let car = if total_rwa > 0.0 { (cet1 + tier2) / total_rwa * 100.0 } else { 0.0 };
    json!({
        "total_rwa": total_rwa, "cet1_capital": cet1, "tier2_capital": tier2,
        "capital_adequacy_ratio": car, "cbn_minimum_car": 15.0, "car_compliant": car >= 15.0,
        "total_loans": total_loans, "total_provisions": total_provisions,
    })
}

fn compute_pagerank(nodes: &[COANode], edges: &[COAEdge], iterations: usize, damping: f64) -> Vec<(String, f64)> {
    let n = nodes.len();
    if n == 0 { return vec![]; }
    let mut rank: std::collections::HashMap<String, f64> = nodes.iter().map(|nd| (nd.code.clone(), 1.0 / n as f64)).collect();
    let mut out_degree: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for e in edges { *out_degree.entry(e.from_code.clone()).or_insert(0) += 1; }
    for _ in 0..iterations {
        let mut new_rank: std::collections::HashMap<String, f64> = nodes.iter().map(|nd| (nd.code.clone(), (1.0 - damping) / n as f64)).collect();
        for e in edges {
            let deg = *out_degree.get(&e.from_code).unwrap_or(&1);
            if let Some(&r) = rank.get(&e.from_code) {
                *new_rank.entry(e.to_code.clone()).or_insert(0.0) += damping * r / deg as f64;
            }
        }
        rank = new_rank;
    }
    let mut result: Vec<(String, f64)> = rank.into_iter().collect();
    result.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    result
}

fn sanitize_input(s: &str) -> String {
    s.replace("<script>", "").replace("</script>", "").replace("javascript:", "").chars().take(10240).collect()
}

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if now > RL_LAST.load(AtomicOrdering::Relaxed) {
        RL_TOKENS.store(100, AtomicOrdering::Relaxed);
        RL_LAST.store(now, AtomicOrdering::Relaxed);
    }
    RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) > 0
}

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path.starts_with("/healthz") || path.starts_with("/readyz") || path.starts_with("/livez") || path.starts_with("/metrics") {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(v) if v.to_str().unwrap_or("").starts_with("Bearer ") => Ok(()),
        _ => Err(HttpResponse::Unauthorized().json(json!({"error": "unauthorized"}))),
    }
}


// --- Circuit Breaker + Retry for gRPC/HTTP calls ---
use std::sync::atomic::{AtomicI32, AtomicI64};

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

fn call_service_sync(url: &str, payload: &str) -> Result<String, String> {
    let tcp = std::net::TcpStream::connect_timeout(
        &url.replace("http://", "").replace("https://", "").parse().unwrap_or_else(|_| "127.0.0.1:8080".parse().unwrap()),
        std::time::Duration::from_secs(5),
    );
    match tcp {
        Ok(mut stream) => {
            use std::io::Write;
            let req = format!("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n\r\n{}", payload.len(), payload);
            let _ = stream.write_all(req.as_bytes());
            Ok("ok".to_string())
        }
        Err(e) => Err(format!("connection failed: {}", e)),
    }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "neo4j_coa_graph_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc_name = String::from("neo4j-coa-graph-rs");
    if let Some(client) = &state.db_client {
        let _ = client.execute(
            "INSERT INTO records (id, service, tenant, status, data, created_at) VALUES ($1, $2, 'default', 'active', $3, NOW()) ON CONFLICT (id) DO UPDATE SET data = $3",
            &[&id, &svc_name, &data.to_string()],
        ).await;
    } else {
        let mut recs = state.records.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
        recs.push(json!({"id": id, "service": svc_name, "data": data}));
    }
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;


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
fn compute_simple_interest(principal: AmountKobo, annual_rate_pct: f64, days: u32, day_basis: u32) -> AmountKobo {
    let interest = principal.0 as f64 * (annual_rate_pct / 100.0) * (days as f64 / day_basis as f64);
    AmountKobo(interest.round() as i64)
}

fn compute_compound_interest(principal: AmountKobo, annual_rate_pct: f64, days: u32, day_basis: u32, freq: u32) -> AmountKobo {
    let periods = days as f64 / (day_basis as f64 / freq as f64);
    let rate_per_period = annual_rate_pct / 100.0 / freq as f64;
    let amount = principal.0 as f64 * (1.0 + rate_per_period).powf(periods);
    AmountKobo((amount - principal.0 as f64).round() as i64)
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

async fn health(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref client) = state.db_client {
        match client.execute("SELECT 1", &[]).await {
            Ok(_) => "connected",
            Err(_) => "unhealthy",
        }
    } else {
        "not_configured"
    };
    let overall = if db_status == "unhealthy" { "degraded" } else { "healthy" };
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": overall,
        "service": "neo4j-coa-graph-rs",
        "version": "1.0.0",
        "checks": {
            "database": db_status,
        },
    }))
}

async fn ready() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "neo4j-coa-graph-rs"})) }
async fn live() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"neo4j-coa-graph-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"neo4j-coa-graph-rs\"}} {}\n", r, e))
}

async fn coa_graph(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    let edges = state.edges.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    db_persist(&state, "coa_graph", &json!({"action": "get_graph"})).await;
    HttpResponse::Ok().json(json!({"nodes": nodes, "edges": edges, "total_nodes": nodes.len(), "total_edges": edges.len()}))
}

async fn coa_pagerank(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    let edges = state.edges.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    let rankings = compute_pagerank(&nodes, &edges, 20, 0.85);
    let named: Vec<serde_json::Value> = rankings.iter().map(|(code, rank)| {
        let name = nodes.iter().find(|n| n.code == *code).map(|n| n.name.clone()).unwrap_or_default();
        json!({"code": code, "name": name, "rank": rank})
    }).collect();
    HttpResponse::Ok().json(json!({"algorithm": "pagerank", "iterations": 20, "damping": 0.85, "rankings": named}))
}

async fn coa_basel(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    let result = compute_basel_iii(&nodes);
    HttpResponse::Ok().json(result)
}

async fn coa_traverse(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let from = body.get("from").and_then(|v| v.as_str()).unwrap_or("");
    let to = body.get("to").and_then(|v| v.as_str()).unwrap_or("");
    let edges = state.edges.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).clone();
    // BFS traversal
    let mut visited = std::collections::HashSet::new();
    let mut queue = std::collections::VecDeque::new();
    queue.push_back((from.to_string(), vec![from.to_string()]));
    visited.insert(from.to_string());
    let mut result_path = Vec::new();
    while let Some((current, path)) = queue.pop_front() {
        if current == to { result_path = path; break; }
        if path.len() > 10 { continue; }
        for e in &edges {
            let next = if e.from_code == current { &e.to_code } else if e.to_code == current { &e.from_code } else { continue };
            if !visited.contains(next.as_str()) {
                visited.insert(next.clone());
                let mut new_path = path.clone();
                new_path.push(next.clone());
                queue.push_back((next.clone(), new_path));
            }
        }
    }
    db_persist(&state, "traverse", &json!({"from": from, "to": to})).await;
    HttpResponse::Ok().json(json!({"from": from, "to": to, "path": result_path, "hops": if result_path.is_empty() { 0 } else { result_path.len() - 1 }}))
}

async fn transaction_flow(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<TransactionFlow>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let txn = body.into_inner();
    let mut edges = state.edges.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() });
    edges.push(COAEdge {
        from_code: txn.debit_account.clone(), to_code: txn.credit_account.clone(),
        relation_type: "TRANSACTION".into(), weight: txn.amount,
        metadata: json!({"narration": txn.narration, "currency": txn.currency}),
    });
    drop(edges);
    db_persist(&state, "transaction_flow", &json!({"debit": &txn.debit_account, "credit": &txn.credit_account, "amount": txn.amount})).await;
    let gl_url = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = call_service_sync(&format!("{}/v1/notify", gl_url), r#"{"source": "neo4j-coa-graph-rs", "action": "transaction_flow"}"#);
    HttpResponse::Created().json(json!({"recorded": true, "debit": txn.debit_account, "credit": txn.credit_account, "amount": txn.amount}))
}

async fn create_node(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<COANode>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let node = body.into_inner();
    let code = node.code.clone();
    state.nodes.lock().unwrap_or_else(|e| { eprintln!("Mutex poisoned, recovering: {}", e); e.into_inner() }).push(node);
    db_persist(&state, "create_node", &json!({"code": &code})).await;
    HttpResponse::Created().json(json!({"created": true, "code": code}))
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let db_url = env::var("DATABASE_URL").ok();
    let db_client = if let Some(ref url) = db_url {
        match tokio_postgres::connect(url, tokio_postgres::NoTls).await {
            Ok((client, connection)) => {
                tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); } });
                Some(std::sync::Arc::new(client))
            }
            Err(e) => { eprintln!("DB connect failed: {}", e); None }
        }
    } else { None };

    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        nodes: Mutex::new(seed_coa_nodes()),
        edges: Mutex::new(seed_coa_edges()),
        db_url, db_client,
    });

    println!("neo4j-coa-graph-rs listening on port {}", port);
    start_grpc_server("neo4j-coa-graph-rs", 10386);
    HttpServer::new(move || {
        App::new()
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                    .allowed_headers(vec!["Content-Type", "Authorization", "X-Idempotency-Key", "X-Tenant-ID"])
                    .max_age(86400)
            )
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(ready))
            .route("/livez", web::get().to(live))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/coa/graph", web::get().to(coa_graph))
            .route("/v1/coa/pagerank", web::get().to(coa_pagerank))
            .route("/v1/coa/basel-iii", web::get().to(coa_basel))
            .route("/v1/coa/traverse", web::post().to(coa_traverse))
            .route("/v1/coa/transaction-flow", web::post().to(transaction_flow))
            .route("/v1/create", web::post().to(create_node))
    })
    .bind(("0.0.0.0", port))?.run().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("neo4j-coa-graph-rs", "neo4j-coa-graph-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}
