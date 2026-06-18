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
struct InterbankDeal {
    id: String,
    deal_type: String,
    counterparty_bank: String,
    counterparty_bic: String,
    direction: String,
    currency: String,
    principal: f64,
    rate: f64,
    tenor_days: u32,
    value_date: String,
    maturity_date: String,
    status: String,
    accrued_interest: f64,
    nibss_ref: String,
}

fn seed() -> Vec<InterbankDeal> {
    vec![
        InterbankDeal { id: "IB-001".into(), deal_type: "call_placement".into(), counterparty_bank: "First Bank of Nigeria".into(), counterparty_bic: "FBNINGLA".into(), direction: "lend".into(), currency: "NGN".into(), principal: 5_000_000_000.0, rate: 12.5, tenor_days: 7, value_date: "2026-05-01".into(), maturity_date: "2026-05-08".into(), status: "active".into(), accrued_interest: 11_986_301.37, nibss_ref: "NIBSS-IB-2026050101".into() },
        InterbankDeal { id: "IB-002".into(), deal_type: "overnight".into(), counterparty_bank: "Access Bank Plc".into(), counterparty_bic: "ABORNGLA".into(), direction: "borrow".into(), currency: "NGN".into(), principal: 3_000_000_000.0, rate: 11.75, tenor_days: 1, value_date: "2026-05-09".into(), maturity_date: "2026-05-10".into(), status: "active".into(), accrued_interest: 965_753.42, nibss_ref: "NIBSS-IB-2026050901".into() },
        InterbankDeal { id: "IB-003".into(), deal_type: "term_deposit".into(), counterparty_bank: "Zenith Bank Plc".into(), counterparty_bic: "ZELOINGLA".into(), direction: "lend".into(), currency: "NGN".into(), principal: 10_000_000_000.0, rate: 14.25, tenor_days: 30, value_date: "2026-04-15".into(), maturity_date: "2026-05-15".into(), status: "active".into(), accrued_interest: 93_698_630.14, nibss_ref: "NIBSS-IB-2026041501".into() },
        InterbankDeal { id: "IB-004".into(), deal_type: "takeback".into(), counterparty_bank: "GTBank Plc".into(), counterparty_bic: "GTBIINGLA".into(), direction: "borrow".into(), currency: "NGN".into(), principal: 2_000_000_000.0, rate: 13.0, tenor_days: 14, value_date: "2026-04-28".into(), maturity_date: "2026-05-12".into(), status: "matured".into(), accrued_interest: 9_972_602.74, nibss_ref: "NIBSS-IB-2026042801".into() },
        InterbankDeal { id: "IB-005".into(), deal_type: "repo".into(), counterparty_bank: "UBA Plc".into(), counterparty_bic: "UBAINLG0".into(), direction: "lend".into(), currency: "NGN".into(), principal: 7_500_000_000.0, rate: 15.0, tenor_days: 90, value_date: "2026-03-01".into(), maturity_date: "2026-05-30".into(), status: "active".into(), accrued_interest: 215_753_424.66, nibss_ref: "NIBSS-IB-2026030101".into() },
        InterbankDeal { id: "IB-006".into(), deal_type: "call_placement".into(), counterparty_bank: "Stanbic IBTC".into(), counterparty_bic: "SBICNLAG".into(), direction: "lend".into(), currency: "USD".into(), principal: 10_000_000.0, rate: 5.25, tenor_days: 30, value_date: "2026-04-10".into(), maturity_date: "2026-05-10".into(), status: "matured".into(), accrued_interest: 43_150.68, nibss_ref: "NIBSS-IB-2026041001".into() },
    ]
}

struct AppState { deals: Mutex<Vec<InterbankDeal>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}
         

async fn list_deals(data: web::Data<AppState>) -> HttpResponse {
    let d = data.deals.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let d = data.deals.lock().unwrap();
    let total_lent: f64 = d.iter().filter(|x| x.direction == "lend").map(|x| x.principal).sum();
    let total_borrowed: f64 = d.iter().filter(|x| x.direction == "borrow").map(|x| x.principal).sum();
    let net_position = total_lent - total_borrowed;
    let active = d.iter().filter(|x| x.status == "active").count();
    let total_accrued: f64 = d.iter().map(|x| x.accrued_interest).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "total_deals": d.len(), "active_deals": active,
        "total_lent": total_lent, "total_borrowed": total_borrowed,
        "net_position": net_position, "total_accrued_interest": total_accrued,
        "avg_lending_rate": d.iter().filter(|x| x.direction == "lend").map(|x| x.rate).sum::<f64>() / d.iter().filter(|x| x.direction == "lend").count().max(1) as f64
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8166".into()).parse().unwrap_or(8166);
    let data = web::Data::new(AppState { deals: Mutex::new(seed()) });
    println!("Interbank Lending Service running on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/interbank/deals", web::get().to(list_deals))
            .route("/v1/interbank/stats", web::get().to(get_stats))
    }).bind(("0.0.0.0", port))?.run().await
}
