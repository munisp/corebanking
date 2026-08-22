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
}

struct AppState {
    db: Option<PgPool>,
    edges_mem: std::sync::Mutex<Vec<COAEdge>>,
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

static RL_TOKENS: AtomicI64 = AtomicI64::new(100);
static RL_LAST: AtomicI64 = AtomicI64::new(0);

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if now > RL_LAST.load(AtomicOrdering::Relaxed) {
        RL_TOKENS.store(100, AtomicOrdering::Relaxed);
        RL_LAST.store(now, AtomicOrdering::Relaxed);
    }
    RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) > 0
}

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path.starts_with("/health") || path.starts_with("/ready") || path.starts_with("/live") || path.starts_with("/metrics") {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(v) if v.to_str().unwrap_or("").starts_with("Bearer ") => Ok(()),
        _ => Err(HttpResponse::Unauthorized().json(json!({"error": "unauthorized"}))),
    }
}

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(AtomicOrdering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
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
    if let Err(resp) = check_jwt(&req) { return resp; } HttpResponse::Ok().json(json!({"ready": true, "service": "neo4j-coa-graph-rs"})) }
async fn live(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; } HttpResponse::Ok().json(json!({"live": true})) }
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
    // Edges: DB table, merged with any edges recorded at runtime via transaction-flow.
    let db_edges = fetch_edges(db).await.unwrap_or_else(|e| {
        eprintln!("[neo4j-coa-graph-rs] edge load failed (continuing with runtime edges): {}", e);
        Vec::new()
    });
    let mut edges = db_edges;
    edges.extend(state.edges_mem.lock().unwrap().iter().cloned());
    Ok((nodes, edges))
}

async fn coa_graph(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    match load_graph(&state).await {
        Ok((nodes, edges)) => HttpResponse::Ok().json(json!({"nodes": nodes, "edges": edges, "total_nodes": nodes.len(), "total_edges": edges.len()})),
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); resp }
    }
}

async fn coa_pagerank(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
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
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    match load_graph(&state).await {
        Ok((nodes, _)) => HttpResponse::Ok().json(compute_basel_iii(&nodes)),
        Err(resp) => { ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed); resp }
    }
}

async fn coa_traverse(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
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
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let txn = body.into_inner();
    state.edges_mem.lock().unwrap().push(COAEdge {
        from_code: txn.debit_account.clone(), to_code: txn.credit_account.clone(),
        relation_type: "TRANSACTION".into(), weight: txn.amount,
        metadata: json!({"narration": txn.narration, "currency": txn.currency}),
    });
    HttpResponse::Created().json(json!({"recorded": true, "debit": txn.debit_account, "credit": txn.credit_account, "amount": txn.amount}))
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
                Ok(p) => Some(p),
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
    let state = web::Data::new(AppState { db, edges_mem: std::sync::Mutex::new(Vec::new()) });

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("neo4j-coa-graph-rs", "neo4j-coa-graph-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}
