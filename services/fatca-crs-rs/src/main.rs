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
struct FATCAReport {
    id: String,
    report_type: String,
    reporting_year: String,
    jurisdiction: String,
    accounts_reported: u32,
    total_balance: f64,
    currency: String,
    filing_deadline: String,
    status: String,
}

fn seed() -> Vec<FATCAReport> { vec![
        FATCAReport { id: "FATCA-001".into(), report_type: "FATCA".into(), reporting_year: "2025".into(), jurisdiction: "US".into(), accounts_reported: 342, total_balance: 85_000_000.0, currency: "USD".into(), filing_deadline: "2026-03-31".into(), status: "filed".into() },
        FATCAReport { id: "CRS-001".into(), report_type: "CRS".into(), reporting_year: "2025".into(), jurisdiction: "UK".into(), accounts_reported: 156, total_balance: 45_000_000.0, currency: "GBP".into(), filing_deadline: "2026-06-30".into(), status: "pending".into() },
        FATCAReport { id: "CRS-002".into(), report_type: "CRS".into(), reporting_year: "2025".into(), jurisdiction: "AE".into(), accounts_reported: 89, total_balance: 120_000_000.0, currency: "AED".into(), filing_deadline: "2026-06-30".into(), status: "pending".into() },
        FATCAReport { id: "FATCA-002".into(), report_type: "FATCA".into(), reporting_year: "2024".into(), jurisdiction: "US".into(), accounts_reported: 298, total_balance: 72_000_000.0, currency: "USD".into(), filing_deadline: "2025-03-31".into(), status: "filed".into() },
    ]
}

struct AppState { items: Mutex<Vec<FATCAReport>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8188".into()).parse().unwrap_or(8188);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("FATCA/CRS Compliance Service running on port {}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/fatca-crs-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}
