use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String,
    redis_url: String,
    postgres_url: String,
    opensearch_url: String,
    keycloak_url: String,
    permify_url: String,
    dapr_url: String,
    fluvio_url: String,
    temporal_url: String,
    mojaloop_url: String,
    tigerbeetle_url: String,
    lakehouse_url: String,
    apisix_url: String,
    openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://localhost:5432/db".into()),
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
struct ContingentLiability {
    id: String,
    liability_type: String,
    counterparty: String,
    description: String,
    max_exposure: f64,
    probability: f64,
    expected_loss: f64,
    currency: String,
    expiry_date: String,
    status: String,
}

fn seed() -> Vec<ContingentLiability> {
    vec![
        ContingentLiability {
            id: "CL-001".into(),
            liability_type: "letter_of_credit".into(),
            counterparty: "Dangote Cement Plc".into(),
            description: "Import LC for clinker shipment".into(),
            max_exposure: 5_000_000_000.0,
            probability: 0.05,
            expected_loss: 250_000_000.0,
            currency: "NGN".into(),
            expiry_date: "2026-09-30".into(),
            status: "active".into(),
        },
        ContingentLiability {
            id: "CL-002".into(),
            liability_type: "performance_guarantee".into(),
            counterparty: "Julius Berger Nigeria".into(),
            description: "Road construction bond".into(),
            max_exposure: 10_000_000_000.0,
            probability: 0.08,
            expected_loss: 800_000_000.0,
            currency: "NGN".into(),
            expiry_date: "2027-12-31".into(),
            status: "active".into(),
        },
    ]
}

struct AppState {
    items: Mutex<Vec<ContingentLiability>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "contingent-liabilities-rs",
        "status": "healthy"
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *d,
        "total": d.len()
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8174".into())
        .parse()
        .unwrap_or(8174);

    let data = web::Data::new(AppState {
        items: Mutex::new(seed()),
    });

    println!("Contingent Liabilities Service running on port {}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/contingent-liabilities-rs/list", web::get().to(list_items))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}