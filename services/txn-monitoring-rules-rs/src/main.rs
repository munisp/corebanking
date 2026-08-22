use actix_web::{web, App, HttpServer, HttpResponse};
use sqlx::PgPool;

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

fn mw() -> serde_json::Value { serde_json::json!({"kafka":{"broker":ev("KAFKA_BROKER","localhost:9092"),"topics":["txn.monitored","txn.alert-generated","txn.rule-triggered","txn.case-opened","txn.sar-recommended"]},"dapr":{"app_id":"txn-monitoring-rules-rs"},"fluvio":{"url":ev("FLUVIO_URL","localhost:9003"),"topics":["txn-monitoring-stream","txn-alert-stream"]},"temporal":{"url":ev("TEMPORAL_URL","localhost:7233"),"namespace":"txn-monitoring","workflows":["RealTimeMonitorWorkflow","BatchMonitorWorkflow","CaseManagementWorkflow"]},"postgres":{"tables":["txn_monitoring_rules","txn_alerts","txn_cases","txn_scenarios"]},"keycloak":{"url":ev("KEYCLOAK_URL","http://localhost:8080"),"realm":"54link-dev","client_id":"txn-monitoring"},"redis":{"url":ev("REDIS_URL","redis://localhost:6379"),"keys":["txn:velocity:{customer_id}","txn:pattern:{customer_id}","txn:alert-count"]},"opensearch":{"url":ev("OPENSEARCH_URL","http://localhost:9200"),"indices":["txn-monitoring-alerts","txn-cases"]}}) }

struct St {
    /// Postgres pool for the REAL monitoring data. Rules/alerts/cases are read
    /// from the database; when the DB is unavailable the API returns honest
    /// empty lists — never seeded/fabricated AML alerts, cases or SAR outcomes.
    pool: Option<PgPool>,
}

async fn healthz(d: web::Data<St>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "txn-monitoring-rules-rs",
        "version": "1.0.0",
        "db_available": d.pool.is_some(),
        "middleware": mw(),
    }))
}

/// Read all rows of a table as JSON objects. Returns None on DB error.
async fn read_table(pool: &PgPool, table: &str) -> Option<Vec<serde_json::Value>> {
    // Table names are fixed literals from this binary — never user input.
    let sql = format!("SELECT row_to_json(t)::text AS data FROM {} t", table);
    let rows: Vec<String> = sqlx::query_scalar(&sql).fetch_all(pool).await.ok()?;
    Some(rows.iter().filter_map(|r| serde_json::from_str(r).ok()).collect())
}

async fn list_table(d: &web::Data<St>, table: &str) -> HttpResponse {
    match &d.pool {
        Some(pool) => match read_table(pool, table).await {
            Some(items) => HttpResponse::Ok().json(serde_json::json!({"items": items, "total": items.len()})),
            None => HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database_unavailable", "items": [], "total": 0})),
        },
        // Honest empty list — no fabricated records.
        None => HttpResponse::Ok().json(serde_json::json!({"items": [], "total": 0})),
    }
}

async fn get_rules(req: actix_web::HttpRequest, d: web::Data<St>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; } list_table(&d, "txn_monitoring_rules").await }
async fn get_alerts(req: actix_web::HttpRequest, d: web::Data<St>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; } list_table(&d, "txn_alerts").await }
async fn get_cases(req: actix_web::HttpRequest, d: web::Data<St>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; } list_table(&d, "txn_cases").await }

/// POST /api/cases/{id}/file-sar — the ONLY way a SAR outcome may be set on a
/// case. Records a real filing action in the database; fails closed (503) when
/// the database is unavailable rather than pretending a filing occurred.
async fn file_sar(req: actix_web::HttpRequest, d: web::Data<St>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = path.into_inner();
    let sar_reference = body.get("sar_reference").and_then(|v| v.as_str()).map(|s| s.to_string());
    let filed_by = body.get("filed_by").and_then(|v| v.as_str()).unwrap_or("compliance-officer").to_string();
    let pool = match &d.pool {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database_unavailable", "sar_filed": false})),
    };
    let outcome = match &sar_reference {
        Some(r) => format!("SAR filed — {}", r),
        None => "SAR filed".to_string(),
    };
    let res = sqlx::query(
        "UPDATE txn_cases SET outcome = $2, sar_filed = TRUE, status = 'closed_sar_filed', assigned_to = $3 WHERE id = $1"
    )
    .bind(&id)
    .bind(&outcome)
    .bind(&filed_by)
    .execute(pool)
    .await;
    match res {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::Ok().json(serde_json::json!({
            "id": id, "sar_filed": true, "outcome": outcome, "filed_by": filed_by,
        })),
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "case_not_found", "id": id})),
        Err(e) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("sar_filing_failed: {}", e), "sar_filed": false})),
    }
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
    let port: u16 = ev("PORT", "8285").parse().unwrap_or(8285);
    let pool = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => match PgPool::connect(&url).await {
            Ok(p) => Some(p),
            Err(e) => {
                eprintln!("txn-monitoring-rules-rs: DATABASE_URL connect failed: {} — serving honest empty lists", e);
                None
            }
        },
        _ => {
            eprintln!("txn-monitoring-rules-rs: DATABASE_URL not set — serving honest empty lists");
            None
        }
    };
    let d = web::Data::new(St { pool });
    println!("txn-monitoring-rules-rs listening on :{}", port);
    HttpServer::new(move || App::new()
        .app_data(d.clone())
        .route("/healthz", web::get().to(healthz))
        .route("/api/rules", web::get().to(get_rules))
        .route("/api/alerts", web::get().to(get_alerts))
        .route("/api/cases", web::get().to(get_cases))
        .route("/api/cases/{id}/file-sar", web::post().to(file_sar))
    ).bind(("0.0.0.0", port))?.run().await
}
