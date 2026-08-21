use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

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

struct AppState { db: Option<PgPool> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

// FATCA/CRS regulatory reports must come from the reporting database.
// Never fabricate filings: if the DB is unreachable or the query fails, fail fast (503).
async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let pool = match &data.db {
        Some(p) => p,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve fabricated FATCA/CRS reports"),
    };
    let rows = sqlx::query(
        r#"SELECT id, report_type, reporting_year, jurisdiction, accounts_reported,
                  total_balance, currency, filing_deadline, status
           FROM fatca_crs_reports ORDER BY id"#,
    )
    .fetch_all(pool)
    .await;
    match rows {
        Ok(rows) => {
            let items: Vec<FATCAReport> = rows
                .iter()
                .map(|r| FATCAReport {
                    id: r.get("id"),
                    report_type: r.get("report_type"),
                    reporting_year: r.get("reporting_year"),
                    jurisdiction: r.get("jurisdiction"),
                    accounts_reported: r.get::<i32, _>("accounts_reported") as u32,
                    total_balance: r.get("total_balance"),
                    currency: r.get("currency"),
                    filing_deadline: r.get("filing_deadline"),
                    status: r.get("status"),
                })
                .collect();
            HttpResponse::Ok().json(serde_json::json!({ "items": items, "total": items.len() }))
        }
        Err(e) => {
            eprintln!("[fatca-crs-rs] report query failed: {}", e);
            source_unavailable("fatca_crs_reports query failed; no data served")
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8188".into()).parse().unwrap_or(8188);
    let _ = mw(); // middleware endpoints are environment-derived config display only
    let db = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    eprintln!("[fatca-crs-rs] DB connect failed: {} — reports will 503 (fail-fast)", e);
                    None
                }
            }
        }
        _ => {
            eprintln!("[fatca-crs-rs] DATABASE_URL not set — reports will 503 (fail-fast)");
            None
        }
    };
    let data = web::Data::new(AppState { db });
    println!("FATCA/CRS Compliance Service running on port {}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/fatca-crs-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}
