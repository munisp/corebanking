#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::env;
use uuid::Uuid;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Entity {
    id: String,
    name: String,
    entity_type: String,
    jurisdiction: String,
    registration_number: Option<String>,
    is_pep: bool,
    is_sanctioned: bool,
    risk_score: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct OwnershipLink {
    parent_id: String,
    child_id: String,
    ownership_pct: f64,
    ownership_type: String,
    voting_rights_pct: Option<f64>,
    verified: bool,
}

#[derive(Serialize)]
struct UBOResult {
    entity_id: String,
    entity_name: String,
    entity_type: String,
    effective_ownership_pct: f64,
    ownership_path: Vec<String>,
    depth: usize,
    is_pep: bool,
    is_sanctioned: bool,
    flags: Vec<String>,
}

#[derive(Deserialize)]
struct TraverseRequest {
    company_id: String,
    min_ownership_pct: Option<f64>,
    max_depth: Option<usize>,
}

#[derive(Deserialize)]
struct AddEntityRequest {
    id: Option<String>,
    name: String,
    entity_type: String,
    jurisdiction: String,
    registration_number: Option<String>,
    is_pep: Option<bool>,
    is_sanctioned: Option<bool>,
}

#[derive(Deserialize)]
struct AddLinkRequest {
    parent_id: String,
    child_id: String,
    ownership_pct: f64,
    ownership_type: Option<String>,
    voting_rights_pct: Option<f64>,
}

fn traverse_ownership(
    target_id: &str,
    entities: &HashMap<String, Entity>,
    links: &[OwnershipLink],
    min_pct: f64,
    max_depth: usize,
) -> (Vec<UBOResult>, Vec<String>) {
    let mut ubos = Vec::new();
    let mut flags = Vec::new();
    let mut visited = HashSet::new();
    let mut queue: VecDeque<(String, f64, Vec<String>, usize)> = VecDeque::new();

    for link in links.iter().filter(|l| l.child_id == target_id) {
        queue.push_back((
            link.parent_id.clone(),
            link.ownership_pct,
            vec![target_id.to_string(), link.parent_id.clone()],
            1,
        ));
    }

    while let Some((entity_id, effective_pct, path, depth)) = queue.pop_front() {
        if depth > max_depth {
            flags.push(format!("MAX_DEPTH_REACHED: chain exceeds {} layers from {}", max_depth, entity_id));
            continue;
        }
        if visited.contains(&entity_id) {
            flags.push(format!("CIRCULAR_OWNERSHIP: {} appears multiple times in chain", entity_id));
            continue;
        }
        visited.insert(entity_id.clone());

        if let Some(entity) = entities.get(&entity_id) {
            if entity.entity_type == "individual" {
                if effective_pct >= min_pct {
                    let mut ubo_flags = Vec::new();
                    if entity.is_pep { ubo_flags.push("PEP".to_string()); }
                    if entity.is_sanctioned { ubo_flags.push("SANCTIONED".to_string()); }
                    if depth >= 3 { ubo_flags.push(format!("DEEP_LAYERING: {} levels", depth)); }
                    ubos.push(UBOResult {
                        entity_id: entity_id.clone(),
                        entity_name: entity.name.clone(),
                        entity_type: entity.entity_type.clone(),
                        effective_ownership_pct: effective_pct,
                        ownership_path: path.clone(),
                        depth,
                        is_pep: entity.is_pep,
                        is_sanctioned: entity.is_sanctioned,
                        flags: ubo_flags,
                    });
                }
            } else {
                if entity.entity_type == "nominee" {
                    flags.push(format!("NOMINEE_STRUCTURE: {} is a nominee entity", entity_id));
                }
                let high_risk_jurisdictions = ["VG", "KY", "PA", "BZ", "SC", "VU"];
                if high_risk_jurisdictions.contains(&entity.jurisdiction.as_str()) {
                    flags.push(format!("HIGH_RISK_JURISDICTION: {} in {}", entity.name, entity.jurisdiction));
                }
                for link in links.iter().filter(|l| l.child_id == entity_id) {
                    let chain_pct = effective_pct * link.ownership_pct / 100.0;
                    if chain_pct >= min_pct * 0.5 {
                        let mut new_path = path.clone();
                        new_path.push(link.parent_id.clone());
                        queue.push_back((link.parent_id.clone(), chain_pct, new_path, depth + 1));
                    }
                }
            }
        }
    }

    if ubos.is_empty() && !links.iter().any(|l| l.child_id == target_id) {
        flags.push("NO_OWNERSHIP_DATA: no ownership links found for this entity".to_string());
    }

    (ubos, flags)
}

async fn load_entities_and_links(db: &tokio_postgres::Client) -> (HashMap<String, Entity>, Vec<OwnershipLink>) {
    let mut entities = HashMap::new();
    let mut links = Vec::new();

    if let Ok(rows) = db.query("SELECT id, name, entity_type, jurisdiction, registration_number, is_pep, is_sanctioned, risk_score FROM ubo_entities", &[]).await {
        for row in rows {
            let id: String = row.get(0);
            let reg_num: Option<String> = row.get(4);
            entities.insert(id.clone(), Entity {
                id, name: row.get(1), entity_type: row.get(2), jurisdiction: row.get(3),
                registration_number: reg_num, is_pep: row.get(5), is_sanctioned: row.get(6), risk_score: row.get::<_, i32>(7) as u32,
            });
        }
    }
    if let Ok(rows) = db.query("SELECT parent_id, child_id, ownership_pct, ownership_type, voting_rights_pct, verified FROM ubo_ownership_links", &[]).await {
        for row in rows {
            let vr: Option<f64> = row.get(4);
            links.push(OwnershipLink {
                parent_id: row.get(0), child_id: row.get(1), ownership_pct: row.get(2),
                ownership_type: row.get(3), voting_rights_pct: vr, verified: row.get(5),
            });
        }
    }
    (entities, links)
}

async fn traverse(req: actix_web::HttpRequest, body: web::Json<TraverseRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let min_pct = body.min_ownership_pct.unwrap_or(10.0);
    let max_depth = body.max_depth.unwrap_or(10);

    if let Some(ref db) = state.db {
        let (entities, links) = load_entities_and_links(db).await;
        let (ubos, flags) = traverse_ownership(&body.company_id, &entities, &links, min_pct, max_depth);
        let total_identified_pct: f64 = ubos.iter().map(|u| u.effective_ownership_pct).sum();
        let has_sanctioned = ubos.iter().any(|u| u.is_sanctioned);
        let has_pep = ubos.iter().any(|u| u.is_pep);
        let risk_level = if has_sanctioned { "CRITICAL" } else if has_pep { "HIGH" } else if total_identified_pct < 75.0 { "ELEVATED" } else { "NORMAL" };

        return HttpResponse::Ok().json(json!({
            "company_id": body.company_id,
            "ubos": ubos,
            "total_identified_ownership_pct": total_identified_pct,
            "unidentified_ownership_pct": 100.0 - total_identified_pct.min(100.0),
            "flags": flags,
            "risk_level": risk_level,
            "has_pep_ubo": has_pep,
            "has_sanctioned_ubo": has_sanctioned,
            "source": "postgresql",
        }));
    }
    HttpResponse::ServiceUnavailable().json(json!({"error": "database unavailable"}))
}

async fn add_entity(req: actix_web::HttpRequest, body: web::Json<AddEntityRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let id = body.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let is_pep = body.is_pep.unwrap_or(false);
    let is_sanctioned = body.is_sanctioned.unwrap_or(false);
    let reg_num = body.registration_number.clone().unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO ubo_entities (id, name, entity_type, jurisdiction, registration_number, is_pep, is_sanctioned, risk_score) VALUES ($1, $2, $3, $4, $5, $6, $7, 0) ON CONFLICT (id) DO UPDATE SET name = $2, entity_type = $3",
            &[&id, &body.name, &body.entity_type, &body.jurisdiction, &reg_num, &is_pep, &is_sanctioned],
        ).await;
    }
    HttpResponse::Created().json(json!({"id": id, "status": "created"}))
}

async fn add_link(req: actix_web::HttpRequest, body: web::Json<AddLinkRequest>, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if body.ownership_pct <= 0.0 || body.ownership_pct > 100.0 {
        return HttpResponse::BadRequest().json(json!({"error": "ownership_pct must be 0-100"}));
    }
    let otype = body.ownership_type.clone().unwrap_or_else(|| "direct".into());
    let vr = body.voting_rights_pct.unwrap_or(0.0);

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO ubo_ownership_links (parent_id, child_id, ownership_pct, ownership_type, voting_rights_pct, verified) VALUES ($1, $2, $3, $4, $5, false)",
            &[&body.parent_id, &body.child_id, &body.ownership_pct, &otype, &vr],
        ).await;
    }
    HttpResponse::Created().json(json!({"status": "linked"}))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "ubo-traversal-rs", "version": "1.0.0", "database": db_status}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS ubo_entities (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, entity_type TEXT NOT NULL,
                    jurisdiction TEXT NOT NULL, registration_number TEXT NOT NULL DEFAULT '',
                    is_pep BOOLEAN NOT NULL DEFAULT FALSE, is_sanctioned BOOLEAN NOT NULL DEFAULT FALSE,
                    risk_score INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS ubo_ownership_links (
                    id SERIAL PRIMARY KEY, parent_id TEXT NOT NULL, child_id TEXT NOT NULL,
                    ownership_pct DOUBLE PRECISION NOT NULL, ownership_type TEXT NOT NULL DEFAULT 'direct',
                    voting_rights_pct DOUBLE PRECISION NOT NULL DEFAULT 0, verified BOOLEAN NOT NULL DEFAULT FALSE
                );
                CREATE INDEX IF NOT EXISTS idx_uol_child ON ubo_ownership_links(child_id);",
            ).await;
            eprintln!("[ubo-traversal-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[ubo-traversal-rs] DB connect failed: {}", e); None }
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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9033);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;
    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
    });
    eprintln!("[ubo-traversal-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/ubo/traverse", web::post().to(traverse))
            .route("/api/v1/ubo/entity", web::post().to(add_entity))
            .route("/api/v1/ubo/link", web::post().to(add_link))
    }).bind(("0.0.0.0", port))?.run().await
}
