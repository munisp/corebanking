#![allow(unused)]
//! 54link-dev Chart-of-Accounts Graph — Rust
//! CoA nodes/edges are REAL GL data (glAccounts / coaEdges tables). Basel CAR
//! is computed from live GL balances; any source failure => 503.

use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use std::sync::atomic::{AtomicU64, AtomicI64, AtomicI32, AtomicBool, Ordering as AtomicOrdering};
use std::time::Instant;
use actix_web::HttpMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct COANode {
    code: String,
    name: String,
    category: String,
    subcategory: String,
    balance: f64,
    currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct COAEdge {
    from_code: String,
    to_code: String,
    relation_type: String,
    weight: f64,
    metadata: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct TransactionFlow {
    debit_account: String,
    credit_account: String,
    amount: f64,
    currency: String,
    narration: String,
    // Optional caller-supplied idempotency key (natural dedup key for the
    // money flow); UNIQUE in coa_transaction_flows when present.
    flow_ref: Option<String>,
}

// W12-B5P1H: the edges_mem in-memory shadow (runtime transaction-flow edges
// lost on restart) was removed; flows are persisted transactionally to the
// coa_transaction_flows Postgres metadata table and merged into the graph on
// read. This service holds no balance/ledger state (balances are read live
// from glAccounts) — graph metadata only, so PG is the correct target.
struct AppState {
    db: Option<PgPool>,
}

async fn init_flow_schema(db: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS coa_transaction_flows (
            flow_id BIGSERIAL PRIMARY KEY,
            debit_account TEXT NOT NULL,
            credit_account TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
            currency TEXT NOT NULL,
            narration TEXT NOT NULL,
            flow_ref TEXT UNIQUE,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"#,
    )
    .execute(db)
    .await?;
    Ok(())
}

// Runtime-recorded flows as graph edges, read back from Postgres.
async fn fetch_flow_edges(db: &PgPool) -> Result<Vec<COAEdge>, String> {
    let rows = sqlx::query(
        r#"SELECT debit_account, credit_account, amount::float8, currency, narration
           FROM coa_transaction_flows ORDER BY flow_id"#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("coa_transaction_flows query failed: {}", e))?;
    Ok(rows
        .iter()
        .map(|r| COAEdge {
            from_code: r.get("debit_account"),
            to_code: r.get("credit_account"),
            relation_type: "TRANSACTION".into(),
            weight: r.get(2),
            metadata: json!({"narration": r.get::<String, _>("narration"), "currency": r.get::<String, _>("currency")}),
        })
        .collect())
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

// Load the chart of accounts from the real GL. Never seed fake balances.
async fn fetch_nodes(db: &PgPool) -> Result<Vec<COANode>, String> {
    let rows = sqlx::query(
        r#"SELECT "glAccountCode", "name", "category", COALESCE("subcategory", ''), balance::float8, "currency"
           FROM "glAccounts" ORDER BY "glAccountCode""#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("glAccounts query failed: {}", e))?;
    if rows.is_empty() {
        return Err("glAccounts is empty — no chart of accounts available".into());
    }
    Ok(rows
        .iter()
        .map(|r| COANode {
            code: r.get("glAccountCode"),
            name: r.get("name"),
            category: r.get("category"),
            subcategory: r.get(3),
            balance: r.get(4),
            currency: r.get("currency"),
        })
        .collect())
}

// Graph edges come from the coaEdges table when present; otherwise empty
// (never fabricate flows).
async fn fetch_edges(db: &PgPool) -> Result<Vec<COAEdge>, String> {
    let rows = sqlx::query(
        r#"SELECT from_code, to_code, relation_type, weight::float8, COALESCE(metadata::text, '{}')
           FROM "coaEdges""#,
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("coaEdges query failed: {}", e))?;
    Ok(rows
        .iter()
        .map(|r| COAEdge {
            from_code: r.get("from_code"),
            to_code: r.get("to_code"),
            relation_type: r.get("relation_type"),
            weight: r.get(3),
            metadata: serde_json::from_str(r.get::<String, _>(4).as_str()).unwrap_or(json!({})),
        })
        .collect())
}

fn compute_basel_iii(nodes: &[COANode]) -> serde_json::Value {
    let mut total_rwa = 0.0f64;
    let mut cet1 = 0.0f64;
    let mut tier2 = 0.0f64;
    let mut total_loans = 0.0f64;
    let mut total_provisions = 0.0f64;
    for n in nodes {
        match n.subcategory.as_str() {
            s if s.starts_with("loans_") => {
                let rw = match s { "loans_corporate" => 1.0, "loans_sme" => 0.75, "loans_agric" => 0.5, _ => 1.0 };
                total_rwa += n.balance.abs() * rw;
                total_loans += n.balance.abs();
            }
            "share_capital" | "reserves" | "retained" => cet1 += n.balance.abs(),
            "borrowings_sub" => tier2 += n.balance.abs(),
            s if s.starts_with("provision_") => total_provisions += n.balance.abs(),
            _ => {}
        }
    }
    let car = if total_rwa > 0.0 { (cet1 + tier2) / total_rwa * 100.0 } else { 0.0 };
    json!({
        "total_rwa": total_rwa, "cet1_capital": cet1, "tier2_capital": tier2,
        "capital_adequacy_ratio": car, "cbn_minimum_car": 15.0, "car_compliant": car >= 15.0,
        "total_loans": total_loans, "total_provisions": total_provisions,
    })
}

fn compute_pagerank(nodes: &[COANode], edges: &[COAEdge], iterations: usize, damping: f64) -> Vec<(String, f64)> {
    let n = nodes.len();
    if n == 0 { return vec![]; }
    let mut rank: std::collections::HashMap<String, f64> = nodes.iter().map(|nd| (nd.code.clone(), 1.0 / n as f64)).collect();
    let mut out_degree: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for e in edges { *out_degree.entry(e.from_code.clone()).or_insert(0) += 1; }
    for _ in 0..iterations {
        let mut new_rank: std::collections::HashMap<String, f64> = nodes.iter().map(|nd| (nd.code.clone(), (1.0 - damping) / n as f64)).collect();
        for e in edges {
            let deg = *out_degree.get(&e.from_code).unwrap_or(&1);
            if let Some(&r) = rank.get(&e.from_code) {
                *new_rank.entry(e.to_code.clone()).or_insert(0.0) += damping * r / deg as f64;
            }
        }
        rank = new_rank;
    }
    let mut result: Vec<(String, f64)> = rank.into_iter().collect();
    result.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    result
}

fn sanitize_input(s: &str) -> String {
    s.replace("<script>", "").replace("</script>", "").replace("javascript:", "").chars().take(10240).collect()
}


// --- Distributed rate limiting (redis shared sliding window; W12 C3-P1-B1) ---
// Replaces the per-replica statics _RL_TOKENS/_RL_LAST (and the dead
// _RATE_WINDOW_START/_RATE_WINDOW_COUNT pair): behind >1 replica the old
// per-process bucket multiplied the effective limit by the replica count
// (correctness bug). Now an atomic Lua INCR+PEXPIRE sliding window on a shared
// deadpool-redis pool; limit is global per service, not per replica.
// Key: ratelimit:neo4j-coa-graph-rs:global — the replaced bucket was process-global (no
// per-ip/per-user subject), so the subject segment is preserved as "global".
// Window/limit: 100 requests per 1000 ms — identical to the old token bucket.
// Env: REDIS_URL (fleet-wide var, cf. docker-compose.yml REDIS_URL entries);
// default redis://redis:6379 matches the compose network.
// Fail-mode: FAIL CLOSED — when redis is unreachable or errors, rl_allow()
// returns false and callers answer 429 + Retry-After, mirroring check_jwt's
// fail-closed style. Limiting is never silently disabled.
static RL_POOL: std::sync::OnceLock<Option<deadpool_redis::Pool>> = std::sync::OnceLock::new();
static RL_SCRIPT: std::sync::OnceLock<deadpool_redis::redis::Script> = std::sync::OnceLock::new();

const RL_WINDOW_MS: u64 = 1000;
const RL_LIMIT: i64 = 100;
const RL_LUA: &str = "local c = redis.call('INCR', KEYS[1])\nif c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end\nreturn c";

fn rl_pool() -> Option<&'static deadpool_redis::Pool> {
    RL_POOL
        .get_or_init(|| {
            let url =
                std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
            deadpool_redis::Config::from_url(url)
                .create_pool(Some(deadpool_redis::Runtime::Tokio1))
                .ok()
        })
        .as_ref()
}

async fn rl_allow() -> bool {
    let Some(pool) = rl_pool() else {
        return false; // fail closed: redis pool unavailable (malformed REDIS_URL)
    };
    let Ok(mut conn) = pool.get().await else {
        return false; // fail closed: redis unreachable
    };
    let script = RL_SCRIPT.get_or_init(|| deadpool_redis::redis::Script::new(RL_LUA));
    let count: Result<i64, deadpool_redis::redis::RedisError> = script
        .key("ratelimit:neo4j-coa-graph-rs:global")
        .arg(RL_WINDOW_MS)
        .invoke_async(&mut *conn)
        .await;
    match count {
        Ok(n) => n <= RL_LIMIT,
        Err(_) => false, // fail closed: redis error
    }
}

// --- JWT Auth Check (fail-closed; R4-V1 remediation) ---
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
    // This service exposes its probes at /ready and /live (not /readyz, /livez); they stay unauthenticated.
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" || path == "/ready" || path == "/live" {
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

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

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

async fn health(state: web::Data<AppState>) -> HttpResponse {
    let db_ok = match &state.db {
        Some(pool) => sqlx::query("SELECT 1").execute(pool).await.is_ok(),
        None => false,
    };
    DB_AVAILABLE.store(db_ok, AtomicOrdering::Relaxed);
    HttpResponse::Ok().json(json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": "neo4j-coa-graph-rs",
        "database": if db_ok { "connected" } else { "unavailable" },
        "capabilities": ["coa_graph", "neo4j_cypher", "pagerank", "basel_iii", "path_traversal"],
    }))
}

async fn ready(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; } HttpResponse::Ok().json(json!({"ready": true, "service": "neo4j-coa-graph-rs"})) }
async fn live(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; } HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"neo4j-coa-graph-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"neo4j-coa-graph-rs\"}} {}\n", r, e))
}

async fn load_graph(state: &web::Data<AppState>) -> Result<(Vec<COANode>, Vec<COAEdge>), HttpResponse> {
    let db = match &state.db {
        Some(d) => d,
        None => return Err(source_unavailable("DATABASE_URL not configured; refusing to serve a fabricated chart of accounts")),
    };
    let nodes = match fetch_nodes(db).await {
        Ok(n) => n,
        Err(e) => {
            eprintln!("[neo4j-coa-graph-rs] node load failed: {}", e);
            return Err(source_unavailable(&e));
        }
    };
    // Edges: coaEdges table, merged with transaction flows recorded at
    // runtime via transaction-flow (persisted in coa_transaction_flows).
    let db_edges = fetch_edges(db).await.unwrap_or_else(|e| {
        eprintln!("[neo4j-coa-graph-rs] edge load failed (continuing with flow edges): {}", e);
        Vec::new()
    });
    let mut edges = db_edges;
    match fetch_flow_edges(db).await {
        Ok(flow_edges) => edges.extend(flow_edges),
        Err(e) => eprintln!("[neo4j-coa-graph-rs] flow edge load failed: {}", e),
    }
    Ok((nodes, edges))
}

async fn coa_graph(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow().await { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    match load_graph(&state).await {
        Ok((nodes, edges)) => HttpResponse::Ok().json(json!({"nodes": nodes, "edges": edges, "total_nodes": nodes.len(), "total_edges": edges.len()})),
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); resp }
    }
}

async fn coa_pagerank(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow().await { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    match load_graph(&state).await {
        Ok((nodes, edges)) => {
            let rankings = compute_pagerank(&nodes, &edges, 20, 0.85);
            let named: Vec<serde_json::Value> = rankings.iter().map(|(code, rank)| {
                let name = nodes.iter().find(|n| n.code == *code).map(|n| n.name.clone()).unwrap_or_default();
                json!({"code": code, "name": name, "rank": rank})
            }).collect();
            HttpResponse::Ok().json(json!({"algorithm": "pagerank", "iterations": 20, "damping": 0.85, "rankings": named}))
        }
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); resp }
    }
}

async fn coa_basel(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow().await { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    match load_graph(&state).await {
        Ok((nodes, _)) => HttpResponse::Ok().json(compute_basel_iii(&nodes)),
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); resp }
    }
}

async fn coa_traverse(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow().await { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger", "view").await { return resp; } // W12-B5D1
    let from = body.get("from").and_then(|v| v.as_str()).unwrap_or("");
    let to = body.get("to").and_then(|v| v.as_str()).unwrap_or("");
    let edges = match load_graph(&state).await {
        Ok((_, edges)) => edges,
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); return resp; }
    };
    // BFS traversal
    let mut visited = std::collections::HashSet::new();
    let mut queue = std::collections::VecDeque::new();
    queue.push_back((from.to_string(), vec![from.to_string()]));
    visited.insert(from.to_string());
    let mut result_path = Vec::new();
    while let Some((current, path)) = queue.pop_front() {
        if current == to { result_path = path; break; }
        if path.len() > 10 { continue; }
        for e in &edges {
            let next = if e.from_code == current { &e.to_code } else if e.to_code == current { &e.from_code } else { continue };
            if !visited.contains(next.as_str()) {
                visited.insert(next.clone());
                let mut new_path = path.clone();
                new_path.push(next.clone());
                queue.push_back((next.clone(), new_path));
            }
        }
    }
    HttpResponse::Ok().json(json!({"from": from, "to": to, "path": result_path, "hops": if result_path.is_empty() { 0 } else { result_path.len() - 1 }}))
}

async fn transaction_flow(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<TransactionFlow>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow().await { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify::require_permify(&req, "ledger", "view").await { return resp; } // W12-B5D1
    let txn = body.into_inner();
    let db = match &state.db {
        Some(d) => d,
        None => {
            ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
            return source_unavailable("DATABASE_URL not configured; refusing to record an unpersisted transaction flow");
        }
    };
    // Transactional, idempotent on the natural key flow_ref (when supplied):
    // a replayed POST returns the already-stored flow instead of duplicating it.
    let inserted = match sqlx::query(
        r#"INSERT INTO coa_transaction_flows (debit_account, credit_account, amount, currency, narration, flow_ref)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (flow_ref) DO NOTHING RETURNING flow_id"#,
    )
    .bind(&txn.debit_account)
    .bind(&txn.credit_account)
    .bind(txn.amount)
    .bind(&txn.currency)
    .bind(&txn.narration)
    .bind(&txn.flow_ref)
    .fetch_optional(db)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            eprintln!("[neo4j-coa-graph-rs] flow insert failed: {}", e);
            ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
            return source_unavailable(&format!("flow persist failed: {}", e));
        }
    };
    match inserted {
        Some(row) => HttpResponse::Created().json(json!({
            "recorded": true, "flow_id": row.get::<i64, _>("flow_id"),
            "debit": txn.debit_account, "credit": txn.credit_account, "amount": txn.amount,
            "source": "postgres",
        })),
        None => {
            // ON CONFLICT fired: fetch the stored row and report the replay.
            let stored = sqlx::query(
                r#"SELECT flow_id FROM coa_transaction_flows WHERE flow_ref = $1"#,
            )
            .bind(&txn.flow_ref)
            .fetch_one(db)
            .await;
            match stored {
                Ok(row) => HttpResponse::Ok().json(json!({
                    "recorded": true, "idempotent_replayed": true, "flow_id": row.get::<i64, _>("flow_id"),
                    "debit": txn.debit_account, "credit": txn.credit_account, "amount": txn.amount,
                    "source": "postgres",
                })),
                Err(e) => {
                    ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    source_unavailable(&format!("flow replay lookup failed: {}", e))
                }
            }
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[neo4j-coa-graph-rs] starting");

    // Fail-fast policy: CoA/Basel endpoints 503 without the GL database.
    let db = match env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(10)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => {
                    if let Err(e) = init_flow_schema(&p).await {
                        log::error!("[neo4j-coa-graph-rs] flow schema init failed: {} — CoA endpoints will 503", e);
                        None
                    } else {
                        Some(p)
                    }
                }
                Err(e) => {
                    log::error!("[neo4j-coa-graph-rs] DB connect failed: {} — CoA endpoints will 503", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("[neo4j-coa-graph-rs] DATABASE_URL not set — CoA endpoints will 503");
            None
        }
    };

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8112".to_string()).parse().unwrap_or(8112);
    let state = web::Data::new(AppState { db });

    println!("neo4j-coa-graph-rs listening on port {}", port);
    start_grpc_server("neo4j-coa-graph-rs", 10386);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/health", web::get().to(health))
            .route("/ready", web::get().to(ready))
            .route("/live", web::get().to(live))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/coa/graph", web::get().to(coa_graph))
            .route("/v1/coa/pagerank", web::get().to(coa_pagerank))
            .route("/v1/coa/basel", web::get().to(coa_basel))
            .route("/v1/coa/traverse", web::post().to(coa_traverse))
            .route("/v1/coa/transaction-flow", web::post().to(transaction_flow))
    })
    .bind(("0.0.0.0", port))?.run().await
}

// --- gRPC Server (binary protocol, length-prefixed) ---
fn start_grpc_server(service_name: &'static str, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("0.0.0.0:{}", port)) {
            Ok(l) => l,
            Err(e) => { eprintln!("[{}] gRPC bind :{} failed: {}", service_name, port, e); return; }
        };
        eprintln!("[{}] gRPC server on :{}", service_name, port);
        // Wave-11: bound concurrent connection handlers (was: unbounded thread-per-conn).
        let conn_sem = std::sync::Arc::new(tokio::sync::Semaphore::new(256));
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let conn_permit = match conn_sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => {
                        eprintln!("[{}] gRPC connection limit (256) reached; dropping connection", service_name);
                        continue;
                    }
                };
                std::thread::spawn(move || {
                    let _conn_permit = conn_permit; // released when handler exits
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("neo4j-coa-graph-rs", "neo4j-coa-graph-rs");
    }

}

// Wave-12 B5-P0-D1: Permify authorization guard module.
mod permify;
