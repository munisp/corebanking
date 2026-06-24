#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;

// Cross-Border Payment Routing Optimizer
// Finds cheapest/fastest path for remittance corridors (UK→NG, US→NG, etc.)
// Rails: SWIFT, Mojaloop, PAPSS, bilateral, mobile money

#[derive(Clone, Serialize, Deserialize)]
struct PaymentRail {
    id: String,
    name: String,
    rail_type: String,  // "swift", "mojaloop", "papss", "bilateral", "mobile_money"
    corridors: Vec<String>,  // e.g., "GBP-NGN", "USD-NGN"
    avg_settlement_hours: f64,
    fee_bps: u32,  // basis points
    min_fee_kobo: i64,
    max_amount_kobo: i64,
    reliability_pct: f64,
    available: bool,
}

struct AppState {
    rails: Vec<PaymentRail>,
}

#[derive(Deserialize)]
struct RouteRequest {
    from_currency: String,
    to_currency: String,
    amount_kobo: i64,
    priority: Option<String>,  // "speed", "cost", "reliability"
    max_settlement_hours: Option<f64>,
}

fn score_rail(rail: &PaymentRail, amount_kobo: i64, priority: &str) -> (f64, i64, f64) {
    let fee = std::cmp::max(rail.min_fee_kobo, (amount_kobo * rail.fee_bps as i64) / 10000);
    let speed_score = 1.0 / (1.0 + rail.avg_settlement_hours);
    let cost_score = 1.0 / (1.0 + fee as f64 / amount_kobo as f64);
    let reliability_score = rail.reliability_pct / 100.0;
    
    let composite = match priority {
        "speed" => speed_score * 0.6 + cost_score * 0.2 + reliability_score * 0.2,
        "cost" => speed_score * 0.2 + cost_score * 0.6 + reliability_score * 0.2,
        "reliability" => speed_score * 0.2 + cost_score * 0.2 + reliability_score * 0.6,
        _ => speed_score * 0.33 + cost_score * 0.34 + reliability_score * 0.33,
    };
    (composite, fee, rail.avg_settlement_hours)
}

async fn find_route(body: web::Json<RouteRequest>, state: web::Data<AppState>) -> HttpResponse {
    let corridor = format!("{}-{}", body.from_currency, body.to_currency);
    let priority = body.priority.as_deref().unwrap_or("balanced");
    
    let mut routes: Vec<serde_json::Value> = state.rails.iter()
        .filter(|r| r.available && r.corridors.contains(&corridor) && body.amount_kobo <= r.max_amount_kobo)
        .filter(|r| body.max_settlement_hours.map_or(true, |max| r.avg_settlement_hours <= max))
        .map(|r| {
            let (score, fee, hours) = score_rail(r, body.amount_kobo, priority);
            json!({
                "rail_id": r.id,
                "rail_name": r.name,
                "rail_type": r.rail_type,
                "fee_kobo": fee,
                "fee_pct": fee as f64 / body.amount_kobo as f64 * 100.0,
                "settlement_hours": hours,
                "reliability_pct": r.reliability_pct,
                "score": score,
            })
        })
        .collect();
    
    routes.sort_by(|a, b| b["score"].as_f64().unwrap().partial_cmp(&a["score"].as_f64().unwrap()).unwrap());
    
    let recommended = routes.first().cloned();
    
    HttpResponse::Ok().json(json!({
        "corridor": corridor,
        "amount_kobo": body.amount_kobo,
        "priority": priority,
        "routes": routes,
        "recommended": recommended,
        "total_routes_available": routes.len(),
    }))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "payment-routing-rs", "version": "1.0.0"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9051);
    let state = web::Data::new(AppState {
        rails: vec![
            PaymentRail { id: "swift-ng".into(), name: "SWIFT gpi".into(), rail_type: "swift".into(), corridors: vec!["GBP-NGN".into(), "USD-NGN".into(), "EUR-NGN".into()], avg_settlement_hours: 4.0, fee_bps: 50, min_fee_kobo: 200000, max_amount_kobo: 500000000000, reliability_pct: 99.5, available: true },
            PaymentRail { id: "mojaloop-ng".into(), name: "Mojaloop".into(), rail_type: "mojaloop".into(), corridors: vec!["GHS-NGN".into(), "KES-NGN".into(), "ZAR-NGN".into()], avg_settlement_hours: 0.5, fee_bps: 15, min_fee_kobo: 50000, max_amount_kobo: 50000000000, reliability_pct: 97.0, available: true },
            PaymentRail { id: "papss-ng".into(), name: "PAPSS".into(), rail_type: "papss".into(), corridors: vec!["GHS-NGN".into(), "XOF-NGN".into(), "KES-NGN".into()], avg_settlement_hours: 1.0, fee_bps: 20, min_fee_kobo: 100000, max_amount_kobo: 100000000000, reliability_pct: 95.0, available: true },
            PaymentRail { id: "bilateral-uk".into(), name: "UK Bilateral".into(), rail_type: "bilateral".into(), corridors: vec!["GBP-NGN".into()], avg_settlement_hours: 2.0, fee_bps: 30, min_fee_kobo: 150000, max_amount_kobo: 200000000000, reliability_pct: 98.0, available: true },
            PaymentRail { id: "mobile-money".into(), name: "Mobile Money Bridge".into(), rail_type: "mobile_money".into(), corridors: vec!["KES-NGN".into(), "GHS-NGN".into()], avg_settlement_hours: 0.2, fee_bps: 100, min_fee_kobo: 20000, max_amount_kobo: 5000000000, reliability_pct: 92.0, available: true },
        ],
    });
    eprintln!("[payment-routing-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/routing/find", web::post().to(find_route))
    }).bind(("0.0.0.0", port))?.run().await
}
