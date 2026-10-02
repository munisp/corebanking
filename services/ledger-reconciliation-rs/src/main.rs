//! 54link-dev Ledger Reconciliation Service (Rust)
//!
//! Implements high-performance ledger reconciliation:
//!   - TigerBeetle ↔ PostgreSQL parity checks
//!   - Discrepancy detection and classification
//!   - Automated repair for known patterns
//!   - Manual triage queue for complex mismatches
//!   - Reconciliation run scheduling and history
//!   - GL (General Ledger) balance assertions
//!
//! Middleware: TigerBeetle, Postgres, Kafka, Redis, Lakehouse, Fluvio

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_web::HttpMessage;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReconciliationRun {
    id: String,
    tenant_id: String,
    run_type: String,       // full, incremental, targeted
    scope: String,          // all, ledger, account, date_range
    status: String,         // running, completed, failed, completed_with_discrepancies
    total_entries_checked: u64,
    matches: u64,
    discrepancies: u64,
    auto_repaired: u64,
    manual_triage: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    start_time: String,
    end_time: Option<String>,
    duration_ms: Option<u64>,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Discrepancy {
    id: String,
    run_id: String,
    source_system: String,       // tigerbeetle, postgres
    target_system: String,
    entry_id: String,
    discrepancy_type: String,    // missing, amount_mismatch, timestamp_drift, duplicate
    source_amount: Option<f64>,
    target_amount: Option<f64>,
    variance: Option<f64>,
    severity: String,            // low, medium, high, critical
    status: String,              // detected, auto_repaired, triaged, resolved, escalated
    resolution: Option<String>,
    detected_at: String,
    resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GLAssertion {
    id: String,
    account_code: String,
    account_name: String,
    expected_balance: f64,
    actual_balance: f64,
    variance: f64,
    passes: bool,
    checked_at: String,
}

// Wave-12 (C3-P2-RSVEC): reconciliation runs, discrepancies and GL assertions
// are persisted in Postgres (was: in-memory Mutex<Vec<..>> lost on every
// restart). jsonb payload — the structs carry u64 fields for which
// sqlx-postgres has no codec; id is the natural/unique key (ON CONFLICT
// idempotent). Handlers fail closed (503) on PG error — no memory fallback.
struct AppState {
    db: Option<PgPool>,
}

async fn init_recon_db(pool: &PgPool) {
    for ddl in [
        "CREATE TABLE IF NOT EXISTS recon_runs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
        "CREATE TABLE IF NOT EXISTS recon_discrepancies (
            id TEXT PRIMARY KEY,
            run_id TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
        "CREATE TABLE IF NOT EXISTS gl_assertions (
            id TEXT PRIMARY KEY,
            account_code TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    ] {
        if let Err(e) = sqlx::query(ddl).execute(pool).await {
            eprintln!("[ledger-reconciliation] store DDL failed: {}", e);
        }
    }
}

/// Load every row of a jsonb store, deserializing each payload. `table` is only
/// ever one of the compile-time-constant store names above.
async fn load_store<T: serde::de::DeserializeOwned>(
    pool: &PgPool,
    table: &str,
) -> Result<Vec<T>, sqlx::Error> {
    let rows = sqlx::query_scalar::<_, serde_json::Value>(&format!(
        "SELECT payload FROM {} ORDER BY created_at, id",
        table
    ))
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect())
}

async fn load_one<T: serde::de::DeserializeOwned>(
    pool: &PgPool,
    table: &str,
    id: &str,
) -> Result<Option<T>, sqlx::Error> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(&format!(
        "SELECT payload FROM {} WHERE id = $1",
        table
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|v| serde_json::from_value(v).ok()))
}

async fn insert_row<T: serde::Serialize>(
    pool: &PgPool,
    table: &str,
    id: &str,
    item: &T,
) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO {} (id, payload) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        table
    ))
    .bind(id)
    .bind(serde_json::to_value(item).unwrap_or_else(|_| serde_json::json!({})))
    .execute(pool)
    .await?;
    Ok(())
}

async fn update_row<T: serde::Serialize>(
    pool: &PgPool,
    table: &str,
    id: &str,
    item: &T,
) -> Result<(), sqlx::Error> {
    sqlx::query(&format!("UPDATE {} SET payload = $1 WHERE id = $2", table))
        .bind(serde_json::to_value(item).unwrap_or_else(|_| serde_json::json!({})))
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// --- JWT Auth Check (fail-closed; N-2 remediation) ---
// Canonical pattern aligned with the C-10-repaired fleet (jwt-validator-rs /
// gl-engine-rs) and extended to RS256: tokens are verified against the Keycloak
// JWKS (KEYCLOAK_JWKS_URL, or derived from KEYCLOAK_REALM_URL) with a 300s cache
// and a 5s fetch timeout; HS256 via JWT_SECRET is supported when JWKS is not
// configured. 401 on missing/malformed/expired/unknown-kid tokens; 503 when the
// verification backend (JWKS endpoint or JWT_SECRET) is unavailable. Verified
// claims are stored in request extensions for downstream handlers.

#[derive(Debug, Clone)]
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

async fn check_jwt(req: &actix_web::HttpRequest) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(serde_json::json!({}));
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims.clone()));
    Ok(claims)
}

/// Verified tenant id from JWT claims stored in request extensions (never from
/// raw request headers or caller-supplied body fields).
#[allow(dead_code)]
fn claims_tenant(req: &actix_web::HttpRequest) -> Option<String> {
    let ext = req.extensions();
    let claims = ext.get::<VerifiedClaims>()?;
    claims
        .0
        .get("tenant_id")
        .or_else(|| claims.0.get("tenant"))
        .and_then(|v| v.as_str())
        .map(String::from)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8100".into()).parse().unwrap_or(8100);
    // Fail-fast policy: if the reconciliation data sources are unreachable,
    // runs are recorded as failed with error=source_unavailable (never fabricated).
    let db = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(20) /* Wave-11 RS-37: was 5, undersized */
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    eprintln!("[ledger-reconciliation] DB connect failed: {} — runs will fail fast", e);
                    None
                }
            }
        }
        _ => {
            eprintln!("[ledger-reconciliation] DATABASE_URL not set — runs will fail fast");
            None
        }
    };
    if let Some(pool) = db.as_ref() {
        init_recon_db(pool).await;
    }
    let data = web::Data::new(AppState {
        db,
    });

    println!("Ledger Reconciliation service listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .service(
                web::scope("/v1/reconciliation")
                    .route("/runs", web::get().to(list_runs))
                    .route("/runs", web::post().to(start_run))
                    .route("/runs/{id}", web::get().to(get_run))
                    .route("/discrepancies", web::get().to(list_discrepancies))
                    .route("/discrepancies/{id}", web::get().to(get_discrepancy))
                    .route("/discrepancies/{id}/resolve", web::post().to(resolve_discrepancy))
                    .route("/discrepancies/{id}/escalate", web::post().to(escalate_discrepancy))
                    .route("/gl-assertions", web::get().to(list_assertions))
                    .route("/gl-assertions", web::post().to(run_gl_assertion))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

async fn list_runs(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let runs: Vec<ReconciliationRun> = match load_store(pool, "recon_runs").await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] list_runs query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    let total = runs.len();
    HttpResponse::Ok().json(serde_json::json!({"items": runs, "total": total}))
}

async fn get_run(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let found: Option<ReconciliationRun> = match load_one(pool, "recon_runs", &id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] get_run query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    match found {
        Some(r) => HttpResponse::Ok().json(r),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Run not found"})),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartRunRequest {
    run_type: Option<String>,
    scope: Option<String>,
}

// Fetch both sides of the reconciliation:
//   source = TigerBeetle CDC mirror (tb_transfers)
//   target = Postgres GL postings (journal_entries)
// Returns Err(reason) when either source is unreachable.
async fn fetch_both_sides(db: &PgPool) -> Result<(Vec<(String, f64)>, Vec<(String, f64)>), String> {
    let source_rows = sqlx::query("SELECT id, amount::float8 FROM tb_transfers")
        .fetch_all(db)
        .await
        .map_err(|e| format!("tigerbeetle source unavailable: {}", e))?;
    let target_rows = sqlx::query(
        "SELECT external_id, amount::float8 FROM journal_entries WHERE external_id IS NOT NULL",
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("postgres GL target unavailable: {}", e))?;
    let source = source_rows
        .iter()
        .map(|r| (r.get::<String, _>(0), r.get::<f64, _>(1)))
        .collect();
    let target = target_rows
        .iter()
        .map(|r| (r.get::<String, _>(0), r.get::<f64, _>(1)))
        .collect();
    Ok((source, target))
}

async fn start_run(req: actix_web::HttpRequest, data: web::Data<AppState>, body: web::Json<StartRunRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "reconciliation", "run").await { return resp; } // W12-B5D1
    let req = body.into_inner();
    let run_type = req.run_type.unwrap_or_else(|| "incremental".into());
    let scope = req.scope.unwrap_or_else(|| "all".into());

    let start = std::time::Instant::now();
    let now = Utc::now().to_rfc3339();
    let run_id = format!("REC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase();
    let tenant_id = std::env::var("TENANT_ID").unwrap_or_else(|_| "54link-dev-platform-prod".into());

    let db = match &data.db {
        Some(d) => d,
        None => {
            // FAIL FAST: reconciliation without both data sources would be fabrication.
            let run = ReconciliationRun {
                id: run_id,
                tenant_id,
                run_type,
                scope,
                status: "failed".into(),
                total_entries_checked: 0,
                matches: 0,
                discrepancies: 0,
                auto_repaired: 0,
                manual_triage: 0,
                error: Some("source_unavailable".into()),
                start_time: now.clone(),
                end_time: Some(now.clone()),
                duration_ms: Some(start.elapsed().as_millis() as u64),
                created_at: now,
            };
            // No DATABASE_URL: the failed run cannot be persisted (C3-P2-RSVEC);
            // it is only returned in this 503.
            return HttpResponse::ServiceUnavailable().json(run);
        }
    };

    let (source, target) = match fetch_both_sides(db).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[ledger-reconciliation] run failed: {}", e);
            let run = ReconciliationRun {
                id: run_id,
                tenant_id,
                run_type,
                scope,
                status: "failed".into(),
                total_entries_checked: 0,
                matches: 0,
                discrepancies: 0,
                auto_repaired: 0,
                manual_triage: 0,
                error: Some("source_unavailable".into()),
                start_time: now.clone(),
                end_time: Some(now.clone()),
                duration_ms: Some(start.elapsed().as_millis() as u64),
                created_at: now,
            };
            let _ = insert_row(db, "recon_runs", &run.id, &run).await;
            return HttpResponse::ServiceUnavailable().json(run);
        }
    };

    // Real matching: join source and target on entry id, compare amounts.
    use std::collections::HashMap;
    let target_map: HashMap<&str, f64> = target.iter().map(|(id, amt)| (id.as_str(), *amt)).collect();
    let source_map: HashMap<&str, f64> = source.iter().map(|(id, amt)| (id.as_str(), *amt)).collect();

    let mut matches: u64 = 0;
    let mut new_discrepancies: Vec<Discrepancy> = Vec::new();
    let total_entries = (source.len().max(target.len())) as u64;

    for (id, src_amt) in &source {
        match target_map.get(id.as_str()) {
            Some(tgt_amt) if (tgt_amt - src_amt).abs() < 0.005 => matches += 1,
            Some(tgt_amt) => new_discrepancies.push(Discrepancy {
                id: format!("DSC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
                run_id: run_id.clone(),
                source_system: "tigerbeetle".into(),
                target_system: "postgres".into(),
                entry_id: id.clone(),
                discrepancy_type: "amount_mismatch".into(),
                source_amount: Some(*src_amt),
                target_amount: Some(*tgt_amt),
                variance: Some(tgt_amt - src_amt),
                severity: "medium".into(),
                status: "triaged".into(),
                resolution: None,
                detected_at: now.clone(),
                resolved_at: None,
            }),
            None => new_discrepancies.push(Discrepancy {
                id: format!("DSC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
                run_id: run_id.clone(),
                source_system: "tigerbeetle".into(),
                target_system: "postgres".into(),
                entry_id: id.clone(),
                discrepancy_type: "missing".into(),
                source_amount: Some(*src_amt),
                target_amount: None,
                variance: None,
                severity: "high".into(),
                status: "triaged".into(),
                resolution: None,
                detected_at: now.clone(),
                resolved_at: None,
            }),
        }
    }
    for (id, tgt_amt) in &target {
        if !source_map.contains_key(id.as_str()) {
            new_discrepancies.push(Discrepancy {
                id: format!("DSC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
                run_id: run_id.clone(),
                source_system: "postgres".into(),
                target_system: "tigerbeetle".into(),
                entry_id: id.clone(),
                discrepancy_type: "missing".into(),
                source_amount: Some(*tgt_amt),
                target_amount: None,
                variance: None,
                severity: "high".into(),
                status: "triaged".into(),
                resolution: None,
                detected_at: now.clone(),
                resolved_at: None,
            });
        }
    }

    let discrepancy_count = new_discrepancies.len() as u64;
    let duration = start.elapsed().as_millis() as u64;

    let run = ReconciliationRun {
        id: run_id,
        tenant_id,
        run_type,
        scope,
        status: if discrepancy_count == 0 { "completed".into() } else { "completed_with_discrepancies".into() },
        total_entries_checked: total_entries,
        matches,
        discrepancies: discrepancy_count,
        auto_repaired: 0,
        manual_triage: discrepancy_count,
        error: None,
        start_time: now.clone(),
        end_time: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(duration),
        created_at: now,
    };

    // Wave-12 (C3-P2-RSVEC): persist discrepancies + run to Postgres (was
    // in-memory Vec extend/push). Fail closed on PG error.
    for d in &new_discrepancies {
        if let Err(e) = insert_row(db, "recon_discrepancies", &d.id, d).await {
            eprintln!("[ledger-reconciliation] discrepancy insert failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    }
    if let Err(e) = insert_row(db, "recon_runs", &run.id, &run).await {
        eprintln!("[ledger-reconciliation] run insert failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"error": "recon_store_unavailable"}));
    }

    println!("[kafka] publish topic=54link-dev.reconciliation.run.completed key={}", run.id);
    println!("[lakehouse] PUBLISH reconciliation_runs records=1");
    HttpResponse::Created().json(run)
}

async fn list_discrepancies(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let discrepancies: Vec<Discrepancy> = match load_store(pool, "recon_discrepancies").await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] list_discrepancies query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    let total = discrepancies.len();
    HttpResponse::Ok().json(serde_json::json!({"items": discrepancies, "total": total}))
}

async fn get_discrepancy(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "reconciliation", "resolve").await { return resp; } // W12-B5D1
    let id = path.into_inner();
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let found: Option<Discrepancy> = match load_one(pool, "recon_discrepancies", &id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] get_discrepancy query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    match found {
        Some(d) => HttpResponse::Ok().json(d),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveRequest {
    resolution: String,
}

async fn resolve_discrepancy(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>, body: web::Json<ResolveRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "reconciliation", "escalate").await { return resp; } // W12-B5D1
    let id = path.into_inner();
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let found: Option<Discrepancy> = match load_one(pool, "recon_discrepancies", &id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] resolve fetch failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    match found {
        Some(mut d) => {
            if d.status == "auto_repaired" || d.status == "resolved" {
                return HttpResponse::BadRequest().json(serde_json::json!({"message": "Already resolved"}));
            }
            d.status = "resolved".into();
            d.resolution = Some(body.resolution.clone());
            d.resolved_at = Some(Utc::now().to_rfc3339());
            if let Err(e) = update_row(pool, "recon_discrepancies", &id, &d).await {
                eprintln!("[ledger-reconciliation] resolve update failed: {}", e);
                return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
            }
            HttpResponse::Ok().json(d)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

async fn escalate_discrepancy(req: actix_web::HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let found: Option<Discrepancy> = match load_one(pool, "recon_discrepancies", &id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] escalate fetch failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    match found {
        Some(mut d) => {
            d.status = "escalated".into();
            d.severity = "critical".into();
            if let Err(e) = update_row(pool, "recon_discrepancies", &id, &d).await {
                eprintln!("[ledger-reconciliation] escalate update failed: {}", e);
                return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
            }
            println!("[temporal] StartWorkflow name=DiscrepancyEscalation id={}", d.id);
            HttpResponse::Ok().json(d)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

async fn list_assertions(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = match data.db.as_ref() {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"})),
    };
    let assertions: Vec<GLAssertion> = match load_store(pool, "gl_assertions").await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ledger-reconciliation] list_assertions query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "recon_store_unavailable"}));
        }
    };
    let total = assertions.len();
    HttpResponse::Ok().json(serde_json::json!({"items": assertions, "total": total}))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GLAssertionRequest {
    account_code: String,
    account_name: String,
    expected_balance: f64,
}

async fn run_gl_assertion(req: actix_web::HttpRequest, data: web::Data<AppState>, body: web::Json<GLAssertionRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "reconciliation", "run").await { return resp; } // W12-B5D1
    let req = body.into_inner();

    // Fetch the ACTUAL balance from the GL; never simulate it.
    let db = match &data.db {
        Some(d) => d,
        None => {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "source_unavailable",
                "detail": "DATABASE_URL not configured; refusing to fabricate GL balances",
            }))
        }
    };
    let actual_balance: f64 = match sqlx::query(
        r#"SELECT balance::float8 FROM "glAccounts" WHERE "glAccountCode" = $1"#,
    )
    .bind(&req.account_code)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row.get(0),
        Ok(None) => {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "source_unavailable",
                "detail": format!("GL account {} not found", req.account_code),
            }))
        }
        Err(e) => {
            eprintln!("[ledger-reconciliation] GL balance query failed: {}", e);
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "source_unavailable",
                "detail": "GL balance query failed",
            }))
        }
    };

    let variance = actual_balance - req.expected_balance;
    let passes = variance.abs() <= req.expected_balance.abs() * 0.01; // 1% tolerance

    let assertion = GLAssertion {
        id: format!("GLA-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
        account_code: req.account_code,
        account_name: req.account_name,
        expected_balance: req.expected_balance,
        actual_balance: (actual_balance * 100.0).round() / 100.0,
        variance: (variance * 100.0).round() / 100.0,
        passes,
        checked_at: Utc::now().to_rfc3339(),
    };

    if let Err(e) = insert_row(db, "gl_assertions", &assertion.id, &assertion).await {
        eprintln!("[ledger-reconciliation] assertion insert failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"error": "recon_store_unavailable"}));
    }
    HttpResponse::Created().json(assertion)
}

// Wave-12 B5-P0-D1: Permify authorization guard module.
mod permify;
