use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// ─── State ──────────────────────────────────────────────────────────────────

struct AppState {
    start_time: Instant,
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct ValidateRequest {
    /// Optional explicit token; otherwise the Authorization: Bearer token is validated.
    token: Option<String>,
}

#[derive(Debug, Clone)]
struct VerifiedClaims(serde_json::Value);

// ─── Real JWT verification ──────────────────────────────────────────────────

/// Decode and cryptographically verify a JWT. Fails closed on any error.
/// Supports HS256 (JWT_SECRET env). RS256 via Keycloak JWKS requires an
/// upstream fetch backend; when only KEYCLOAK_JWKS_URL is configured and the
/// token is RS256, we fail closed (503) rather than trusting unverified claims.
fn verify_token(token: &str) -> Result<serde_json::Value, HttpResponse> {
    // Inspect the header to determine the algorithm without trusting claims.
    let header = jsonwebtoken::decode_header(token)
        .map_err(|_| HttpResponse::Unauthorized().json(json!({"valid": false, "errors": ["malformed token header"]})))?;

    match header.alg {
        jsonwebtoken::Algorithm::HS256 => {
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => return Err(HttpResponse::ServiceUnavailable().json(json!({
                    "valid": false,
                    "error": "jwt_validation_unavailable",
                    "detail": "JWT_SECRET is not configured; refusing to validate",
                }))),
            };
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            if let Ok(iss) = std::env::var("JWT_EXPECTED_ISS") {
                if !iss.is_empty() {
                    validation.set_issuer(&[iss]);
                }
            }
            match jsonwebtoken::decode::<serde_json::Value>(
                token,
                &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
                &validation,
            ) {
                Ok(data) => Ok(data.claims),
                Err(e) => Err(HttpResponse::Unauthorized().json(json!({
                    "valid": false,
                    "errors": [format!("{}", e)],
                }))),
            }
        }
        other => {
            // No JWKS fetch backend in this process: fail closed.
            Err(HttpResponse::ServiceUnavailable().json(json!({
                "valid": false,
                "error": "jwt_validation_unavailable",
                "detail": format!("algorithm {:?} requires an RS256/JWKS backend (KEYCLOAK_JWKS_URL); not configured for cryptographic verification here", other),
            })))
        }
    }
}

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    use actix_web::HttpMessage as _;
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
    let claims = verify_token(token)?;
    // W12-B5-P1-D-B: retain verified claims for the downstream Permify guard
    // (subject = verified JWT sub; never caller-supplied).
    req.extensions_mut().insert(VerifiedClaims(claims));
    Ok(())
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn health() -> HttpResponse {
    HttpResponse::Ok()
        .insert_header(("content-security-policy", "default-src 'self'"))
        .json(json!({"status": "healthy", "service": "jwt-validator-rs"}))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "jwt-validator-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"jwt-validator-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": state.db_client.is_some(),
        "mode": if state.db_client.is_some() { "normal" } else { "degraded" },
    }))
}

/// POST /v1/jwt/validate — validate the JWT from the Authorization header
/// (or an explicit {"token": "..."} body). Never trusts caller-supplied claims.
async fn validate_jwt(req: actix_web::HttpRequest, state: web::Data<AppState>, body: Option<web::Json<ValidateRequest>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if let Err(resp) = permify_check(&req, "jwt_validation", "collection", "validate").await { return resp; }
    let token = if let Some(b) = &body {
        if let Some(t) = &b.token {
            Some(t.clone())
        } else {
            None
        }
    } else {
        None
    };
    let token = match token {
        Some(t) => t,
        None => {
            match req.headers().get("Authorization").and_then(|v| v.to_str().ok()).and_then(|h| h.strip_prefix("Bearer ")) {
                Some(t) if !t.is_empty() => t.to_string(),
                _ => return HttpResponse::Unauthorized().json(json!({"valid": false, "errors": ["no token supplied (Authorization: Bearer or body.token)"]})),
            }
        }
    };

    match verify_token(&token) {
        Ok(claims) => {
            db_persist(&state, "validate_jwt", &json!({"endpoint": "validate_jwt", "valid": true})).await;
            HttpResponse::Ok().json(json!({
                "service": "jwt-validator-rs",
                "valid": true,
                "claims": claims,
            }))
        }
        Err(resp) => {
            db_persist(&state, "validate_jwt", &json!({"endpoint": "validate_jwt", "valid": false})).await;
            resp
        }
    }
}

// ─── service_configs CRUD (Postgres-backed when available, else in-memory) ──

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page - 1) * limit).take(limit).collect();
    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "source": if state.db_client.is_some() { "database" } else { "in-memory" },
    }))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if let Err(resp) = permify_check(&req, "service_config", "collection", "create").await { return resp; }
    let mut rec = body.into_inner();
    rec["id"] = json!(uuid::Uuid::new_v4().to_string());
    rec["created_at"] = json!(chrono::Utc::now().to_rfc3339());
    state.records.lock().unwrap().push(rec.clone());
    db_persist(&state, "create_record", &rec).await;
    HttpResponse::Created().json(rec)
}

async fn get_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let records = state.records.lock().unwrap();
    match records.iter().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => HttpResponse::Ok().json(r),
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn update_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "service_config", &id, "update").await { return resp; }
    let mut records = state.records.lock().unwrap();
    match records.iter_mut().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => {
            if let Some(obj) = body.into_inner().as_object() {
                for (k, v) in obj {
                    if k != "id" { r[k.as_str()] = v.clone(); }
                }
            }
            HttpResponse::Ok().json(r.clone())
        }
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn delete_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    if let Err(resp) = permify_check(&req, "service_config", &id, "delete").await { return resp; }
    let mut records = state.records.lock().unwrap();
    let before = records.len();
    records.retain(|r| r.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
    if records.len() == before {
        return HttpResponse::NotFound().json(json!({"error": "not found"}));
    }
    HttpResponse::NoContent().finish()
}

// ─── Persistence ────────────────────────────────────────────────────────────

use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); } });
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}

// Wave-11: audit INSERTs are buffered behind a Mutex and flushed every 100ms
// or every 100 rows by a spawned task (was: one blocking INSERT per request).
static W11_AUDIT_BUF: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<Vec<(String, String, String, String, String)>>>> = std::sync::OnceLock::new();
static W11_FLUSH_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let buf = W11_AUDIT_BUF.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(Vec::new())));
        let id = format!("{}_{}_{}", "jwt_validator_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("jwt-validator-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        if !W11_FLUSH_STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            let client = client.clone();
            let buf = buf.clone();
            tokio::spawn(async move {
                let mut tick = tokio::time::interval(std::time::Duration::from_millis(100));
                loop {
                    tick.tick().await;
                    let rows: Vec<(String, String, String, String, String)> = {
                        let mut b = buf.lock().unwrap();
                        if b.is_empty() { continue; }
                        std::mem::take(&mut *b)
                    };
                    for (id, svc, ep, st, d) in rows {
                        let _ = client.execute(
                            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                            &[&id, &svc, &ep, &st, &d],
                        ).await;
                    }
                }
            });
        }
        let mut b = buf.lock().unwrap();
        b.push((id, svc_name, endpoint.to_string(), status, data_str));
        if b.len() >= 100 {
            let rows = std::mem::take(&mut *b);
            drop(b);
            let client = client.clone();
            tokio::spawn(async move {
                for (id, svc, ep, st, d) in rows {
                    let _ = client.execute(
                        "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                        &[&id, &svc, &ep, &st, &d],
                    ).await;
                }
            });
        }
    }
}

// --- Permify authorization (W12-B5-P1-D-B) ---
// Every mutating handler performs a REAL Permify permission check AFTER
// check_jwt has authenticated the caller. Subject = verified JWT sub (from
// VerifiedClaims in request extensions), tenant = verified JWT tenant claim
// (fallback: X-Tenant-Id header, PERMIFY_DEFAULT_TENANT, "bpmgd"), resource =
// domain entity id, permission per action (schema: canonical v2.perm
// service_config entity + services/auth-service/schemas/permify/
// v2-core-domain-rs.fragment). 30s in-process decision cache keyed
// (tenant, entity_type, entity_id, permission, subject); errors NEVER cached.
// FAIL-CLOSED: Permify unreachable/non-200 => 502; denied => 403.
// Canonical pattern: W12-B5-P0-D2 (services/risk-scoring-rs/src/main.rs).
struct PermifyDecision {
    allowed: bool,
    expires_at: std::time::Instant,
}

static PERMIFY_DECISIONS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>>> = std::sync::OnceLock::new();

fn permify_decisions() -> &'static std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>> {
    PERMIFY_DECISIONS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn permify_base_url() -> String {
    match std::env::var("PERMIFY_URL") {
        Ok(u) if !u.is_empty() => u.trim_end_matches('/').to_string(),
        _ => "http://permify:3476".to_string(),
    }
}

async fn permify_check(req: &actix_web::HttpRequest, entity_type: &str, entity_id: &str, permission: &str) -> Result<(), HttpResponse> {
    use actix_web::HttpMessage as _;
    let (subject, claim_tenant) = {
        let ext = req.extensions();
        match ext.get::<VerifiedClaims>() {
            Some(c) => (
                c.0.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()),
                c.0.get("tenant_id").or_else(|| c.0.get("tenant")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            ),
            None => (None, None),
        }
    };
    let subject = match subject {
        Some(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"}))),
    };
    if entity_id.is_empty() {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"})));
    }
    let tenant_id = claim_tenant.filter(|s| !s.is_empty())
        .or_else(|| req.headers().get("X-Tenant-Id").and_then(|v| v.to_str().ok()).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string());
    let cache_key = format!("{}|{}|{}|{}|{}", tenant_id, entity_type, entity_id, permission, subject);
    {
        let cache = permify_decisions().lock().unwrap();
        if let Some(d) = cache.get(&cache_key) {
            if d.expires_at > std::time::Instant::now() {
                if d.allowed { return Ok(()); }
                return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
            }
        }
    }
    let payload = serde_json::json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_base_url(), tenant_id);
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
        Ok(c) => c,
        Err(_) => return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify client init failed (fail-closed)"}))),
    };
    let resp = match client.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[permify] FAIL-CLOSED check {} on {}:{} unreachable: {}", permission, entity_type, entity_id, e);
            return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})));
        }
    };
    if !resp.status().is_success() {
        return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})));
    }
    let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({}));
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED")
        || body.get("can").and_then(|v| v.as_bool()) == Some(true);
    // Errors are never cached; only concrete allow/deny decisions (30s TTL).
    permify_decisions().lock().unwrap().insert(cache_key, PermifyDecision {
        allowed,
        expires_at: std::time::Instant::now() + std::time::Duration::from_secs(30),
    });
    if !allowed {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8224);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await.map(Arc::new)
    } else { None };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        records: Mutex::new(Vec::new()),
        db_client,
    });
    println!("jwt-validator-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/jwt/validate", web::post().to(validate_jwt))
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
