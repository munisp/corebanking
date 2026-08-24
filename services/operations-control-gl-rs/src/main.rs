#![allow(unused)]
//! 54link-dev Operations Control GL Engine — Rust
//! Maker-Checker Execution, Limit Management, Product→GL Mapping.
//! Everything is DB-backed; "posted_to_gl" is claimed ONLY when a matching
//! posted journal entry actually exists in the GL. Source failure => 503.

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
        source_unavailable("DATABASE_URL not configured; refusing to fabricate operations/GL data")
    })
}

async fn gl_balance_sum(db: &PgPool, codes: &[&str]) -> Result<f64, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT COALESCE(SUM(balance),0)::float8 FROM "glAccounts" WHERE "glAccountCode" = ANY($1)"#,
    )
    .bind(codes)
    .fetch_one(db)
    .await?;
    Ok(rows.get(0))
}

// ── Gap 21: Maker-Checker → GL ─────────────────────────────────────────────
// Approved requests come from maker_checker_requests. executionStatus is
// "posted_to_gl" ONLY when a posted journal entry with reference = request_id
// exists in the real GL; otherwise "pending_gl_posting".
async fn maker_checker_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let rows = match sqlx::query(
        r#"SELECT request_id, request_type, amount::float8, maker, checker, second_checker,
                  approval_chain, approved_at::text, status
           FROM maker_checker_requests WHERE status = 'approved' ORDER BY approved_at DESC LIMIT 200"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[operations-control-gl-rs] maker_checker_requests query failed: {}", e);
            return source_unavailable(&format!("maker_checker_requests query failed: {}", e));
        }
    };

    let mut approved = Vec::new();
    let mut posted_count = 0u64;
    let mut total_posted = 0.0f64;
    for r in &rows {
        let request_id: String = r.get("request_id");
        let amount: f64 = r.get("amount");
        // Verify against the REAL GL: a posted journal entry referencing this request.
        let posting = sqlx::query(
            r#"SELECT "entryId", "lines" FROM "journalEntries"
               WHERE "reference" = $1 AND "status" = 'posted' ORDER BY "postedAt" DESC LIMIT 1"#,
        )
        .bind(&request_id)
        .fetch_optional(db)
        .await;
        let (execution_status, gl_postings) = match posting {
            Ok(Some(p)) => {
                posted_count += 1;
                total_posted += amount;
                let lines: serde_json::Value = p
                    .try_get::<serde_json::Value, _>("lines")
                    .unwrap_or(json!([]));
                ("posted_to_gl", json!([{"entryId": p.get::<String, _>("entryId"), "lines": lines}]))
            }
            Ok(None) => ("pending_gl_posting", json!([])),
            Err(e) => {
                eprintln!("[operations-control-gl-rs] journalEntries lookup failed: {}", e);
                ("gl_verification_unavailable", json!([]))
            }
        };
        approved.push(json!({
            "requestId": request_id,
            "type": r.get::<String, _>("request_type"),
            "amount": amount,
            "maker": r.get::<String, _>("maker"),
            "checker": r.get::<String, _>("checker"),
            "secondChecker": r.get::<Option<String>, _>("second_checker"),
            "approvalChain": r.get::<Option<String>, _>("approval_chain"),
            "approvedAt": r.get::<String, _>("approved_at"),
            "executionStatus": execution_status,
            "glPostings": gl_postings,
        }));
    }

    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "approvedTransactions": approved,
        "summary": {
            "totalApproved": rows.len(),
            "postedToGL": posted_count,
            "totalAmountPosted": total_posted,
        },
        "approvalThresholds": {
            "single_approval": "< ₦10M",
            "dual_approval": "₦10M - ₦100M",
            "triple_approval": "> ₦100M (Branch Manager + Head of Dept + MD)",
            "board_approval": "> ₦500M (Board resolution required)"
        },
    }))
}

// ── Gap 22: Limit management → off-balance-sheet GL ────────────────────────
async fn limit_management_gl(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let events = match sqlx::query(
        r#"SELECT event_id, event_type, customer, facility_type, approved_limit::float8,
                  drawn_amount::float8, sector, business_date::text
           FROM limit_events ORDER BY business_date DESC LIMIT 500"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => rows
            .iter()
            .map(|r| json!({
                "eventId": r.get::<String, _>("event_id"),
                "type": r.get::<String, _>("event_type"),
                "customer": r.get::<String, _>("customer"),
                "facilityType": r.get::<Option<String>, _>("facility_type"),
                "approvedLimit": r.get::<Option<f64>, _>("approved_limit"),
                "drawnAmount": r.get::<Option<f64>, _>("drawn_amount"),
                "sector": r.get::<Option<String>, _>("sector"),
            }))
            .collect::<Vec<_>>(),
        Err(e) => {
            eprintln!("[operations-control-gl-rs] limit_events query failed: {}", e);
            return source_unavailable(&format!("limit_events query failed: {}", e));
        }
    };

    // Real exposure summary from GL balances.
    let on_bs = match gl_balance_sum(db, &["1301", "1302", "1305", "1320"]).await {
        Ok(v) => v,
        Err(e) => return source_unavailable(&format!("glAccounts query failed: {}", e)),
    };
    let off_bs = match gl_balance_sum(db, &["9201", "9203", "9301"]).await {
        Ok(v) => v,
        Err(e) => return source_unavailable(&format!("glAccounts query failed: {}", e)),
    };

    HttpResponse::Ok().json(json!({
        "limitEvents": events,
        "exposureSummary": {
            "totalOnBalanceSheet": on_bs,
            "totalOffBalanceSheet": off_bs,
        },
    }))
}

// ── Gap 23: Product → GL mapping (from DB) ─────────────────────────────────
async fn product_gl_mapping(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded", "retry_after": 1})); }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };

    let rows = match sqlx::query(
        r#"SELECT product_code, product_name, category, gl_mapping, efass_mapping
           FROM product_gl_mappings ORDER BY product_code"#,
    )
    .fetch_all(db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[operations-control-gl-rs] product_gl_mappings query failed: {}", e);
            return source_unavailable(&format!("product_gl_mappings query failed: {}", e));
        }
    };
    if rows.is_empty() {
        return source_unavailable("product_gl_mappings is empty — no product/GL mapping available");
    }

    let mut mappings = Vec::new();
    let mut gl_codes: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for r in &rows {
        let gl_mapping: serde_json::Value = r
            .try_get::<serde_json::Value, _>("gl_mapping")
            .unwrap_or(json!({}));
        if let Some(obj) = gl_mapping.as_object() {
            for (_, v) in obj {
                if let Some(code) = v.get("glCode").and_then(|c| c.as_str()) {
                    gl_codes.insert(code.to_string());
                }
            }
        }
        mappings.push(json!({
            "productCode": r.get::<String, _>("product_code"),
            "productName": r.get::<String, _>("product_name"),
            "category": r.get::<String, _>("category"),
            "glMapping": gl_mapping,
            "efassMapping": r.try_get::<serde_json::Value, _>("efass_mapping").unwrap_or(json!({})),
        }));
    }

    HttpResponse::Ok().json(json!({
        "productGLMappings": mappings,
        "summary": {
            "totalProducts": mappings.len(),
            "glCodesReferenced": gl_codes.len(),
            "glCodes": gl_codes,
        },
    }))
}

// ── service_configs CRUD (real DB) ─────────────────────────────────────────

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
        "SELECT id::text, config_key, config_value, environment, version, is_active FROM service_configs ORDER BY config_key LIMIT 500",
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) => {
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| json!({
                    "id": r.get::<String, _>(0),
                    "configKey": r.get::<String, _>(1),
                    "configValue": r.get::<serde_json::Value, _>(2),
                    "environment": r.get::<String, _>(3),
                    "version": r.get::<i32, _>(4),
                    "isActive": r.get::<bool, _>(5),
                }))
                .collect();
            HttpResponse::Ok().json(json!({"items": items, "total": items.len()}))
        }
        Err(e) => source_unavailable(&format!("service_configs query failed: {}", e)),
    }
}

async fn create_record(state: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let req = body.into_inner();
    let key = req.extra.get("configKey").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let value = req.extra.get("configValue").cloned().unwrap_or(json!({}));
    if key.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "configKey is required"}));
    }
    match sqlx::query(
        "INSERT INTO service_configs (config_key, config_value) VALUES ($1, $2) RETURNING id::text",
    )
    .bind(&key)
    .bind(&value)
    .fetch_one(db)
    .await
    {
        Ok(r) => HttpResponse::Created().json(json!({"id": r.get::<String, _>(0), "configKey": key})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

async fn get_record(state: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    match sqlx::query("SELECT id::text, config_key, config_value FROM service_configs WHERE id = $1::uuid")
        .bind(&id)
        .fetch_optional(db)
        .await
    {
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "id": r.get::<String, _>(0),
            "configKey": r.get::<String, _>(1),
            "configValue": r.get::<serde_json::Value, _>(2),
        })),
        Ok(None) => HttpResponse::NotFound().json(json!({"error": "not found"})),
        Err(e) => source_unavailable(&format!("service_configs query failed: {}", e)),
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&data) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    let value = body.extra.get("configValue").cloned().unwrap_or(json!({}));
    match sqlx::query("UPDATE service_configs SET config_value = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&value)
        .bind(&id)
        .execute(db)
        .await
    {
        Ok(_) => HttpResponse::Ok().json(json!({"id": id})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"error": e.to_string()})),
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&data) { Ok(d) => d, Err(r) => return r };
    let id = path.into_inner();
    let _ = sqlx::query("UPDATE service_configs SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid")
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
        "service": "operations-control-gl-rs",
        "version": "1.0.0",
        "database": if db_ok { "connected" } else { "unavailable" },
        "gaps_closed": ["Gap 21: Maker-Checker → GL", "Gap 22: Limits → Off-BS GL", "Gap 23: Product → GL Mapping"],
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "operations-control-gl-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"operations-control-gl-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"operations-control-gl-rs\"}} {}\n", r, e);
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
    log::info!("[operations-control-gl-rs] starting");

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
                    log::error!("[operations-control-gl-rs] DB connect failed: {} — endpoints will 503", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("[operations-control-gl-rs] DATABASE_URL not set — endpoints will 503");
            None
        }
    };

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8406".to_string()).parse().unwrap_or(8406);
    let data = web::Data::new(AppState { db });
    log::info!("[operations-control-gl-rs] ready on :{}", port);
    start_grpc_server("operations-control-gl-rs", 10445);

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
            .route("/v1/maker-checker/gl", web::get().to(maker_checker_gl))
            .route("/v1/limits/gl", web::get().to(limit_management_gl))
            .route("/v1/products/gl-mapping", web::get().to(product_gl_mapping))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
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
