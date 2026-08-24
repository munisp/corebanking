// Sanctions Screening Service — Production Implementation
//
// Real-time AML/sanctions screening using Jaro-Winkler fuzzy name matching
// against entries stored in PostgreSQL (OFAC SDN, UN Consolidated, EU, HMT,
// CBN, EFCC watchlists).
//
// Every screening result is persisted for regulatory audit trail.
// Fail-closed: DB unavailability returns 503 which blocks the calling payment.
//
// FATF Recommendation 6 compliant: screens both originator and beneficiary.
//
// Port: 8283

use actix_web::{middleware, web, App, HttpResponse, HttpServer};
use chrono::Utc;
use deadpool_postgres::{Config as PgConfig, ManagerConfig, Pool, RecyclingMethod, Runtime};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use strsim::jaro_winkler;
use tokio_postgres_rustls::MakeRustlsConnect;
use uuid::Uuid;

use quick_xml::events::Event;
use quick_xml::Reader;

// ── Configuration ─────────────────────────────────────────────────────────────

fn ev(k: &str, d: &str) -> String {
    env::var(k).unwrap_or_else(|_| d.into())
}

// ── Pool ──────────────────────────────────────────────────────────────────────

// R4-V3: verify the Postgres server certificate against the public WebPKI root
// store (webpki-roots, already in the dependency lock). TLS verification is no
// longer disabled: an untrusted/self-signed server certificate now fails the
// handshake (fail-closed) instead of being silently accepted.
fn build_pool() -> Pool {
    let mut cfg = PgConfig::new();
    cfg.url = Some(env::var("DATABASE_URL").expect("DATABASE_URL is required"));
    cfg.manager = Some(ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    });
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let tls = MakeRustlsConnect::new(
        rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth(),
    );
    cfg.create_pool(Some(Runtime::Tokio1), tls)
        .expect("Failed to create PostgreSQL connection pool")
}

// ── JWT Auth (fail-closed; R4-V5-rust remediation) ──

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

// ── Schema ────────────────────────────────────────────────────────────────────

async fn ensure_schema(pool: &Pool) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;
    client
        .batch_execute(
            "
            CREATE TABLE IF NOT EXISTS sanctions_entries (
                id            UUID        PRIMARY KEY,
                list_id       TEXT        NOT NULL,
                list_name     TEXT        NOT NULL,
                entity_name   TEXT        NOT NULL,
                entity_type   TEXT        NOT NULL DEFAULT 'individual',
                aliases       TEXT[]      NOT NULL DEFAULT '{}',
                risk_level    TEXT        NOT NULL DEFAULT 'high',
                program       TEXT        NOT NULL DEFAULT '',
                active        BOOLEAN     NOT NULL DEFAULT TRUE,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_sanctions_entries_active
                ON sanctions_entries(active);

            CREATE TABLE IF NOT EXISTS sanctions_screenings (
                id             UUID        PRIMARY KEY,
                tenant_id      TEXT        NOT NULL,
                screened_name  TEXT        NOT NULL,
                screen_type    TEXT        NOT NULL DEFAULT 'transaction',
                customer_id    TEXT,
                transaction_id TEXT,
                risk_level     TEXT        NOT NULL,
                action         TEXT        NOT NULL,
                highest_score  FLOAT8      NOT NULL DEFAULT 0.0,
                match_count    INT         NOT NULL DEFAULT 0,
                triggered_by   TEXT        NOT NULL,
                screened_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_tenant
                ON sanctions_screenings(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_txn
                ON sanctions_screenings(transaction_id);

            CREATE TABLE IF NOT EXISTS sanctions_matches (
                id               UUID   PRIMARY KEY,
                screening_id     UUID   NOT NULL REFERENCES sanctions_screenings(id),
                entry_id         UUID   NOT NULL,
                list_name        TEXT   NOT NULL,
                matched_name     TEXT   NOT NULL,
                match_type       TEXT   NOT NULL,
                similarity_score FLOAT8 NOT NULL,
                risk_level       TEXT   NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sanctions_matches_screening
                ON sanctions_matches(screening_id);

            ALTER TABLE sanctions_entries ADD COLUMN IF NOT EXISTS list_entry_ref TEXT;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sanctions_entries_ref
                ON sanctions_entries(list_id, list_entry_ref)
                WHERE list_entry_ref IS NOT NULL;

            CREATE TABLE IF NOT EXISTS sanctions_list_syncs (
                id           UUID        PRIMARY KEY,
                list_id      TEXT        NOT NULL,
                entry_count  BIGINT      NOT NULL DEFAULT 0,
                synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_sanctions_list_syncs_list
                ON sanctions_list_syncs(list_id, synced_at DESC);
        ",
        )
        .await?;
    Ok(())
}

// ── PBAC ──────────────────────────────────────────────────────────────────────

async fn pbac_check(tenant_id: &str, user_id: &str, permission: &str) -> bool {
    let url = format!(
        "{}/v1/authz/check",
        ev("AUTH_ENFORCER_URL", "http://auth-enforcer:8314")
    );
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    let body = json!({
        "userId": user_id,
        "tenantId": tenant_id,
        "permission": permission,
        "entityType": "financial_operation"
    });
    match client.post(&url).json(&body).send().await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(j) => j
                .get("allowed")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            Err(_) => false,
        },
        Err(e) => {
            warn!("PBAC check unreachable — denying: {}", e);
            false
        }
    }
}

// ── App state ─────────────────────────────────────────────────────────────────

struct AppState {
    pool: Pool,
    match_threshold: f64,
}

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct ScreenReq {
    name: String,
    tenant_id: String,
    triggered_by: String,
    transaction_id: Option<String>,
    customer_id: Option<String>,
    screen_type: Option<String>,
}

#[derive(Serialize)]
struct MatchResult {
    entry_id: String,
    list_name: String,
    matched_name: String,
    match_type: String,
    similarity_score: f64,
    risk_level: String,
}

#[derive(Serialize)]
struct ScreeningResponse {
    id: String,
    screened_name: String,
    screen_type: String,
    tenant_id: String,
    transaction_id: Option<String>,
    customer_id: Option<String>,
    risk_level: String,
    action: String,
    highest_score: f64,
    match_count: usize,
    matches: Vec<MatchResult>,
    screened_at: String,
}

#[derive(Deserialize)]
struct AddEntryReq {
    list_id: String,
    list_name: String,
    entity_name: String,
    entity_type: Option<String>,
    aliases: Option<Vec<String>>,
    risk_level: Option<String>,
    program: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn screen(body: web::Json<ScreenReq>, data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let tid = body.tenant_id.trim().to_string();
    let user_id = body.triggered_by.trim().to_string();
    let name = body.name.trim().to_string();

    if name.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "name is required"}));
    }
    if tid.is_empty() || user_id.is_empty() {
        return HttpResponse::BadRequest()
            .json(json!({"error": "tenant_id and triggered_by are required"}));
    }

    if !pbac_check(&tid, &user_id, "sanctions:screen").await {
        return HttpResponse::Forbidden()
            .json(json!({"error": "forbidden: sanctions:screen permission required"}));
    }

    let client = match data.pool.get().await {
        Ok(c) => c,
        Err(e) => {
            error!("DB pool unavailable: {}", e);
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "sanctions database unavailable — transaction blocked for compliance"
            }));
        }
    };

    let rows = match client
        .query(
            "SELECT id, list_name, entity_name, aliases, risk_level \
             FROM sanctions_entries WHERE active = TRUE",
            &[],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            error!("Failed to query sanctions entries: {}", e);
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "sanctions list query failed — transaction blocked for compliance"
            }));
        }
    };

    let name_lower = name.to_lowercase();
    let threshold = data.match_threshold;

    let mut matches: Vec<MatchResult> = rows
        .iter()
        .filter_map(|row| {
            let entry_id: Uuid = row.get("id");
            let list_name: String = row.get("list_name");
            let entity_name: String = row.get("entity_name");
            let aliases: Vec<String> = row.get("aliases");
            let risk_level: String = row.get("risk_level");

            let primary_score = jaro_winkler(&name_lower, &entity_name.to_lowercase());

            let (alias_score, alias_idx) = aliases
                .iter()
                .enumerate()
                .map(|(i, a)| (jaro_winkler(&name_lower, &a.to_lowercase()), i))
                .fold((0.0_f64, 0), |best, (s, i)| {
                    if s > best.0 { (s, i) } else { best }
                });

            let (best_score, match_type, matched_name) = if primary_score >= alias_score {
                (primary_score, "primary", entity_name.clone())
            } else {
                (
                    alias_score,
                    "alias",
                    aliases
                        .get(alias_idx)
                        .cloned()
                        .unwrap_or_else(|| entity_name.clone()),
                )
            };

            if best_score >= threshold {
                Some(MatchResult {
                    entry_id: entry_id.to_string(),
                    list_name,
                    matched_name,
                    match_type: match_type.to_string(),
                    similarity_score: best_score,
                    risk_level,
                })
            } else {
                None
            }
        })
        .collect();

    matches.sort_by(|a, b| {
        b.similarity_score
            .partial_cmp(&a.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let highest_score = matches
        .first()
        .map(|m| m.similarity_score)
        .unwrap_or(0.0);
    let has_critical = matches.iter().any(|m| m.risk_level == "critical");
    let has_high = matches.iter().any(|m| m.risk_level == "high");

    let (risk_level, action) = if matches.is_empty() {
        ("clear", "proceed")
    } else if has_critical || highest_score >= 0.90 {
        ("critical", "block")
    } else if has_high || highest_score >= threshold {
        ("high", "hold_and_review")
    } else {
        ("medium", "hold_and_review")
    };

    let screening_id = Uuid::new_v4();
    let screened_at = Utc::now();
    let screen_type = body
        .screen_type
        .clone()
        .unwrap_or_else(|| "transaction".to_string());

    if let Err(e) = client
        .execute(
            "INSERT INTO sanctions_screenings \
             (id, tenant_id, screened_name, screen_type, customer_id, transaction_id, \
              risk_level, action, highest_score, match_count, triggered_by, screened_at) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            &[
                &screening_id,
                &tid,
                &name,
                &screen_type,
                &body.customer_id,
                &body.transaction_id,
                &risk_level,
                &action,
                &highest_score,
                &(matches.len() as i32),
                &user_id,
                &screened_at,
            ],
        )
        .await
    {
        error!("Failed to persist screening record: {}", e);
        return HttpResponse::InternalServerError()
            .json(json!({"error": "failed to persist audit record"}));
    }

    for m in &matches {
        let mid = Uuid::new_v4();
        let entry_uuid = Uuid::parse_str(&m.entry_id).unwrap_or_default();
        if let Err(e) = client
            .execute(
                "INSERT INTO sanctions_matches \
                 (id, screening_id, entry_id, list_name, matched_name, match_type, \
                  similarity_score, risk_level) \
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                &[
                    &mid,
                    &screening_id,
                    &entry_uuid,
                    &m.list_name,
                    &m.matched_name,
                    &m.match_type,
                    &m.similarity_score,
                    &m.risk_level,
                ],
            )
            .await
        {
            error!("Failed to persist match record: {}", e);
        }
    }

    info!(
        "Sanctions screening completed name={:?} risk_level={} action={} matches={} score={:.4}",
        name,
        risk_level,
        action,
        matches.len(),
        highest_score
    );

    HttpResponse::Ok().json(ScreeningResponse {
        id: screening_id.to_string(),
        screened_name: name,
        screen_type,
        tenant_id: tid,
        transaction_id: body.transaction_id.clone(),
        customer_id: body.customer_id.clone(),
        risk_level: risk_level.to_string(),
        action: action.to_string(),
        highest_score,
        match_count: matches.len(),
        matches,
        screened_at: screened_at.to_rfc3339(),
    })
}

async fn add_entry(body: web::Json<AddEntryReq>, data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let client = match data.pool.get().await {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": e.to_string()}));
        }
    };

    let id = Uuid::new_v4();
    let entity_type = body
        .entity_type
        .clone()
        .unwrap_or_else(|| "individual".to_string());
    let aliases: Vec<String> = body.aliases.clone().unwrap_or_default();
    let risk_level = body
        .risk_level
        .clone()
        .unwrap_or_else(|| "high".to_string());
    let program = body.program.clone().unwrap_or_default();

    match client
        .execute(
            "INSERT INTO sanctions_entries \
             (id, list_id, list_name, entity_name, entity_type, aliases, risk_level, program) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            &[
                &id,
                &body.list_id,
                &body.list_name,
                &body.entity_name,
                &entity_type,
                &aliases,
                &risk_level,
                &program,
            ],
        )
        .await
    {
        Ok(_) => HttpResponse::Created().json(json!({
            "id": id.to_string(),
            "entity_name": body.entity_name
        })),
        Err(e) => {
            error!("Failed to insert sanctions entry: {}", e);
            HttpResponse::InternalServerError().json(json!({"error": e.to_string()}))
        }
    }
}

async fn list_entries(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let client = match data.pool.get().await {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": e.to_string()}));
        }
    };
    let rows = match client
        .query(
            "SELECT id, list_id, list_name, entity_name, entity_type, aliases, risk_level, \
             program, active, created_at \
             FROM sanctions_entries ORDER BY created_at DESC LIMIT 500",
            &[],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(json!({"error": e.to_string()}));
        }
    };

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let created_at: chrono::DateTime<Utc> = r.get("created_at");
            json!({
                "id": r.get::<_, Uuid>("id").to_string(),
                "list_id": r.get::<_, String>("list_id"),
                "list_name": r.get::<_, String>("list_name"),
                "entity_name": r.get::<_, String>("entity_name"),
                "entity_type": r.get::<_, String>("entity_type"),
                "aliases": r.get::<_, Vec<String>>("aliases"),
                "risk_level": r.get::<_, String>("risk_level"),
                "program": r.get::<_, String>("program"),
                "active": r.get::<_, bool>("active"),
                "created_at": created_at.to_rfc3339(),
            })
        })
        .collect();

    let total = items.len();
    HttpResponse::Ok().json(json!({"items": items, "total": total}))
}

async fn list_screenings(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let client = match data.pool.get().await {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::ServiceUnavailable()
                .json(json!({"error": e.to_string()}));
        }
    };
    let rows = match client
        .query(
            "SELECT id, tenant_id, screened_name, screen_type, customer_id, transaction_id, \
             risk_level, action, highest_score, match_count, triggered_by, screened_at \
             FROM sanctions_screenings ORDER BY screened_at DESC LIMIT 200",
            &[],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(json!({"error": e.to_string()}));
        }
    };

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let screened_at: chrono::DateTime<Utc> = r.get("screened_at");
            json!({
                "id": r.get::<_, Uuid>("id").to_string(),
                "tenant_id": r.get::<_, String>("tenant_id"),
                "screened_name": r.get::<_, String>("screened_name"),
                "screen_type": r.get::<_, String>("screen_type"),
                "customer_id": r.get::<_, Option<String>>("customer_id"),
                "transaction_id": r.get::<_, Option<String>>("transaction_id"),
                "risk_level": r.get::<_, String>("risk_level"),
                "action": r.get::<_, String>("action"),
                "highest_score": r.get::<_, f64>("highest_score"),
                "match_count": r.get::<_, i32>("match_count"),
                "triggered_by": r.get::<_, String>("triggered_by"),
                "screened_at": screened_at.to_rfc3339(),
            })
        })
        .collect();

    let total = items.len();
    HttpResponse::Ok().json(json!({"items": items, "total": total}))
}

async fn healthz(_data: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "sanctions-screening-rs"
    }))
}

// ── Live list sync ────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct ListEntry {
    entity_name: String,
    entity_type: String,
    aliases: Vec<String>,
    program: String,
    list_entry_ref: String,
}

fn parse_ofac_sdn(xml: &str) -> Vec<ListEntry> {
    let mut entries = Vec::new();
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut in_entry = false;
    let mut in_aka = false;
    let mut text_tag = String::new();

    let mut entry_uid = String::new();
    let mut entry_first = String::new();
    let mut entry_last = String::new();
    let mut entry_type = String::new();
    let mut entry_program = String::new();
    let mut aliases: Vec<String> = Vec::new();
    let mut aka_first = String::new();
    let mut aka_last = String::new();

    loop {
        buf.clear();
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = std::str::from_utf8(e.name().as_ref())
                    .unwrap_or("")
                    .to_lowercase();
                match tag.as_str() {
                    "sdnentry" => {
                        in_entry = true;
                        entry_uid.clear();
                        entry_first.clear();
                        entry_last.clear();
                        entry_type.clear();
                        entry_program.clear();
                        aliases.clear();
                    }
                    "aka" => {
                        in_aka = true;
                        aka_first.clear();
                        aka_last.clear();
                    }
                    "uid" | "firstname" | "lastname" | "sdntype" | "program" => {
                        text_tag = tag;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = std::str::from_utf8(e.name().as_ref())
                    .unwrap_or("")
                    .to_lowercase();
                match tag.as_str() {
                    "sdnentry" => {
                        if in_entry && !entry_last.is_empty() {
                            let full_name = if entry_first.is_empty() {
                                entry_last.clone()
                            } else {
                                format!("{} {}", entry_first, entry_last)
                            };
                            let etype = match entry_type.to_lowercase().as_str() {
                                t if t.contains("individual") => "individual",
                                t if t.contains("vessel") => "vessel",
                                t if t.contains("aircraft") => "aircraft",
                                _ => "entity",
                            };
                            entries.push(ListEntry {
                                entity_name: full_name,
                                entity_type: etype.to_string(),
                                aliases: aliases.clone(),
                                program: entry_program.clone(),
                                list_entry_ref: format!("ofac-sdn-{}", entry_uid),
                            });
                        }
                        in_entry = false;
                    }
                    "aka" => {
                        if in_aka {
                            let alias = match (aka_first.is_empty(), aka_last.is_empty()) {
                                (true, false) => aka_last.clone(),
                                (false, true) => aka_first.clone(),
                                (false, false) => format!("{} {}", aka_first, aka_last),
                                _ => String::new(),
                            };
                            let alias = alias.trim().to_string();
                            if !alias.is_empty() {
                                aliases.push(alias);
                            }
                        }
                        in_aka = false;
                    }
                    t if t == text_tag => {
                        text_tag.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if text_tag.is_empty() {
                    continue;
                }
                let text = match e.unescape() {
                    Ok(t) => t.trim().to_string(),
                    Err(_) => continue,
                };
                if text.is_empty() {
                    continue;
                }
                match text_tag.as_str() {
                    "uid" if !in_aka => {
                        entry_uid = text;
                    }
                    "firstname" if !in_aka => {
                        entry_first = text;
                    }
                    "lastname" if !in_aka => {
                        entry_last = text;
                    }
                    "sdntype" => {
                        entry_type = text;
                    }
                    "program" => {
                        if entry_program.is_empty() {
                            entry_program = text;
                        }
                    }
                    "firstname" => {
                        aka_first = text;
                    }
                    "lastname" => {
                        aka_last = text;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                warn!("OFAC XML parse error: {}", e);
                break;
            }
            _ => {}
        }
    }
    entries
}

fn parse_un_consolidated(xml: &str) -> Vec<ListEntry> {
    let mut entries = Vec::new();
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut in_individual = false;
    let mut in_entity = false;
    let mut in_alias = false;
    let mut text_tag = String::new();

    let mut dataid = String::new();
    let mut first_name = String::new();
    let mut second_name = String::new();
    let mut third_name = String::new();
    let mut list_type = String::new();
    let mut aliases: Vec<String> = Vec::new();
    let mut alias_name = String::new();

    loop {
        buf.clear();
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = std::str::from_utf8(e.name().as_ref())
                    .unwrap_or("")
                    .to_uppercase();
                match tag.as_str() {
                    "INDIVIDUAL" => {
                        in_individual = true;
                        in_entity = false;
                        dataid.clear();
                        first_name.clear();
                        second_name.clear();
                        third_name.clear();
                        list_type.clear();
                        aliases.clear();
                    }
                    "ENTITY" => {
                        in_entity = true;
                        in_individual = false;
                        dataid.clear();
                        first_name.clear();
                        second_name.clear();
                        third_name.clear();
                        list_type.clear();
                        aliases.clear();
                    }
                    "ALIAS" => {
                        in_alias = true;
                        alias_name.clear();
                    }
                    "DATAID" | "FIRST_NAME" | "SECOND_NAME" | "THIRD_NAME"
                    | "UN_LIST_TYPE" | "ALIAS_NAME" => {
                        text_tag = tag;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = std::str::from_utf8(e.name().as_ref())
                    .unwrap_or("")
                    .to_uppercase();
                match tag.as_str() {
                    "INDIVIDUAL" => {
                        if !first_name.is_empty() {
                            let full_name = [&first_name, &second_name, &third_name]
                                .iter()
                                .filter(|s| !s.is_empty())
                                .map(|s| s.as_str())
                                .collect::<Vec<_>>()
                                .join(" ");
                            entries.push(ListEntry {
                                entity_name: full_name,
                                entity_type: "individual".to_string(),
                                aliases: aliases.clone(),
                                program: list_type.clone(),
                                list_entry_ref: format!("un-{}", dataid),
                            });
                        }
                        in_individual = false;
                    }
                    "ENTITY" => {
                        if !first_name.is_empty() {
                            entries.push(ListEntry {
                                entity_name: first_name.clone(),
                                entity_type: "entity".to_string(),
                                aliases: aliases.clone(),
                                program: list_type.clone(),
                                list_entry_ref: format!("un-{}", dataid),
                            });
                        }
                        in_entity = false;
                    }
                    "ALIAS" => {
                        let name = alias_name.trim().to_string();
                        if !name.is_empty() {
                            aliases.push(name);
                        }
                        in_alias = false;
                    }
                    t if t == text_tag => {
                        text_tag.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if text_tag.is_empty() {
                    continue;
                }
                let text = match e.unescape() {
                    Ok(t) => t.trim().to_string(),
                    Err(_) => continue,
                };
                if text.is_empty() {
                    continue;
                }
                match text_tag.as_str() {
                    "DATAID" => dataid = text,
                    "FIRST_NAME" => first_name = text,
                    "SECOND_NAME" => second_name = text,
                    "THIRD_NAME" => third_name = text,
                    "UN_LIST_TYPE" => list_type = text,
                    "ALIAS_NAME" => alias_name = text,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                warn!("UN XML parse error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // suppress unused-variable warnings for flags that are set but only read at end
    let _ = in_alias;
    let _ = in_entity;
    let _ = in_individual;

    entries
}

async fn upsert_entries(
    pool: &Pool,
    list_id: &str,
    list_name: &str,
    risk_level: &str,
    entries: Vec<ListEntry>,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    let mut count = 0usize;
    for entry in &entries {
        let id = Uuid::new_v4();
        let affected = client
            .execute(
                "INSERT INTO sanctions_entries \
                 (id, list_id, list_name, entity_name, entity_type, aliases, \
                  risk_level, program, list_entry_ref) \
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) \
                 ON CONFLICT (list_id, list_entry_ref) \
                 WHERE list_entry_ref IS NOT NULL \
                 DO UPDATE SET \
                     entity_name = EXCLUDED.entity_name, \
                     entity_type = EXCLUDED.entity_type, \
                     aliases     = EXCLUDED.aliases, \
                     program     = EXCLUDED.program, \
                     active      = TRUE",
                &[
                    &id,
                    &list_id,
                    &list_name,
                    &entry.entity_name,
                    &entry.entity_type,
                    &entry.aliases,
                    &risk_level,
                    &entry.program,
                    &entry.list_entry_ref,
                ],
            )
            .await?;
        if affected > 0 {
            count += 1;
        }
    }
    Ok(count)
}

async fn record_sync(
    pool: &Pool,
    list_id: &str,
    count: usize,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = pool.get().await?;
    client
        .execute(
            "INSERT INTO sanctions_list_syncs (id, list_id, entry_count, synced_at) \
             VALUES ($1,$2,$3,NOW())",
            &[&Uuid::new_v4(), &list_id, &(count as i64)],
        )
        .await?;
    Ok(())
}

async fn sync_all_lists(
    pool: &Pool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let ofac_url = ev(
        "OFAC_SDN_URL",
        "https://ofac.treasury.gov/downloads/sdn.xml",
    );
    info!("Downloading OFAC SDN list from {}", ofac_url);
    let ofac_xml = http.get(&ofac_url).send().await?.text().await?;
    let ofac_entries = parse_ofac_sdn(&ofac_xml);
    info!("Parsed {} OFAC SDN entries", ofac_entries.len());
    let ofac_count =
        upsert_entries(pool, "ofac-sdn", "OFAC SDN", "critical", ofac_entries).await?;
    record_sync(pool, "ofac-sdn", ofac_count).await?;
    info!("Upserted {} OFAC SDN entries", ofac_count);

    let un_url = ev(
        "UN_CONSOLIDATED_URL",
        "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
    );
    info!("Downloading UN Consolidated list from {}", un_url);
    let un_xml = http.get(&un_url).send().await?.text().await?;
    let un_entries = parse_un_consolidated(&un_xml);
    info!("Parsed {} UN Consolidated entries", un_entries.len());
    let un_count = upsert_entries(
        pool,
        "un-consolidated",
        "UN Consolidated",
        "critical",
        un_entries,
    )
    .await?;
    record_sync(pool, "un-consolidated", un_count).await?;
    info!("Upserted {} UN Consolidated entries", un_count);

    Ok(())
}

async fn trigger_sync(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let pool = data.pool.clone();
    tokio::spawn(async move {
        if let Err(e) = sync_all_lists(&pool).await {
            error!("Triggered sync failed: {}", e);
        }
    });
    HttpResponse::Accepted().json(json!({
        "status": "sync_triggered",
        "message": "Background sync of OFAC/UN sanctions lists started"
    }))
}

// ── Main ──────────────────────────────────────────────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install ring crypto provider");

    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let pool = build_pool();
    for attempt in 1u32..=5 {
        match ensure_schema(&pool).await {
            Ok(_) => {
                info!("Schema initialized");
                break;
            }
            Err(e) => {
                eprintln!("WARNING: Schema init attempt {attempt} failed: {e}");
                if attempt < 5 {
                    tokio::time::sleep(std::time::Duration::from_secs(2 * attempt as u64)).await;
                } else {
                    eprintln!("WARNING: Schema initialization failed after {attempt} attempts — service starting without DB");
                }
            }
        }
    }

    let threshold: f64 = env::var("MATCH_THRESHOLD")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.82);

    let allowed_origins = ev("ALLOWED_ORIGINS", "*");
    let port: u16 = ev("PORT", "8283").parse().unwrap_or(8283);

    info!(
        "sanctions-screening-rs listening on :{} match_threshold={}",
        port, threshold
    );

    let state = web::Data::new(AppState {
        pool,
        match_threshold: threshold,
    });

    // Spawn background sanctions list sync: initial sync after 60s, then every 24h
    let sync_pool = state.pool.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        loop {
            info!("Starting scheduled sanctions list sync");
            if let Err(e) = sync_all_lists(&sync_pool).await {
                error!("Scheduled sanctions sync failed: {}", e);
            }
            tokio::time::sleep(std::time::Duration::from_secs(86_400)).await;
        }
    });

    let ao = allowed_origins.clone();
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(
                middleware::DefaultHeaders::new()
                    .add(("Access-Control-Allow-Origin", ao.as_str()))
                    .add(("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
                    .add((
                        "Access-Control-Allow-Headers",
                        "Content-Type, x-tenant-id, x-keycloak-id",
                    )),
            )
            .route("/healthz", web::get().to(healthz))
            .route("/api/screen", web::post().to(screen))
            .route("/api/entries", web::get().to(list_entries))
            .route("/api/entries", web::post().to(add_entry))
            .route("/api/screenings", web::get().to(list_screenings))
            .route("/api/admin/sync-lists", web::post().to(trigger_sync))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
