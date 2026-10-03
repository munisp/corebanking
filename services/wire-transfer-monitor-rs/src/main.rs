use actix_web::{web, App, HttpServer, HttpResponse};
use actix_web::HttpMessage;
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, FromRow};
use std::time::Instant;

// ── Postgres persistence (W13-FIX-CRIT C9: Mutex<Vec> → sqlx PG store) ──
// Monitoring records lived in a process-local Mutex<Vec> and vanished on
// restart, while healthz advertised a postgres table that did not exist.
// wire_transfer_monitor_records (the advertised table) is now the system of
// record. Fail-closed: DB down => 503 on list/create/stats.
struct AppState {
    start_time: Instant,
    db: Option<PgPool>,
}

// DB row shape (typed cols + FromRow, canonical wave-12 rust store idiom).
#[derive(Debug, FromRow)]
struct WireTransferRow {
    id: String,
    tenant_id: String,
    status: String,
    data: serde_json::Value,
    created_at: chrono::DateTime<chrono::Utc>,
}

fn store_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "store_unavailable",
        "service": "wire-transfer-monitor-rs",
        "detail": detail,
    }))
}

fn require_db(state: &web::Data<AppState>) -> Result<&PgPool, HttpResponse> {
    state.db.as_ref().ok_or_else(|| {
        store_unavailable("DATABASE_URL not configured or unreachable; refusing to drop monitoring records")
    })
}

// Tenant from verified JWT claims (fallback X-Tenant-Id header / default).
fn request_tenant(req: &actix_web::HttpRequest) -> String {
    let claim_tenant = {
        let ext = req.extensions();
        ext.get::<VerifiedClaims>().and_then(|c| {
            c.0.get("tenant_id").or_else(|| c.0.get("tenant")).and_then(|v| v.as_str()).map(|s| s.to_string())
        })
    };
    claim_tenant.filter(|s| !s.is_empty())
        .or_else(|| req.headers().get("X-Tenant-Id").and_then(|v| v.to_str().ok()).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string())
}

async fn init_store() -> Option<PgPool> {
    let db_url = match std::env::var("DATABASE_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => {
            eprintln!("[wire-transfer-monitor-rs] DATABASE_URL not set — endpoints will 503");
            return None;
        }
    };
    let pool = match PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&db_url)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[wire-transfer-monitor-rs] DB connect failed: {} — endpoints will 503", e);
            return None;
        }
    };
    let schema = [
        r#"CREATE TABLE IF NOT EXISTS wire_transfer_monitor_records (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            data JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_wtm_records_tenant ON wire_transfer_monitor_records (tenant_id)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_wtm_records_status ON wire_transfer_monitor_records (status)"#,
    ];
    for stmt in schema {
        if let Err(e) = sqlx::query(stmt).execute(&pool).await {
            eprintln!("[wire-transfer-monitor-rs] schema init failed: {} — endpoints will 503", e);
            return None;
        }
    }
    eprintln!("[wire-transfer-monitor-rs] postgres store ready (table wire_transfer_monitor_records)");
    Some(pool)
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "wire-transfer-monitor-rs",
        "status": "healthy",
        "domain": "Wire Transfer Monitor",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "wire-transfer-monitor.events, wire-transfer-monitor.audit",
            "postgres": if state.db.is_some() { "wire_transfer_monitor_records" } else { "unavailable" },
            "redis": "wire-transfer-monitor_cache",
            "temporal": "WireTransferMonitorWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "wire-transfer-monitor-2026"
        }
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    let rows = match sqlx::query_as::<_, WireTransferRow>(
        "SELECT id, tenant_id, status, data, created_at FROM wire_transfer_monitor_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000")
        .bind(&tenant).fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("wire_transfer_monitor_records query failed: {}", e)),
    };
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM wire_transfer_monitor_records WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("wire_transfer_monitor_records count failed: {}", e)),
    };
    let records: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "id": r.id,
        "status": r.status,
        "domain": "Wire Transfer Monitor",
        "data": r.data,
        "createdAt": r.created_at.to_rfc3339(),
    })).collect();
    HttpResponse::Ok().json(json!({"records": records, "total": total, "domain": "Wire Transfer Monitor"}))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let permify_entity = body.get("id").and_then(|v| v.as_str())
        .or_else(|| body.get("transactionRef").and_then(|v| v.as_str()))
        .unwrap_or("wire-transfer-monitor");
    if let Err(resp) = permify_check(&req, "monitoring_rule", permify_entity, "manage").await { return resp; }
    // INSERT-first: the row is the system of record; a DB failure is loud
    // (503) — never a 201 for a dropped monitoring record.
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    let id = body.get("id").and_then(|v| v.as_str()).filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("WTM-{}", uuid::Uuid::new_v4()));
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string();
    let data = body.0.clone();
    match sqlx::query("INSERT INTO wire_transfer_monitor_records (id, tenant_id, status, data) VALUES ($1,$2,$3,$4)")
        .bind(&id).bind(&tenant).bind(&status).bind(&data)
        .execute(db).await {
        Ok(_) => HttpResponse::Created().json(json!({"created": true, "id": id, "data": data})),
        Err(e) => {
            eprintln!("[wire-transfer-monitor-rs] record insert failed: {}", e);
            store_unavailable(&format!("wire_transfer_monitor_records insert failed: {}", e))
        }
    }
}

async fn get_stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db = match require_db(&state) { Ok(d) => d, Err(r) => return r };
    let tenant = request_tenant(&req);
    // Real COUNTs from the store.
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM wire_transfer_monitor_records WHERE tenant_id = $1")
        .bind(&tenant).fetch_one(db).await {
        Ok(n) => n,
        Err(e) => return store_unavailable(&format!("stats query failed: {}", e)),
    };
    let rows = match sqlx::query_as::<_, (String, i64)>("SELECT status, COUNT(*) FROM wire_transfer_monitor_records WHERE tenant_id = $1 GROUP BY status")
        .bind(&tenant).fetch_all(db).await {
        Ok(r) => r,
        Err(e) => return store_unavailable(&format!("stats query failed: {}", e)),
    };
    let by_status: std::collections::HashMap<String, i64> = rows.into_iter().collect();
    let active = by_status.get("active").copied().unwrap_or(0);
    let pending = by_status.get("pending").copied().unwrap_or(0) + by_status.get("processing").copied().unwrap_or(0);
    let archived = by_status.get("completed").copied().unwrap_or(0) + by_status.get("archived").copied().unwrap_or(0);
    HttpResponse::Ok().json(json!({"total": total, "active": active, "pending": pending, "archived": archived, "by_status": by_status}))
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

// --- Permify authorization (W12-B5-P0-D3) ---
// Every mutating handler performs a REAL Permify permission check AFTER
// check_jwt has authenticated the caller. Subject = verified JWT sub (from
// VerifiedClaims in request extensions), tenant = X-Tenant-Id header or
// PERMIFY_DEFAULT_TENANT, resource = domain entity id, permission per action
// (schema: services/auth-service/schemas/permify/v2-kyc-compliance.fragment).
// FAIL-CLOSED: Permify unreachable/non-200 => 503; denied => 403.
// Canonical pattern: services/permify-authz-go/main.go:428 (REST check) and
// services/auth-service/adapters/permify.py check_permission.
fn permify_base_url() -> String {
    match std::env::var("PERMIFY_URL") {
        Ok(u) if !u.is_empty() => u.trim_end_matches('/').to_string(),
        _ => "http://permify:3476".to_string(),
    }
}

async fn permify_check(req: &actix_web::HttpRequest, entity_type: &str, entity_id: &str, permission: &str) -> Result<(), HttpResponse> {
    let subject = {
        let ext = req.extensions();
        ext.get::<VerifiedClaims>()
            .and_then(|c| c.0.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()))
    };
    let subject = match subject {
        Some(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"}))),
    };
    if entity_id.is_empty() {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"})));
    }
    let tenant_id = req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string());
    let payload = serde_json::json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_base_url(), tenant_id);
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
        Ok(c) => c,
        Err(_) => return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify client init failed (fail-closed)"}))),
    };
    let resp = match client.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[permify] FAIL-CLOSED check {} on {}:{} unreachable: {}", permission, entity_type, entity_id, e);
            return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})));
        }
    };
    if !resp.status().is_success() {
        return Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})));
    }
    let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({}));
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED")
        || body.get("can").and_then(|v| v.as_bool()) == Some(true);
    if !allowed {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9325".to_string());
    // Fail-closed store: None => all data endpoints 503 (no in-memory fallback).
    let db = init_store().await;
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        db,
    });
    println!("Wire Transfer Monitor (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/wire-transfer-monitor/list", web::get().to(list_records))
            .route("/v1/wire-transfer-monitor/create", web::post().to(create_record))
            .route("/v1/wire-transfer-monitor/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

// W12-B5-P0-D3: removed the generator-emitted update_record/delete_record
// stubs that trailed this file. They were never registered in main() above
// (unreachable dead code) and referenced a nonexistent CreateRequest type and
// AppState.db field, so the crate did not compile. The only routed mutating
// handler is create_record, now Permify-gated.
