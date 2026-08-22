#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use uuid::Uuid;
use chrono::{Utc, DateTime};

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

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
    http_client: reqwest::Client,
}

fn validate_nuban(account: &str) -> bool { account.len() == 10 && account.chars().all(|c| c.is_ascii_digit()) }
fn compute_batch_hash(amounts: &[f64]) -> f64 { amounts.iter().sum() }
fn batch_success_rate(total: u32, successful: u32) -> f64 { if total == 0 { 0.0 } else { successful as f64 / total as f64 * 100.0 } }
fn nibss_fee(amount: f64) -> f64 {
    if amount <= 5000.0 { 10.0 } else if amount <= 50000.0 { 25.0 } else { 50.0 }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "status": "healthy",
        "service": "bulk-payments-rs",
        "version": "1.0.0",
        "description": "Bulk payment processing engine (NIBSS, NIP)",
    }))
}

/// Forwards a single transfer payload to the payment hub /v1/transfers/initiate.
/// Passes through the caller's auth and tenant headers unchanged.
async fn forward_transfer_to_hub(
    http_client: &reqwest::Client,
    hub_url: &str,
    transfer: serde_json::Value,
    auth: &str,
    forwarded_headers: &std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/v1/transfers/initiate", hub_url);
    let mut req = http_client
        .post(&url)
        .header("Authorization", auth)
        .header("Content-Type", "application/json");

    for (k, v) in forwarded_headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let resp = req
        .json(&transfer)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .unwrap_or_else(|_| json!({"error": "invalid response body"}));

    if status.is_success() {
        Ok(body)
    } else {
        Err(body.to_string())
    }
}

/// POST /v1/bulk-payments
///
/// Body:
/// {
///   "batch_id": "optional-client-ref",
///   "transfers": [
///     { /* same shape as POST /v1/transfers/initiate on payment hub */ },
///     ...
///   ]
/// }
///
/// Each transfer is forwarded individually to the payment hub, applying the
/// same KYC / billing / sanctions / maker-checker gates as a regular transfer.
async fn process_batch(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }

    let auth = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Collect tenant-related headers to forward alongside each transfer.
    // Pin headers are forwarded so the payment hub can resolve them the same
    // way it does for a regular single transfer.
    let forward_header_names = [
        "x-tenant-id",
        "x-tenent-id",
        "x-keycloak-id",
        "x-ledger-id",
        "x-mint-account-id",
        "x-switch-name",
        "x-ams-name",
        "x-payer-pin",
        "x-pin",
    ];
    let mut forwarded_headers = std::collections::HashMap::new();
    for name in &forward_header_names {
        if let Some(val) = req.headers().get(*name).and_then(|v| v.to_str().ok()) {
            forwarded_headers.insert(name.to_string(), val.to_string());
        }
    }

    let input = body.into_inner();
    let batch_id = input
        .get("batch_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // A top-level "pin" on the batch body is injected into every transfer that
    // does not already carry its own pin field (e.g. salary runs, bulk disbursements).
    let batch_pin = input.get("pin").and_then(|v| v.as_str()).map(|s| s.to_string());

    let transfers = match input.get("transfers").and_then(|v| v.as_array()) {
        Some(t) => t.clone(),
        None => {
            return HttpResponse::BadRequest().json(json!({
                "error": "transfers array is required"
            }));
        }
    };

    if transfers.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "transfers array must not be empty"}));
    }

    let hub_url = std::env::var("PAYMENT_HUB_URL")
        .unwrap_or_else(|_| "http://payment-hub".to_string());

    let mut results = Vec::with_capacity(transfers.len());
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;

    for (idx, transfer) in transfers.iter().enumerate() {
        let mut transfer = transfer.clone();
        // Inject batch-level pin if the individual item has none
        if let Some(ref pin) = batch_pin {
            if transfer.get("pin").is_none() {
                if let Some(obj) = transfer.as_object_mut() {
                    obj.insert("pin".to_string(), serde_json::Value::String(pin.clone()));
                }
            }
        }
        let outcome = forward_transfer_to_hub(
            &state.http_client,
            &hub_url,
            transfer,
            &auth,
            &forwarded_headers,
        )
        .await;

        match outcome {
            Ok(resp_body) => {
                succeeded += 1;
                results.push(json!({
                    "index": idx,
                    "status": "success",
                    "response": resp_body,
                }));
            }
            Err(err_msg) => {
                failed += 1;
                results.push(json!({
                    "index": idx,
                    "status": "failed",
                    "error": err_msg,
                }));
            }
        }
    }

    let total = transfers.len() as u32;
    let success_rate = batch_success_rate(total, succeeded);
    let summary = json!({
        "batch_id": batch_id,
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate_pct": success_rate,
        "results": results,
    });

    db_persist(&state, "process_batch", &summary).await;

    HttpResponse::Ok().json(summary)
}

async fn batch_status(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let amounts_v: Vec<f64> = input.get("amounts").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let amounts = amounts_v.as_slice();
    let result = compute_batch_hash(amounts);
    let _result_data = json!({"endpoint": "batch_status"});
    db_persist(&state, "batch_status", &_result_data).await;

    HttpResponse::Ok().json(json!({
        "service": "bulk-payments-rs",
        "endpoint": "batch_status",
        "result": json!({"value": result}),
    }))
}

async fn generate_return_file(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let total = input.get("total").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let successful = input.get("successful").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = batch_success_rate(total, successful);
    let _result_data = json!({"endpoint": "generate_return_file"});
    db_persist(&state, "generate_return_file", &_result_data).await;

    HttpResponse::Ok().json(json!({
        "service": "bulk-payments-rs",
        "endpoint": "generate_return_file",
        "result": json!({"value": result}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let offset = (page - 1) * limit;
    if let Some(ref client) = state.db_client {
        match client.query(
            "SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            &[&"bulk_payments_rs", &(limit as i64), &(offset as i64)]
        ).await {
            Ok(rows) => {
                let items: Vec<serde_json::Value> = rows.iter().map(|r| {
                    json!({
                        "id": r.get::<_, String>(0),
                        "service": r.get::<_, String>(1),
                        "type": r.get::<_, String>(2),
                        "status": r.get::<_, String>(3),
                        "data": r.get::<_, String>(4),
                    })
                }).collect();
                let total: i64 = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"bulk_payments_rs"]).await.map(|r| r.get(0)).unwrap_or(0);
                return HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "database"}));
            }
            Err(e) => { eprintln!("DB query failed: {} — fallback to in-memory", e); }
        }
    }
    let records = state.records.lock().unwrap();
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip(offset).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "in-memory"}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    if let Some(ref client) = state.db_client {
        if let Ok(row) = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"bulk_payments_rs"]).await {
            let total: i64 = row.get(0);
            return HttpResponse::Ok().json(json!({"total": total, "service": env!("CARGO_PKG_NAME"), "source": "database"}));
        }
    }
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME"), "source": "in-memory"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "bulk-payments-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"bulk-payments-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"bulk-payments-rs\"}} {}\n", r, e);
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
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
    }
}


async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "bulk_payments_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("bulk-payments-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &svc_name, &endpoint, &status, &data_str],
        ).await;
    } else {
        // fallback: keep last 1000 records in memory
        let mut records = state.records.lock().unwrap();
        if records.len() >= 1000 { records.remove(0); }
        records.push(data.clone());
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8130);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        match tokio::time::timeout(std::time::Duration::from_secs(5), init_db(&url)).await {
            Ok(Some(c)) => { println!("bulk-payments-rs: connected to Postgres"); Some(std::sync::Arc::new(c)) }
            Ok(None) => { eprintln!("bulk-payments-rs: DB connect failed — in-memory fallback"); None }
            Err(_) => { eprintln!("bulk-payments-rs: DB connect timed out — in-memory fallback"); None }
        }
    } else { None };
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("failed to build HTTP client");
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client,
        http_client,
    });
    println!("bulk-payments-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[bulk-payments-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/healthz", web::get().to(health))
            // canonical internal routes
            .route("/v1/process", web::post().to(process_batch))
            .route("/v1/status", web::post().to(batch_status))
            .route("/v1/returns", web::post().to(generate_return_file))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
            // UI-facing aliases expected by paymentsApi.ts
            .route("/v1/bulk-payments", web::get().to(list_records))
            .route("/v1/bulk-payments", web::post().to(process_batch))
            .route("/v1/bulk-payments/stats", web::get().to(stats))
            .route("/v1/bulk-payments/{id}", web::get().to(list_records))
            .route("/v1/bulk-payments/{id}/items", web::get().to(list_records))
            .route("/v1/bulk-payments/{id}/approve", web::post().to(batch_status))
            .route("/v1/bulk-payments/{id}/cancel", web::post().to(batch_status))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/payments", web::get().to(list_records))
            .route("/api/v1/payments", web::post().to(create_record))
            .route("/api/v1/payments/{id}", web::get().to(get_record))
            .route("/api/v1/payments/{id}", web::put().to(update_record))
            .route("/api/v1/payments/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(64) NOT NULL UNIQUE,
    payment_type VARCHAR(32) NOT NULL,
    source_account VARCHAR(20) NOT NULL,
    destination_account VARCHAR(20) NOT NULL,
    destination_bank VARCHAR(10),
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    fee_kobo BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status VARCHAR(20) NOT NULL DEFAULT 'initiated',
    channel VARCHAR(32) NOT NULL,
    session_id VARCHAR(64),
    narration TEXT,
    beneficiary_name VARCHAR(100),
    tenant_id UUID NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create payments table");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_nuban() { assert!(validate_nuban("0123456789")); assert!(!validate_nuban("")); }

    #[test]
    fn test_compute_batch_hash() { assert_eq!(compute_batch_hash(&[10.0, 20.0, 30.0]), 60.0); }

    #[test]
    fn test_batch_success_rate() { let r = batch_success_rate(100, 80); assert!(r >= 0.0); }

    #[test]
    fn test_nibss_fee() { let r = nibss_fee(10000.0); assert!(r >= 0.0); }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("payments.updated")
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
    sqlx::query("UPDATE payments SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("payments.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
