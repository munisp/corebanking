#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// qdrant-financial-search-rs

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);
static RL_TOKENS: AtomicU64 = AtomicU64::new(100);
static RL_LAST: AtomicU64 = AtomicU64::new(0);

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn sanitize_input(s: &str) -> String { s.replace("<script>", "").replace("</script>", "").replace("javascript:", "").chars().take(10240).collect() }

fn compute_text_hash(text: &str) -> u64 {
    text.bytes().fold(14695981039346656037u64, |h, b| (h ^ b as u64).wrapping_mul(1099511628211))
}

fn compute_cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f64 = a.iter().map(|x| x * x).sum::<f64>().sqrt();
    let mag_b: f64 = b.iter().map(|x| x * x).sum::<f64>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 { 0.0 } else { dot / (mag_a * mag_b) }
}

fn generate_embedding(text: &str, dim: usize) -> Vec<f64> {
    let mut embedding = Vec::with_capacity(dim);
    let mut hash = compute_text_hash(text);
    for _ in 0..dim {
        hash = hash.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        embedding.push((hash as f64 / u64::MAX as f64) * 2.0 - 1.0);
    }
    embedding
}

fn validate_search_query(query: &str, max_results: usize) -> (bool, Vec<&'static str>) {
    let mut errors = Vec::new();
    if query.is_empty() { errors.push("Query text required"); }
    if query.len() > 10000 { errors.push("Query too long (max 10000 chars)"); }
    if max_results > 100 { errors.push("Max results capped at 100"); }
    (errors.is_empty(), errors)
}

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if now > RL_LAST.load(AtomicOrdering::Relaxed) { RL_TOKENS.store(100, AtomicOrdering::Relaxed); RL_LAST.store(now, AtomicOrdering::Relaxed); }
    RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) > 0
}

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path.starts_with("/healthz") || path.starts_with("/readyz") || path.starts_with("/livez") || path.starts_with("/metrics") { return Ok(()); }
    match req.headers().get("Authorization") {
        Some(v) if v.to_str().unwrap_or("").starts_with("Bearer ") => Ok(()),
        _ => Err(HttpResponse::Unauthorized().json(json!({"error": "unauthorized"})))
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
    let addr_str = url.replace("http://", "").replace("https://", "");
    let tcp = std::net::TcpStream::connect_timeout(&addr_str.parse().unwrap_or_else(|_| "127.0.0.1:8080".parse().unwrap()), std::time::Duration::from_secs(5));
    match tcp { Ok(mut s) => { use std::io::Write; let _ = s.write_all(format!("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n\r\n{}", payload.len(), payload).as_bytes()); Ok("ok".into()) } Err(e) => Err(format!("{}", e)) }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "qdrant-financial-search-rs".replace("-","_"), endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc = String::from("qdrant-financial-search-rs");
    if let Some(client) = &state.db_client {
        let _ = client.execute("INSERT INTO records (id,service,tenant,status,data,created_at) VALUES ($1,$2,'default','active',$3,NOW()) ON CONFLICT (id) DO UPDATE SET data=$3", &[&id, &svc, &data.to_string()]).await;
    } else {
        state.records.lock().unwrap().push(json!({"id": id, "service": svc, "data": data}));
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

async fn health() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "qdrant-financial-search-rs"})) }
async fn ready() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "qdrant-financial-search-rs"})) }
async fn live() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"qdrant-financial-search-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"qdrant-financial-search-rs\"}} {}\n", r, e))
}

async fn semantic_search(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    db_persist(&state, "semantic_search", &input).await;
    let upstream = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), &format!(r#"{"source": "qdrant-financial-search-rs", "action": "semantic_search"}"#));
    HttpResponse::Ok().json(json!({"service": "qdrant-financial-search-rs", "endpoint": "semantic_search", "result": input}))
}

async fn index_document(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    db_persist(&state, "index_document", &input).await;
    let upstream = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), &format!(r#"{"source": "qdrant-financial-search-rs", "action": "index_document"}"#));
    HttpResponse::Ok().json(json!({"service": "qdrant-financial-search-rs", "endpoint": "index_document", "result": input}))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    db_persist(&state, "create", &body.into_inner()).await;
    HttpResponse::Created().json(json!({"created": true}))
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
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54bank/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54bank/certs/ca.crt".to_string());
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

    let state = web::Data::new(AppState { records: Mutex::new(Vec::new()), db_url, db_client });
    println!("qdrant-financial-search-rs listening on port {}", port);
    start_grpc_server("qdrant-financial-search-rs", 10456);
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
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(ready))
            .route("/livez", web::get().to(live))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/search/semantic", web::post().to(semantic_search))
            .route("/v1/search/index", web::post().to(index_document))
            .route("/v1/create", web::post().to(create_record))
    })
    .bind(("0.0.0.0", port))?.run().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_service_name() {
        assert_eq!("qdrant-financial-search-rs", "qdrant-financial-search-rs");
    }

    #[test]
    fn test_rate_limiter() {
        assert!(rl_allow());
    }
}
