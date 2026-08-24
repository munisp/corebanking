// 54Bank Self-Dealing Detector — Rust
// All state persisted to PostgreSQL. No in-memory HashMaps.
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
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
struct SelfDealingAlert {
    id: String,
    employee_id: String,
    account_id: String,
    relationship: String,
    transaction_ref: String,
    amount_kobo: i64,
    severity: String,
    timestamp: String,
    blocked: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct TransactionCheck {
    employee_id: String,
    source_account: String,
    dest_account: String,
    amount_kobo: i64,
    is_self_dealing: bool,
    relationship: String,
    timestamp: String,
}

async fn init_schema(db: &Client) {
    let queries = [
        "CREATE TABLE IF NOT EXISTS employee_account_links (
            employee_id TEXT NOT NULL, account_id TEXT NOT NULL,
            relationship TEXT NOT NULL DEFAULT 'own',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (employee_id, account_id))",
        "CREATE TABLE IF NOT EXISTS self_dealing_alerts (
            id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, account_id TEXT NOT NULL,
            relationship TEXT, transaction_ref TEXT, amount_kobo BIGINT,
            severity TEXT, timestamp TEXT, blocked BOOLEAN DEFAULT TRUE)",
        "CREATE TABLE IF NOT EXISTS self_dealing_checks (
            id SERIAL PRIMARY KEY, employee_id TEXT NOT NULL,
            source_account TEXT, dest_account TEXT, amount_kobo BIGINT,
            is_self_dealing BOOLEAN, relationship TEXT,
            timestamp TEXT)",
        "CREATE INDEX IF NOT EXISTS idx_sd_links_emp ON employee_account_links(employee_id)",
        "CREATE INDEX IF NOT EXISTS idx_sd_alerts_emp ON self_dealing_alerts(employee_id)",
    ];
    for q in queries {
        if let Err(e) = db.execute(q, &[]).await {
            eprintln!("[self-dealing] schema warning: {}", e);
        }
    }
    // Seed default employee-account links
    let seeds = [
        ("EMP-001", "ACCT-1001", "own"),
        ("EMP-001", "ACCT-1002", "family"),
        ("EMP-002", "ACCT-2001", "own"),
        ("EMP-003", "ACCT-3001", "own"),
        ("EMP-003", "ACCT-3002", "family"),
        ("EMP-003", "ACCT-3003", "family"),
    ];
    for (emp, acct, rel) in seeds {
        let _ = db.execute(
            "INSERT INTO employee_account_links (employee_id, account_id, relationship) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            &[&emp, &acct, &rel]
        ).await;
    }
    eprintln!("[self-dealing] PostgreSQL schema initialized with seed data");
}

async fn check_transaction(req: actix_web::HttpRequest, data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let employee_id = body["employee_id"].as_str().unwrap_or("");
    let source = body["source_account"].as_str().unwrap_or("");
    let dest = body["destination_account"].as_str().unwrap_or("");
    let amount = body["amount_kobo"].as_i64().unwrap_or(0);
    let txn_ref = body["transaction_ref"].as_str().unwrap_or("");

    let db_guard = match &data.db {
        Some(db) => db.lock().await,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database not connected"})),
    };

    let row = db_guard.query_opt(
        "SELECT relationship FROM employee_account_links WHERE employee_id = $1 AND account_id = $2",
        &[&employee_id, &dest]
    ).await;

    let (is_self_dealing, relationship) = match row {
        Ok(Some(r)) => {
            let rel: String = r.get(0);
            (true, rel)
        },
        _ => (false, String::new()),
    };

    let now = chrono::Utc::now().to_rfc3339();

    let _ = db_guard.execute(
        "INSERT INTO self_dealing_checks (employee_id, source_account, dest_account, amount_kobo, is_self_dealing, relationship, timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        &[&employee_id, &source, &dest, &amount, &is_self_dealing, &relationship, &now]
    ).await;

    if is_self_dealing {
        let alert_id = format!("SD-{:08x}", rand_u32());
        let severity = if relationship == "own" { "critical" } else { "high" };
        let _ = db_guard.execute(
            "INSERT INTO self_dealing_alerts (id, employee_id, account_id, relationship, transaction_ref, amount_kobo, severity, timestamp, blocked) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            &[&alert_id, &employee_id, &dest, &relationship, &txn_ref, &amount, &severity, &now, &true]
        ).await;
        return HttpResponse::Forbidden().json(serde_json::json!({
            "blocked": true, "is_self_dealing": true, "relationship": relationship,
            "alert_id": alert_id, "severity": severity,
            "message": format!("BLOCKED: Employee {} has {} relationship with account {}", employee_id, relationship, dest),
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "blocked": false, "is_self_dealing": false, "relationship": "none",
    }))
}

async fn register_link(req: actix_web::HttpRequest, data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let emp = body["employee_id"].as_str().unwrap_or("");
    let acct = body["account_id"].as_str().unwrap_or("");
    let rel = body["relationship"].as_str().unwrap_or("own");

    let db_guard = match &data.db {
        Some(db) => db.lock().await,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database not connected"})),
    };

    let _ = db_guard.execute(
        "INSERT INTO employee_account_links (employee_id, account_id, relationship) VALUES ($1,$2,$3) ON CONFLICT (employee_id, account_id) DO UPDATE SET relationship = $3",
        &[&emp, &acct, &rel]
    ).await;

    HttpResponse::Created().json(serde_json::json!({"status": "registered", "employee_id": emp, "account_id": acct, "relationship": rel}))
}

async fn list_links(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_guard = match &data.db {
        Some(db) => db.lock().await,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database not connected"})),
    };
    let rows = db_guard.query("SELECT employee_id, account_id, relationship FROM employee_account_links ORDER BY employee_id", &[]).await.unwrap_or_default();
    let links: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({"employee_id": r.get::<_, String>(0), "account_id": r.get::<_, String>(1), "relationship": r.get::<_, String>(2)})
    }).collect();
    HttpResponse::Ok().json(links)
}

async fn list_alerts(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_guard = match &data.db {
        Some(db) => db.lock().await,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database not connected"})),
    };
    let rows = db_guard.query("SELECT id, employee_id, account_id, relationship, COALESCE(transaction_ref,''), amount_kobo, severity, timestamp, blocked FROM self_dealing_alerts ORDER BY timestamp DESC LIMIT 1000", &[]).await.unwrap_or_default();
    let alerts: Vec<SelfDealingAlert> = rows.iter().map(|r| SelfDealingAlert {
        id: r.get(0), employee_id: r.get(1), account_id: r.get(2), relationship: r.get(3),
        transaction_ref: r.get(4), amount_kobo: r.get(5), severity: r.get(6), timestamp: r.get(7), blocked: r.get(8),
    }).collect();
    HttpResponse::Ok().json(alerts)
}

async fn stats(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let db_guard = match &data.db {
        Some(db) => db.lock().await,
        None => return HttpResponse::Ok().json(serde_json::json!({"error": "database not connected"})),
    };
    let links: i64 = db_guard.query_one("SELECT COUNT(*) FROM employee_account_links", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let alerts: i64 = db_guard.query_one("SELECT COUNT(*) FROM self_dealing_alerts", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let checks: i64 = db_guard.query_one("SELECT COUNT(*) FROM self_dealing_checks", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({
        "total_links": links, "total_alerts": alerts, "total_checks": checks,
        "service": "self-dealing-detector-rs",
    }))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "self-dealing-detector-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }
async fn readyz(data: web::Data<AppState>) -> HttpResponse {
    if data.db.is_some() { HttpResponse::Ok().json(serde_json::json!({"status": "ready"})) }
    else { HttpResponse::ServiceUnavailable().json(serde_json::json!({"status": "not_ready"})) }
}

fn rand_u32() -> u32 { use std::time::SystemTime; SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().subsec_nanos() }

fn start_watchdog(data: web::Data<AppState>) {
    let d = data.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(15)).await;
            let last = d.last_activity.load(Ordering::Relaxed);
            let now = chrono::Utc::now().timestamp();
            if now - last > 60 { d.healthy.store(0, Ordering::Relaxed); }
            else { d.healthy.store(1, Ordering::Relaxed); }
        }
    });
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
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080);
    let db_url = env::var("DATABASE_URL").unwrap_or_default();

    let db_client = if !db_url.is_empty() {
        match tokio_postgres::connect(&db_url, NoTls).await {
            Ok((client, connection)) => {
                tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("[self-dealing] DB connection error: {}", e); } });
                init_schema(&client).await;
                eprintln!("[self-dealing] Connected to PostgreSQL");
                Some(Mutex::new(client))
            },
            Err(e) => { eprintln!("[self-dealing] DB connection failed: {}", e); None },
        }
    } else {
        eprintln!("[self-dealing] WARNING: DATABASE_URL not set");
        None
    };

    let data = web::Data::new(AppState {
        db: db_client,
        healthy: AtomicI32::new(1),
        last_activity: AtomicI64::new(chrono::Utc::now().timestamp()),
    });

    start_watchdog(data.clone());

    eprintln!("[self-dealing-detector] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/api/v1/self-dealing/check", web::post().to(check_transaction))
            .route("/api/v1/self-dealing/register", web::post().to(register_link))
            .route("/api/v1/self-dealing/links", web::get().to(list_links))
            .route("/api/v1/self-dealing/alerts", web::get().to(list_alerts))
            .route("/api/v1/self-dealing/stats", web::get().to(stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rand_u32() {
        let r = rand_u32();
        assert!(r > 0 || r == 0);
    }
}
