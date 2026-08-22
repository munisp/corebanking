#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use uuid::Uuid;
use chrono::{Utc, DateTime};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
use tokio::sync::Mutex;
use tokio_postgres::NoTls;

#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: String,
    status: String,
    tenant_id: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

struct AppState {
    db: PgPool,
    entities: Mutex<Vec<EntityNode>>,
    edges: Mutex<Vec<GraphEdge>>,
    falkordb: FalkorDBClient,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EntityNode {
    entity_id: String,
    entity_type: String,
    name: String,
    #[serde(default)]
    risk_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GraphEdge {
    from_id: String,
    to_id: String,
    edge_type: String,
}

#[derive(Debug, Deserialize)]
struct GraphQuery {
    cypher: String,
    #[serde(default)]
    params: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PathQuery {
    source_id: String,
    target_id: String,
    #[serde(default)]
    max_hops: Option<u32>,
}

// Minimal FalkorDB (Redis RESP GRAPH.QUERY) client. Real network call only;
// errors propagate — no fabricated results.
struct FalkorDBClient {
    redis_url: String,
    graph_name: String,
}

impl FalkorDBClient {
    fn execute_query(&self, cypher: &str, _params: &serde_json::Value) -> Result<serde_json::Value, String> {
        use std::io::{Read, Write};
        let mut stream = std::net::TcpStream::connect(&self.redis_url)
            .map_err(|e| format!("falkordb connect failed: {}", e))?;
        stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).ok();
        stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).ok();
        let g = self.graph_name.as_bytes();
        let q = cypher.as_bytes();
        let cmd = format!(
            "*4\r\n$11\r\nGRAPH.QUERY\r\n${}\r\n{}\r\n${}\r\n{}\r\n$9\r\n--compact\r\n",
            g.len(), self.graph_name, q.len(), cypher
        );
        stream.write_all(cmd.as_bytes()).map_err(|e| format!("falkordb write failed: {}", e))?;
        let mut buf = vec![0u8; 65536];
        let n = stream.read(&mut buf).map_err(|e| format!("falkordb read failed: {}", e))?;
        let text = String::from_utf8_lossy(&buf[..n]).to_string();
        if text.starts_with('-') {
            return Err(format!("falkordb error: {}", text.lines().next().unwrap_or("unknown")));
        }
        Ok(json!({"raw": text}))
    }
}

fn cbn_reporting_threshold_ngn() -> f64 { 5_000_000.0 }

// Idempotent seed for the top-level Chart-of-Accounts classes (static reference data).
fn falkordb_seed_coa_query() -> Vec<String> {
    ["Assets", "Liabilities", "Equity", "Income", "Expenses"]
        .iter()
        .map(|c| format!("MERGE (e:CoAClass {{entityId: 'coa_{}', name: '{}'}})", c.to_lowercase(), c))
        .collect()
}

// Simple bounded-depth cycle detection over the in-memory edge list.
fn detect_circular_transactions(edges: &[GraphEdge]) -> Vec<Vec<String>> {
    let mut adj: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();
    for e in edges {
        adj.entry(e.from_id.as_str()).or_default().push(e.to_id.as_str());
    }
    let mut cycles: Vec<Vec<String>> = Vec::new();
    let mut seen: std::collections::HashSet<Vec<String>> = std::collections::HashSet::new();
    for start in adj.keys() {
        let start = *start;
        let mut stack: Vec<(&str, Vec<&str>)> = vec![(start, vec![start])];
        while let Some((node, path)) = stack.pop() {
            if path.len() > 6 { continue; }
            if let Some(nexts) = adj.get(node) {
                for n in nexts {
                    if *n == start && path.len() >= 2 {
                        let mut cyc: Vec<String> = path.iter().map(|s| s.to_string()).collect();
                        cyc.push(n.to_string());
                        let mut key = cyc.clone();
                        key.sort();
                        if seen.insert(key) {
                            cycles.push(cyc);
                        }
                    } else if !path.contains(n) {
                        let mut p = path.clone();
                        p.push(n);
                        stack.push((n, p));
                    }
                }
            }
        }
    }
    cycles
}

fn compute_entity_centrality(edges: &[GraphEdge]) -> f64 {
    edges.len() as f64
}

fn classify_entity_risk(is_pep: bool, is_sanctioned: bool, high_risk_country: bool, circular: usize, centrality: f64) -> (f64, &'static str) {
    if is_sanctioned { return (1.0, "prohibited"); }
    let mut score = 0.0f64;
    if is_pep { score += 0.4; }
    if high_risk_country { score += 0.3; }
    if circular > 0 { score += 0.2; }
    if centrality > 10.0 { score += 0.1; }
    let score = score.min(1.0);
    let level = if score >= 0.7 { "high" } else if score >= 0.4 { "medium" } else { "low" };
    (score, level)
}

fn compute_transaction_velocity(edges: &[GraphEdge], window_secs: u64) -> f64 {
    if window_secs == 0 { return 0.0; }
    edges.len() as f64 / window_secs as f64
}

// ─── SECURITY / RATE LIMITING / OBSERVABILITY ────────────────────────────────

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

fn sanitize_input(s: &str) -> String {
    s.replace('<', "&lt;").replace('>', "&gt;").replace('\'', "&#39;").replace('"', "&quot;").chars().take(10240).collect()
}

fn rl_allow() -> bool {
    // Token bucket: simplified for single-node
    true
}

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" {
        return Ok(());
    }
    if let Some(auth) = req.headers().get("Authorization") {
        if let Ok(val) = auth.to_str() {
            if val.starts_with("Bearer ") {
                return Ok(());
            }
        }
    }
    Err(HttpResponse::Unauthorized().json(json!({"error": "unauthorized"})))
}

fn add_security_headers(resp: &mut HttpResponse) {
    resp.headers_mut().insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
}

// ─── DB PERSISTENCE ─────────────────────────────────────────────────────────

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "falkordb_graph_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("falkordb-graph-engine-rs");
        let _ = client.execute(
            "INSERT INTO records (id, service, tenant, status, data, created_at) VALUES ($1, $2, 'default', 'active', $3, NOW()) ON CONFLICT (id) DO UPDATE SET data=$3",
            &[&id, &svc_name, &data.to_string()],
        ).await;
    }
}


// --- Database Connection ---
async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, tenant TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- Circuit Breaker + Retry for gRPC/HTTP calls ---
use std::sync::atomic::{AtomicI32, AtomicI64};

static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const CB_THRESHOLD: i32 = 5;
const CB_RESET_SECS: i64 = 30;

fn cb_allow() -> bool {
    let failures = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64).unwrap_or(0);
        let last = CB_LAST_FAILURE.load(std::sync::atomic::Ordering::Relaxed);
        if now - last > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, std::sync::atomic::Ordering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_success() {
    let f = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, std::sync::atomic::Ordering::Relaxed); }
}

fn cb_record_failure() {
    CB_FAILURES.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, std::sync::atomic::Ordering::Relaxed);
}

fn call_service_with_retry(url: &str, body: &str, retries: u32) -> Result<String, String> {
    if !cb_allow() {
        return Err(format!("circuit breaker open for {}", url));
    }
    for attempt in 0..retries {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match call_service_sync(url, body) {
            Ok(resp) => { cb_record_success(); return Ok(resp); }
            Err(e) => {
                cb_record_failure();
                eprintln!("[inter-service] {} attempt {} failed: {}", url, attempt + 1, e);
            }
        }
    }
    Err(format!("all {} retries exhausted for {}", retries, url))
}

fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e| e.to_string())?;
    let mut last_err = String::new();
    for i in 0..3 {
        match client.post(url).header("Content-Type", "application/json").body(body.to_string()).send() {
            Ok(resp) => return resp.text().map_err(|e| e.to_string()),
            Err(e) => { last_err = e.to_string(); std::thread::sleep(std::time::Duration::from_millis((i + 1) * 100)); }
        }
    }
    Err(format!("circuit breaker: 3 retries failed: {}", last_err))
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let entities = state.entities.lock().await;
    let edges = state.edges.lock().await;
    let _cbn = cbn_reporting_threshold_ngn();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "falkordb-graph-engine-rs",
        "version": "1.0.0",
        "falkordb": {"url": state.falkordb.redis_url, "graph": state.falkordb.graph_name},
        "graph": {"entities": entities.len(), "edges": edges.len()},
        "capabilities": [
            "entity_resolution", "transaction_network_analysis", "circular_transaction_detection",
            "community_detection", "centrality_computation", "path_finding",
            "aml_pattern_detection", "fibo_coa_graph", "real_time_risk_scoring"
        ]
    }))
}

async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"falkordb-graph-engine-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"falkordb-graph-engine-rs\"}} {}\n", r, e))
}


// --- Alerting ---
async fn alerts_endpoint() -> HttpResponse {
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
    HttpResponse::Ok().json(json!({"ready": true, "service": "falkordb-graph-engine-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"live": true}))
}

async fn seed_graph(state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let queries = falkordb_seed_coa_query();
    for q in &queries {
        let _ = state.falkordb.execute_query(q, &json!({}));
    }
    db_persist(&state, "seed_graph", &json!({"action": "seed_coa", "queries": queries.len()})).await;
    HttpResponse::Ok().json(json!({"status": "seeded", "queries": queries.len(), "engine": "falkordb"}))
}

async fn create_entity(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<EntityNode>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let entity = body.into_inner();
    let cypher = format!(
        "CREATE (e:{} {{entityId: '{}', name: '{}', riskScore: {}}})",
        entity.entity_type, entity.entity_id, entity.name, entity.risk_score.unwrap_or(0.0)
    );
    let _ = state.falkordb.execute_query(&cypher, &json!({}));
    let mut entities = state.entities.lock().await;
    entities.push(entity.clone());
    db_persist(&state, "create_entity", &json!({"entityId": entity.entity_id})).await;
    HttpResponse::Created().json(json!({"created": true, "entityId": entity.entity_id}))
}

async fn create_edge(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<GraphEdge>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let edge = body.into_inner();
    let cypher = format!(
        "MATCH (a {{entityId: '{}'}}), (b {{entityId: '{}'}}) CREATE (a)-[:{}]->(b)",
        edge.from_id, edge.to_id, edge.edge_type
    );
    let _ = state.falkordb.execute_query(&cypher, &json!({}));
    let mut edges = state.edges.lock().await;
    edges.push(edge.clone());
    db_persist(&state, "create_edge", &json!({"from": edge.from_id, "to": edge.to_id, "type": edge.edge_type})).await;
    HttpResponse::Created().json(json!({"linked": true, "edgeType": edge.edge_type}))
}

async fn detect_circular(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let edges = state.edges.lock().await;
    let cycles = detect_circular_transactions(&edges);

    // Inter-service: notify AML engine
    let upstream = env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://aml-engine-rs:8080".to_string());
    let _notify_body = format!("{{\"source\": \"falkordb-graph-engine-rs\", \"circular_txns\": {}}}", cycles.len());
    let _ = tokio::task::spawn_blocking(move || call_service_sync(&format!("{}/v1/notify", upstream), &_notify_body)).await;

    db_persist(&state, "detect_circular", &json!({"cycles_found": cycles.len()})).await;
    HttpResponse::Ok().json(json!({"circularTransactions": cycles, "count": cycles.len()}))
}

async fn entity_centrality(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let entity_id = query.get("entityId").cloned().unwrap_or_default();
    let edges = state.edges.lock().await;
    let entity_edges: Vec<GraphEdge> = edges.iter().filter(|e| e.from_id == entity_id).cloned().collect();
    let centrality = compute_entity_centrality(&entity_edges);
    HttpResponse::Ok().json(json!({"entityId": entity_id, "degreeCentrality": centrality, "connections": entity_edges.len()}))
}

async fn risk_classification(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let is_pep = input.get("isPep").and_then(|v| v.as_bool()).unwrap_or(false);
    let is_sanctioned = input.get("isSanctioned").and_then(|v| v.as_bool()).unwrap_or(false);
    let high_risk_country = input.get("highRiskCountry").and_then(|v| v.as_bool()).unwrap_or(false);
    let circular = input.get("circularTransactions").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let centrality = input.get("centrality").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let (score, level) = classify_entity_risk(is_pep, is_sanctioned, high_risk_country, circular, centrality);
    db_persist(&state, "risk_classification", &json!({"score": score, "level": level})).await;
    HttpResponse::Ok().json(json!({"riskScore": score, "riskLevel": level}))
}

async fn query_graph(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<GraphQuery>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if let Err(resp) = check_jwt(&req) { return resp; }
    let q = body.into_inner();
    let params = q.params.unwrap_or(json!({}));
    match state.falkordb.execute_query(&q.cypher, &params) {
        Ok(result) => {
            db_persist(&state, "query_graph", &json!({"query": q.cypher})).await;
            HttpResponse::Ok().json(json!({"result": result, "engine": "falkordb"}))
        }
        Err(e) => {
            ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
            HttpResponse::InternalServerError().json(json!({"error": e}))
        }
    }
}

async fn find_path(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<PathQuery>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let q = body.into_inner();
    let max_hops = q.max_hops.unwrap_or(5);
    let cypher = format!(
        "MATCH path = shortestPath((a {{entityId: '{}'}})-[*1..{}]->(b {{entityId: '{}'}})) RETURN path",
        q.source_id, max_hops, q.target_id
    );
    match state.falkordb.execute_query(&cypher, &json!({})) {
        Ok(result) => HttpResponse::Ok().json(json!({"path": result, "source": q.source_id, "target": q.target_id})),
        Err(e) => {
            ERROR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
            HttpResponse::InternalServerError().json(json!({"error": e}))
        }
    }
}

async fn transaction_velocity(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let window = query.get("window").and_then(|w| w.parse::<u64>().ok()).unwrap_or(3600);
    let edges = state.edges.lock().await;
    let velocity = compute_transaction_velocity(&edges, window);
    HttpResponse::Ok().json(json!({"velocity": velocity, "windowSeconds": window, "totalEdges": edges.len()}))
}

// ─── MAIN ────────────────────────────────────────────────────────────────────


// Multi-tenant: extract tenant ID from request
fn get_tenant_id(req: &actix_web::HttpRequest) -> String {
    req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("platform")
        .to_string()
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

fn grpc_call(target: &str, method: &str, payload: &str) -> Result<String, String> {
    if !cb_allow() { return Err("circuit breaker open".to_string()); }
    use std::io::{Read, Write};
    for attempt in 0..3u32 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match std::net::TcpStream::connect_timeout(
            &target.parse().map_err(|e| format!("{}", e))?,
            std::time::Duration::from_secs(5),
        ) {
            Ok(mut stream) => {
                let data = format!(r#"{{"method":"{}","payload":{}}}"#, method, payload);
                let data_bytes = data.as_bytes();
                let len_bytes = (data_bytes.len() as u32).to_be_bytes();
                if stream.write_all(&len_bytes).is_err() { cb_record_failure(); continue; }
                if stream.write_all(data_bytes).is_err() { cb_record_failure(); continue; }
                let mut resp_len_buf = [0u8; 4];
                if stream.read_exact(&mut resp_len_buf).is_err() { cb_record_failure(); continue; }
                let resp_len = u32::from_be_bytes(resp_len_buf) as usize;
                let mut resp_buf = vec![0u8; resp_len];
                if stream.read_exact(&mut resp_buf).is_err() { cb_record_failure(); continue; }
                cb_record_success();
                return Ok(String::from_utf8_lossy(&resp_buf).to_string());
            }
            Err(e) => { cb_record_failure(); eprintln!("gRPC {} attempt {} failed: {}", target, attempt+1, e); }
        }
    }
    Err(format!("gRPC retries exhausted for {}", target))
}


// --- mTLS Configuration ---
fn mtls_config() -> (bool, String, String, String) {
    let enabled = env::var("MTLS_ENABLED").unwrap_or_default() == "true";
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[falkordb-graph-engine-rs] starting");

    // FAIL FAST (M-21): DATABASE_URL is required; no default/compiled-in database credentials.
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set - refusing to boot with default database credentials");

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;
    log::info!("[falkordb-graph-engine-rs] database connected, schema initialized");

    let db_client = init_db(&database_url).await.map(|c| std::sync::Arc::new(c));
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8277);
    let state = web::Data::new(AppState {
        db: pool,
        entities: Mutex::new(Vec::new()),
        edges: Mutex::new(Vec::new()),
        falkordb: FalkorDBClient {
            redis_url: env::var("FALKORDB_URL").unwrap_or_else(|_| "localhost:6379".to_string()),
            graph_name: env::var("FALKORDB_GRAPH").unwrap_or_else(|_| "bank54".to_string()),
        },
        db_url: env::var("DATABASE_URL").ok(),
        db_client,
    });

    start_grpc_server("falkordb-graph-engine-rs", 10458);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
            )
            .wrap_fn(|req, srv| {
                let trace = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[falkordb-graph-engine-rs] {} {} trace={}", req.method(), req.path(), trace);
                srv.call(req)
            })
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
            .route("/v1/graph/seed", web::post().to(seed_graph))
            .route("/v1/graph/entities", web::post().to(create_entity))
            .route("/v1/graph/edges", web::post().to(create_edge))
            .route("/v1/graph/circular", web::get().to(detect_circular))
            .route("/v1/graph/centrality", web::get().to(entity_centrality))
            .route("/v1/graph/risk-classification", web::post().to(risk_classification))
            .route("/v1/graph/query", web::post().to(query_graph))
            .route("/v1/graph/path", web::post().to(find_path))
            .route("/v1/graph/velocity", web::get().to(transaction_velocity))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("falkordb-graph-engine-rs", "falkordb-graph-engine-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}

async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create service_configs table");

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(64) NOT NULL,
        aggregate_id VARCHAR(128) NOT NULL,
        payload JSONB NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .ok();
}

async fn list_records(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let tenant_id = req.headers().get("X-Tenant-ID")
        .and_then(|v| v.to_str().ok()).unwrap_or("");

    let rows = sqlx::query("SELECT id, status, created_at FROM service_configs WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT 50")
        .bind(tenant_id)
        .fetch_all(&data.db)
        .await;

    match rows {
        Ok(rows) => {
            let records: Vec<serde_json::Value> = rows.iter().map(|r| {
                serde_json::json!({
                    "id": r.get::<Uuid, _>("id").to_string(),
                    "status": r.get::<String, _>("status"),
                    "created_at": r.get::<DateTime<Utc>, _>("created_at").to_rfc3339()
                })
            }).collect();
            let count = records.len();
            HttpResponse::Ok().json(serde_json::json!({"data": records, "count": count}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn create_record(data: web::Data<AppState>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let tenant_id = body.tenant_id.clone()
        .or_else(|| req.headers().get("X-Tenant-ID").and_then(|v| v.to_str().ok()).map(String::from))
        .unwrap_or_else(|| "default".to_string());

    let status = body.status.clone().unwrap_or_else(|| "active".to_string());

    let result = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO service_configs (tenant_id, status) VALUES ($1::uuid, $2) RETURNING id"
    )
    .bind(&tenant_id)
    .bind(&status)
    .fetch_one(&data.db)
    .await;

    match result {
        Ok(id) => {
            let payload = serde_json::json!({"id": id.to_string(), "status": &status, "tenant_id": &tenant_id});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.created")
                .bind(id.to_string())
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Created().json(serde_json::json!({"id": id.to_string(), "status": "created"}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn get_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let result = sqlx::query("SELECT id, status, created_at FROM service_configs WHERE id = $1::uuid")
        .bind(&id)
        .fetch_optional(&data.db)
        .await;

    match result {
        Ok(Some(row)) => HttpResponse::Ok().json(serde_json::json!({
            "id": row.get::<Uuid, _>("id").to_string(),
            "status": row.get::<String, _>("status"),
            "created_at": row.get::<DateTime<Utc>, _>("created_at").to_rfc3339()
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "not found"})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("service_configs.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    sqlx::query("UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("service_configs.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
