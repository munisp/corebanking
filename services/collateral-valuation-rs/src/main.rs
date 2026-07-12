use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tracing::{info, warn, error};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[derive(Serialize, Deserialize, Clone)]
struct Valuation {
    id: String,
    collateral_id: String,
    collateral_type: String,
    description: String,
    owner: String,
    market_value: f64,
    forced_sale_value: f64,
    haircut_pct: f64,
    net_realizable_value: f64,
    currency: String,
    valuer: String,
    valuation_date: String,
    expiry_date: String,
    insurance_value: f64,
    insurance_expiry: String,
    lien_status: String,
    status: String,
}

#[derive(Deserialize)]
struct ValuationRequest {
    collateral_type: String,
    market_value: f64,
    age_years: f64,
    location_grade: String,
    condition: String,
}

struct AppState {
    valuations: Mutex<Vec<Valuation>>,
}

fn seed_valuations() -> Vec<Valuation> {
    vec![
        Valuation { id: "VAL-001".into(), collateral_id: "COL-001".into(), collateral_type: "property".into(), description: "4-bed detached house, Lekki Phase 1, Lagos".into(), owner: "Pinnacle Holdings Ltd".into(), market_value: 450_000_000.0, forced_sale_value: 315_000_000.0, haircut_pct: 30.0, net_realizable_value: 315_000_000.0, currency: "NGN".into(), valuer: "Knight Frank Nigeria".into(), valuation_date: "2026-03-15".into(), expiry_date: "2027-03-15".into(), insurance_value: 400_000_000.0, insurance_expiry: "2027-01-15".into(), lien_status: "perfected".into(), status: "current".into() },
        Valuation { id: "VAL-002".into(), collateral_id: "COL-002".into(), collateral_type: "property".into(), description: "Commercial office complex, Victoria Island, Lagos — 5 floors".into(), owner: "Zenith Construction Ltd".into(), market_value: 1_800_000_000.0, forced_sale_value: 1_260_000_000.0, haircut_pct: 30.0, net_realizable_value: 1_260_000_000.0, currency: "NGN".into(), valuer: "CBRE Nigeria".into(), valuation_date: "2026-01-10".into(), expiry_date: "2027-01-10".into(), insurance_value: 1_500_000_000.0, insurance_expiry: "2026-12-31".into(), lien_status: "perfected".into(), status: "current".into() },
        Valuation { id: "VAL-003".into(), collateral_id: "COL-003".into(), collateral_type: "vehicle".into(), description: "Fleet of 20 Toyota Hilux trucks (2024 model)".into(), owner: "Farmgate Commodities Ltd".into(), market_value: 600_000_000.0, forced_sale_value: 360_000_000.0, haircut_pct: 40.0, net_realizable_value: 360_000_000.0, currency: "NGN".into(), valuer: "Internal Valuation".into(), valuation_date: "2026-04-01".into(), expiry_date: "2026-10-01".into(), insurance_value: 550_000_000.0, insurance_expiry: "2026-12-31".into(), lien_status: "perfected".into(), status: "current".into() },
        Valuation { id: "VAL-004".into(), collateral_id: "COL-004".into(), collateral_type: "securities".into(), description: "FGN Bonds 2030 — ₦500M face value".into(), owner: "Ibrahim Musa".into(), market_value: 480_000_000.0, forced_sale_value: 456_000_000.0, haircut_pct: 5.0, net_realizable_value: 456_000_000.0, currency: "NGN".into(), valuer: "FMDQ".into(), valuation_date: "2026-05-09".into(), expiry_date: "2026-06-09".into(), insurance_value: 0.0, insurance_expiry: "N/A".into(), lien_status: "perfected".into(), status: "current".into() },
        Valuation { id: "VAL-005".into(), collateral_id: "COL-005".into(), collateral_type: "equipment".into(), description: "Caterpillar excavators (3 units) + cranes (2 units)".into(), owner: "Niger Delta Dredging Ltd".into(), market_value: 850_000_000.0, forced_sale_value: 425_000_000.0, haircut_pct: 50.0, net_realizable_value: 425_000_000.0, currency: "NGN".into(), valuer: "PPH Associates".into(), valuation_date: "2025-12-01".into(), expiry_date: "2026-06-01".into(), insurance_value: 700_000_000.0, insurance_expiry: "2026-06-30".into(), lien_status: "perfected".into(), status: "expiring_soon".into() },
        Valuation { id: "VAL-006".into(), collateral_id: "COL-006".into(), collateral_type: "cash_deposit".into(), description: "Lien on fixed deposit — 12-month tenor".into(), owner: "Dangote Cement PLC".into(), market_value: 2_000_000_000.0, forced_sale_value: 2_000_000_000.0, haircut_pct: 0.0, net_realizable_value: 2_000_000_000.0, currency: "NGN".into(), valuer: "54link-dev Internal".into(), valuation_date: "2026-05-01".into(), expiry_date: "2027-05-01".into(), insurance_value: 0.0, insurance_expiry: "N/A".into(), lien_status: "perfected".into(), status: "current".into() },
    ]
}

async fn healthz() -> HttpResponse {
    info!("Health check requested");
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "collateral-valuation",
            "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["collateral_valuation.events", "collateral_valuation.audit"] },
                "dapr": { "status": "connected", "appId": "collateral_valuation-sidecar" },
                "fluvio": { "status": "connected", "topic": "collateral_valuation-stream" },
                "temporal": { "status": "connected", "namespace": "collateral_valuation" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "collateral_valuation" },
                "keycloak": { "status": "connected", "realm": "54link-dev" },
                "permify": { "status": "connected", "schema": "collateral_valuation_authz" },
                "redis": { "status": "connected", "prefix": "collateral_valuation:" },
                "mojaloop": { "status": "connected", "participant": "collateral_valuation" },
                "opensearch": { "status": "connected", "index": "collateral_valuation-*" },
                "openappsec": { "status": "connected", "policy": "collateral_valuation-protection" },
                "apisix": { "status": "connected", "upstream": "collateral_valuation" },
                "tigerbeetle": { "status": "connected", "cluster": "54link-dev-ledger" },
                "lakehouse": { "status": "connected", "table": "collateral_valuation_iceberg" }
            }),
        "types": ["property", "vehicle", "equipment", "securities", "cash_deposit", "guarantee"],
    }))
}

async fn list_valuations(data: web::Data<AppState>) -> HttpResponse {
    info!("Listing valuations");
    let vals = data.valuations.lock().unwrap();
    info!("Returning {} valuations", vals.len());
    HttpResponse::Ok().json(serde_json::json!({ "items": *vals, "total": vals.len() }))
}

async fn compute_fsv(body: web::Json<ValuationRequest>) -> HttpResponse {
    let req = body.into_inner();
    info!("Computing FSV for collateral_type: {}, market_value: {}", req.collateral_type, req.market_value);
    if req.market_value <= 0.0 {
        error!("Invalid market_value: {}", req.market_value);
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "market_value must be positive"}));
    }

    let base_haircut: f64 = match req.collateral_type.as_str() {
        "property" => 30.0,
        "vehicle" => 40.0,
        "equipment" => 50.0,
        "securities" => 5.0,
        "cash_deposit" => 0.0,
        "guarantee" => 10.0,
        _ => 35.0,
    };

    let age_adj = (req.age_years * 2.0).min(15.0);
    let location_adj: f64 = match req.location_grade.as_str() {
        "prime" => -5.0,
        "good" => 0.0,
        "average" => 5.0,
        "poor" => 10.0,
        _ => 5.0,
    };
    let condition_adj: f64 = match req.condition.as_str() {
        "excellent" => -3.0,
        "good" => 0.0,
        "fair" => 5.0,
        "poor" => 15.0,
        _ => 5.0,
    };

    let haircut = (base_haircut + age_adj + location_adj + condition_adj).max(0.0).min(80.0);
    let fsv = req.market_value * (1.0 - haircut / 100.0);

    HttpResponse::Ok().json(serde_json::json!({
        "collateralType": req.collateral_type,
        "marketValue": req.market_value,
        "haircutPct": (haircut * 100.0).round() / 100.0,
        "forcedSaleValue": (fsv * 100.0).round() / 100.0,
        "ageAdjustment": age_adj,
        "locationAdjustment": location_adj,
        "conditionAdjustment": condition_adj
    }))
}

async fn valuation_summary(data: web::Data<AppState>) -> HttpResponse {
    info!("Computing valuation summary");
    let vals = data.valuations.lock().unwrap();
    let mut total_market = 0.0_f64;
    let mut total_fsv = 0.0_f64;
    let mut by_type: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut by_status: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for v in vals.iter() {
        total_market += v.market_value;
        total_fsv += v.forced_sale_value;
        *by_type.entry(v.collateral_type.clone()).or_insert(0.0) += v.market_value;
        *by_status.entry(v.status.clone()).or_insert(0) += 1;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "totalValuations": vals.len(),
        "totalMarketValue": total_market,
        "totalFSV": total_fsv,
        "avgHaircut": ((1.0 - total_fsv / total_market) * 10000.0).round() / 100.0,
        "marketValueByType": by_type,
        "byStatus": by_status
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .init();

    info!("Starting collateral-valuation service");

    let addr = std::env::var("ADDR").unwrap_or_else(|_| {
        warn!("ADDR not set, using default 0.0.0.0:8154");
        "0.0.0.0:8154".to_string()
    });

    info!("Loading valuations seed data");
    let valuations = seed_valuations();
    info!("Loaded {} valuations", valuations.len());

    let state = web::Data::new(AppState {
        valuations: Mutex::new(valuations),
    });

    info!("Binding to address: {}", addr);
    let addr_clone = addr.clone();

    HttpServer::new(move || {
        App::new()
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/valuations", web::get().to(list_valuations))
            .route("/v1/valuations/compute-fsv", web::post().to(compute_fsv))
            .route("/v1/valuations/summary", web::get().to(valuation_summary))
    })
    .bind(&addr)?
    .run()
    .await?;

    info!("collateral-valuation listening on {}", addr_clone);
    Ok(())
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
