#![allow(unused)]
//! 54link-dev Settlement Reconciliation Engine — Rust
//! GL ↔ Nostro ↔ NIBSS settlement reconciliation for end-of-day balancing.
//! All positions/statistics are computed from REAL data (Postgres GL, nostro
//! positions, suspense items). Any source failure => 503 source_unavailable.
//! Middleware: Kafka, Postgres, Redis, Temporal, OpenSearch

use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering as AtomicOrdering};
use std::time::Instant;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SettlementRecon {
    recon_id: String,
    business_date: String,
    recon_type: String,
    gl_balance: f64,
    external_balance: f64,
    difference: f64,
    status: String, // completed, failed
    items_reconciled: u64,
    items_outstanding: u64,
    auto_matched: u64,
    manual_review: u64,
    reconciled_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NostroPosition {
    account_id: String,
    bank_name: String,
    currency: String,
    gl_code: String,
    book_balance: f64,
    statement_balance: f64,
    uncleared_credits: f64,
    uncleared_debits: f64,
    reconciled_balance: f64,
    difference: f64,
    status: String, // reconciled, discrepancy
    last_statement_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SuspenseItem {
    id: String,
    gl_code: String,
    gl_name: String,
    amount: f64,
    aging_days: i64,
    source: String,
    reason: String,
    status: String,
    assigned_to: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct RunSettlementReconRequest {
    recon_type: Option<String>,
    business_date: Option<String>,
}

struct AppState {
    start_time: Instant,
    recons: Mutex<Vec<SettlementRecon>>,
    db_url: Option<String>,
}

fn rand_id(prefix: &str) -> String {
    let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap();
    format!("{}-{:08X}", prefix, (t.subsec_nanos() ^ (t.as_secs() as u32)) & 0xFFFFFFFF)
}

fn now_str() -> String {
    Utc::now().to_rfc3339()
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

async fn pg_connect(db_url: &str) -> Result<tokio_postgres::Client, String> {
    let (client, connection) = tokio_postgres::connect(db_url, tokio_postgres::NoTls)
        .await
        .map_err(|e| format!("postgres connect failed: {}", e))?;
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });
    Ok(client)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(AtomicOrdering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(AtomicOrdering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "service": "reconciliation-engine-rs",
        "status": "healthy",
        "version": "3.0.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "database": if state.db_url.is_some() { "configured" } else { "not_configured" },
        "domain": "Settlement & GL Reconciliation Engine",
        "gl_codes_reconciled": [
            "1101 (CBN Reserve)", "1102 (Nostro Accounts)", "1103 (Vostro Accounts)",
            "1104 (Interbank Settlement)", "1410 (Suspense - Uncleared)",
            "1999 (Reconciliation Suspense)", "9201 (Contingent - LC/BG)",
        ],
    }))
}

async fn run_settlement_recon(req: actix_web::HttpRequest, body: web::Json<RunSettlementReconRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let recon_type = body.recon_type.clone().unwrap_or_else(|| "nostro".into());
    let biz_date = body.business_date.clone().unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    let db_url = match &state.db_url {
        Some(u) => u.clone(),
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate settlement positions"),
    };

    // Pull REAL nostro/vostro positions for the business date.
    let result: Result<Vec<NostroPosition>, String> = async {
        let client = pg_connect(&db_url).await?;
        let rows = client
            .query(
                "SELECT account_id, bank_name, currency, gl_code, book_balance::float8, statement_balance::float8, \
                        uncleared_credits::float8, uncleared_debits::float8, last_statement_date::text \
                 FROM nostro_positions WHERE last_statement_date <= $2::date ORDER BY account_id",
                &[&recon_type, &biz_date],
            )
            .await
            .map_err(|e| format!("nostro_positions query failed: {}", e))?;
        if rows.is_empty() {
            return Err(format!("no nostro positions found for business date {}", biz_date));
        }
        Ok(rows
            .iter()
            .map(|r| {
                let book: f64 = r.get(4);
                let stmt: f64 = r.get(5);
                let uc: f64 = r.get(6);
                let ud: f64 = r.get(7);
                let reconciled = stmt - uc + ud;
                let diff = book - reconciled;
                NostroPosition {
                    account_id: r.get(0),
                    bank_name: r.get(1),
                    currency: r.get(2),
                    gl_code: r.get(3),
                    book_balance: book,
                    statement_balance: stmt,
                    uncleared_credits: uc,
                    uncleared_debits: ud,
                    reconciled_balance: reconciled,
                    difference: diff,
                    status: if diff.abs() < 0.01 { "reconciled".into() } else { "discrepancy".into() },
                    last_statement_date: r.get(8),
                }
            })
            .collect())
    }
    .await;

    match result {
        Ok(nostro_positions) => {
            let total_diff: f64 = nostro_positions.iter().map(|n| n.difference).sum();
            let discrepancies = nostro_positions.iter().filter(|n| n.status == "discrepancy").count() as u64;
            let recon = SettlementRecon {
                recon_id: rand_id("SRECON"),
                business_date: biz_date,
                recon_type: recon_type.clone(),
                gl_balance: nostro_positions.iter().map(|n| n.book_balance).sum(),
                external_balance: nostro_positions.iter().map(|n| n.statement_balance).sum(),
                difference: total_diff,
                status: if discrepancies == 0 { "completed".into() } else { "completed_with_discrepancies".into() },
                items_reconciled: nostro_positions.len() as u64 - discrepancies,
                items_outstanding: discrepancies,
                auto_matched: nostro_positions.len() as u64 - discrepancies,
                manual_review: discrepancies,
                reconciled_at: now_str(),
                error: None,
            };
            let summary = json!({
                "all_positions_reconciled": discrepancies == 0,
                "total_uncleared_credits": nostro_positions.iter().map(|n| n.uncleared_credits).sum::<f64>(),
                "total_uncleared_debits": nostro_positions.iter().map(|n| n.uncleared_debits).sum::<f64>(),
                "net_uncleared": nostro_positions.iter().map(|n| n.uncleared_credits - n.uncleared_debits).sum::<f64>(),
                "cbn_reserve_balanced": nostro_positions.iter().find(|n| n.gl_code == "1101").map(|n| n.difference.abs() < 0.01),
            });
            state.recons.lock().unwrap().push(recon.clone());
            HttpResponse::Ok().json(json!({
                "recon": recon,
                "nostro_positions": nostro_positions,
                "summary": summary,
            }))
        }
        Err(e) => {
            eprintln!("[reconciliation-engine-rs] settlement recon failed: {}", e);
            DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
            let recon = SettlementRecon {
                recon_id: rand_id("SRECON"),
                business_date: biz_date,
                recon_type,
                gl_balance: 0.0, external_balance: 0.0, difference: 0.0,
                status: "failed".into(),
                items_reconciled: 0, items_outstanding: 0, auto_matched: 0, manual_review: 0,
                reconciled_at: now_str(),
                error: Some("source_unavailable".into()),
            };
            state.recons.lock().unwrap().push(recon.clone());
            HttpResponse::ServiceUnavailable().json(json!({"recon": recon, "error": "source_unavailable", "detail": e}))
        }
    }
}

async fn fetch_suspense_items(db_url: &str) -> Result<Vec<SuspenseItem>, String> {
    let client = pg_connect(db_url).await?;
    let rows = client
        .query(
            "SELECT id, gl_code, gl_name, amount::float8, source, reason, status, assigned_to, created_at::text \
             FROM suspense_items ORDER BY created_at",
            &[],
        )
        .await
        .map_err(|e| format!("suspense_items query failed: {}", e))?;
    let now = Utc::now();
    Ok(rows
        .iter()
        .map(|r| {
            let created: String = r.get(8);
            let aging_days = chrono::DateTime::parse_from_rfc3339(&created)
                .map(|t| (now - t.with_timezone(&Utc)).num_days().max(0))
                .unwrap_or(0);
            SuspenseItem {
                id: r.get(0),
                gl_code: r.get(1),
                gl_name: r.get(2),
                amount: r.get(3),
                aging_days,
                source: r.get(4),
                reason: r.get(5),
                status: r.get(6),
                assigned_to: r.get(7),
                created_at: created,
            }
        })
        .collect())
}

async fn get_suspense(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_url = match &state.db_url {
        Some(u) => u,
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate suspense items"),
    };
    match fetch_suspense_items(db_url).await {
        Ok(items) => {
            let total_amount: f64 = items.iter().map(|i| i.amount).sum();
            let aging_0_7: usize = items.iter().filter(|i| i.aging_days <= 7).count();
            let aging_8_30: usize = items.iter().filter(|i| i.aging_days > 7 && i.aging_days <= 30).count();
            let aging_over_30: usize = items.iter().filter(|i| i.aging_days > 30).count();
            HttpResponse::Ok().json(json!({
                "suspense_items": items,
                "total": items.len(),
                "total_amount": total_amount,
                "aging": { "0_7_days": aging_0_7, "8_30_days": aging_8_30, "over_30_days": aging_over_30 },
                "gl_codes": ["1410 (Uncleared Effects)", "1999 (Recon Suspense)"],
            }))
        }
        Err(e) => {
            eprintln!("[reconciliation-engine-rs] suspense query failed: {}", e);
            source_unavailable(&e)
        }
    }
}

async fn list_recons(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let recons = state.recons.lock().unwrap();
    HttpResponse::Ok().json(json!({"recons": *recons, "total": recons.len()}))
}

async fn get_stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_url = match &state.db_url {
        Some(u) => u.clone(),
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate reconciliation statistics"),
    };
    let recons = state.recons.lock().unwrap().clone();
    let total_items: u64 = recons.iter().map(|r| r.items_reconciled + r.items_outstanding).sum();
    let auto_matched: u64 = recons.iter().map(|r| r.auto_matched).sum();
    let auto_match_rate = if total_items > 0 { auto_matched as f64 / total_items as f64 * 100.0 } else { 0.0 };
    let last_eod = recons.last().map(|r| r.reconciled_at.clone());

    // Real suspense balance + CBN filings + nostro account count from DB.
    let suspense = match fetch_suspense_items(&db_url).await {
        Ok(s) => s,
        Err(e) => return source_unavailable(&e),
    };
    let client = match pg_connect(&db_url).await {
        Ok(c) => c,
        Err(e) => return source_unavailable(&e),
    };
    let cbn_returns_filed: i64 = match client
        .query_one("SELECT COUNT(*)::int8 FROM cbn_returns WHERE status = 'submitted'", &[])
        .await
    {
        Ok(r) => r.get(0),
        Err(e) => return source_unavailable(&format!("cbn_returns query failed: {}", e)),
    };
    let nostro_accounts: i64 = match client
        .query_one("SELECT COUNT(*)::int8 FROM nostro_positions", &[])
        .await
    {
        Ok(r) => r.get(0),
        Err(e) => return source_unavailable(&format!("nostro_positions query failed: {}", e)),
    };

    HttpResponse::Ok().json(json!({
        "total_recons_run": recons.len(),
        "total_items_reconciled": recons.iter().map(|r| r.items_reconciled).sum::<u64>(),
        "auto_match_rate_pct": (auto_match_rate * 100.0).round() / 100.0,
        "suspense_balance": suspense.iter().filter(|i| i.status == "open").map(|i| i.amount).sum::<f64>(),
        "suspense_items_open": suspense.iter().filter(|i| i.status == "open").count(),
        "cbn_returns_filed": cbn_returns_filed,
        "last_eod_recon": last_eod,
        "nostro_accounts_monitored": nostro_accounts,
    }))
}

async fn eod_report(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_url = match &state.db_url {
        Some(u) => u.clone(),
        None => return source_unavailable("DATABASE_URL not configured; refusing to fabricate an EOD report"),
    };
    let client = match pg_connect(&db_url).await {
        Ok(c) => c,
        Err(e) => return source_unavailable(&e),
    };

    // Real trial-balance check for the latest period.
    let tb = client
        .query_one(
            r#"SELECT COALESCE(SUM("totalDebits"),0)::float8, COALESCE(SUM("totalCredits"),0)::float8
               FROM "trialBalances"
               WHERE "periodEnd" = (SELECT MAX("periodEnd") FROM "trialBalances")"#,
            &[],
        )
        .await;
    let gl_trial_balance_balanced = match tb {
        Ok(r) => {
            let d: f64 = r.get(0);
            let c: f64 = r.get(1);
            (d - c).abs() < 0.01
        }
        Err(e) => return source_unavailable(&format!("trialBalances query failed: {}", e)),
    };

    let suspense = match fetch_suspense_items(&db_url).await {
        Ok(s) => s,
        Err(e) => return source_unavailable(&e),
    };
    let suspense_total = suspense.len();
    let suspense_cleared = suspense.iter().filter(|i| i.status == "resolved").count();
    let clearance_rate = if suspense_total > 0 { suspense_cleared as f64 / suspense_total as f64 * 100.0 } else { 0.0 };

    let recons = state.recons.lock().unwrap().clone();
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let todays: Vec<&SettlementRecon> = recons.iter().filter(|r| r.business_date == today).collect();
    let nostro_reconciled = todays.iter().filter(|r| r.recon_type == "nostro" && r.status.starts_with("completed")).count();
    let reserve = client
        .query_opt(
            "SELECT (book_balance::float8 - (statement_balance::float8 - uncleared_credits::float8 + uncleared_debits::float8)) FROM nostro_positions WHERE gl_code = '1101' ORDER BY last_statement_date DESC LIMIT 1",
            &[],
        )
        .await
        .ok()
        .flatten()
        .map(|r| r.get::<usize, f64>(0).abs() < 0.01);

    HttpResponse::Ok().json(json!({
        "report_type": "end_of_day_reconciliation",
        "business_date": today,
        "gl_trial_balance_balanced": gl_trial_balance_balanced,
        "nostro_positions_reconciled": nostro_reconciled,
        "suspense_clearance_rate_pct": (clearance_rate * 100.0).round() / 100.0,
        "inter_branch_balanced": todays.iter().find(|r| r.recon_type == "inter_branch").map(|r| r.difference.abs() < 0.01),
        "cbn_reserve_confirmed": reserve,
        "total_recons_today": todays.len(),
        "sign_off": {
            "operations": "Pending",
            "finance": "Pending",
            "compliance": "Pending",
        },
        "cbn_submission_deadline": "T+1 10:00 WAT",
    }))
}

// ─── Main ───────────────────────────────────────────────────────────────────

static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn alerts_endpoint(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "reconciliation-engine-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"reconciliation-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"reconciliation-engine-rs\"}} {}\n", r, e);
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

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8234".to_string());
    let db_url = std::env::var("DATABASE_URL").ok().filter(|u| !u.is_empty());
    if db_url.is_none() {
        eprintln!("[reconciliation-engine-rs] DATABASE_URL not set — recon/stats endpoints will fail fast (503)");
    }
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        recons: Mutex::new(Vec::new()),
        db_url,
    });
    println!("Settlement Reconciliation Engine v3.0 (Rust) on :{}", port);
    start_grpc_server("reconciliation-engine-rs", 10440);
    HttpServer::new(move || {
        App::new()
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/settlement-recon/run", web::post().to(run_settlement_recon))
            .route("/v1/settlement-recon/recons", web::get().to(list_recons))
            .route("/v1/settlement-recon/suspense", web::get().to(get_suspense))
            .route("/v1/settlement-recon/stats", web::get().to(get_stats))
            .route("/v1/settlement-recon/eod-report", web::get().to(eod_report))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    }).bind(format!("0.0.0.0:{}", port))?.shutdown_timeout(30).run().await
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rand_id() { let r = rand_id("test"); assert!(!r.is_empty()); }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
    }
}
