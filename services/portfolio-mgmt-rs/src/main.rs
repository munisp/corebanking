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
        postgres_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()
        }),
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
struct Portfolio {
    id: String,
    portfolio_name: String,
    client_name: String,
    client_id: String,
    portfolio_type: String,
    currency: String,
    total_aum: f64,
    asset_allocation: Vec<AssetAlloc>,
    benchmark: String,
    ytd_return: f64,
    risk_score: f64,
    inception_date: String,
    status: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct AssetAlloc {
    asset_class: String,
    weight: f64,
    value: f64,
}

fn seed() -> Vec<Portfolio> {
    vec![
        Portfolio {
            id: "PF-001".into(),
            portfolio_name: "Conservative Income Fund".into(),
            client_name: "Dangote Industries Ltd".into(),
            client_id: "C-001".into(),
            portfolio_type: "institutional".into(),
            currency: "NGN".into(),
            total_aum: 50_000_000_000.0,
            asset_allocation: vec![
                AssetAlloc { asset_class: "fgn_bonds".into(), weight: 45.0, value: 22_500_000_000.0 },
                AssetAlloc { asset_class: "treasury_bills".into(), weight: 30.0, value: 15_000_000_000.0 },
                AssetAlloc { asset_class: "money_market".into(), weight: 15.0, value: 7_500_000_000.0 },
                AssetAlloc { asset_class: "equities".into(), weight: 10.0, value: 5_000_000_000.0 },
            ],
            benchmark: "S&P/FMDQ Nigerian Bond Index".into(),
            ytd_return: 8.75,
            risk_score: 3.2,
            inception_date: "2023-01-15".into(),
            status: "active".into(),
        }
    ]
}

struct AppState {
    portfolios: Mutex<Vec<Portfolio>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "portfolio-mgmt-rs",
        "status": "ok",
        "version": "1.0.0"
    }))
}

async fn list_portfolios(data: web::Data<AppState>) -> HttpResponse {
    let p = match data.portfolios.lock() {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::InternalServerError().json(
                serde_json::json!({ "error": "failed to acquire lock" })
            );
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "items": *p,
        "total": p.len()
    }))
}

async fn get_performance(data: web::Data<AppState>) -> HttpResponse {
    let p = match data.portfolios.lock() {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::InternalServerError().json(
                serde_json::json!({ "error": "failed to acquire lock" })
            );
        }
    };

    let total_aum: f64 = p.iter().map(|x| x.total_aum).sum();
    let avg_return = if p.is_empty() {
        0.0
    } else {
        p.iter().map(|x| x.ytd_return).sum::<f64>() / p.len() as f64
    };

    let avg_risk = if p.is_empty() {
        0.0
    } else {
        p.iter().map(|x| x.risk_score).sum::<f64>() / p.len() as f64
    };

    let sharpe_ratio = if avg_risk == 0.0 {
        0.0
    } else {
        (avg_return - 5.0) / avg_risk
    };

    HttpResponse::Ok().json(serde_json::json!({
        "total_aum": total_aum,
        "portfolio_count": p.len(),
        "avg_ytd_return": (avg_return * 100.0).round() / 100.0,
        "avg_risk_score": (avg_risk * 100.0).round() / 100.0,
        "sharpe_ratio": (sharpe_ratio * 100.0).round() / 100.0
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8167".into())
        .parse()
        .unwrap_or(8167);

    let data = web::Data::new(AppState {
        portfolios: Mutex::new(seed()),
    });

    println!("Portfolio Management Service running on port {}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/portfolios", web::get().to(list_portfolios))
            .route("/v1/portfolios/performance", web::get().to(get_performance))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}