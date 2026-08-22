#![allow(unused)]
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};


#[derive(Debug, Serialize, Deserialize, Clone)]
struct GLAccount {
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub account_type: Option<String>,  // asset, liability, equity, revenue, expense
    pub parent_code: Option<String>,
    pub currency: Option<String>,
    pub balance_kobo: Option<i64>,     // kobo integer — never float
    pub blocked: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct JournalEntry {
    pub entry_id: Option<String>,
    pub debit_account: String,
    pub credit_account: String,
    pub amount_kobo: i64,             // kobo integer — never float
    pub currency: String,
    pub narration: String,
    pub value_date: String,
    pub posted_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: String,
    status: String,
    tenant_id: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TrialBalanceRequest {
    #[serde(default)]
    as_of: Option<String>,
}

struct AppState {
    db: PgPool,
}


fn validate_double_entry(entries: &[JournalEntry]) -> Result<(), String> {
    if entries.is_empty() {
        return Err("journal must have at least one entry".to_string());
    }
    for e in entries {
        if e.amount_kobo <= 0 {
            return Err(format!("amount_kobo must be positive (got {})", e.amount_kobo));
        }
        if e.debit_account == e.credit_account {
            return Err("debit_account and credit_account must differ".to_string());
        }
    }
    // Each JournalEntry encodes one debit AND one credit of equal amount_kobo,
    // so total debits always equal total credits — this is a structural guarantee.
    // We validate no entry has a zero/negative amount instead.
    let total: i64 = entries.iter().map(|e| e.amount_kobo).sum();
    if total <= 0 {
        return Err(format!("journal total_kobo must be positive (got {})", total));
    }
    Ok(())
}

fn classify_account(code: &str) -> &str {
    match code.chars().next() {
        Some('1') => "asset",
        Some('2') => "liability",
        Some('3') => "equity",
        Some('4') => "revenue",
        Some('5') => "expense",
        _ => "unknown",
    }
}

fn compute_trial_balance(accounts: &[GLAccount]) -> serde_json::Value {
    let mut total_debit_kobo: i64 = 0;
    let mut total_credit_kobo: i64 = 0;
    let mut entries = Vec::new();
    for acc in accounts {
        let bal = acc.balance_kobo.unwrap_or(0);
        let acct_type = acc.account_type.as_deref().unwrap_or("unknown");
        let (dr, cr): (i64, i64) = match acct_type {
            "asset" | "expense" => if bal >= 0 { (bal, 0) } else { (0, bal.abs()) },
            _ =>                   if bal >= 0 { (0, bal) } else { (bal.abs(), 0) },
        };
        total_debit_kobo  += dr;
        total_credit_kobo += cr;
        entries.push(json!({
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "debit_kobo": dr,
            "credit_kobo": cr,
        }));
    }
    json!({
        "entries": entries,
        "total_debit_kobo":  total_debit_kobo,
        "total_credit_kobo": total_credit_kobo,
        "balanced": total_debit_kobo == total_credit_kobo,
    })
}


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn mark_db_available(ok: bool) {
    DB_AVAILABLE.store(ok, std::sync::atomic::Ordering::Relaxed);
}

fn db_unavailable() -> HttpResponse {
    mark_db_available(false);
    HttpResponse::ServiceUnavailable().json(json!({"error": "gl_database_unavailable"}))
}

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": "healthy",
        "service": "gl-engine-rs",
        "version": "1.0.0",
    }))
}


// ── Middleware integration: TigerBeetle ledger + Kafka events ──────────────
// Fire-and-forget raw HTTP over tokio (no extra crate dependency). A broker or
// ledger notification outage is logged but never fails the journal posting —
// the journal is already durably committed to the GL database at that point.
fn mw_tigerbeetle_url() -> String {
    std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "http://tigerbeetle-adapter:3000".to_string())
}
fn mw_kafka_url() -> String {
    std::env::var("KAFKA_REST_URL")
        .or_else(|_| std::env::var("KAFKA_BROKER_URL"))
        .unwrap_or_else(|_| "http://kafka-rest-proxy:8082".to_string())
}

async fn mw_http_post(url: &str, body: String) {
    use tokio::io::AsyncWriteExt;
    let stripped = match url.strip_prefix("http://") {
        Some(s) => s,
        None => return,
    };
    let (hostport, path) = match stripped.find('/') {
        Some(i) => (&stripped[..i], &stripped[i..]),
        None => (stripped, "/"),
    };
    let addr = if hostport.contains(':') {
        hostport.to_string()
    } else {
        format!("{}:80", hostport)
    };
    let connect = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await;
    let mut stream = match connect {
        Ok(Ok(s)) => s,
        _ => {
            eprintln!("[gl-engine-rs] middleware post: connect failed {}", addr);
            return;
        }
    };
    let req = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, hostport, body.len(), body
    );
    let _ = stream.write_all(req.as_bytes()).await;
    let _ = stream.flush().await;
}

async fn mw_post_ledger(entry_id: &str, entries: &[JournalEntry]) {
    let transfers: Vec<serde_json::Value> = entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            json!({
                "id": format!("{}-{}", entry_id, i),
                "debitAccount": e.debit_account,
                "creditAccount": e.credit_account,
                "amount": e.amount_kobo,
                "currency": e.currency,
                "ledger": 1,
                "code": 1000,
                "flags": 0,
            })
        })
        .collect();
    let body = json!({ "transfers": transfers }).to_string();
    let url = format!("{}/transfers", mw_tigerbeetle_url());
    mw_http_post(&url, body).await;
}

async fn mw_publish_event(entry_id: &str, count: usize) {
    let body = json!({
        "eventType": "gl.journal.posted",
        "service": "gl-engine-rs",
        "entryId": entry_id,
        "entries": count,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    })
    .to_string();
    let url = format!("{}/topics/gl-engine.journals", mw_kafka_url());
    mw_http_post(&url, body).await;
}

// Balance sheet query: balances are always derived from persisted journal
// lines — never from process memory. Natural-balance convention:
// asset/expense: debits - credits; liability/equity/revenue: credits - debits.
const BALANCE_SQL: &str = r#"
    SELECT a.account_code, a.account_name, a.account_type, a.currency,
           COALESCE(SUM(CASE
               WHEN a.account_type IN ('asset', 'expense')
                   THEN CASE WHEN l.dc = 'D' THEN l.amount_kobo ELSE -l.amount_kobo END
               ELSE CASE WHEN l.dc = 'C' THEN l.amount_kobo ELSE -l.amount_kobo END
           END), 0)::bigint AS balance_kobo
    FROM gl_accounts a
    LEFT JOIN gl_journal_lines l ON l.account_code = a.account_code
    GROUP BY a.account_code, a.account_name, a.account_type, a.currency
"#;

fn row_to_account(r: &sqlx::postgres::PgRow) -> GLAccount {
    GLAccount {
        account_code: r.try_get::<String, _>("account_code").ok(),
        account_name: r.try_get::<Option<String>, _>("account_name").ok().flatten(),
        account_type: r.try_get::<Option<String>, _>("account_type").ok().flatten(),
        parent_code: None,
        currency: r.try_get::<Option<String>, _>("currency").ok().flatten(),
        balance_kobo: Some(r.try_get::<i64, _>("balance_kobo").unwrap_or(0)),
        blocked: Some(false),
    }
}

async fn post_journal(body: web::Json<Vec<JournalEntry>>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let entries = body.into_inner();
    if let Err(e) = validate_double_entry(&entries) {
        return HttpResponse::BadRequest().json(json!({"error": e}));
    }
    let entry_id = format!(
        "JRN-{}-{}",
        chrono::Utc::now().format("%Y%m%d%H%M%S"),
        uuid::Uuid::new_v4().simple()
    );
    // Posting = a single DB transaction that inserts the journal header and all
    // of its balanced lines. No commit, no "posted" status — fail closed.
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            eprintln!("[gl-engine-rs] post_journal: begin tx failed: {}", e);
            return db_unavailable();
        }
    };
    let narration = entries.first().map(|e| e.narration.clone()).unwrap_or_default();
    let posted_by = entries.first().and_then(|e| e.posted_by.clone());
    if let Err(e) = sqlx::query(
        "INSERT INTO gl_journals (journal_id, narration, posted_by, status) VALUES ($1, $2, $3, 'posted')",
    )
    .bind(entry_id.as_str())
    .bind(narration.as_str())
    .bind(posted_by.as_deref())
    .execute(&mut *tx)
    .await
    {
        eprintln!("[gl-engine-rs] post_journal: insert journal failed: {}", e);
        return db_unavailable();
    }
    for entry in &entries {
        for (code, dc) in [(&entry.debit_account, "D"), (&entry.credit_account, "C")] {
            let acct_type = classify_account(code);
            if let Err(e) = sqlx::query(
                "INSERT INTO gl_accounts (account_code, account_name, account_type, currency) \
                 VALUES ($1, $1, $2, $3) ON CONFLICT (account_code) DO NOTHING",
            )
            .bind(code.as_str())
            .bind(acct_type)
            .bind(entry.currency.as_str())
            .execute(&mut *tx)
            .await
            {
                eprintln!("[gl-engine-rs] post_journal: upsert account failed: {}", e);
                return db_unavailable();
            }
            if let Err(e) = sqlx::query(
                "INSERT INTO gl_journal_lines (journal_id, account_code, dc, amount_kobo, currency, value_date) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(entry_id.as_str())
            .bind(code.as_str())
            .bind(dc)
            .bind(entry.amount_kobo)
            .bind(entry.currency.as_str())
            .bind(entry.value_date.as_str())
            .execute(&mut *tx)
            .await
            {
                eprintln!("[gl-engine-rs] post_journal: insert line failed: {}", e);
                return db_unavailable();
            }
        }
    }
    if let Err(e) = tx.commit().await {
        eprintln!("[gl-engine-rs] post_journal: commit failed: {}", e);
        return db_unavailable();
    }
    mark_db_available(true);
    mw_post_ledger(&entry_id, &entries).await;
    mw_publish_event(&entry_id, entries.len()).await;
    HttpResponse::Ok().json(json!({"entry_id": entry_id, "status": "posted", "entries": entries.len()}))
}

async fn trial_balance(body: web::Json<TrialBalanceRequest>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    match sqlx::query(BALANCE_SQL).fetch_all(&state.db).await {
        Ok(rows) => {
            mark_db_available(true);
            let accounts: Vec<GLAccount> = rows.iter().map(row_to_account).collect();
            HttpResponse::Ok().json(compute_trial_balance(&accounts))
        }
        Err(e) => {
            eprintln!("[gl-engine-rs] trial_balance: query failed: {}", e);
            db_unavailable()
        }
    }
}

async fn chart_of_accounts(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", "1"))
            .json(serde_json::json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    // Inter-service call (blocking client) — never block the async executor.
    let upstream_url = std::env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://localhost:8120".to_string());
    let _ = tokio::task::spawn_blocking(move || {
        call_service_sync(&format!("{}/v1/screen", upstream_url), "{}")
    })
    .await;
    match sqlx::query(BALANCE_SQL).fetch_all(&state.db).await {
        Ok(rows) => {
            mark_db_available(true);
            let accounts: Vec<GLAccount> = rows.iter().map(row_to_account).collect();
            let grouped: std::collections::HashMap<&str, Vec<&GLAccount>> = accounts.iter().fold(
                std::collections::HashMap::new(),
                |mut map, acc| { map.entry(classify_account(acc.account_code.as_deref().unwrap_or(""))).or_default().push(acc); map }
            );
            HttpResponse::Ok().json(json!({"chart": grouped, "total_accounts": accounts.len()}))
        }
        Err(e) => {
            eprintln!("[gl-engine-rs] chart_of_accounts: query failed: {}", e);
            db_unavailable()
        }
    }
}

async fn account_balance(path: web::Path<String>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let code = path.into_inner();
    let result = sqlx::query(
        r#"SELECT a.account_code, a.account_name, a.account_type, a.currency,
                  COALESCE(SUM(CASE
                      WHEN a.account_type IN ('asset', 'expense')
                          THEN CASE WHEN l.dc = 'D' THEN l.amount_kobo ELSE -l.amount_kobo END
                      ELSE CASE WHEN l.dc = 'C' THEN l.amount_kobo ELSE -l.amount_kobo END
                  END), 0)::bigint AS balance_kobo
           FROM gl_accounts a
           LEFT JOIN gl_journal_lines l ON l.account_code = a.account_code
           WHERE a.account_code = $1
           GROUP BY a.account_code, a.account_name, a.account_type, a.currency"#,
    )
    .bind(code.as_str())
    .fetch_optional(&state.db)
    .await;
    match result {
        Ok(Some(row)) => {
            mark_db_available(true);
            let acc = row_to_account(&row);
            HttpResponse::Ok().json(json!({"account": acc, "classification": classify_account(&code)}))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "Account not found"})),
        Err(e) => {
            eprintln!("[gl-engine-rs] account_balance: query failed: {}", e);
            db_unavailable()
        }
    }
}

async fn validate_entry(body: web::Json<Vec<JournalEntry>>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    match validate_double_entry(&body) {
        Ok(_) => HttpResponse::Ok().json(json!({"valid": true})),
        Err(e) => HttpResponse::Ok().json(json!({"valid": false, "error": e})),
    }
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;



// --- Alerting ---
async fn alerts_endpoint(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
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

async fn readyz(state: web::Data<AppState>) -> HttpResponse {
    // Readiness requires a live GL database — fail closed.
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => HttpResponse::Ok().json(json!({"ready": true, "service": "gl-engine-rs"})),
        Err(_) => HttpResponse::ServiceUnavailable().json(json!({"ready": false, "service": "gl-engine-rs"})),
    }
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"gl-engine-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"gl-engine-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"}))),
    };
    // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(json!({"error": "invalid or expired token"}))),
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


// Best-effort audit persistence via the GL pool. Never fails a request.
async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "gl_engine_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc_name = String::from("gl-engine-rs");
    let status = String::from("active");
    let data_str = serde_json::to_string(data).unwrap_or_default();
    let _ = sqlx::query(
        "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5::jsonb)",
    )
    .bind(id.as_str())
    .bind(svc_name.as_str())
    .bind(endpoint)
    .bind(status.as_str())
    .bind(data_str.as_str())
    .execute(&state.db)
    .await;
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
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}


// --- Database schema (durable GL: accounts, journals, journal lines) ---
async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create service_configs table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS outbox (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create outbox table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS service_records (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    type TEXT DEFAULT 'default',
    status TEXT DEFAULT 'active',
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create service_records table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS gl_accounts (
    account_code TEXT PRIMARY KEY,
    account_name TEXT,
    account_type TEXT NOT NULL DEFAULT 'unknown',
    currency TEXT NOT NULL DEFAULT 'NGN',
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create gl_accounts table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS gl_journals (
    journal_id TEXT PRIMARY KEY,
    narration TEXT,
    posted_by TEXT,
    status TEXT NOT NULL DEFAULT 'posted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create gl_journals table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS gl_journal_lines (
    id BIGSERIAL PRIMARY KEY,
    journal_id TEXT NOT NULL REFERENCES gl_journals(journal_id),
    account_code TEXT NOT NULL REFERENCES gl_accounts(account_code),
    dc CHAR(1) NOT NULL CHECK (dc IN ('D', 'C')),
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    currency TEXT NOT NULL,
    value_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create gl_journal_lines table");

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_gjl_account ON gl_journal_lines(account_code)")
        .execute(pool)
        .await
        .expect("Failed to create gl_journal_lines account index");
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8101);
    // FAIL FAST: the GL must never run on in-memory state or default credentials.
    let db_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set — gl-engine-rs refuses to boot without durable storage");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await
        .expect("failed to connect to DATABASE_URL — gl-engine-rs cannot run without the GL database");
    init_schema(&pool).await;
    let state = web::Data::new(AppState { db: pool });
    println!("gl-engine-rs listening on port {}", port);
    start_grpc_server("gl-engine-rs", 10424);
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
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[gl-engine-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
            .route("/alerts", web::get().to(alerts_endpoint))
            .route("/v1/journals", web::post().to(post_journal))
            .route("/v1/journals/validate", web::post().to(validate_entry))
            .route("/v1/trial-balance", web::post().to(trial_balance))
            .route("/v1/chart-of-accounts", web::get().to(chart_of_accounts))
            .route("/v1/accounts/{code}", web::get().to(account_balance))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

async fn list_records(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let result = sqlx::query(
        "SELECT id::text AS id, config_key, config_value::text AS config_value, environment, status, version, is_active \
         FROM service_configs ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&data.db)
    .await;
    match result {
        Ok(rows) => {
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.try_get::<String, _>("id").unwrap_or_default(),
                        "config_key": r.try_get::<String, _>("config_key").unwrap_or_default(),
                        "config_value": r.try_get::<String, _>("config_value").unwrap_or_default(),
                        "environment": r.try_get::<String, _>("environment").unwrap_or_default(),
                        "status": r.try_get::<String, _>("status").unwrap_or_default(),
                        "version": r.try_get::<i32, _>("version").unwrap_or(0),
                        "is_active": r.try_get::<bool, _>("is_active").unwrap_or(false),
                    })
                })
                .collect();
            HttpResponse::Ok().json(json!({"items": items, "count": items.len()}))
        }
        Err(e) => HttpResponse::ServiceUnavailable().json(json!({"error": e.to_string()})),
    }
}

async fn create_record(data: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let config_key = body
        .extra
        .get("config_key")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .to_string();
    let config_value = body
        .extra
        .get("config_value")
        .cloned()
        .unwrap_or_else(|| json!({}))
        .to_string();
    let environment = body
        .extra
        .get("environment")
        .and_then(|v| v.as_str())
        .unwrap_or("production")
        .to_string();
    let status = body.status.clone().unwrap_or_else(|| "active".to_string());
    let result = sqlx::query(
        "INSERT INTO service_configs (config_key, config_value, environment, status) \
         VALUES ($1, $2::jsonb, $3, $4) RETURNING id::text AS id",
    )
    .bind(config_key.as_str())
    .bind(config_value.as_str())
    .bind(environment.as_str())
    .bind(status.as_str())
    .fetch_one(&data.db)
    .await;
    match result {
        Ok(row) => {
            let id: String = row.try_get("id").unwrap_or_default();
            HttpResponse::Created().json(json!({"id": id, "config_key": config_key, "status": status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

async fn get_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let result = sqlx::query(
        "SELECT id::text AS id, config_key, config_value::text AS config_value, environment, status, version, is_active \
         FROM service_configs WHERE id = $1::uuid",
    )
    .bind(id.as_str())
    .fetch_optional(&data.db)
    .await;
    match result {
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "id": r.try_get::<String, _>("id").unwrap_or_default(),
            "config_key": r.try_get::<String, _>("config_key").unwrap_or_default(),
            "config_value": r.try_get::<String, _>("config_value").unwrap_or_default(),
            "environment": r.try_get::<String, _>("environment").unwrap_or_default(),
            "status": r.try_get::<String, _>("status").unwrap_or_default(),
            "version": r.try_get::<i32, _>("version").unwrap_or(0),
            "is_active": r.try_get::<bool, _>("is_active").unwrap_or(false),
        })),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => HttpResponse::ServiceUnavailable().json(json!({"error": e.to_string()})),
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(status.as_str())
        .bind(id.as_str())
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status}).to_string();
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3::jsonb)")
                .bind("service_configs.updated")
                .bind(id.as_str())
                .bind(payload.as_str())
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    sqlx::query("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(id.as_str())
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id}).to_string();
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3::jsonb)")
        .bind("service_configs.deleted")
        .bind(id.as_str())
        .bind(payload.as_str())
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(debit: &str, credit: &str, amount_kobo: i64) -> JournalEntry {
        JournalEntry {
            entry_id: None,
            debit_account: debit.to_string(),
            credit_account: credit.to_string(),
            amount_kobo,
            currency: "NGN".to_string(),
            narration: "test".to_string(),
            value_date: "2026-01-01".to_string(),
            posted_by: None,
        }
    }

    fn make_account(code: &str, acct_type: &str, balance_kobo: i64) -> GLAccount {
        GLAccount {
            account_code: Some(code.to_string()),
            account_name: Some(code.to_string()),
            account_type: Some(acct_type.to_string()),
            parent_code: None,
            currency: Some("NGN".to_string()),
            balance_kobo: Some(balance_kobo),
            blocked: Some(false),
        }
    }

    #[test]
    fn test_validate_double_entry_valid() {
        // 1_000_000 kobo = ₦10,000
        let entries = vec![make_entry("1001", "2001", 1_000_000)];
        assert!(validate_double_entry(&entries).is_ok());
    }

    #[test]
    fn test_validate_double_entry_empty() {
        assert!(validate_double_entry(&[]).is_err());
    }

    #[test]
    fn test_validate_double_entry_zero_amount() {
        let entries = vec![make_entry("1001", "2001", 0)];
        assert!(validate_double_entry(&entries).is_err());
    }

    #[test]
    fn test_validate_double_entry_negative_amount() {
        let entries = vec![make_entry("1001", "2001", -500)];
        assert!(validate_double_entry(&entries).is_err());
    }

    #[test]
    fn test_trial_balance_balanced() {
        // Asset ₦100K, Liability ₦100K → balanced
        let accounts = vec![
            make_account("1001", "asset",     10_000_000),  // ₦100,000 debit
            make_account("2001", "liability",  10_000_000),  // ₦100,000 credit
        ];
        let tb = compute_trial_balance(&accounts);
        assert_eq!(tb["total_debit_kobo"],  10_000_000i64);
        assert_eq!(tb["total_credit_kobo"], 10_000_000i64);
        assert_eq!(tb["balanced"], true);
    }

    #[test]
    fn test_trial_balance_uses_exact_integer_equality() {
        // Verify no float tolerance: 1 kobo difference must show as unbalanced
        let accounts = vec![
            make_account("1001", "asset",     10_000_001),  // 1 kobo extra
            make_account("2001", "liability",  10_000_000),
        ];
        let tb = compute_trial_balance(&accounts);
        assert_eq!(tb["balanced"], false);
    }

    #[test]
    fn test_circuit_breaker_opens() {
        for _ in 0..5 { cb_record_failure(); }
        assert!(!cb_allow());
    }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    #[test]
    fn test_classify_account() {
        assert_eq!(classify_account("1001"), "asset");
        assert_eq!(classify_account("2001"), "liability");
        assert_eq!(classify_account("3001"), "equity");
        assert_eq!(classify_account("4001"), "revenue");
        assert_eq!(classify_account("5001"), "expense");
        assert_eq!(classify_account("9999"), "unknown");
    }
}
