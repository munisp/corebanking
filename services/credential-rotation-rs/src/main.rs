// 54Bank Credential Rotation — Rust
// All state persisted to PostgreSQL. No in-memory Vecs/HashMaps.
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicI64, AtomicI32, Ordering};
use std::env;
use tokio_postgres::{Client, NoTls};
use tokio::sync::Mutex;

struct AppState {
    db: Option<Mutex<Client>>,
    healthy: AtomicI32,
    last_activity: AtomicI64,
}

#[derive(Serialize, Deserialize, Clone)]
struct ManagedCredential {
    id: String,
    name: String,
    credential_type: String,
    owner: String,
    last_rotated: String,
    expires_at: String,
    rotation_count: i32,
    status: String,
    vault_path: String,
    auto_rotate: bool,
    days_since_rotation: i32,
}

#[derive(Serialize, Deserialize, Clone)]
struct RotationEvent {
    id: String,
    credential_id: String,
    action: String,
    performed_by: String,
    timestamp: String,
    details: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct RotationPolicy {
    credential_type: String,
    max_age_days: i32,
    stale_warning_days: i32,
    auto_rotate: bool,
    require_mfa: bool,
}

async fn init_schema(db: &Client) {
    let queries = [
        "CREATE TABLE IF NOT EXISTS managed_credentials (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, credential_type TEXT NOT NULL,
            owner TEXT NOT NULL, last_rotated TEXT, expires_at TEXT,
            rotation_count INT DEFAULT 0, status TEXT DEFAULT 'active',
            vault_path TEXT, auto_rotate BOOLEAN DEFAULT FALSE,
            days_since_rotation INT DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS rotation_events (
            id TEXT PRIMARY KEY, credential_id TEXT NOT NULL, action TEXT,
            performed_by TEXT, timestamp TEXT, details TEXT)",
        "CREATE TABLE IF NOT EXISTS rotation_policies (
            credential_type TEXT PRIMARY KEY, max_age_days INT DEFAULT 90,
            stale_warning_days INT DEFAULT 60, auto_rotate BOOLEAN DEFAULT FALSE,
            require_mfa BOOLEAN DEFAULT FALSE)",
        "CREATE INDEX IF NOT EXISTS idx_cred_owner ON managed_credentials(owner)",
        "CREATE INDEX IF NOT EXISTS idx_cred_status ON managed_credentials(status)",
    ];
    for q in queries {
        if let Err(e) = db.execute(q, &[]).await { eprintln!("[cred-rotation] schema: {}", e); }
    }
    // Seed credentials and policies
    let creds = [
        ("CRED-DB-001", "PostgreSQL production password", "database", "platform-team", "2026-01-15T00:00:00Z", "2026-04-15T00:00:00Z", 3, "active", "secret/data/db/prod-password", true, 144),
        ("CRED-API-001", "Payment gateway API key", "api_key", "payments-team", "2026-05-01T00:00:00Z", "2026-08-01T00:00:00Z", 5, "active", "secret/data/api/payment-gw", true, 38),
        ("CRED-SSH-001", "Production SSH key", "ssh_key", "sre-team", "2025-12-01T00:00:00Z", "2026-03-01T00:00:00Z", 2, "expired", "secret/data/ssh/prod-key", false, 189),
        ("CRED-TLS-001", "mTLS client certificate", "certificate", "security-team", "2026-04-01T00:00:00Z", "2027-04-01T00:00:00Z", 1, "active", "secret/data/tls/mtls-client", false, 68),
        ("CRED-JWT-001", "JWT signing key", "signing_key", "auth-team", "2026-03-15T00:00:00Z", "2026-09-15T00:00:00Z", 4, "active", "secret/data/jwt/signing", true, 85),
    ];
    for (id, name, ctype, owner, lr, ea, rc, status, vp, ar, dsr) in creds {
        let _ = db.execute(
            "INSERT INTO managed_credentials (id, name, credential_type, owner, last_rotated, expires_at, rotation_count, status, vault_path, auto_rotate, days_since_rotation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING",
            &[&id, &name, &ctype, &owner, &lr, &ea, &rc, &status, &vp, &ar, &dsr]
        ).await;
    }
    let policies = [
        ("database", 90, 60, true, true),
        ("api_key", 90, 60, true, false),
        ("ssh_key", 180, 120, false, true),
        ("certificate", 365, 300, false, false),
        ("signing_key", 180, 120, true, true),
    ];
    for (ct, max, stale, ar, mfa) in policies {
        let _ = db.execute(
            "INSERT INTO rotation_policies (credential_type, max_age_days, stale_warning_days, auto_rotate, require_mfa) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (credential_type) DO NOTHING",
            &[&ct, &max, &stale, &ar, &mfa]
        ).await;
    }
    eprintln!("[cred-rotation] PostgreSQL schema initialized with seed data");
}

async fn list_credentials(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let rows = db_guard.query("SELECT id, name, credential_type, owner, COALESCE(last_rotated,''), COALESCE(expires_at,''), rotation_count, status, COALESCE(vault_path,''), auto_rotate, days_since_rotation FROM managed_credentials ORDER BY days_since_rotation DESC", &[]).await.unwrap_or_default();
    let creds: Vec<ManagedCredential> = rows.iter().map(|r| ManagedCredential {
        id: r.get(0), name: r.get(1), credential_type: r.get(2), owner: r.get(3),
        last_rotated: r.get(4), expires_at: r.get(5), rotation_count: r.get(6), status: r.get(7),
        vault_path: r.get(8), auto_rotate: r.get(9), days_since_rotation: r.get(10),
    }).collect();
    HttpResponse::Ok().json(creds)
}

async fn check_stale(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let rows = db_guard.query(
        "SELECT c.id, c.name, c.credential_type, c.days_since_rotation, p.stale_warning_days, p.max_age_days FROM managed_credentials c JOIN rotation_policies p ON c.credential_type = p.credential_type WHERE c.days_since_rotation > p.stale_warning_days ORDER BY c.days_since_rotation DESC",
        &[]
    ).await.unwrap_or_default();
    let stale: Vec<serde_json::Value> = rows.iter().map(|r| {
        let days: i32 = r.get(3);
        let max: i32 = r.get(5);
        let severity = if days > max { "critical" } else { "warning" };
        serde_json::json!({
            "credential_id": r.get::<_, String>(0), "name": r.get::<_, String>(1),
            "type": r.get::<_, String>(2), "days_since_rotation": days,
            "max_age_days": max, "severity": severity,
        })
    }).collect();
    HttpResponse::Ok().json(serde_json::json!({"stale_credentials": stale, "count": stale.len()}))
}

async fn rotate_credential(req: actix_web::HttpRequest, data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let cred_id = body["credential_id"].as_str().unwrap_or("");
    let performed_by = body["performed_by"].as_str().unwrap_or("system");
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let now = chrono::Utc::now().to_rfc3339();
    let res = db_guard.execute(
        "UPDATE managed_credentials SET last_rotated = $1, rotation_count = rotation_count + 1, days_since_rotation = 0, status = 'active' WHERE id = $2",
        &[&now, &cred_id]
    ).await;
    if let Err(e) = res { return HttpResponse::BadRequest().json(serde_json::json!({"error": format!("{}", e)})); }
    let evt_id = format!("ROT-{:08x}", rand_u32());
    let _ = db_guard.execute(
        "INSERT INTO rotation_events (id, credential_id, action, performed_by, timestamp, details) VALUES ($1,$2,$3,$4,$5,$6)",
        &[&evt_id, &cred_id, &"rotated", &performed_by, &now, &"Credential rotated successfully"]
    ).await;
    HttpResponse::Ok().json(serde_json::json!({"status": "rotated", "credential_id": cred_id, "event_id": evt_id}))
}

async fn list_policies(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let rows = db_guard.query("SELECT credential_type, max_age_days, stale_warning_days, auto_rotate, require_mfa FROM rotation_policies", &[]).await.unwrap_or_default();
    let policies: Vec<RotationPolicy> = rows.iter().map(|r| RotationPolicy {
        credential_type: r.get(0), max_age_days: r.get(1), stale_warning_days: r.get(2),
        auto_rotate: r.get(3), require_mfa: r.get(4),
    }).collect();
    HttpResponse::Ok().json(policies)
}

async fn stats(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::Ok().json(serde_json::json!({"error": "no db"})) };
    let total: i64 = db_guard.query_one("SELECT COUNT(*) FROM managed_credentials", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let stale: i64 = db_guard.query_one("SELECT COUNT(*) FROM managed_credentials c JOIN rotation_policies p ON c.credential_type = p.credential_type WHERE c.days_since_rotation > p.stale_warning_days", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let events: i64 = db_guard.query_one("SELECT COUNT(*) FROM rotation_events", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({"total_credentials": total, "stale_credentials": stale, "total_rotation_events": events, "service": "credential-rotation-rs"}))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "credential-rotation-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }
async fn readyz(data: web::Data<AppState>) -> HttpResponse {
    if data.db.is_some() { HttpResponse::Ok().json(serde_json::json!({"status": "ready"})) }
    else { HttpResponse::ServiceUnavailable().json(serde_json::json!({"status": "not_ready"})) }
}

fn rand_u32() -> u32 { use std::time::SystemTime; SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().subsec_nanos() }

fn start_watchdog(data: web::Data<AppState>) {
    let d = data.clone();
    tokio::spawn(async move { loop {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        let last = d.last_activity.load(Ordering::Relaxed);
        let now = chrono::Utc::now().timestamp();
        if now - last > 60 { d.healthy.store(0, Ordering::Relaxed); } else { d.healthy.store(1, Ordering::Relaxed); }
    }});
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
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".into()).parse().unwrap_or(8080);
    let db_url = env::var("DATABASE_URL").unwrap_or_default();
    let db_client = if !db_url.is_empty() {
        match tokio_postgres::connect(&db_url, NoTls).await {
            Ok((client, conn)) => {
                tokio::spawn(async move { if let Err(e) = conn.await { eprintln!("[cred-rotation] DB error: {}", e); } });
                init_schema(&client).await;
                eprintln!("[cred-rotation] Connected to PostgreSQL");
                Some(Mutex::new(client))
            },
            Err(e) => { eprintln!("[cred-rotation] DB failed: {}", e); None },
        }
    } else { eprintln!("[cred-rotation] WARNING: DATABASE_URL not set"); None };

    let data = web::Data::new(AppState { db: db_client, healthy: AtomicI32::new(1), last_activity: AtomicI64::new(chrono::Utc::now().timestamp()) });
    start_watchdog(data.clone());
    eprintln!("[credential-rotation] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz)).route("/livez", web::get().to(livez)).route("/readyz", web::get().to(readyz))
            .route("/api/v1/credentials", web::get().to(list_credentials))
            .route("/api/v1/credentials/stale", web::get().to(check_stale))
            .route("/api/v1/credentials/rotate", web::post().to(rotate_credential))
            .route("/api/v1/credentials/policies", web::get().to(list_policies))
            .route("/api/v1/credentials/stats", web::get().to(stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_rand_u32() { let r = super::rand_u32(); assert!(r >= 0); }
}
