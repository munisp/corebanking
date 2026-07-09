#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::env;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
    rails: Vec<PaymentRail>,
}

#[derive(Clone, Serialize, Deserialize)]
struct PaymentRail {
    id: String,
    name: String,
    rail_type: String,
    corridors: Vec<String>,
    avg_settlement_hours: f64,
    fee_bps: u32,
    min_fee_kobo: i64,
    max_amount_kobo: i64,
    reliability_pct: f64,
    available: bool,
}

#[derive(Deserialize)]
struct RouteRequest {
    from_currency: String,
    to_currency: String,
    amount_kobo: i64,
    priority: Option<String>,
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

fn default_rails() -> Vec<PaymentRail> {
    vec![
        PaymentRail { id: "swift-ng".into(), name: "SWIFT gpi".into(), rail_type: "swift".into(), corridors: vec!["GBP-NGN".into(), "USD-NGN".into(), "EUR-NGN".into()], avg_settlement_hours: 4.0, fee_bps: 50, min_fee_kobo: 200000, max_amount_kobo: 500000000000, reliability_pct: 99.5, available: true },
        PaymentRail { id: "mojaloop-ng".into(), name: "Mojaloop".into(), rail_type: "mojaloop".into(), corridors: vec!["GHS-NGN".into(), "KES-NGN".into(), "ZAR-NGN".into()], avg_settlement_hours: 0.5, fee_bps: 15, min_fee_kobo: 50000, max_amount_kobo: 50000000000, reliability_pct: 97.0, available: true },
        PaymentRail { id: "papss-ng".into(), name: "PAPSS".into(), rail_type: "papss".into(), corridors: vec!["GHS-NGN".into(), "XOF-NGN".into(), "KES-NGN".into()], avg_settlement_hours: 1.0, fee_bps: 20, min_fee_kobo: 100000, max_amount_kobo: 100000000000, reliability_pct: 95.0, available: true },
        PaymentRail { id: "bilateral-uk".into(), name: "UK Bilateral".into(), rail_type: "bilateral".into(), corridors: vec!["GBP-NGN".into()], avg_settlement_hours: 2.0, fee_bps: 30, min_fee_kobo: 150000, max_amount_kobo: 200000000000, reliability_pct: 98.0, available: true },
        PaymentRail { id: "mobile-money".into(), name: "Mobile Money Bridge".into(), rail_type: "mobile_money".into(), corridors: vec!["KES-NGN".into(), "GHS-NGN".into()], avg_settlement_hours: 0.2, fee_bps: 100, min_fee_kobo: 20000, max_amount_kobo: 5000000000, reliability_pct: 92.0, available: true },
    ]
}

async fn load_rails_from_db(db: &tokio_postgres::Client) -> Vec<PaymentRail> {
    if let Ok(rows) = db.query(
        "SELECT id, name, rail_type, corridors, avg_settlement_hours, fee_bps, min_fee_kobo, max_amount_kobo, reliability_pct, available FROM payment_rails WHERE available = true", &[],
    ).await {
        if !rows.is_empty() {
            return rows.iter().map(|row| {
                let corridors_str: String = row.get(3);
                let corridors: Vec<String> = serde_json::from_str(&corridors_str).unwrap_or_default();
                PaymentRail {
                    id: row.get(0), name: row.get(1), rail_type: row.get(2),
                    corridors,
                    avg_settlement_hours: row.get(4), fee_bps: row.get::<_, i32>(5) as u32,
                    min_fee_kobo: row.get(6), max_amount_kobo: row.get(7),
                    reliability_pct: row.get(8), available: row.get(9),
                }
            }).collect();
        }
    }
    Vec::new()
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
                "rail_id": r.id, "rail_name": r.name, "rail_type": r.rail_type,
                "fee_kobo": fee, "fee_pct": fee as f64 / body.amount_kobo as f64 * 100.0,
                "settlement_hours": hours, "reliability_pct": r.reliability_pct, "score": score,
            })
        })
        .collect();

    routes.sort_by(|a, b| b["score"].as_f64().unwrap().partial_cmp(&a["score"].as_f64().unwrap()).unwrap());
    let recommended = routes.first().cloned();

    // Log routing decision to DB
    if let Some(ref db) = state.db {
        let rec_rail = recommended.as_ref().and_then(|r| r["rail_id"].as_str()).unwrap_or("none");
        let _ = db.execute(
            "INSERT INTO routing_decisions (corridor, amount_kobo, priority, recommended_rail, routes_available, decided_at) VALUES ($1, $2, $3, $4, $5, NOW())",
            &[&corridor, &body.amount_kobo, &priority.to_string(), &rec_rail.to_string(), &(routes.len() as i32)],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "corridor": corridor, "amount_kobo": body.amount_kobo, "priority": priority,
        "routes": routes, "recommended": recommended, "total_routes_available": routes.len(),
    }))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "payment-routing-rs", "version": "1.0.0", "database": db_status, "rails_loaded": state.rails.len()}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS payment_rails (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, rail_type TEXT NOT NULL,
                    corridors TEXT NOT NULL DEFAULT '[]', avg_settlement_hours DOUBLE PRECISION NOT NULL,
                    fee_bps INTEGER NOT NULL, min_fee_kobo BIGINT NOT NULL,
                    max_amount_kobo BIGINT NOT NULL, reliability_pct DOUBLE PRECISION NOT NULL,
                    available BOOLEAN NOT NULL DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS routing_decisions (
                    id SERIAL PRIMARY KEY, corridor TEXT NOT NULL, amount_kobo BIGINT NOT NULL,
                    priority TEXT NOT NULL, recommended_rail TEXT NOT NULL,
                    routes_available INTEGER NOT NULL, decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_rd_corridor ON routing_decisions(corridor);",
            ).await;
            eprintln!("[payment-routing-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[payment-routing-rs] DB connect failed: {}", e); None }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9051);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;

    let mut rails = Vec::new();
    if let Some(ref client) = db_client {
        rails = load_rails_from_db(client).await;
    }
    if rails.is_empty() {
        eprintln!("[payment-routing-rs] No rails in DB, using defaults");
        rails = default_rails();
        // Persist defaults to DB for future sessions
        if let Some(ref client) = db_client {
            for r in &rails {
                let corridors_json = serde_json::to_string(&r.corridors).unwrap_or_default();
                let _ = client.execute(
                    "INSERT INTO payment_rails (id, name, rail_type, corridors, avg_settlement_hours, fee_bps, min_fee_kobo, max_amount_kobo, reliability_pct, available) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING",
                    &[&r.id, &r.name, &r.rail_type, &corridors_json, &r.avg_settlement_hours, &(r.fee_bps as i32), &r.min_fee_kobo, &r.max_amount_kobo, &r.reliability_pct, &r.available],
                ).await;
            }
        }
    }

    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
        rails,
    });
    eprintln!("[payment-routing-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/routing/find", web::post().to(find_route))
    }).bind(("0.0.0.0", port))?.run().await
}
