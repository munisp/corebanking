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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    log::info!("[postgres-persistence-rs] starting");

    let db_name = "postgres-persistence-rs".replace("-", "_");
    let default_url = format!("postgres://postgres:postgres@localhost:5432/{}", db_name);
    let database_url = env::var("DATABASE_URL").unwrap_or(default_url);

    let pool = PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    init_schema(&pool).await;
    log::info!("[postgres-persistence-rs] database connected, schema initialized");

    let keycloak_url = env::var("KEYCLOAK_REALM_URL").unwrap_or_else(|_| "http://keycloak:8080/realms/54bank".to_string());
    let kafka_brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "localhost:6379".to_string());
    let opensearch_url = env::var("OPENSEARCH_ENDPOINT").unwrap_or_else(|_| "http://opensearch:9200".to_string());
    let permify_url = env::var("PERMIFY_ENDPOINT").unwrap_or_else(|_| "http://permify:3476".to_string());

    log::info!("[postgres-persistence-rs] middleware: keycloak={} kafka={} redis={} opensearch={} permify={}",
        keycloak_url, kafka_brokers, redis_url, opensearch_url, permify_url);

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8202".to_string()).parse().unwrap_or(8202);
    let data = web::Data::new(AppState { db: pool });

    log::info!("[postgres-persistence-rs] ready on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .wrap(middleware::Logger::default())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }))
            .route("/metrics", web::get().to(metrics))
            .route("/api/v1/cards", web::get().to(list_records))
            .route("/api/v1/cards", web::post().to(create_record))
            .route("/api/v1/cards/{id}", web::get().to(get_record))
            .route("/api/v1/cards/{id}", web::put().to(update_record))
            .route("/api/v1/cards/{id}", web::delete().to(delete_record))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

async fn init_schema(pool: &PgPool) {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number_hash VARCHAR(64) NOT NULL,
    masked_pan VARCHAR(19) NOT NULL,
    customer_id UUID NOT NULL,
    account_id UUID NOT NULL,
    card_type VARCHAR(20) NOT NULL,
    scheme VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expiry_month INT NOT NULL,
    expiry_year INT NOT NULL,
    daily_limit_kobo BIGINT NOT NULL DEFAULT 50000000,
    monthly_limit_kobo BIGINT NOT NULL DEFAULT 500000000,
    pin_retries INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    blocked_reason VARCHAR(100),
    tenant_id UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"#)
    .execute(pool)
    .await
    .expect("Failed to create cards table");

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

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cards_tenant ON cards(tenant_id)")
        .execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status)")
        .execute(pool).await.ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at DESC)")
        .execute(pool).await.ok();
}

async fn health(data: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "postgres-persistence-rs",
        "version": "1.0.0"
    }))
}

async fn readyz(data: web::Data<AppState>) -> HttpResponse {
    match sqlx::query("SELECT 1").execute(&data.db).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"status": "ready"})),
        Err(e) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"status": "not ready", "error": e.to_string()})),
    }
}

async fn metrics(data: web::Data<AppState>) -> HttpResponse {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cards")
        .fetch_one(&data.db).await.unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({
        "service": "postgres-persistence-rs",
        "total_records": count
    }))
}

async fn list_records(data: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    let tenant_id = req.headers().get("X-Tenant-ID")
        .and_then(|v| v.to_str().ok()).unwrap_or("");

    let rows = sqlx::query("SELECT id, status, created_at FROM cards WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT 50")
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
    let tenant_id = body.tenant_id.clone()
        .or_else(|| req.headers().get("X-Tenant-ID").and_then(|v| v.to_str().ok()).map(String::from))
        .unwrap_or_else(|| "default".to_string());

    let status = body.status.clone().unwrap_or_else(|| "active".to_string());

    let result = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO cards (tenant_id, status) VALUES ($1::uuid, $2) RETURNING id"
    )
    .bind(&tenant_id)
    .bind(&status)
    .fetch_one(&data.db)
    .await;

    match result {
        Ok(id) => {
            let payload = serde_json::json!({"id": id.to_string(), "status": &status, "tenant_id": &tenant_id});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("cards.created")
                .bind(id.to_string())
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Created().json(serde_json::json!({"id": id.to_string(), "status": "created"}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn get_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("SELECT id, status, created_at FROM cards WHERE id = $1::uuid")
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

    let result = sqlx::query("UPDATE cards SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("cards.updated")
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
    sqlx::query("UPDATE cards SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("cards.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
