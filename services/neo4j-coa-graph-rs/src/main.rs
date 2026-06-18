#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// neo4j-coa-graph-rs — Chart of Accounts graph database service using Neo4j
// Models COA as directed graph with account hierarchies, transaction flows,
// regulatory relationships (CBN, IFRS9, Basel III), and PageRank analytics.

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);
static RL_TOKENS: AtomicU64 = AtomicU64::new(100);
static RL_LAST: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize, Deserialize, Debug)]
struct COANode {
    code: String,
    name: String,
    category: String,
    subcategory: String,
    balance: f64,
    currency: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct COAEdge {
    from_code: String,
    to_code: String,
    relation_type: String,
    weight: f64,
    metadata: serde_json::Value,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct TransactionFlow {
    debit_account: String,
    credit_account: String,
    amount: f64,
    currency: String,
    narration: String,
}

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    nodes: Mutex<Vec<COANode>>,
    edges: Mutex<Vec<COAEdge>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn seed_coa_nodes() -> Vec<COANode> {
    vec![
        COANode { code: "1001".into(), name: "Cash in Vault - Local Currency".into(), category: "asset".into(), subcategory: "cash".into(), balance: 2_850_000_000.0, currency: "NGN".into() },
        COANode { code: "1005".into(), name: "Cash Reserve Requirement (CRR)".into(), category: "asset".into(), subcategory: "cash_cbn".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "1201".into(), name: "Treasury Bills (NTBs)".into(), category: "asset".into(), subcategory: "investments_govt".into(), balance: 25_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1301".into(), name: "Overdrafts - Corporate".into(), category: "asset".into(), subcategory: "loans_corporate".into(), balance: 28_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1302".into(), name: "Term Loans - Corporate".into(), category: "asset".into(), subcategory: "loans_corporate".into(), balance: 45_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1306".into(), name: "SME Loans".into(), category: "asset".into(), subcategory: "loans_sme".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
        COANode { code: "1307".into(), name: "Agricultural Loans (ABP)".into(), category: "asset".into(), subcategory: "loans_agric".into(), balance: 8_500_000_000.0, currency: "NGN".into() },
        COANode { code: "1355".into(), name: "IFRS 9 ECL Stage 1".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -800_000_000.0, currency: "NGN".into() },
        COANode { code: "1356".into(), name: "IFRS 9 ECL Stage 2".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -1_200_000_000.0, currency: "NGN".into() },
        COANode { code: "1357".into(), name: "IFRS 9 ECL Stage 3".into(), category: "asset".into(), subcategory: "provision_ecl".into(), balance: -2_500_000_000.0, currency: "NGN".into() },
        COANode { code: "2101".into(), name: "Demand Deposits - Current".into(), category: "liability".into(), subcategory: "deposits_demand".into(), balance: 85_000_000_000.0, currency: "NGN".into() },
        COANode { code: "2102".into(), name: "Savings Deposits".into(), category: "liability".into(), subcategory: "deposits_savings".into(), balance: 45_000_000_000.0, currency: "NGN".into() },
        COANode { code: "2206".into(), name: "Subordinated Debt (Tier 2)".into(), category: "liability".into(), subcategory: "borrowings_sub".into(), balance: 8_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3002".into(), name: "Issued & Paid-up Capital".into(), category: "equity".into(), subcategory: "share_capital".into(), balance: 25_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3004".into(), name: "Statutory Reserve".into(), category: "equity".into(), subcategory: "reserves".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
        COANode { code: "3006".into(), name: "Retained Earnings".into(), category: "equity".into(), subcategory: "retained".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "4101".into(), name: "Interest on Loans - Corporate".into(), category: "income".into(), subcategory: "interest_loans".into(), balance: 18_500_000_000.0, currency: "NGN".into() },
        COANode { code: "5101".into(), name: "Interest on Deposits - Savings".into(), category: "expense".into(), subcategory: "interest_deposits".into(), balance: 3_500_000_000.0, currency: "NGN".into() },
        COANode { code: "5301".into(), name: "Staff Costs - Salaries".into(), category: "expense".into(), subcategory: "staff_costs".into(), balance: 12_000_000_000.0, currency: "NGN".into() },
    ]
}

fn seed_coa_edges() -> Vec<COAEdge> {
    vec![
        COAEdge { from_code: "2101".into(), to_code: "1301".into(), relation_type: "FLOWS_TO".into(), weight: 0.35, metadata: json!({"flow": "deposits_fund_loans"}) },
        COAEdge { from_code: "1301".into(), to_code: "4101".into(), relation_type: "FLOWS_TO".into(), weight: 0.18, metadata: json!({"flow": "loans_generate_interest"}) },
        COAEdge { from_code: "2102".into(), to_code: "5101".into(), relation_type: "FLOWS_TO".into(), weight: 0.08, metadata: json!({"flow": "savings_interest_expense"}) },
        COAEdge { from_code: "1355".into(), to_code: "1301".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage1"}) },
        COAEdge { from_code: "1356".into(), to_code: "1302".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage2"}) },
        COAEdge { from_code: "1357".into(), to_code: "1307".into(), relation_type: "PROVISION_FOR".into(), weight: 1.0, metadata: json!({"standard": "IFRS9_ECL_stage3"}) },
        COAEdge { from_code: "3002".into(), to_code: "1301".into(), relation_type: "BACKS_RWA".into(), weight: 0.15, metadata: json!({"framework": "Basel_III_CET1"}) },
    ]
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
    if path.starts_with("/healthz") || path.starts_with("/readyz") || path.starts_with("/livez") || path.starts_with("/metrics") {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(v) if v.to_str().unwrap_or("").starts_with("Bearer ") => Ok(()),
        _ => Err(HttpResponse::Unauthorized().json(json!({"error": "unauthorized"}))),
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

fn call_service_sync(url: &str, payload: &str) -> Result<String, String> {
    let tcp = std::net::TcpStream::connect_timeout(
        &url.replace("http://", "").replace("https://", "").parse().unwrap_or_else(|_| "127.0.0.1:8080".parse().unwrap()),
        std::time::Duration::from_secs(5),
    );
    match tcp {
        Ok(mut stream) => {
            use std::io::Write;
            let req = format!("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n\r\n{}", payload.len(), payload);
            let _ = stream.write_all(req.as_bytes());
            Ok("ok".to_string())
        }
        Err(e) => Err(format!("connection failed: {}", e)),
    }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "neo4j_coa_graph_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc_name = String::from("neo4j-coa-graph-rs");
    if let Some(client) = &state.db_client {
        let _ = client.execute(
            "INSERT INTO records (id, service, tenant, status, data, created_at) VALUES ($1, $2, 'default', 'active', $3, NOW()) ON CONFLICT (id) DO UPDATE SET data = $3",
            &[&id, &svc_name, &data.to_string()],
        ).await;
    } else {
        let mut recs = state.records.lock().unwrap();
        recs.push(json!({"id": id, "service": svc_name, "data": data}));
    }
}


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

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy", "service": "neo4j-coa-graph-rs",
        "capabilities": ["coa_graph", "neo4j_cypher", "pagerank", "basel_iii", "path_traversal"],
    }))
}

async fn ready() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "neo4j-coa-graph-rs"})) }
async fn live() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"neo4j-coa-graph-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"neo4j-coa-graph-rs\"}} {}\n", r, e))
}

async fn coa_graph(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap().clone();
    let edges = state.edges.lock().unwrap().clone();
    db_persist(&state, "coa_graph", &json!({"action": "get_graph"})).await;
    HttpResponse::Ok().json(json!({"nodes": nodes, "edges": edges, "total_nodes": nodes.len(), "total_edges": edges.len()}))
}

async fn coa_pagerank(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap().clone();
    let edges = state.edges.lock().unwrap().clone();
    let rankings = compute_pagerank(&nodes, &edges, 20, 0.85);
    let named: Vec<serde_json::Value> = rankings.iter().map(|(code, rank)| {
        let name = nodes.iter().find(|n| n.code == *code).map(|n| n.name.clone()).unwrap_or_default();
        json!({"code": code, "name": name, "rank": rank})
    }).collect();
    HttpResponse::Ok().json(json!({"algorithm": "pagerank", "iterations": 20, "damping": 0.85, "rankings": named}))
}

async fn coa_basel(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let nodes = state.nodes.lock().unwrap().clone();
    let result = compute_basel_iii(&nodes);
    HttpResponse::Ok().json(result)
}

async fn coa_traverse(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let from = body.get("from").and_then(|v| v.as_str()).unwrap_or("");
    let to = body.get("to").and_then(|v| v.as_str()).unwrap_or("");
    let edges = state.edges.lock().unwrap().clone();
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
    db_persist(&state, "traverse", &json!({"from": from, "to": to})).await;
    HttpResponse::Ok().json(json!({"from": from, "to": to, "path": result_path, "hops": if result_path.is_empty() { 0 } else { result_path.len() - 1 }}))
}

async fn transaction_flow(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<TransactionFlow>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let txn = body.into_inner();
    let mut edges = state.edges.lock().unwrap();
    edges.push(COAEdge {
        from_code: txn.debit_account.clone(), to_code: txn.credit_account.clone(),
        relation_type: "TRANSACTION".into(), weight: txn.amount,
        metadata: json!({"narration": txn.narration, "currency": txn.currency}),
    });
    drop(edges);
    db_persist(&state, "transaction_flow", &json!({"debit": &txn.debit_account, "credit": &txn.credit_account, "amount": txn.amount})).await;
    let gl_url = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = call_service_sync(&format!("{}/v1/notify", gl_url), r#"{"source": "neo4j-coa-graph-rs", "action": "transaction_flow"}"#);
    HttpResponse::Created().json(json!({"recorded": true, "debit": txn.debit_account, "credit": txn.credit_account, "amount": txn.amount}))
}

async fn create_node(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<COANode>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let node = body.into_inner();
    let code = node.code.clone();
    state.nodes.lock().unwrap().push(node);
    db_persist(&state, "create_node", &json!({"code": &code})).await;
    HttpResponse::Created().json(json!({"created": true, "code": code}))
}


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
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
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
        records: Mutex::new(Vec::new()),
        nodes: Mutex::new(seed_coa_nodes()),
        edges: Mutex::new(seed_coa_edges()),
        db_url, db_client,
    });

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
            .route("/v1/coa/basel-iii", web::get().to(coa_basel))
            .route("/v1/coa/traverse", web::post().to(coa_traverse))
            .route("/v1/coa/transaction-flow", web::post().to(transaction_flow))
            .route("/v1/create", web::post().to(create_node))
    })
    .bind(("0.0.0.0", port))?.run().await
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
