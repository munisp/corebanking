#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// epr-kgqa-rs

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

fn extract_entities(query: &str) -> Vec<(&str, String)> {
    let mut entities = Vec::new();
    let q = query.to_lowercase();
    // Account numbers (10 digits)
    for word in q.split_whitespace() {
        if word.len() == 10 && word.chars().all(|c| c.is_ascii_digit()) {
            entities.push(("account_number", word.to_string()));
        }
        // BVN (starts with 22, 11 digits)
        if word.len() == 11 && word.starts_with("22") && word.chars().all(|c| c.is_ascii_digit()) {
            entities.push(("bvn", word.to_string()));
        }
    }
    entities
}

fn generate_cypher(intent: &str, entity_type: &str, entity_value: &str) -> String {
    match (intent, entity_type) {
        ("find_account", "account_number") => format!("MATCH (a:Account {{number: '{}'}}) RETURN a", entity_value),
        ("find_customer", "bvn") => format!("MATCH (c:Customer)-[:OWNS]->(a:Account) WHERE c.bvn = '{}' RETURN c, a", entity_value),
        ("find_transactions", "account_number") => format!("MATCH (a:Account {{number: '{}'}})-[:HAS_TXN]->(t:Transaction) RETURN t ORDER BY t.date DESC LIMIT 10", entity_value),
        _ => format!("MATCH (n) WHERE n.id = '{}' RETURN n LIMIT 10", entity_value),
    }
}

fn classify_intent(query: &str) -> &'static str {
    let q = query.to_lowercase();
    if q.contains("account") || q.contains("balance") { "find_account" }
    else if q.contains("customer") || q.contains("bvn") { "find_customer" }
    else if q.contains("transaction") || q.contains("transfer") { "find_transactions" }
    else if q.contains("fraud") || q.contains("suspicious") { "fraud_investigation" }
    else { "general_query" }
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

fn call_service_sync(url: &str, payload: &str) -> Result<String, String> {
    let addr_str = url.replace("http://", "").replace("https://", "");
    let tcp = std::net::TcpStream::connect_timeout(&addr_str.parse().unwrap_or_else(|_| "127.0.0.1:8080".parse().unwrap()), std::time::Duration::from_secs(5));
    match tcp { Ok(mut s) => { use std::io::Write; let _ = s.write_all(format!("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n\r\n{}", payload.len(), payload).as_bytes()); Ok("ok".into()) } Err(e) => Err(format!("{}", e)) }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    let id = format!("{}_{}_{}", "epr-kgqa-rs".replace("-","_"), endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let svc = String::from("epr-kgqa-rs");
    if let Some(client) = &state.db_client {
        let _ = client.execute("INSERT INTO records (id,service,tenant,status,data,created_at) VALUES ($1,$2,'default','active',$3,NOW()) ON CONFLICT (id) DO UPDATE SET data=$3", &[&id, &svc, &data.to_string()]).await;
    } else {
        state.records.lock().unwrap().push(json!({"id": id, "service": svc, "data": data}));
    }
}

async fn health() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "epr-kgqa-rs"})) }
async fn ready() -> HttpResponse { HttpResponse::Ok().json(json!({"ready": true, "service": "epr-kgqa-rs"})) }
async fn live() -> HttpResponse { HttpResponse::Ok().json(json!({"live": true})) }
async fn metrics() -> HttpResponse {
    let r = REQUEST_COUNT.load(AtomicOrdering::Relaxed);
    let e = ERROR_COUNT.load(AtomicOrdering::Relaxed);
    HttpResponse::Ok().content_type("text/plain").body(format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"epr-kgqa-rs\"}} {}\n# TYPE errors_total counter\nerrors_total{{service=\"epr-kgqa-rs\"}} {}\n", r, e))
}

async fn ask(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let _ = sanitize_input("");
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    db_persist(&state, "ask", &input).await;
    let upstream = env::var("GL_ENGINE_URL").unwrap_or_else(|_| "http://gl-engine-rs:8080".into());
    let _ = call_service_sync(&format!("{}/v1/notify", upstream), &format!(r#"{"source": "epr-kgqa-rs", "action": "ask"}"#));
    HttpResponse::Ok().json(json!({"service": "epr-kgqa-rs", "endpoint": "ask", "result": input}))
}

async fn entities(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    if !rl_allow() { return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"})); }
    if let Err(resp) = check_jwt(&req) { return resp; }
    db_persist(&state, "entities", &json!({"action": "entities"})).await;
    HttpResponse::Ok().json(json!({"service": "epr-kgqa-rs", "endpoint": "entities", "items": []}))
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
    println!("epr-kgqa-rs listening on port {}", port);
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
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(ready))
            .route("/livez", web::get().to(live))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/kgqa/ask", web::post().to(ask))
            .route("/v1/kgqa/entities", web::get().to(entities))
            .route("/v1/create", web::post().to(create_record))
    })
    .bind(("0.0.0.0", port))?.run().await
}
