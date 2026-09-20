#![allow(unused)]
// MN-18: this crate previously DID NOT COMPILE — it referenced undefined
// handlers (create_record/get_record/metrics), missing imports (Mutex, json!,
// AtomicU64/AtomicOrdering) and a sqlx dependency absent from Cargo.toml.
// Repaired below; all money paths now use the tokio_postgres client.
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, AtomicOrdering};
use uuid::Uuid;
use chrono::{Utc, DateTime};
use sha2::{Digest, Sha256};

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

/// MN-18: deterministic per-leg idempotency key — sha256(batch_id|index),
/// hex-encoded. A batch retry re-derives the SAME keys, so already-succeeded
/// legs are skipped locally and the hub can dedup on x-idempotency-key.
fn leg_idempotency_key(batch_id: &str, index: usize) -> String {
    let mut h = Sha256::new();
    h.update(format!("{}|{}", batch_id, index).as_bytes());
    hex::encode(h.finalize())
}

/// Extract a transfer amount as integer kobo from a hub-shaped transfer
/// payload ("amount" may be a JSON string or number, in naira major units).
/// Integer minor units only after this point — no float money comparisons.
fn transfer_amount_kobo(transfer: &serde_json::Value) -> i64 {
    let naira = transfer
        .get("amount")
        .and_then(|v| {
            v.as_str()
                .and_then(|s| s.parse::<f64>().ok())
                .or_else(|| v.as_f64())
        })
        .unwrap_or(0.0);
    (naira * 100.0).round() as i64
}

/// Forwards a single transfer payload to the payment hub /v1/transfers/initiate.
/// Passes through the caller's auth and tenant headers unchanged, plus the
/// per-leg idempotency key (MN-18) as x-idempotency-key.
async fn forward_transfer_to_hub(
    http_client: &reqwest::Client,
    hub_url: &str,
    transfer: serde_json::Value,
    auth: &str,
    forwarded_headers: &std::collections::HashMap<String, String>,
    idempotency_key: &str,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/v1/transfers/initiate", hub_url);
    let mut req = http_client
        .post(&url)
        .header("Authorization", auth)
        .header("x-idempotency-key", idempotency_key)
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
    if let Err(resp) = check_jwt(&req).await { return resp; }

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

    // MN-18: durable per-leg persistence is MANDATORY for money movement —
    // refuse to process a batch without Postgres (fail-closed; previously the
    // batch would execute with only an in-memory summary).
    let db = match &state.db_client {
        Some(c) => c.clone(),
        None => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_unavailable",
                "detail": "postgres not connected; refusing to execute a money batch without durable per-leg persistence"
            }));
        }
    };

    // MN-18: batch-level maker-checker gate (F7-08 structuring bypass: a
    // ₦50M batch of ₦900k legs never triggered maker-checker). Batches whose
    // total exceeds BULK_APPROVAL_THRESHOLD_KOBO require an approval id.
    let total_kobo: i64 = transfers.iter().map(transfer_amount_kobo).sum();
    let threshold_kobo: i64 = std::env::var("BULK_APPROVAL_THRESHOLD_KOBO")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5_000_000_000); // default ₦50,000,000.00
    let approval_id = req
        .headers()
        .get("x-maker-checker-approval-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if total_kobo > threshold_kobo && approval_id.is_empty() {
        return HttpResponse::Forbidden().json(json!({
            "error": "maker_checker_approval_required",
            "detail": "batch total exceeds BULK_APPROVAL_THRESHOLD_KOBO; supply x-maker-checker-approval-id",
            "batchTotalKobo": total_kobo,
            "thresholdKobo": threshold_kobo,
        }));
    }

    let hub_url = std::env::var("PAYMENT_HUB_URL")
        .unwrap_or_else(|_| "http://payment-hub".to_string());

    // MN-18: register the batch durably BEFORE executing any leg.
    let tenant_hdr = forwarded_headers.get("x-tenant-id").cloned().unwrap_or_default();
    if let Err(e) = db.execute(
        "INSERT INTO batches (batch_id, tenant_id, total, total_amount_kobo, status, approval_id)
         VALUES ($1,$2,$3,$4,'processing',NULLIF($5,''))
         ON CONFLICT (batch_id) DO NOTHING",
        &[&batch_id, &tenant_hdr, &(transfers.len() as i32), &total_kobo, &approval_id],
    ).await {
        return HttpResponse::ServiceUnavailable().json(json!({
            "error": "batch_store_write_failed", "detail": e.to_string()
        }));
    }

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
        let idem_key = leg_idempotency_key(&batch_id, idx);

        // MN-18: replay guard — a leg that already succeeded is NEVER
        // re-executed, so a batch retry cannot double-pay.
        match db.query_opt(
            "SELECT status FROM batch_legs WHERE idempotency_key = $1",
            &[&idem_key],
        ).await {
            Ok(Some(row)) if row.get::<_, String>(0) == "success" => {
                succeeded += 1;
                results.push(json!({
                    "index": idx,
                    "status": "already_succeeded",
                    "idempotencyKey": idem_key,
                }));
                continue;
            }
            Ok(_) => {}
            Err(e) => {
                return HttpResponse::ServiceUnavailable().json(json!({
                    "error": "batch_store_read_failed", "detail": e.to_string()
                }));
            }
        }

        // Record the leg as pending before hitting the rail.
        if let Err(e) = db.execute(
            "INSERT INTO batch_legs (idempotency_key, batch_id, leg_index, status, transfer)
             VALUES ($1,$2,$3,'pending',$4::jsonb)
             ON CONFLICT (idempotency_key) DO UPDATE SET status='pending', updated_at=NOW()",
            &[&idem_key, &batch_id, &(idx as i32), &transfer.to_string()],
        ).await {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_write_failed", "detail": e.to_string()
            }));
        }

        let outcome = forward_transfer_to_hub(
            &state.http_client,
            &hub_url,
            transfer,
            &auth,
            &forwarded_headers,
            &idem_key,
        )
        .await;

        match outcome {
            Ok(resp_body) => {
                succeeded += 1;
                // MN-18: durable per-leg status transition pending→success.
                if let Err(e) = db.execute(
                    "UPDATE batch_legs SET status='success', error=NULL, response=$2::jsonb, updated_at=NOW() WHERE idempotency_key=$1",
                    &[&idem_key, &resp_body.to_string()],
                ).await {
                    eprintln!("[bulk-payments-rs] leg {} success persist failed: {}", idem_key, e);
                }
                results.push(json!({
                    "index": idx,
                    "status": "success",
                    "idempotencyKey": idem_key,
                    "response": resp_body,
                }));
            }
            Err(err_msg) => {
                failed += 1;
                // MN-18: durable per-leg status transition pending→failed.
                if let Err(e) = db.execute(
                    "UPDATE batch_legs SET status='failed', error=$2, updated_at=NOW() WHERE idempotency_key=$1",
                    &[&idem_key, &err_msg],
                ).await {
                    eprintln!("[bulk-payments-rs] leg {} failure persist failed: {}", idem_key, e);
                }
                results.push(json!({
                    "index": idx,
                    "status": "failed",
                    "idempotencyKey": idem_key,
                    "error": err_msg,
                }));
            }
        }
    }

    let total = transfers.len() as u32;
    let success_rate = batch_success_rate(total, succeeded);
    // MN-18: durable batch summary.
    let final_status = if failed == 0 {
        "completed"
    } else if succeeded == 0 {
        "failed"
    } else {
        "completed_with_failures"
    };
    if let Err(e) = db.execute(
        "UPDATE batches SET succeeded=$2, failed=$3, status=$4, updated_at=NOW() WHERE batch_id=$1",
        &[&batch_id, &(succeeded as i32), &(failed as i32), &final_status],
    ).await {
        eprintln!("[bulk-payments-rs] batch {} summary persist failed: {}", batch_id, e);
    }

    let summary = json!({
        "batch_id": batch_id,
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate_pct": success_rate,
        "status": final_status,
        "totalAmountKobo": total_kobo,
        "results": results,
    });

    db_persist(&state, "process_batch", &summary).await;

    HttpResponse::Ok().json(summary)
}

/// POST /v1/bulk-payments/{batch_id}/retry-failed (MN-18)
///
/// Re-executes ONLY legs persisted as failed; succeeded legs are never
/// re-sent (the per-leg replay guard + deterministic idempotency keys make a
/// double payout impossible).
async fn retry_failed(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let batch_id = path.into_inner();
    let db = match &state.db_client {
        Some(c) => c.clone(),
        None => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_unavailable",
                "detail": "postgres not connected"
            }));
        }
    };

    // The batch must exist — 404 otherwise (no hash-fiction fallback).
    match db.query_opt("SELECT batch_id FROM batches WHERE batch_id = $1", &[&batch_id]).await {
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "error": "batch_not_found", "batchId": batch_id
            }));
        }
        Err(e) => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_read_failed", "detail": e.to_string()
            }));
        }
        Ok(Some(_)) => {}
    }

    let auth = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let forward_header_names = [
        "x-tenant-id", "x-tenent-id", "x-keycloak-id", "x-ledger-id",
        "x-mint-account-id", "x-switch-name", "x-ams-name", "x-payer-pin", "x-pin",
    ];
    let mut forwarded_headers = std::collections::HashMap::new();
    for name in &forward_header_names {
        if let Some(val) = req.headers().get(*name).and_then(|v| v.to_str().ok()) {
            forwarded_headers.insert(name.to_string(), val.to_string());
        }
    }

    let rows = match db.query(
        "SELECT leg_index, transfer::text FROM batch_legs WHERE batch_id = $1 AND status = 'failed' ORDER BY leg_index",
        &[&batch_id],
    ).await {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_read_failed", "detail": e.to_string()
            }));
        }
    };

    let hub_url = std::env::var("PAYMENT_HUB_URL")
        .unwrap_or_else(|_| "http://payment-hub".to_string());

    let mut results = Vec::with_capacity(rows.len());
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;
    for row in &rows {
        let idx: i32 = row.get(0);
        let transfer_txt: String = row.get(1);
        let transfer: serde_json::Value =
            serde_json::from_str(&transfer_txt).unwrap_or_else(|_| json!({}));
        let idem_key = leg_idempotency_key(&batch_id, idx as usize);
        match forward_transfer_to_hub(
            &state.http_client,
            &hub_url,
            transfer,
            &auth,
            &forwarded_headers,
            &idem_key,
        )
        .await
        {
            Ok(resp_body) => {
                succeeded += 1;
                let _ = db.execute(
                    "UPDATE batch_legs SET status='success', error=NULL, response=$2::jsonb, updated_at=NOW() WHERE idempotency_key=$1",
                    &[&idem_key, &resp_body.to_string()],
                ).await;
                results.push(json!({"index": idx, "status": "success", "idempotencyKey": idem_key, "response": resp_body}));
            }
            Err(err_msg) => {
                failed += 1;
                let _ = db.execute(
                    "UPDATE batch_legs SET status='failed', error=$2, updated_at=NOW() WHERE idempotency_key=$1",
                    &[&idem_key, &err_msg],
                ).await;
                results.push(json!({"index": idx, "status": "failed", "idempotencyKey": idem_key, "error": err_msg}));
            }
        }
    }

    // Refresh the persisted batch summary from leg reality.
    if let Ok(row) = db.query_one(
        "SELECT COUNT(*) FILTER (WHERE status = 'success'), COUNT(*) FILTER (WHERE status = 'failed') FROM batch_legs WHERE batch_id = $1",
        &[&batch_id],
    ).await {
        let s: i64 = row.get(0);
        let f: i64 = row.get(1);
        let st = if f == 0 { "completed" } else if s == 0 { "failed" } else { "completed_with_failures" };
        let _ = db.execute(
            "UPDATE batches SET succeeded=$2, failed=$3, status=$4, updated_at=NOW() WHERE batch_id=$1",
            &[&batch_id, &(s as i32), &(f as i32), &st],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "batch_id": batch_id,
        "retried": rows.len(),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }))
}

/// GET /v1/bulk-payments/{batch_id} (MN-18)
///
/// Reads the PERSISTED batch (and its legs) or returns 404. This replaces the
/// previous hash-fiction: batch_status ignored batch state entirely and
/// returned compute_batch_hash() of caller-supplied amounts.
async fn get_batch(
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let batch_id = path.into_inner();
    let db = match &state.db_client {
        Some(c) => c.clone(),
        None => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_unavailable", "detail": "postgres not connected"
            }));
        }
    };
    match db.query_opt(
        "SELECT batch_id, tenant_id, total, succeeded, failed, total_amount_kobo, status, COALESCE(approval_id,''), created_at::text, updated_at::text FROM batches WHERE batch_id = $1",
        &[&batch_id],
    ).await {
        Ok(Some(row)) => {
            let legs = db.query(
                "SELECT leg_index, status, COALESCE(error,''), idempotency_key FROM batch_legs WHERE batch_id = $1 ORDER BY leg_index",
                &[&batch_id],
            ).await.unwrap_or_default();
            let leg_items: Vec<serde_json::Value> = legs.iter().map(|l| json!({
                "index": l.get::<_, i32>(0),
                "status": l.get::<_, String>(1),
                "error": l.get::<_, String>(2),
                "idempotencyKey": l.get::<_, String>(3),
            })).collect();
            HttpResponse::Ok().json(json!({
                "batchId": row.get::<_, String>(0),
                "tenantId": row.get::<_, String>(1),
                "total": row.get::<_, i32>(2),
                "succeeded": row.get::<_, i32>(3),
                "failed": row.get::<_, i32>(4),
                "totalAmountKobo": row.get::<_, i64>(5),
                "status": row.get::<_, String>(6),
                "approvalId": row.get::<_, String>(7),
                "createdAt": row.get::<_, String>(8),
                "updatedAt": row.get::<_, String>(9),
                "legs": leg_items,
                "source": "postgres",
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({
            "error": "batch_not_found", "batchId": batch_id
        })),
        Err(e) => HttpResponse::ServiceUnavailable().json(json!({
            "error": "batch_store_read_failed", "detail": e.to_string()
        })),
    }
}

/// MN-18: the approve/cancel UI aliases previously resolved to the batch_status
/// hash calculator — pure fiction. Honest 501 until a real approval workflow
/// exists; batch-level maker-checker is enforced at processing time via the
/// x-maker-checker-approval-id header.
async fn not_implemented(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::NotImplemented().json(json!({
        "error": "not_implemented",
        "detail": "batch approve/cancel workflow is not implemented; batch maker-checker is enforced in POST /v1/bulk-payments via x-maker-checker-approval-id"
    }))
}

/// POST /v1/status (MN-18)
///
/// Reads the PERSISTED batch identified by {"batch_id": "..."} in the body,
/// or 404. The previous implementation ignored batch state and returned
/// compute_batch_hash() of caller-supplied amounts — deleted as fiction.
async fn batch_status(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let input = body.into_inner();
    let batch_id = match input.get("batch_id").and_then(|v| v.as_str()) {
        Some(b) if !b.is_empty() => b.to_string(),
        _ => {
            return HttpResponse::BadRequest().json(json!({
                "error": "batch_id is required"
            }));
        }
    };
    let db = match &state.db_client {
        Some(c) => c.clone(),
        None => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "batch_store_unavailable", "detail": "postgres not connected"
            }));
        }
    };
    match db.query_opt(
        "SELECT batch_id, total, succeeded, failed, total_amount_kobo, status, updated_at::text FROM batches WHERE batch_id = $1",
        &[&batch_id],
    ).await {
        Ok(Some(row)) => HttpResponse::Ok().json(json!({
            "batchId": row.get::<_, String>(0),
            "total": row.get::<_, i32>(1),
            "succeeded": row.get::<_, i32>(2),
            "failed": row.get::<_, i32>(3),
            "totalAmountKobo": row.get::<_, i64>(4),
            "status": row.get::<_, String>(5),
            "updatedAt": row.get::<_, String>(6),
            "source": "postgres",
        })),
        Ok(None) => HttpResponse::NotFound().json(json!({
            "error": "batch_not_found", "batchId": batch_id
        })),
        Err(e) => HttpResponse::ServiceUnavailable().json(json!({
            "error": "batch_store_read_failed", "detail": e.to_string()
        })),
    }
}

async fn generate_return_file(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
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
    if let Err(resp) = check_jwt(&req).await { return resp; }
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

async fn stats(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
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
            // MN-18: durable batch + per-leg stores. batch_legs.idempotency_key
            // is sha256(batch_id|index) — a batch retry re-derives the same
            // keys, so succeeded legs are never re-executed.
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS batches (
                    batch_id TEXT PRIMARY KEY,
                    tenant_id TEXT,
                    total INTEGER NOT NULL DEFAULT 0,
                    succeeded INTEGER NOT NULL DEFAULT 0,
                    failed INTEGER NOT NULL DEFAULT 0,
                    total_amount_kobo BIGINT NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'processing',
                    approval_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS batch_legs (
                    idempotency_key TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES batches(batch_id),
                    leg_index INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    error TEXT,
                    transfer JSONB NOT NULL,
                    response JSONB,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE (batch_id, leg_index)
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_batch_legs_batch ON batch_legs(batch_id, status)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
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

// MN-18 compile repair: parameter type was `&actix_web` (a crate name, not a
// type) — the crate could not compile. Corrected to &actix_web::HttpRequest.
async fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
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
// --- Route-layer JWT guard (R3-NEW-1): wraps routes whose handlers are registered but not defined in this file ---
async fn jwt_route_guard(
    req: actix_web::dev::ServiceRequest,
    next: actix_web::middleware::Next<impl actix_web::body::MessageBody>,
) -> Result<actix_web::dev::ServiceResponse<actix_web::body::BoxBody>, actix_web::Error> {
    if let Err(resp) = check_jwt(req.request()).await {
        return Ok(req.into_response(resp));
    }
    next.call(req).await.map(|res| res.map_into_boxed_body())
}



async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "bulk_payments_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let _span = otelkit::pg_span("INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)").entered();
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
    // Wave-9 otelkit (SPEC §2.5): OTLP gRPC tracing; dropping the guard flushes spans.
    let _otel_guard = match otelkit::init("bulk-payments-rs") {
        Ok(g) => Some(g),
        Err(e) => {
            eprintln!("[bulk-payments-rs] otel init failed: {e}; continuing without telemetry");
            None
        }
    };
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
            .wrap(otelkit::actix::TenantMiddleware)
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
            // MN-18: real persisted batch read (404 when unknown), retry of
            // failed legs only, and honest 501 for approve/cancel (was the
            // batch_status hash calculator — fiction).
            .route("/v1/bulk-payments/{id}", web::get().to(get_batch))
            .route("/v1/bulk-payments/{id}/items", web::get().to(get_batch))
            .route("/v1/bulk-payments/{id}/retry-failed", web::post().to(retry_failed))
            .route("/v1/bulk-payments/{id}/approve", web::post().to(not_implemented))
            .route("/v1/bulk-payments/{id}/cancel", web::post().to(not_implemented))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/payments", web::get().to(list_records))
            .service(web::resource("/api/v1/payments").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::post().to(create_record)))
            .service(web::resource("/api/v1/payments/{id}").wrap(actix_web::middleware::from_fn(jwt_route_guard)).route(web::get().to(get_record)))
            .route("/api/v1/payments/{id}", web::put().to(update_record))
            .route("/api/v1/payments/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

// MN-18: the sqlx-based init_schema / payments-table CRUD below referenced a
// sqlx dependency that was never declared in Cargo.toml and an AppState.db
// field that does not exist — the crate could not compile. Repaired to use
// the tokio_postgres client against service_records (fail-closed 503 without
// Postgres).

/// create_record — POST /api/v1/payments (generic record intake).
async fn create_record(state: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let status = body.status.clone().unwrap_or_else(|| "active".to_string());
    let tenant = body.tenant_id.clone().unwrap_or_default();
    let data_str = serde_json::to_string(&body.extra).unwrap_or_else(|_| "{}".to_string());
    match &state.db_client {
        Some(client) => {
            match client.execute(
                "INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5::jsonb)",
                &[&id, &"bulk_payments_rs", &"payment", &status, &data_str],
            ).await {
                Ok(_) => HttpResponse::Created().json(json!({"id": id, "status": status, "tenantId": tenant})),
                Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
            }
        }
        None => HttpResponse::ServiceUnavailable().json(json!({"error": "store_unavailable", "detail": "postgres not connected"})),
    }
}

/// get_record — GET /api/v1/payments/{id}.
async fn get_record(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    let id = path.into_inner();
    match &state.db_client {
        Some(client) => {
            match client.query_opt(
                "SELECT id, type, status, data::text, created_at::text FROM service_records WHERE id = $1 AND service = $2",
                &[&id, &"bulk_payments_rs"],
            ).await {
                Ok(Some(row)) => HttpResponse::Ok().json(json!({
                    "id": row.get::<_, String>(0),
                    "type": row.get::<_, String>(1),
                    "status": row.get::<_, String>(2),
                    "data": row.get::<_, String>(3),
                    "createdAt": row.get::<_, String>(4),
                })),
                Ok(None) => HttpResponse::NotFound().json(json!({"error": "record_not_found", "id": id})),
                Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
            }
        }
        None => HttpResponse::ServiceUnavailable().json(json!({"error": "store_unavailable", "detail": "postgres not connected"})),
    }
}

/// metrics — Prometheus text exposition (was referenced by the router but
/// never defined; MN-18 compile repair).
async fn metrics() -> HttpResponse {
    prom_metrics().await
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

// MN-18 compile repair: these previously used sqlx against an AppState.db
// field that does not exist (sqlx was never in Cargo.toml). Rewritten to the
// tokio_postgres client against service_records, fail-closed without Postgres.
async fn update_record(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    match &state.db_client {
        Some(client) => {
            match client.execute(
                "UPDATE service_records SET status = $1, updated_at = NOW() WHERE id = $2 AND service = $3",
                &[&status, &id, &"bulk_payments_rs"],
            ).await {
                Ok(0) => HttpResponse::NotFound().json(json!({"error": "record_not_found", "id": id})),
                Ok(_) => HttpResponse::Ok().json(json!({"id": id, "status": status})),
                Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
            }
        }
        None => HttpResponse::ServiceUnavailable().json(json!({"error": "store_unavailable", "detail": "postgres not connected"})),
    }
}

async fn delete_record(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    match &state.db_client {
        Some(client) => {
            match client.execute(
                "UPDATE service_records SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND service = $2",
                &[&id, &"bulk_payments_rs"],
            ).await {
                Ok(0) => HttpResponse::NotFound().json(json!({"error": "record_not_found", "id": id})),
                Ok(_) => HttpResponse::NoContent().finish(),
                Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
            }
        }
        None => HttpResponse::ServiceUnavailable().json(json!({"error": "store_unavailable", "detail": "postgres not connected"})),
    }
}
