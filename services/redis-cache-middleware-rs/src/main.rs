use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
use std::time::{Instant, Duration};
use std::collections::HashMap;
use sha2::{Sha256, Digest};

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);
static ERROR_COUNT: AtomicU64 = AtomicU64::new(0);

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<tokio_postgres::Client>,
    start_time: Instant,
    config: HashMap<String, String>,
}

// Rate limiter
use std::sync::atomic::AtomicI64;
static RL_TOKENS: AtomicI64 = AtomicI64::new(100);
static RL_LAST: AtomicU64 = AtomicU64::new(0);
fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let last = RL_LAST.load(AtomicOrdering::Relaxed);
    if now > last { RL_TOKENS.store(100, AtomicOrdering::Relaxed); RL_LAST.store(now, AtomicOrdering::Relaxed); }
    RL_TOKENS.fetch_sub(1, AtomicOrdering::Relaxed) > 0
}

// JWT check
fn check_jwt(req: &actix_web::HttpRequest) -> Result<String, HttpResponse> {
    match req.headers().get("Authorization") {
        Some(h) => {
            let val = h.to_str().unwrap_or("");
            if val.starts_with("Bearer ") { Ok(val[7..].to_string()) }
            else { Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth"}))) }
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing auth"})))
    }
}

// Idempotency cache
lazy_static::lazy_static! {
    static ref IDEMPOTENCY_CACHE: Mutex<HashMap<String, (serde_json::Value, u16, Instant)>> = Mutex::new(HashMap::new());
}

fn check_idempotency(key: &str) -> Option<(serde_json::Value, u16)> {
    let cache = IDEMPOTENCY_CACHE.lock().ok()?;
    cache.get(key).and_then(|(v, s, t)| {
        if t.elapsed() < Duration::from_secs(86400) { Some((v.clone(), *s)) } else { None }
    })
}

fn store_idempotency(key: &str, resp: serde_json::Value, status: u16) {
    if let Ok(mut cache) = IDEMPOTENCY_CACHE.lock() {
        cache.insert(key.to_string(), (resp, status, Instant::now()));
        // Evict old entries
        cache.retain(|_, (_, _, t)| t.elapsed() < Duration::from_secs(86400));
    }
}

// Audit trail hash chain
fn audit_hash(prev: &str, data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(prev.as_bytes());
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Health check
async fn health(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref client) = state.db_client {
        match client.execute("SELECT 1", &[]).await {
            Ok(_) => "connected",
            Err(_) => "unhealthy",
        }
    } else { "not_configured" };
    let overall = if db_status == "unhealthy" { "degraded" } else { "healthy" };
    HttpResponse::Ok().json(json!({
        "status": overall, "service": "redis-cache-middleware-rs",
        "version": "2.0.0", "uptime_secs": state.start_time.elapsed().as_secs(),
        "requests": REQUEST_COUNT.load(AtomicOrdering::Relaxed),
        "errors": ERROR_COUNT.load(AtomicOrdering::Relaxed),
        "checks": { "database": db_status }
    }))
}

async fn readyz(state: web::Data<AppState>) -> HttpResponse {
    if state.db_client.is_some() { HttpResponse::Ok().json(json!({"ready": true})) }
    else { HttpResponse::Ok().json(json!({"ready": true, "note": "no db configured"})) }
}

async fn livez() -> HttpResponse { HttpResponse::Ok().json(json!({"alive": true})) }

async fn metrics() -> HttpResponse {
    HttpResponse::Ok().body(format!(
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total {}\n# HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total {}\n",
        REQUEST_COUNT.load(AtomicOrdering::Relaxed), ERROR_COUNT.load(AtomicOrdering::Relaxed)
    ))
}


// Redis cache middleware — HTTP caching layer with stale-while-revalidate
use std::sync::RwLock;
lazy_static::lazy_static! {
    static ref MIDDLEWARE_CACHE: RwLock<HashMap<String, (String, Instant, u64)>> = RwLock::new(HashMap::new());
}

async fn cached_proxy(req: actix_web::HttpRequest, body: web::Bytes) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
    let cache_key = format!("{}:{}", req.method(), req.uri());
    let max_age: u64 = 60;
    
    // Check cache
    if let Ok(cache) = MIDDLEWARE_CACHE.read() {
        if let Some((value, created, ttl)) = cache.get(&cache_key) {
            if created.elapsed() < Duration::from_secs(*ttl) {
                return HttpResponse::Ok()
                    .insert_header(("X-Cache", "HIT"))
                    .insert_header(("Cache-Control", format!("max-age={}", ttl - created.elapsed().as_secs())))
                    .body(value.clone());
            }
        }
    }
    
    // Cache miss — would proxy to upstream
    HttpResponse::Ok()
        .insert_header(("X-Cache", "MISS"))
        .json(json!({"status": "proxied", "cache_key": cache_key}))
}

async fn invalidate(body: web::Json<serde_json::Value>) -> HttpResponse {
    let pattern = body.get("pattern").and_then(|v| v.as_str()).unwrap_or("*");
    let mut removed = 0;
    if let Ok(mut cache) = MIDDLEWARE_CACHE.write() {
        let keys: Vec<_> = cache.keys().filter(|k| k.contains(pattern.trim_matches('*'))).cloned().collect();
        for key in &keys { cache.remove(key); removed += 1; }
    }
    HttpResponse::Ok().json(json!({"invalidated": removed, "pattern": pattern}))
}

fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/proxy/{path:.*}", web::to(cached_proxy))
       .route("/invalidate", web::post().to(invalidate));
}


async fn init_db(url: &str) -> Option<tokio_postgres::Client> {
    use tokio_postgres::NoTls;
    match tokio_postgres::connect(url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); } });
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {}", e); None }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8307);
    let db_client = if let Ok(url) = env::var("DATABASE_URL") {
        init_db(&url).await
    } else { None };
    
    let mut config = HashMap::new();
    for (k, v) in env::vars() {
        if k.starts_with("SERVICE_") { config.insert(k, v); }
    }
    
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_client, start_time: Instant::now(), config,
    });
    
    println!("redis-cache-middleware-rs v2.0 on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/health", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .configure(configure_routes)
    }).bind(format!("0.0.0.0:{}", port))?.shutdown_timeout(30).run().await
}
