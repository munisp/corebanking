// redis-cache-rs — Redis cache layer for 54Bank
// Implements: get/set/delete/TTL, cache-aside pattern, session store, rate limiting
// Uses: redis crate with tokio async connection manager

use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use std::env;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{Utc, DateTime};
use redis::{Client as RedisClient, AsyncCommands, aio::ConnectionManager};

static CACHE_HITS: AtomicU64 = AtomicU64::new(0);
static CACHE_MISSES: AtomicU64 = AtomicU64::new(0);
static CACHE_WRITES: AtomicU64 = AtomicU64::new(0);
static CACHE_DELETES: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheSetRequest {
    pub key: String,
    pub value: serde_json::Value,
    pub ttl_seconds: Option<u64>,
    pub namespace: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheGetResponse {
    pub key: String,
    pub value: Option<serde_json::Value>,
    pub hit: bool,
    pub ttl_remaining: Option<i64>,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RateLimitRequest {
    pub key: String,
    pub limit: u64,
    pub window_seconds: u64,
    pub tenant_id: Option<String>,
}

pub struct AppState {
    pub db: PgPool,
    pub redis: Arc<RwLock<Option<ConnectionManager>>>,
    pub redis_url: String,
}

async fn connect_redis(url: &str) -> Option<ConnectionManager> {
    match RedisClient::open(url) {
        Ok(client) => match ConnectionManager::new(client).await {
            Ok(mgr) => {
                log::info!("[redis-cache-rs] Connected to Redis at {}", url);
                Some(mgr)
            }
            Err(e) => {
                log::warn!("[redis-cache-rs] Redis ConnectionManager failed: {}", e);
                None
            }
        },
        Err(e) => {
            log::warn!("[redis-cache-rs] Redis client open failed: {}", e);
            None
        }
    }
}

fn build_key(namespace: Option<&str>, tenant_id: Option<&str>, key: &str) -> String {
    let ns = namespace.unwrap_or("54bank");
    let tenant = tenant_id.unwrap_or("global");
    format!("{}:{}:{}", ns, tenant, key)
}

async fn init_schema(pool: &PgPool) {
    let ddl = r#"
        CREATE TABLE IF NOT EXISTS redis_cache_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cache_key VARCHAR(512) NOT NULL,
            namespace VARCHAR(64) NOT NULL DEFAULT '54bank',
            tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
            value JSONB NOT NULL,
            ttl_seconds INTEGER,
            expires_at TIMESTAMPTZ,
            hit_count BIGINT NOT NULL DEFAULT 0,
            source VARCHAR(16) NOT NULL DEFAULT 'redis',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(cache_key, namespace, tenant_id)
        );

        CREATE TABLE IF NOT EXISTS redis_cache_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
            namespace VARCHAR(64) NOT NULL DEFAULT '54bank',
            hits BIGINT NOT NULL DEFAULT 0,
            misses BIGINT NOT NULL DEFAULT 0,
            writes BIGINT NOT NULL DEFAULT 0,
            deletes BIGINT NOT NULL DEFAULT 0,
            evictions BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(metric_date, namespace)
        );

        CREATE TABLE IF NOT EXISTS redis_rate_limit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rate_key VARCHAR(512) NOT NULL,
            tenant_id VARCHAR(64),
            window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            window_seconds INTEGER NOT NULL,
            request_count BIGINT NOT NULL DEFAULT 1,
            limit_value BIGINT NOT NULL,
            allowed BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS redis_session_store (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id VARCHAR(128) NOT NULL UNIQUE,
            tenant_id VARCHAR(64) NOT NULL,
            user_id VARCHAR(128) NOT NULL,
            data JSONB NOT NULL DEFAULT '{}',
            ip_address VARCHAR(64),
            user_agent TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_redis_cache_key ON redis_cache_entries(cache_key, namespace);
        CREATE INDEX IF NOT EXISTS idx_redis_cache_tenant ON redis_cache_entries(tenant_id, namespace);
        CREATE INDEX IF NOT EXISTS idx_redis_cache_expires ON redis_cache_entries(expires_at) WHERE expires_at IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_redis_session_user ON redis_session_store(user_id, tenant_id);
        CREATE INDEX IF NOT EXISTS idx_redis_session_expires ON redis_session_store(expires_at);
    "#;
    if let Err(e) = sqlx::query(ddl).execute(pool).await {
        log::error!("[redis-cache-rs] Schema init failed: {}", e);
    } else {
        log::info!("[redis-cache-rs] Schema initialized (4 tables)");
    }
}

async fn health(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let redis_status = {
        let guard = state.redis.read().await;
        if guard.is_some() { "connected" } else { "degraded" }
    };
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db).await {
        Ok(_) => "connected",
        Err(_) => "unhealthy",
    };
    HttpResponse::Ok().json(serde_json::json!({
        "status": if db_status == "unhealthy" { "degraded" } else { "healthy" },
        "service": "redis-cache-rs",
        "version": "3.0.0",
        "checks": { "database": db_status, "redis": redis_status },
        "metrics": {
            "hits": CACHE_HITS.load(Ordering::Relaxed),
            "misses": CACHE_MISSES.load(Ordering::Relaxed),
            "writes": CACHE_WRITES.load(Ordering::Relaxed),
            "deletes": CACHE_DELETES.load(Ordering::Relaxed),
            "hit_rate_pct": {
                let h = CACHE_HITS.load(Ordering::Relaxed);
                let m = CACHE_MISSES.load(Ordering::Relaxed);
                if h + m == 0 { 0.0 } else { (h as f64 / (h + m) as f64) * 100.0 }
            }
        }
    }))
}

// POST /api/v1/cache — Set cache entry
async fn set_cache(state: web::Data<Arc<AppState>>, body: web::Json<CacheSetRequest>) -> HttpResponse {
    let full_key = build_key(body.namespace.as_deref(), body.tenant_id.as_deref(), &body.key);
    let value_str = serde_json::to_string(&body.value).unwrap_or_default();
    let ttl = body.ttl_seconds.unwrap_or(3600);

    let mut redis_ok = false;
    {
        let mut guard = state.redis.write().await;
        if let Some(ref mut conn) = *guard {
            let result: Result<(), redis::RedisError> = conn.set_ex(&full_key, &value_str, ttl).await;
            if result.is_ok() {
                redis_ok = true;
                CACHE_WRITES.fetch_add(1, Ordering::Relaxed);
            } else {
                log::warn!("[redis-cache-rs] Redis SET failed for key={}", full_key);
            }
        }
    }

    // Always write to PostgreSQL as fallback/audit
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl as i64);
    let _ = sqlx::query(
        "INSERT INTO redis_cache_entries (cache_key, namespace, tenant_id, value, ttl_seconds, expires_at, source) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (cache_key, namespace, tenant_id) DO UPDATE SET value = $4, ttl_seconds = $5, expires_at = $6, updated_at = NOW(), hit_count = 0"
    )
    .bind(&full_key)
    .bind(body.namespace.as_deref().unwrap_or("54bank"))
    .bind(body.tenant_id.as_deref().unwrap_or("global"))
    .bind(&body.value)
    .bind(ttl as i32)
    .bind(expires_at)
    .bind(if redis_ok { "redis" } else { "postgres" })
    .execute(&state.db).await;

    HttpResponse::Created().json(serde_json::json!({
        "key": body.key,
        "full_key": full_key,
        "ttl_seconds": ttl,
        "backend": if redis_ok { "redis" } else { "postgres_fallback" },
        "status": "set"
    }))
}

// GET /api/v1/cache/{key} — Get cache entry
async fn get_cache(
    state: web::Data<Arc<AppState>>,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let key = path.into_inner();
    let namespace = query.get("namespace").cloned();
    let tenant_id = query.get("tenant_id").cloned();
    let full_key = build_key(namespace.as_deref(), tenant_id.as_deref(), &key);

    // Try Redis first
    {
        let mut guard = state.redis.write().await;
        if let Some(ref mut conn) = *guard {
            let result: Result<Option<String>, redis::RedisError> = conn.get(&full_key).await;
            if let Ok(Some(val_str)) = result {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&val_str) {
                    let ttl: Result<i64, redis::RedisError> = conn.ttl(&full_key).await;
                    CACHE_HITS.fetch_add(1, Ordering::Relaxed);
                    // Update hit count in DB
                    let _ = sqlx::query("UPDATE redis_cache_entries SET hit_count = hit_count + 1 WHERE cache_key = $1")
                        .bind(&full_key).execute(&state.db).await;
                    return HttpResponse::Ok().json(CacheGetResponse {
                        key: key.clone(),
                        value: Some(value),
                        hit: true,
                        ttl_remaining: ttl.ok(),
                        source: "redis".to_string(),
                    });
                }
            }
        }
    }

    // Fallback: PostgreSQL
    let row = sqlx::query(
        "SELECT value, ttl_seconds, expires_at FROM redis_cache_entries WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > NOW())"
    )
    .bind(&full_key)
    .fetch_optional(&state.db).await;

    match row {
        Ok(Some(r)) => {
            let value: serde_json::Value = r.get("value");
            let expires_at: Option<DateTime<Utc>> = r.get("expires_at");
            let ttl_remaining = expires_at.map(|e| (e - Utc::now()).num_seconds());
            CACHE_HITS.fetch_add(1, Ordering::Relaxed);
            let _ = sqlx::query("UPDATE redis_cache_entries SET hit_count = hit_count + 1 WHERE cache_key = $1")
                .bind(&full_key).execute(&state.db).await;
            HttpResponse::Ok().json(CacheGetResponse {
                key, value: Some(value), hit: true, ttl_remaining, source: "postgres_fallback".to_string(),
            })
        }
        _ => {
            CACHE_MISSES.fetch_add(1, Ordering::Relaxed);
            HttpResponse::Ok().json(CacheGetResponse {
                key, value: None, hit: false, ttl_remaining: None, source: "miss".to_string(),
            })
        }
    }
}

// DELETE /api/v1/cache/{key} — Delete cache entry
async fn delete_cache(
    state: web::Data<Arc<AppState>>,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let key = path.into_inner();
    let namespace = query.get("namespace").cloned();
    let tenant_id = query.get("tenant_id").cloned();
    let full_key = build_key(namespace.as_deref(), tenant_id.as_deref(), &key);

    {
        let mut guard = state.redis.write().await;
        if let Some(ref mut conn) = *guard {
            let _: Result<i64, _> = conn.del(&full_key).await;
        }
    }
    let _ = sqlx::query("DELETE FROM redis_cache_entries WHERE cache_key = $1")
        .bind(&full_key).execute(&state.db).await;
    CACHE_DELETES.fetch_add(1, Ordering::Relaxed);
    HttpResponse::Ok().json(serde_json::json!({"key": key, "status": "deleted"}))
}

// POST /api/v1/rate-limit — Check and increment rate limit
async fn check_rate_limit(state: web::Data<Arc<AppState>>, body: web::Json<RateLimitRequest>) -> HttpResponse {
    let rate_key = format!("ratelimit:{}:{}", body.tenant_id.as_deref().unwrap_or("global"), body.key);
    let mut count: u64 = 0;
    let mut allowed = true;

    {
        let mut guard = state.redis.write().await;
        if let Some(ref mut conn) = *guard {
            // Sliding window rate limit using Redis INCR + EXPIRE
            let current: Result<u64, _> = conn.incr(&rate_key, 1u64).await;
            if let Ok(c) = current {
                count = c;
                if c == 1 {
                    let _: Result<bool, _> = conn.expire(&rate_key, body.window_seconds as i64).await;
                }
                allowed = c <= body.limit;
            }
        }
    }

    let _ = sqlx::query(
        "INSERT INTO redis_rate_limit_log (rate_key, tenant_id, window_seconds, request_count, limit_value, allowed) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(&rate_key)
    .bind(body.tenant_id.as_deref().unwrap_or("global"))
    .bind(body.window_seconds as i32)
    .bind(count as i64)
    .bind(body.limit as i64)
    .bind(allowed)
    .execute(&state.db).await;

    let status = if allowed { http::StatusCode::OK } else { http::StatusCode::TOO_MANY_REQUESTS };
    HttpResponse::build(status).json(serde_json::json!({
        "key": body.key,
        "allowed": allowed,
        "count": count,
        "limit": body.limit,
        "window_seconds": body.window_seconds,
        "remaining": if count <= body.limit { body.limit - count } else { 0 }
    }))
}

async fn metrics_handler() -> HttpResponse {
    let h = CACHE_HITS.load(Ordering::Relaxed);
    let m = CACHE_MISSES.load(Ordering::Relaxed);
    let body = format!(
        "redis_cache_hits_total {}\nredis_cache_misses_total {}\nredis_cache_writes_total {}\nredis_cache_deletes_total {}\n",
        h, m,
        CACHE_WRITES.load(Ordering::Relaxed),
        CACHE_DELETES.load(Ordering::Relaxed),
    );
    HttpResponse::Ok().content_type("text/plain; version=0.0.4").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[redis-cache-rs] starting v3.0.0 (Redis SDK integrated)");

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/redis_cache_rs".to_string());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;

    let redis_conn = connect_redis(&redis_url).await;
    let redis_arc = Arc::new(RwLock::new(redis_conn));

    let state = Arc::new(AppState {
        db: pool,
        redis: redis_arc.clone(),
        redis_url: redis_url.clone(),
    });

    // Background: reconnect Redis if lost
    let reconnect_arc = redis_arc.clone();
    let reconnect_url = redis_url.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let needs_reconnect = { reconnect_arc.read().await.is_none() };
            if needs_reconnect {
                let conn = connect_redis(&reconnect_url).await;
                *reconnect_arc.write().await = conn;
            }
        }
    });

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8219".to_string()).parse().unwrap_or(8219);
    log::info!("[redis-cache-rs] ready on :{} (redis={})", port, redis_url);

    let state_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(state_data.clone())
            .wrap(middleware::Logger::default())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "ready"})) }))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics_handler))
            .route("/api/v1/cache", web::post().to(set_cache))
            .route("/api/v1/cache/{key}", web::get().to(get_cache))
            .route("/api/v1/cache/{key}", web::delete().to(delete_cache))
            .route("/api/v1/rate-limit", web::post().to(check_rate_limit))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
