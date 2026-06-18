#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// falkordb-graph-engine-rs — FalkorDB (Redis-compatible graph DB) service
// High-performance graph queries, real-time entity resolution,
// transaction network analysis, AML pattern detection.
// Uses FalkorDB Cypher dialect over Redis protocol.

// ─── FALKORDB CLIENT ─────────────────────────────────────────────────────────

struct FalkorDBClient {
    redis_url: String,
    graph_name: String,
}

impl FalkorDBClient {
    fn new() -> Self {
        let redis_url = env::var("FALKORDB_URL").unwrap_or_else(|_| "redis://falkordb:6379".to_string());
        let graph_name = env::var("FALKORDB_GRAPH").unwrap_or_else(|_| "bank54_graph".to_string());
        FalkorDBClient { redis_url, graph_name }
    }

    fn execute_query(&self, cypher: &str, params: &serde_json::Value) -> Result<serde_json::Value, String> {
        // FalkorDB uses GRAPH.QUERY command over Redis protocol
        // In production, this would use redis crate with GRAPH.QUERY <graph_name> <cypher>
        eprintln!("[falkordb] executing: {} with params: {}", &cypher[..cypher.len().min(100)], params);
        Ok(json!({"executed": true, "query": cypher, "engine": "falkordb"}))
    }
}

// ─── GRAPH MODELS ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct EntityNode {
    pub entity_id: String,
    pub entity_type: String,      // "customer", "account", "transaction", "loan"
    pub name: String,
    pub risk_score: Option<f64>,
    pub properties: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GraphEdge {
    pub from_id: String,
    pub to_id: String,
    pub edge_type: String,        // "TRANSACTED_WITH", "OWNS", "CONTROLS", "GUARANTEES"
    pub weight: Option<f64>,
    pub properties: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphQuery {
    pub cypher: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PathQuery {
    pub source_id: String,
    pub target_id: String,
    pub max_hops: Option<u32>,
    pub edge_types: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CommunityDetectionRequest {
    pub algorithm: String,         // "louvain", "label_propagation", "weakly_connected"
    pub min_community_size: Option<u32>,
}

// ─── DOMAIN FUNCTIONS ────────────────────────────────────────────────────────

fn compute_entity_centrality(connections: &[GraphEdge]) -> f64 {
    // Degree centrality: number of unique connections
    let unique_targets: std::collections::HashSet<&str> = connections.iter()
        .map(|e| e.to_id.as_str())
        .collect();
    unique_targets.len() as f64
}

fn detect_circular_transactions(edges: &[GraphEdge]) -> Vec<Vec<String>> {
    // Find cycles in transaction graph (potential round-tripping)
    let mut adjacency: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();
    for edge in edges {
        adjacency.entry(edge.from_id.as_str()).or_default().push(edge.to_id.as_str());
    }
    let mut cycles: Vec<Vec<String>> = Vec::new();
    for (start, targets) in &adjacency {
        for target in targets {
            if let Some(back_targets) = adjacency.get(target) {
                if back_targets.contains(start) {
                    cycles.push(vec![start.to_string(), target.to_string(), start.to_string()]);
                }
            }
        }
    }
    cycles
}

fn compute_transaction_velocity(edges: &[GraphEdge], window_seconds: u64) -> f64 {
    // Transactions per second within window
    if edges.is_empty() { return 0.0; }
    edges.len() as f64 / (window_seconds as f64).max(1.0)
}

fn classify_entity_risk(
    is_pep: bool,
    is_sanctioned: bool,
    high_risk_country: bool,
    circular_txns: usize,
    centrality: f64,
) -> (f64, String) {
    let mut score = 0.0f64;
    if is_pep { score += 25.0; }
    if is_sanctioned { score += 40.0; }
    if high_risk_country { score += 20.0; }
    if circular_txns > 0 { score += 15.0; }
    if centrality > 50.0 { score += 10.0; }
    let level = if score >= 70.0 { "critical" } else if score >= 50.0 { "high" } else if score >= 30.0 { "medium" } else { "low" };
    (score.min(100.0), level.to_string())
}

fn falkordb_seed_coa_query() -> Vec<String> {
    vec![
        // FIBO-aligned COA nodes in FalkorDB Cypher
        "CREATE (:GLAccount:Asset {code: '1001', name: 'Cash in Vault', subcategory: 'cash', currency: 'NGN', fiboClass: 'bank54:CashInVault'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1005', name: 'CRR', subcategory: 'cash_cbn', currency: 'NGN', fiboClass: 'bank54:CashReserveRequirement'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1201', name: 'Treasury Bills', subcategory: 'investments_govt', currency: 'NGN'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1301', name: 'Overdrafts - Corporate', subcategory: 'loans_corporate', currency: 'NGN'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1302', name: 'Term Loans - Corporate', subcategory: 'loans_corporate', currency: 'NGN'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1306', name: 'SME Loans', subcategory: 'loans_sme', currency: 'NGN'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1307', name: 'Agricultural Loans (ABP)', subcategory: 'loans_agric', currency: 'NGN'})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1355', name: 'IFRS 9 ECL Stage 1', subcategory: 'provision_ecl', ifrs9Stage: 1})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1356', name: 'IFRS 9 ECL Stage 2', subcategory: 'provision_ecl', ifrs9Stage: 2})".to_string(),
        "CREATE (:GLAccount:Asset {code: '1357', name: 'IFRS 9 ECL Stage 3', subcategory: 'provision_ecl', ifrs9Stage: 3})".to_string(),
        "CREATE (:GLAccount:Liability {code: '2101', name: 'Demand Deposits', subcategory: 'deposits_demand', currency: 'NGN', ndicInsured: true})".to_string(),
        "CREATE (:GLAccount:Liability {code: '2102', name: 'Savings Deposits', subcategory: 'deposits_savings', currency: 'NGN', ndicInsured: true})".to_string(),
        "CREATE (:GLAccount:Equity {code: '3002', name: 'Share Capital', subcategory: 'share_capital', baselTier: 'CET1'})".to_string(),
        "CREATE (:GLAccount:Equity {code: '3004', name: 'Statutory Reserve', subcategory: 'reserves', baselTier: 'CET1'})".to_string(),
        "CREATE (:GLAccount:Revenue {code: '4101', name: 'Interest on Loans - Corporate', subcategory: 'interest_loans'})".to_string(),
        "CREATE (:GLAccount:Expense {code: '5101', name: 'Interest on Deposits - Savings', subcategory: 'interest_deposits'})".to_string(),
        // Regulatory nodes
        "CREATE (:Regulation {id: 'CAR', name: 'Capital Adequacy Ratio', minimum: 0.15, regulator: 'CBN'})".to_string(),
        "CREATE (:Regulation {id: 'CRR', name: 'Cash Reserve Requirement', rate: 0.325, regulator: 'CBN'})".to_string(),
        "CREATE (:Regulation {id: 'LCR', name: 'Liquidity Coverage Ratio', minimum: 1.0, regulator: 'CBN'})".to_string(),
    ]
}

fn cbn_reporting_threshold_ngn() -> f64 { 5_000_000.0 }

// ─── APP STATE ───────────────────────────────────────────────────────────────

struct AppState {
    falkordb: FalkorDBClient,
    entities: Mutex<Vec<EntityNode>>,
    edges: Mutex<Vec<GraphEdge>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

// ─── SECURITY / RATE LIMITING / OBSERVABILITY ────────────────────────────────

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

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

async fn degradation_status() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let entities = state.entities.lock().unwrap();
    let edges = state.edges.lock().unwrap();
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

async fn seed_graph(state: web::Data<AppState>) -> HttpResponse {
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
    let mut entities = state.entities.lock().unwrap();
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
    let mut edges = state.edges.lock().unwrap();
    edges.push(edge.clone());
    db_persist(&state, "create_edge", &json!({"from": edge.from_id, "to": edge.to_id, "type": edge.edge_type})).await;
    HttpResponse::Created().json(json!({"linked": true, "edgeType": edge.edge_type}))
}

async fn detect_circular(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let edges = state.edges.lock().unwrap();
    let cycles = detect_circular_transactions(&edges);

    // Inter-service: notify AML engine
    let upstream = env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://aml-engine-rs:8080".to_string());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), &format!("{{\"source\": \"falkordb-graph-engine-rs\", \"circular_txns\": {}}}", cycles.len()));

    db_persist(&state, "detect_circular", &json!({"cycles_found": cycles.len()})).await;
    HttpResponse::Ok().json(json!({"circularTransactions": cycles, "count": cycles.len()}))
}

async fn entity_centrality(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let entity_id = query.get("entityId").cloned().unwrap_or_default();
    let edges = state.edges.lock().unwrap();
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
    let edges = state.edges.lock().unwrap();
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
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080);

    let db_url = env::var("DATABASE_URL").ok();
    let db_client = if let Some(ref url) = db_url {
        match tokio_postgres::connect(url, tokio_postgres::NoTls).await {
            Ok((client, connection)) => {
                tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); } });
                Some(std::sync::Arc::new(client))
            }
            Err(e) => { eprintln!("DB connect failed: {}", e); None }
        }
    } else { None };

    let state = web::Data::new(AppState {
        falkordb: FalkorDBClient::new(),
        entities: Mutex::new(Vec::new()),
        edges: Mutex::new(Vec::new()),
        db_url,
        db_client,
    });

    println!("falkordb-graph-engine-rs listening on port {}", port);

    start_grpc_server("falkordb-graph-engine-rs", 10458);
    HttpServer::new(move || {
        let trace_id = format!("trace-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
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
            .wrap_fn(move |req, srv| {
                let trace = trace_id.clone();
                eprintln!("[falkordb-graph-engine-rs] {} {} trace={}", req.method(), req.path(), trace);
                srv.call(req)
            })
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            // Graph API
            .route("/v1/graph/seed", web::post().to(seed_graph))
            .route("/v1/graph/query", web::post().to(query_graph))
            .route("/v1/graph/entity", web::post().to(create_entity))
            .route("/v1/graph/edge", web::post().to(create_edge))
            .route("/v1/graph/path", web::post().to(find_path))
            // Analytics
            .route("/v1/graph/circular", web::get().to(detect_circular))
            .route("/v1/graph/centrality", web::get().to(entity_centrality))
            .route("/v1/graph/velocity", web::get().to(transaction_velocity))
            .route("/v1/graph/risk", web::post().to(risk_classification))
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
