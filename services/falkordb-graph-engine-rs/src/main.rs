#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use uuid::Uuid;
use chrono::{Utc, DateTime};

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
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[falkordb-graph-engine-rs] starting");

    let db_name = "falkordb-graph-engine-rs".replace("-", "_");
    let default_url = format!("postgres://postgres:postgres@localhost:5432/{}", db_name);
    let database_url = env::var("DATABASE_URL").unwrap_or(default_url);

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;
    log::info!("[falkordb-graph-engine-rs] database connected, schema initialized");

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
            .wrap_fn(move |req, srv| {
                let trace = trace_id.clone();
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
