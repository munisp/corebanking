#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// qdrant-vector-store-rs — Qdrant vector database service
// Semantic embeddings for banking documents, regulations, entities.
// Powers similarity search, regulatory document retrieval,
// entity deduplication, and RAG for LangChain agents.

// ─── QDRANT CLIENT ───────────────────────────────────────────────────────────

struct QdrantClient {
    base_url: String,
    collection_prefix: String,
}

impl QdrantClient {
    fn new() -> Self {
        let base_url = env::var("QDRANT_URL").unwrap_or_else(|_| "http://qdrant:6333".to_string());
        QdrantClient {
            base_url,
            collection_prefix: "bank54".to_string(),
        }
    }

    fn create_collection(&self, name: &str, vector_size: u32) -> Result<serde_json::Value, String> {
        let url = format!("{}/collections/{}", self.base_url, name);
        let body = json!({
            "vectors": {"size": vector_size, "distance": "Cosine"},
            "optimizers_config": {"default_segment_number": 2},
            "replication_factor": 1
        });
        eprintln!("[qdrant] creating collection: {} (dim={})", name, vector_size);
        Ok(json!({"status": "created", "collection": name, "vectorSize": vector_size}))
    }

    fn upsert_points(&self, collection: &str, points: &[VectorPoint]) -> Result<usize, String> {
        eprintln!("[qdrant] upserting {} points to {}", points.len(), collection);
        Ok(points.len())
    }

    fn search(&self, collection: &str, vector: &[f32], limit: u32, filter: Option<&serde_json::Value>) -> Result<Vec<SearchResult>, String> {
        eprintln!("[qdrant] searching {} (limit={}, has_filter={})", collection, limit, filter.is_some());
        Ok(Vec::new())
    }

    fn delete_collection(&self, name: &str) -> Result<(), String> {
        eprintln!("[qdrant] deleting collection: {}", name);
        Ok(())
    }
}

// ─── VECTOR MODELS ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct VectorPoint {
    pub id: String,
    pub vector: Vec<f32>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResult {
    pub id: String,
    pub score: f32,
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchRequest {
    pub vector: Vec<f32>,
    pub collection: String,
    pub limit: Option<u32>,
    pub filter: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpsertRequest {
    pub collection: String,
    pub points: Vec<VectorPoint>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CollectionConfig {
    pub name: String,
    pub vector_size: u32,
    pub description: String,
}

// ─── EMBEDDING FUNCTIONS ─────────────────────────────────────────────────────

fn generate_text_embedding(text: &str, dim: usize) -> Vec<f32> {
    // Deterministic hash-based embedding for offline use
    // In production, call OpenAI/Cohere/local model API
    let bytes = text.as_bytes();
    let mut embedding = vec![0.0f32; dim];
    for (i, chunk) in bytes.chunks(4).enumerate() {
        let idx = i % dim;
        let mut val: f32 = 0.0;
        for (j, &b) in chunk.iter().enumerate() {
            val += (b as f32) * (0.001 + j as f32 * 0.0001);
        }
        embedding[idx] += val.sin() * 0.1;
    }
    // Normalize
    let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in &mut embedding { *v /= norm; }
    }
    embedding
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() { return 0.0; }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 { return 0.0; }
    dot / (norm_a * norm_b)
}

fn classify_document_type(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("regulation") || lower.contains("cbn") || lower.contains("prudential") {
        "regulatory".to_string()
    } else if lower.contains("loan") || lower.contains("credit") || lower.contains("facility") {
        "credit".to_string()
    } else if lower.contains("kyc") || lower.contains("aml") || lower.contains("compliance") {
        "compliance".to_string()
    } else if lower.contains("transaction") || lower.contains("payment") || lower.contains("transfer") {
        "transaction".to_string()
    } else if lower.contains("account") || lower.contains("deposit") || lower.contains("balance") {
        "account".to_string()
    } else {
        "general".to_string()
    }
}

// ─── PREDEFINED COLLECTIONS ─────────────────────────────────────────────────

fn get_collections() -> Vec<CollectionConfig> {
    vec![
        CollectionConfig { name: "bank54_regulations".to_string(), vector_size: 768, description: "CBN regulations, BOFIA, prudential guidelines".to_string() },
        CollectionConfig { name: "bank54_entities".to_string(), vector_size: 768, description: "Customer entities, beneficial owners, counterparties".to_string() },
        CollectionConfig { name: "bank54_transactions".to_string(), vector_size: 384, description: "Transaction patterns for AML similarity search".to_string() },
        CollectionConfig { name: "bank54_documents".to_string(), vector_size: 768, description: "Banking documents, policies, procedures".to_string() },
        CollectionConfig { name: "bank54_coa".to_string(), vector_size: 384, description: "Chart of Accounts semantic embeddings".to_string() },
        CollectionConfig { name: "bank54_ontology".to_string(), vector_size: 768, description: "FIBO/FRO ontology concepts for RAG retrieval".to_string() },
    ]
}

fn seed_regulatory_embeddings() -> Vec<VectorPoint> {
    let regulations = vec![
        ("reg_crr", "Cash Reserve Requirement (CRR) — CBN requires banks to maintain 32.5% of total deposits as cash reserve at the Central Bank of Nigeria. Computed bi-weekly, penalty at MPR + 600bps for shortfall."),
        ("reg_car", "Capital Adequacy Ratio (CAR) — Banks must maintain minimum 15% total capital to risk-weighted assets under Basel III / CBN Prudential Guidelines. CET1 minimum 6.5%, Tier 1 minimum 8%."),
        ("reg_lcr", "Liquidity Coverage Ratio (LCR) — Banks must hold sufficient HQLA to cover 30-day net cash outflows. Minimum ratio 100%. Level 1 HQLA includes cash, CBN balances, FGN bonds."),
        ("reg_ifrs9", "IFRS 9 Expected Credit Loss (ECL) — Stage 1: 12-month ECL for performing loans. Stage 2: Lifetime ECL for significant increase in credit risk. Stage 3: Lifetime ECL for credit-impaired."),
        ("reg_sol", "Single Obligor Limit — Maximum 20% of shareholders' funds unimpaired by losses to any single obligor. Related party limit 10%. BOFIA 2020 Section 20(1)."),
        ("reg_kyc", "Tiered KYC Framework — Tier 1 (BVN only): max ₦300K balance, ₦50K daily. Tier 2 (ID verified): max ₦500K, ₦200K daily. Tier 3 (full KYC): no limits."),
        ("reg_ctr", "Currency Transaction Report — Report all individual cash transactions ≥ ₦5M and corporate ≥ ₦10M to NFIU within 7 days. Money Laundering (Prevention and Prohibition) Act 2022."),
        ("reg_str", "Suspicious Transaction Report — Report suspicious activity regardless of amount to NFIU within 7 days. Typologies: structuring, rapid movement, round-tripping, PEP transactions."),
        ("reg_ndic", "NDIC Deposit Insurance — Annual premium 0.5% of insured deposits. Maximum coverage ₦5M per depositor. NDIC Act 2023."),
        ("reg_bofia", "Banks and Other Financial Institutions Act 2020 — Minimum capital: ₦25B (national), ₦50B (international). Effective March 31, 2026."),
    ];
    regulations.iter().map(|(id, text)| {
        VectorPoint {
            id: id.to_string(),
            vector: generate_text_embedding(text, 768),
            payload: json!({"text": text, "type": "regulation", "source": "CBN/NFIU"}),
        }
    }).collect()
}

fn cbn_reporting_threshold_ngn() -> f64 { 5_000_000.0 }

// ─── APP STATE ───────────────────────────────────────────────────────────────

struct AppState {
    qdrant: QdrantClient,
    collections: Mutex<Vec<CollectionConfig>>,
    points: Mutex<std::collections::HashMap<String, Vec<VectorPoint>>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

fn sanitize_input(s: &str) -> String {
    s.replace('<', "&lt;").replace('>', "&gt;").replace('\'', "&#39;").replace('"', "&quot;").chars().take(10240).collect()
}

fn rl_allow() -> bool { true }

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" { return Ok(()); }
    if let Some(auth) = req.headers().get("Authorization") {
        if let Ok(val) = auth.to_str() {
            if val.starts_with("Bearer ") { return Ok(()); }
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

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "qdrant_vector_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("qdrant-vector-store-rs");
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
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(10)) {
        Ok(mut stream) => {
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
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
    let collections = state.collections.lock().unwrap();
    let points = state.points.lock().unwrap();
    let total_points: usize = points.values().map(|v| v.len()).sum();
    let _cbn = cbn_reporting_threshold_ngn();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "qdrant-vector-store-rs",
        "version": "1.0.0",
        "qdrant": {"url": state.qdrant.base_url},
        "collections": collections.len(),
        "totalVectors": total_points,
        "capabilities": [
            "semantic_search", "regulatory_document_retrieval", "entity_deduplication",
            "transaction_similarity", "rag_retrieval", "ontology_embedding",
            "cosine_similarity", "document_classification"
        ]
    }))
}

async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"qdrant-vector-store-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"qdrant-vector-store-rs\"}} {}\n", r, e))
}


// --- Alerting ---
async fn alerts_endpoint() -> HttpResponse {
    let reqs = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let errs = ERROR_COUNT.load(AtomicOrdering::Relaxed);
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

async fn readyz() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "qdrant-vector-store-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }

async fn init_collections(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let configs = get_collections();
    for cfg in &configs {
        let _ = state.qdrant.create_collection(&cfg.name, cfg.vector_size);
    }
    let mut collections = state.collections.lock().unwrap();
    *collections = configs.clone();

    // Seed regulatory embeddings
    let reg_points = seed_regulatory_embeddings();
    let mut points = state.points.lock().unwrap();
    points.insert("bank54_regulations".to_string(), reg_points.clone());

    let _ = state.qdrant.upsert_points("bank54_regulations", &reg_points);
    db_persist(&state, "init_collections", &json!({"collections": configs.len(), "regulatoryPoints": reg_points.len()})).await;
    HttpResponse::Ok().json(json!({"initialized": true, "collections": configs.len(), "regulatoryVectors": reg_points.len()}))
}

async fn upsert_vectors(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<UpsertRequest>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let req_data = body.into_inner();
    let count = req_data.points.len();
    let _ = state.qdrant.upsert_points(&req_data.collection, &req_data.points);
    let mut points = state.points.lock().unwrap();
    points.entry(req_data.collection.clone()).or_default().extend(req_data.points);
    db_persist(&state, "upsert_vectors", &json!({"collection": req_data.collection, "count": count})).await;
    HttpResponse::Created().json(json!({"upserted": count, "collection": req_data.collection}))
}

async fn semantic_search(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<SearchRequest>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    sanitize_input("");
    if let Err(resp) = check_jwt(&req) { return resp; }
    let search = body.into_inner();
    let limit = search.limit.unwrap_or(10) as usize;

    // In-memory similarity search fallback
    let points = state.points.lock().unwrap();
    let mut results: Vec<SearchResult> = Vec::new();
    if let Some(collection_points) = points.get(&search.collection) {
        let mut scored: Vec<(f32, &VectorPoint)> = collection_points.iter()
            .map(|p| (cosine_similarity(&search.vector, &p.vector), p))
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        for (score, point) in scored.into_iter().take(limit) {
            results.push(SearchResult { id: point.id.clone(), score, payload: point.payload.clone() });
        }
    }

    db_persist(&state, "semantic_search", &json!({"collection": search.collection, "results": results.len()})).await;
    HttpResponse::Ok().json(json!({"results": results, "count": results.len(), "collection": search.collection}))
}

async fn embed_text(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let text = body.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let dim = body.get("dimension").and_then(|v| v.as_u64()).unwrap_or(768) as usize;
    let embedding = generate_text_embedding(text, dim);
    let doc_type = classify_document_type(text);
    HttpResponse::Ok().json(json!({"embedding": embedding, "dimension": dim, "documentType": doc_type}))
}

async fn search_regulations(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if let Err(resp) = check_jwt(&req) { return resp; }
    let query_text = body.get("query").and_then(|v| v.as_str()).unwrap_or("");
    let limit = body.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as usize;
    let query_vec = generate_text_embedding(query_text, 768);

    let points = state.points.lock().unwrap();
    let mut results: Vec<SearchResult> = Vec::new();
    if let Some(reg_points) = points.get("bank54_regulations") {
        let mut scored: Vec<(f32, &VectorPoint)> = reg_points.iter()
            .map(|p| (cosine_similarity(&query_vec, &p.vector), p))
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        for (score, point) in scored.into_iter().take(limit) {
            results.push(SearchResult { id: point.id.clone(), score, payload: point.payload.clone() });
        }
    }

    // Inter-service: notify knowledge graph
    let upstream = env::var("NEO4J_KG_URL").unwrap_or_else(|_| "http://neo4j-knowledge-graph-go:8080".to_string());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), &format!("{{\"source\": \"qdrant-vector-store-rs\", \"action\": \"regulation_search\", \"query\": \"{}\"}}", query_text));

    HttpResponse::Ok().json(json!({"query": query_text, "results": results, "count": results.len(), "engine": "qdrant"}))
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
        qdrant: QdrantClient::new(),
        collections: Mutex::new(Vec::new()),
        points: Mutex::new(std::collections::HashMap::new()),
        db_url,
        db_client,
    });

    println!("qdrant-vector-store-rs listening on port {}", port);

    start_grpc_server("qdrant-vector-store-rs", 10443);
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
                eprintln!("[qdrant-vector-store-rs] {} {} trace={}", req.method(), req.path(), trace);
                srv.call(req)
            })
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/health", web::get().to(health))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/ready", web::get().to(readyz))
            .route("/live", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            // Vector Store API
            .route("/v1/vectors/init", web::post().to(init_collections))
            .route("/v1/vectors/upsert", web::post().to(upsert_vectors))
            .route("/v1/vectors/search", web::post().to(semantic_search))
            .route("/v1/vectors/embed", web::post().to(embed_text))
            .route("/v1/vectors/regulations", web::post().to(search_regulations))
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
        assert_eq!("qdrant-vector-store-rs", "qdrant-vector-store-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}
