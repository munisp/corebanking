use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String, redis_url: String, postgres_url: String, opensearch_url: String,
    keycloak_url: String, permify_url: String, dapr_url: String, fluvio_url: String,
    temporal_url: String, mojaloop_url: String, tigerbeetle_url: String, lakehouse_url: String,
    apisix_url: String, openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()),
        opensearch_url: std::env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()),
        keycloak_url: std::env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()),
        permify_url: std::env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()),
        dapr_url: std::env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()),
        fluvio_url: std::env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()),
        temporal_url: std::env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()),
        mojaloop_url: std::env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()),
        tigerbeetle_url: std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()),
        lakehouse_url: std::env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()),
        apisix_url: std::env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()),
        openappsec_url: std::env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct ETDPosition {
    id: String,
    instrument: String,
    exchange: String,
    contract_type: String,
    underlying: String,
    strike_price: f64,
    expiry: String,
    quantity: i32,
    avg_price: f64,
    current_price: f64,
    margin_required: f64,
    pnl: f64,
    status: String,
}

fn seed() -> Vec<ETDPosition> {
    vec![
        ETDPosition { id: "ETD-001".into(), instrument: "NGX-DANG-JUN26-C450".into(), exchange: "NGX".into(), contract_type: "call_option".into(), underlying: "DANGCEM".into(), strike_price: 450.0, expiry: "2026-06-30".into(), quantity: 1000, avg_price: 25.50, current_price: 32.00, margin_required: 5_000_000.0, pnl: 6_500_000.0, status: "open".into() },
        ETDPosition { id: "ETD-002".into(), instrument: "NGX-GTCO-SEP26-P35".into(), exchange: "NGX".into(), contract_type: "put_option".into(), underlying: "GTCO".into(), strike_price: 35.0, expiry: "2026-09-30".into(), quantity: 5000, avg_price: 3.20, current_price: 2.80, margin_required: 8_000_000.0, pnl: -2_000_000.0, status: "open".into() },
        ETDPosition { id: "ETD-003".into(), instrument: "FMDQ-TBILL-FUT-AUG26".into(), exchange: "FMDQ".into(), contract_type: "future".into(), underlying: "NTB-364D".into(), strike_price: 0.0, expiry: "2026-08-15".into(), quantity: 100, avg_price: 985_000.0, current_price: 987_500.0, margin_required: 50_000_000.0, pnl: 250_000.0, status: "open".into() },
        ETDPosition { id: "ETD-004".into(), instrument: "NGX-AIRP-DEC26-C15".into(), exchange: "NGX".into(), contract_type: "call_option".into(), underlying: "AIRPEACE".into(), strike_price: 15.0, expiry: "2026-12-31".into(), quantity: 10000, avg_price: 2.10, current_price: 3.50, margin_required: 12_000_000.0, pnl: 14_000_000.0, status: "open".into() },
    ]
}

struct AppState { items: Mutex<Vec<ETDPosition>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "etd-trading-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["etd.trades","etd.margin-calls","etd.settlements"] },
            "redis": { "url": c.redis_url, "cache_keys": ["etd-trading-rs:cache"] },
            "postgres": { "url": c.postgres_url, "tables": ["etd_positions","etd_trades","margin_accounts","clearing_records"] },
            "opensearch": { "url": c.opensearch_url, "indices": ["etd-positions","etd-audit"] },
            "keycloak": { "url": c.keycloak_url, "realm": "54link-dev", "client": "etd-trading-rs" },
            "permify": { "url": c.permify_url, "resources": ["etd-trading-rs"] },
            "dapr": { "url": c.dapr_url, "app_id": "etd-trading-rs", "pubsub": "etd-trading-rs-pubsub" },
            "fluvio": { "url": c.fluvio_url, "topics": ["etd-trading-rs-stream"] },
            "temporal": { "url": c.temporal_url, "workflows": ["MarginCallWorkflow","ExpirySettlementWorkflow"] },
            "mojaloop": { "url": c.mojaloop_url, "usage": "settlement" },
            "tigerbeetle": { "url": c.tigerbeetle_url, "ledgers": ["etd_margin","etd_settlement"] },
            "lakehouse": { "url": c.lakehouse_url, "tables": ["etd-trading-rs_history"] },
            "apisix": { "url": c.apisix_url, "routes": ["/v1/etd-trading-rs/*"] },
            "openappsec": { "url": c.openappsec_url, "policy": "etd-trading-rs-waf" }
        }
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8175".into()).parse().unwrap_or(8175);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Exchange Traded Derivatives Service running on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/etd-trading-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
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
