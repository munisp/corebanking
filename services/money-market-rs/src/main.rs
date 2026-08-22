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

fn middleware_config() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set - refusing to boot with default database credentials"),
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
struct Deal {
    id: String,
    deal_type: String, // placement, borrowing, call_deposit, repo, reverse_repo, cp, cd
    counterparty: String,
    counterparty_id: String,
    currency: String,
    principal: f64,
    rate: f64,
    tenor_days: u32,
    start_date: String,
    maturity_date: String,
    interest_amount: f64,
    maturity_amount: f64,
    day_count_basis: String, // ACT/360, ACT/365, 30/360
    status: String, // active, matured, rolled_over, cancelled
    settlement_account: String,
    booking_date: String,
    rollover_count: u32,
    collateral_type: Option<String>,
    repo_security: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct InterestCalc {
    principal: f64,
    rate: f64,
    tenor_days: u32,
    day_count_basis: String,
}

#[derive(Deserialize)]
struct DealRequest {
    deal_type: String,
    counterparty: String,
    principal: f64,
    rate: f64,
    tenor_days: u32,
    day_count_basis: Option<String>,
    collateral_type: Option<String>,
    repo_security: Option<String>,
}

struct AppState {
    deals: Mutex<Vec<Deal>>,
}

fn calc_interest(principal: f64, rate: f64, days: u32, basis: &str) -> f64 {
    let year_days: f64 = match basis {
        "ACT/365" | "act/365" => 365.0,
        "30/360" => 360.0,
        _ => 360.0, // ACT/360 default
    };
    (principal * (rate / 100.0) * days as f64 / year_days * 100.0).round() / 100.0
}

fn seed_deals() -> Vec<Deal> {
    let deals = vec![
        ("MM-001", "placement", "First Bank of Nigeria", "FBN-001", 5_000_000_000.0, 14.50, 90, "2026-04-01", "2026-06-30", "ACT/360", "active", "NGN-SETTLE-001", 0, None, None),
        ("MM-002", "borrowing", "Central Bank of Nigeria", "CBN-001", 20_000_000_000.0, 18.75, 30, "2026-05-01", "2026-05-31", "ACT/360", "active", "NGN-SETTLE-002", 0, None, None),
        ("MM-003", "call_deposit", "Zenith Bank PLC", "ZBP-001", 2_000_000_000.0, 12.00, 7, "2026-05-05", "2026-05-12", "ACT/360", "matured", "NGN-SETTLE-003", 0, None, None),
        ("MM-004", "repo", "Access Bank PLC", "ABP-001", 10_000_000_000.0, 16.25, 14, "2026-05-01", "2026-05-15", "ACT/360", "active", "NGN-SETTLE-004", 0, Some("FGN_BOND".into()), Some("FGN-2030-12.5%".into())),
        ("MM-005", "reverse_repo", "GTBank PLC", "GTB-001", 8_000_000_000.0, 15.50, 28, "2026-04-15", "2026-05-13", "ACT/360", "matured", "NGN-SETTLE-005", 1, Some("TBILL".into()), Some("NTB-91DAY-2026Q2".into())),
        ("MM-006", "cp", "Dangote Industries Ltd", "DGL-001", 15_000_000_000.0, 13.75, 180, "2026-03-01", "2026-08-28", "ACT/360", "active", "NGN-SETTLE-006", 0, None, None),
        ("MM-007", "cd", "54link-dev Treasury", "54B-TSY", 3_000_000_000.0, 11.50, 365, "2026-01-15", "2027-01-15", "ACT/365", "active", "NGN-SETTLE-007", 0, None, None),
        ("MM-008", "placement", "United Bank for Africa", "UBA-001", 7_500_000_000.0, 15.00, 60, "2026-04-20", "2026-06-19", "ACT/360", "active", "NGN-SETTLE-008", 0, None, None),
    ];
    deals.into_iter().map(|(id,dt,cp,cpid,p,r,t,sd,md,dcb,st,sa,rc,ct,rs)| {
        let interest = calc_interest(p, r, t, dcb);
        Deal {
            id: id.into(), deal_type: dt.into(), counterparty: cp.into(), counterparty_id: cpid.into(),
            currency: "NGN".into(), principal: p, rate: r, tenor_days: t, start_date: sd.into(),
            maturity_date: md.into(), interest_amount: interest, maturity_amount: p + interest,
            day_count_basis: dcb.into(), status: st.into(), settlement_account: sa.into(),
            booking_date: sd.into(), rollover_count: rc,
            collateral_type: ct, repo_security: rs,
        }
    }).collect()
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok", "service": "money-market-rs"}))
}

async fn list_deals(data: web::Data<AppState>) -> HttpResponse {
    let deals = data.deals.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *deals, "total": deals.len() }))
}

async fn create_deal(body: web::Json<DealRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    let valid_types = ["placement", "borrowing", "call_deposit", "repo", "reverse_repo", "cp", "cd"];
    if !valid_types.contains(&req.deal_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("deal_type must be one of: {}", valid_types.join(", "))
        }));
    }
    if req.principal <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "principal must be positive"}));
    }
    if req.rate <= 0.0 || req.rate > 100.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "rate must be between 0 and 100"}));
    }
    if req.tenor_days == 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "tenor_days must be > 0"}));
    }
    if (req.deal_type == "repo" || req.deal_type == "reverse_repo") && req.repo_security.is_none() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "repo/reverse_repo requires repo_security"}));
    }
    let basis = req.day_count_basis.unwrap_or_else(|| "ACT/360".into());
    let interest = calc_interest(req.principal, req.rate, req.tenor_days, &basis);
    let mut deals = data.deals.lock().unwrap();
    let deal = Deal {
        id: format!("MM-{:03}", deals.len() + 1),
        deal_type: req.deal_type, counterparty: req.counterparty, counterparty_id: "NEW".into(),
        currency: "NGN".into(), principal: req.principal, rate: req.rate, tenor_days: req.tenor_days,
        start_date: "2026-05-10".into(), maturity_date: "TBD".into(), interest_amount: interest,
        maturity_amount: req.principal + interest, day_count_basis: basis,
        status: "active".into(), settlement_account: "NGN-SETTLE-NEW".into(),
        booking_date: "2026-05-10".into(), rollover_count: 0,
        collateral_type: req.collateral_type, repo_security: req.repo_security,
    };
    deals.push(deal.clone());
    HttpResponse::Created().json(deal)
}

async fn calculate_interest(body: web::Json<InterestCalc>) -> HttpResponse {
    let req = body.into_inner();
    if req.principal <= 0.0 || req.rate <= 0.0 || req.tenor_days == 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "principal, rate, tenor_days must all be positive"}));
    }
    let interest = calc_interest(req.principal, req.rate, req.tenor_days, &req.day_count_basis);
    HttpResponse::Ok().json(serde_json::json!({
        "principal": req.principal, "rate": req.rate, "tenor_days": req.tenor_days,
        "day_count_basis": req.day_count_basis, "interest": interest,
        "maturity_amount": req.principal + interest
    }))
}

async fn stats(data: web::Data<AppState>) -> HttpResponse {
    let deals = data.deals.lock().unwrap();
    let active: Vec<&Deal> = deals.iter().filter(|d| d.status == "active").collect();
    let total_placements: f64 = active.iter().filter(|d| d.deal_type == "placement").map(|d| d.principal).sum();
    let total_borrowings: f64 = active.iter().filter(|d| d.deal_type == "borrowing").map(|d| d.principal).sum();
    let total_repos: f64 = active.iter().filter(|d| d.deal_type == "repo" || d.deal_type == "reverse_repo").map(|d| d.principal).sum();
    let avg_rate = if active.is_empty() { 0.0 } else {
        (active.iter().map(|d| d.rate).sum::<f64>() / active.len() as f64 * 100.0).round() / 100.0
    };
    HttpResponse::Ok().json(serde_json::json!({
        "totalDeals": deals.len(), "activeDeals": active.len(),
        "totalPlacements": total_placements, "totalBorrowings": total_borrowings,
        "totalRepos": total_repos, "avgRate": avg_rate,
        "netPosition": total_placements - total_borrowings,
        "byType": {
            "placement": deals.iter().filter(|d| d.deal_type == "placement").count(),
            "borrowing": deals.iter().filter(|d| d.deal_type == "borrowing").count(),
            "call_deposit": deals.iter().filter(|d| d.deal_type == "call_deposit").count(),
            "repo": deals.iter().filter(|d| d.deal_type == "repo").count(),
            "reverse_repo": deals.iter().filter(|d| d.deal_type == "reverse_repo").count(),
            "cp": deals.iter().filter(|d| d.deal_type == "cp").count(),
            "cd": deals.iter().filter(|d| d.deal_type == "cd").count(),
        }
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let state = web::Data::new(AppState { deals: Mutex::new(seed_deals()) });
    println!("Money Market service on :8156");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/money-market/deals", web::get().to(list_deals))
            .route("/v1/money-market/deals", web::post().to(create_deal))
            .route("/v1/money-market/calculate", web::post().to(calculate_interest))
            .route("/v1/money-market/stats", web::get().to(stats))
    })
    .bind("0.0.0.0:8156")?
    .run()
    .await
}
