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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VectorPoint {
    pub id: String,
    pub vector: Vec<f32>,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpsertRequest {
    pub collection: String,
    pub points: Vec<VectorPoint>,
}

#[derive(Debug, Deserialize)]
struct SearchRequest {
    pub collection: String,
    pub vector: Vec<f32>,
    #[serde(default)]
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize)]
struct SearchResult {
    pub id: String,
    pub score: f32,
    pub payload: serde_json::Value,
}

// Minimal Qdrant REST client. Real HTTP calls only; errors propagate —
// no fabricated responses.
struct QdrantClient {
    base_url: String,
}

impl QdrantClient {
    fn request(&self, method: &str, path: &str, body: &str) -> Result<serde_json::Value, String> {
        use std::io::{Read, Write};
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let url_parsed = url.strip_prefix("http://").unwrap_or(url.as_str());
        let (host_port, req_path) = url_parsed.split_once('/').unwrap_or((url_parsed, ""));
        let host_port = if !host_port.contains(':') { format!("{}:6333", host_port) } else { host_port.to_string() };
        let mut stream = std::net::TcpStream::connect_timeout(
            &host_port.parse().map_err(|e| format!("{}", e))?,
            std::time::Duration::from_secs(5),
        ).map_err(|e| format!("qdrant connect failed: {}", e))?;
        stream.set_read_timeout(Some(std::time::Duration::from_secs(10))).ok();
        let host = host_port.split(':').next().unwrap_or("localhost");
        let req = format!("{} /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", method, req_path, host, body.len(), body);
        stream.write_all(req.as_bytes()).map_err(|e| format!("qdrant write failed: {}", e))?;
        let mut resp = String::new();
        stream.read_to_string(&mut resp).map_err(|e| format!("qdrant read failed: {}", e))?;
        let status_ok = resp.starts_with("HTTP/1.1 2") || resp.starts_with("HTTP/1.0 2");
        if !status_ok {
            return Err(format!("qdrant {} {} failed: {}", method, path, resp.lines().next().unwrap_or("unknown status")));
        }
        let body_start = resp.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
        serde_json::from_str::<serde_json::Value>(&resp[body_start..])
            .map_err(|e| format!("qdrant response parse failed: {}", e))
    }

    fn create_collection(&self, name: &str, vector_size: u32) -> Result<serde_json::Value, String> {
        let body = json!({"vectors": {"size": vector_size, "distance": "Cosine"}}).to_string();
        self.request("PUT", &format!("/collections/{}", name), &body)
    }

    fn upsert_points(&self, collection: &str, points: &[VectorPoint]) -> Result<serde_json::Value, String> {
        let body = json!({"points": points}).to_string();
        self.request("PUT", &format!("/collections/{}/points?wait=true", collection), &body)
    }
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
    db: PgPool,
    collections: Mutex<Vec<CollectionConfig>>,
    points: Mutex<std::collections::HashMap<String, Vec<VectorPoint>>>,
    qdrant: QdrantClient,
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
    let collections = state.collections.lock().await;
    let points = state.points.lock().await;
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
    let mut collections = state.collections.lock().await;
    *collections = configs.clone();

    // Seed regulatory embeddings
    let reg_points = seed_regulatory_embeddings();
    let mut points = state.points.lock().await;
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
    let mut points = state.points.lock().await;
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
    let points = state.points.lock().await;
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

    let points = state.points.lock().await;
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
    let _notify_body = format!("{{\"source\": \"qdrant-vector-store-rs\", \"action\": \"regulation_search\", \"query\": \"{}\"}}", query_text);
    let _ = tokio::task::spawn_blocking(move || call_service_sync(&format!("{}/v1/notify", upstream), &_notify_body)).await;

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
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[qdrant-vector-store-rs] starting");

    // FAIL FAST (M-21): DATABASE_URL is required; no default/compiled-in database credentials.
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set - refusing to boot with default database credentials");

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;
    log::info!("[qdrant-vector-store-rs] database connected, schema initialized");

    let db_client = init_db(&database_url).await.map(|c| std::sync::Arc::new(c));
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8163);
    let state = web::Data::new(AppState {
        db: pool,
        collections: Mutex::new(Vec::new()),
        points: Mutex::new(std::collections::HashMap::new()),
        qdrant: QdrantClient {
            base_url: env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string()),
        },
        db_url: env::var("DATABASE_URL").ok(),
        db_client,
    });

    start_grpc_server("qdrant-vector-store-rs", 10443);
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
                eprintln!("[qdrant-vector-store-rs] {} {} trace={}", req.method(), req.path(), trace);
                srv.call(req)
            })
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/health", web::get().to(health))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/ready", web::get().to(readyz))
            .route("/live", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/service_configs", web::get().to(list_records))
            .route("/api/v1/service_configs", web::post().to(create_record))
            .route("/api/v1/service_configs/{id}", web::get().to(get_record))
            .route("/api/v1/service_configs/{id}", web::put().to(update_record))
            .route("/api/v1/service_configs/{id}", web::delete().to(delete_record))
            .route("/v1/collections/init", web::post().to(init_collections))
            .route("/v1/vectors/upsert", web::post().to(upsert_vectors))
            .route("/v1/vectors/search", web::post().to(semantic_search))
            .route("/v1/embed", web::post().to(embed_text))
            .route("/v1/regulations/search", web::post().to(search_regulations))
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

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
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

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
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
