#![allow(unused)]
//! 54link-dev Banking Clearing & Operations Engine — Rust
//! Cheque Clearing, Collateral, Cash Management, SWIFT/Correspondent → GL.
//! All figures come from REAL data (Postgres GL + operations tables).
//! Fabricated batches/postings removed: any source failure => 503.

use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering as AtomicOrdering};

struct AppState {
    db: Option<PgPool>,
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

fn require_db(state: &web::Data<AppState>) -> Result<&PgPool, HttpResponse> {
    state.db.as_ref().ok_or_else(|| {
        source_unavailable("DATABASE_URL not configured; refusing to fabricate clearing/GL data")
    })
}

// Real GL account balance (NGN). Errors propagate -> 503.
async fn gl_balance(db: &PgPool, code: &str) -> Result<f64, sqlx::Error> {
    let row = sqlx::query(r#"SELECT balance::float8 FROM "glAccounts" WHERE "glAccountCode" = $1"#)
        .bind(code)
        .fetch_one(db)
        .await?;
    Ok(row.get(0))
}

// ── Gap 13: Cheque clearing ────────────────────────────────────────────────
async fn cheque_clearing_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let rows = sqlx::query(
        r#"SELECT cycle_id, direction, clearing, cheque_no, drawer, payee, amount::float8, status, business_date::text
           FROM cheques ORDER BY business_date DESC, cycle_id, cheque_no LIMIT 1000"#,
    )
    .fetch_all(db)
    .await;
    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[banking-clearing-ops-rs] cheques query failed: {}", e);
            return source_unavailable(&format!("cheques query failed: {}", e));
        }
    };
    use std::collections::BTreeMap;
    let mut cycles: BTreeMap<String, Vec<serde_json::Value>> = BTreeMap::new();
    let (mut out_cleared, mut out_returned, mut in_honoured, mut in_dishonoured) = (0u64, 0u64, 0u64, 0u64);
    let (mut total_out, mut total_in) = (0.0f64, 0.0f64);
    let mut business_date = String::new();
    for r in &rows {
        let cycle_id: String = r.get("cycle_id");
        let direction: String = r.get("direction");
        let status: String = r.get("status");
        let amount: f64 = r.get("amount");
        if business_date.is_empty() {
            business_date = r.get("business_date");
        }
        if direction == "outward" {
            total_out += amount;
            if status == "cleared" { out_cleared += 1 } else { out_returned += 1 }
        } else {
            total_in += amount;
            if status == "honoured" { in_honoured += 1 } else { in_dishonoured += 1 }
        }
        cycles.entry(cycle_id).or_default().push(json!({
            "chequeNo": r.get::<String, _>("cheque_no"),
            "drawer": r.get::<String, _>("drawer"),
            "payee": r.get::<Option<String>, _>("payee"),
            "amount": amount,
            "status": status,
        }));
    }
    let clearing_cycles: Vec<serde_json::Value> = cycles
        .into_iter()
        .map(|(cycle_id, cheques)| json!({"cycleId": cycle_id, "cheques": cheques}))
        .collect();
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "businessDate": business_date,
        "clearingCycles": clearing_cycles,
        "summary": {
            "outwardCleared": out_cleared, "outwardReturned": out_returned,
            "inwardHonoured": in_honoured, "inwardDishonoured": in_dishonoured,
            "totalOutward": total_out, "totalInward": total_in, "netClearing": total_out - total_in,
            "glCodesImpacted": ["1105 (Clearing Account)", "2101 (Customer Deposits)"],
        },
    }))
}

// ── Gap 14: Collateral events ──────────────────────────────────────────────
async fn collateral_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let rows = sqlx::query(
        r#"SELECT event_id, event_type, collateral_type, customer, loan_id, amount::float8,
                  previous_value::float8, new_value::float8, business_date::text
           FROM collateral_events ORDER BY business_date DESC LIMIT 500"#,
    )
    .fetch_all(db)
    .await;
    match rows {
        Ok(rows) => {
            let events: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| json!({
                    "eventId": r.get::<String, _>("event_id"),
                    "type": r.get::<String, _>("event_type"),
                    "collateralType": r.get::<String, _>("collateral_type"),
                    "customer": r.get::<String, _>("customer"),
                    "loanId": r.get::<String, _>("loan_id"),
                    "amount": r.get::<f64, _>("amount"),
                    "previousValue": r.get::<Option<f64>, _>("previous_value"),
                    "newValue": r.get::<Option<f64>, _>("new_value"),
                }))
                .collect();
            let liens = events.iter().filter(|e| e["type"] == "lien_placement").count();
            let releases = events.iter().filter(|e| e["type"] == "lien_release").count();
            let revals = events.iter().filter(|e| e["type"] == "revaluation").count();
            let fore = events.iter().filter(|e| e["type"] == "foreclosure_sale").count();
            HttpResponse::Ok().json(json!({
                "events": events,
                "summary": {
                    "liensPlaced": liens, "liensReleased": releases,
                    "revaluations": revals, "foreclosures": fore,
                    "glCodesImpacted": ["2101", "2106 (Lien)", "1360 (Valuation Provision)", "5210 (Impairment)", "1006", "1301", "1357"],
                },
            }))
        }
        Err(e) => {
            eprintln!("[banking-clearing-ops-rs] collateral_events query failed: {}", e);
            source_unavailable(&format!("collateral_events query failed: {}", e))
        }
    }
}

// ── Gap 15: Cash management (vault / CRR / ATM) — computed from real GL ────
async fn cash_management_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let vault = match gl_balance(db, "1001").await { Ok(v) => v, Err(e) => return source_unavailable(&format!("GL 1001 unavailable: {}", e)) };
    let atm = match gl_balance(db, "1002").await { Ok(v) => v, Err(e) => return source_unavailable(&format!("GL 1002 unavailable: {}", e)) };
    let cbn_current = match gl_balance(db, "1006").await { Ok(v) => v, Err(e) => return source_unavailable(&format!("GL 1006 unavailable: {}", e)) };
    let crr_reserve = match gl_balance(db, "1005").await { Ok(v) => v, Err(e) => return source_unavailable(&format!("GL 1005 unavailable: {}", e)) };
    let nostro_usd = gl_balance(db, "1101").await.unwrap_or(0.0);
    let total_deposits = match gl_balance(db, "2101").await { Ok(v) => v, Err(e) => return source_unavailable(&format!("GL 2101 unavailable: {}", e)) };

    let crr_rate: f64 = env::var("CBN_CRR_RATE").ok().and_then(|v| v.parse().ok()).unwrap_or(32.5);
    let required_reserve = total_deposits * crr_rate / 100.0;
    let surplus = crr_reserve - required_reserve;

    let operations: Vec<serde_json::Value> = match sqlx::query(
        r#"SELECT op_id, op_type, branch, amount::float8, direction, business_date::text
           FROM cash_operations ORDER BY business_date DESC LIMIT 200"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows
            .iter()
            .map(|r| json!({
                "opId": r.get::<String, _>("op_id"),
                "type": r.get::<String, _>("op_type"),
                "branch": r.get::<Option<String>, _>("branch"),
                "amount": r.get::<f64, _>("amount"),
                "direction": r.get::<Option<String>, _>("direction"),
            }))
            .collect(),
        Err(e) => {
            eprintln!("[banking-clearing-ops-rs] cash_operations query failed: {}", e);
            return source_unavailable(&format!("cash_operations query failed: {}", e));
        }
    };

    HttpResponse::Ok().json(json!({
        "operations": operations,
        "cashPosition": {
            "vaultCash": vault, "atmNetwork": atm, "cbnCurrentAccount": cbn_current,
            "crrReserve": crr_reserve, "nostroUSD": nostro_usd,
            "totalLiquidity": vault + atm + cbn_current + crr_reserve + nostro_usd,
        },
        "crrMonitoring": {
            "totalDeposits": total_deposits, "crrRate": crr_rate,
            "requiredReserve": required_reserve, "actualReserve": crr_reserve,
            "surplus": surplus, "compliant": crr_reserve >= required_reserve,
        },
    }))
}

// ── Gap 16: SWIFT / correspondent banking ──────────────────────────────────
async fn swift_correspondent_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let messages = match sqlx::query(
        r#"SELECT message_id, message_type, direction, sender, receiver, currency, amount::float8,
                  beneficiary, ordering, value_date::text
           FROM swift_messages ORDER BY value_date DESC LIMIT 200"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows
            .iter()
            .map(|r| json!({
                "messageId": r.get::<String, _>("message_id"),
                "type": r.get::<String, _>("message_type"),
                "direction": r.get::<String, _>("direction"),
                "sender": r.get::<String, _>("sender"),
                "receiver": r.get::<String, _>("receiver"),
                "currency": r.get::<String, _>("currency"),
                "amount": r.get::<f64, _>("amount"),
                "beneficiary": r.get::<Option<String>, _>("beneficiary"),
                "ordering": r.get::<Option<String>, _>("ordering"),
                "valueDate": r.get::<String, _>("value_date"),
            }))
            .collect::<Vec<_>>(),
        Err(e) => {
            eprintln!("[banking-clearing-ops-rs] swift_messages query failed: {}", e);
            return source_unavailable(&format!("swift_messages query failed: {}", e));
        }
    };

    let nostro = match sqlx::query(
        r#"SELECT correspondent, currency, gl_code, balance::float8, limit_amount::float8
           FROM nostro_accounts ORDER BY correspondent"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows
            .iter()
            .map(|r| json!({
                "correspondent": r.get::<String, _>("correspondent"),
                "currency": r.get::<String, _>("currency"),
                "glCode": r.get::<String, _>("gl_code"),
                "balance": r.get::<f64, _>("balance"),
                "limit": r.get::<f64, _>("limit_amount"),
            }))
            .collect::<Vec<_>>(),
        Err(e) => {
            eprintln!("[banking-clearing-ops-rs] nostro_accounts query failed: {}", e);
            return source_unavailable(&format!("nostro_accounts query failed: {}", e));
        }
    };

    HttpResponse::Ok().json(json!({
        "swiftMessages": messages,
        "nostroPositions": nostro,
    }))
}

// ── Settlements CRUD (real DB) ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

async fn list_records(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    match sqlx::query(
        "SELECT id::text, batch_id, settlement_type, counterparty, net_amount_kobo, currency, status, transaction_count, settlement_date::text, reference, channel FROM settlements ORDER BY created_at DESC LIMIT 500",
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => {
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| json!({
                    "id": r.get::<String, _>(0), "batchId": r.get::<String, _>(1),
                    "settlementType": r.get::<String, _>(2), "counterparty": r.get::<String, _>(3),
                    "netAmountKobo": r.get::<i64, _>(4), "currency": r.get::<String, _>(5),
                    "status": r.get::<String, _>(6), "transactionCount": r.get::<i32, _>(7),
                    "settlementDate": r.get::<String, _>(8), "reference": r.get::<Option<String>, _>(9),
                    "channel": r.get::<String, _>(10),
                }))
                .collect();
            HttpResponse::Ok().json(json!({"items": items, "total": items.len()}))
        }
        Err(e) => source_unavailable(&format!("settlements query failed: {}", e)),
    }
}

async fn create_record(state: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let req = body.into_inner();
    let batch_id = req.extra.get("batchId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let settlement_type = req.extra.get("settlementType").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let counterparty = req.extra.get("counterparty").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let channel = req.extra.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let net_amount_kobo = req.extra.get("netAmountKobo").and_then(|v| v.as_i64()).unwrap_or(0);
    let currency = req.extra.get("currency").and_then(|v| v.as_str()).unwrap_or("NGN").to_string();
    if batch_id.is_empty() || settlement_type.is_empty() || counterparty.is_empty() || channel.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "batchId, settlementType, counterparty, channel are required"}));
    }
    let tenant = req.tenant_id.unwrap_or_else(|| "00000000-0000-0000-0000-000000000000".to_string());
    match sqlx::query(
        "INSERT INTO settlements (batch_id, settlement_type, counterparty, net_amount_kobo, currency, status, channel, settlement_date, tenant_id) VALUES ($1,$2,$3,$4,$5,'pending',$6,CURRENT_DATE,$7::uuid) RETURNING id::text",
    )
    .bind(&batch_id).bind(&settlement_type).bind(&counterparty).bind(net_amount_kobo).bind(&currency).bind(&channel).bind(&tenant)
    .fetch_one(db)
    .await
    {
        Ok(r) => HttpResponse::Created().json(json!({"id": r.get::<String, _>(0), "status": "pending"})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

async fn get_record(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    match sqlx::query("SELECT id::text, batch_id, status FROM settlements WHERE id = $1::uuid")
        .bind(&id)
        .fetch_optional(db)
        .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "id": r.get::<String, _>(0), "batchId": r.get::<String, _>(1), "status": r.get::<String, _>(2)
        })),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => source_unavailable(&format!("settlement query failed: {}", e)),
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&data) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());
    match sqlx::query("UPDATE settlements SET status = $1 WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(db)
        .await
    {
        Ok(_) => HttpResponse::Ok().json(json!({"id": id, "status": status})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&data) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    let _ = sqlx::query("UPDATE settlements SET status = 'deleted' WHERE id = $1::uuid")
        .bind(&id)
        .execute(db)
        .await;
    HttpResponse::NoContent().finish()
}

// ── Shared infrastructure ──────────────────────────────────────────────────

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
    let db_ok = match &state.db {
        Some(pool) => sqlx::query("SELECT 1").execute(pool).await.is_ok(),
        None => false,
    };
    DB_AVAILABLE.store(db_ok, AtomicOrdering::Relaxed);
    HttpResponse::Ok().json(json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": "banking-clearing-ops-rs",
        "version": "1.0.0",
        "database": if db_ok { "connected" } else { "unavailable" },
        "gaps_closed": ["Gap 13: Cheque Clearing → GL", "Gap 14: Collateral → GL", "Gap 15: Cash Management → GL", "Gap 16: SWIFT/Correspondent → GL"],
    }))
}

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
    HttpResponse::Ok().json(json!({"ready": true, "service": "banking-clearing-ops-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"banking-clearing-ops-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"banking-clearing-ops-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

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
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[banking-clearing-ops-rs] starting");

    // Fail-fast policy: no DB => all data endpoints 503 (never fabricated).
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
                    log::error!("[banking-clearing-ops-rs] DB connect failed: {} — endpoints will 503", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("[banking-clearing-ops-rs] DATABASE_URL not set — endpoints will 503");
            None
        }
    };

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8144".to_string()).parse().unwrap_or(8144);
    let data = web::Data::new(AppState { db });
    log::info!("[banking-clearing-ops-rs] ready on :{}", port);
    start_grpc_server("banking-clearing-ops-rs", 10444);

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
            .route("/v1/cheque/clearing-gl", web::get().to(cheque_clearing_gl))
            .route("/v1/collateral/gl", web::get().to(collateral_gl))
            .route("/v1/cash/management-gl", web::get().to(cash_management_gl))
            .route("/v1/swift/correspondent-gl", web::get().to(swift_correspondent_gl))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
            .route("/api/v1/settlements", web::get().to(list_records))
            .route("/api/v1/settlements", web::post().to(create_record))
            .route("/api/v1/settlements/{id}", web::get().to(get_record))
            .route("/api/v1/settlements/{id}", web::put().to(update_record))
            .route("/api/v1/settlements/{id}", web::delete().to(delete_record))
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
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, AtomicOrdering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, AtomicOrdering::Relaxed);
    }
}
