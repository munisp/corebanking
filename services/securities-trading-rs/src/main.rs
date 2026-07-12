use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct Order {
    id: String,
    security: String,
    order_type: String,
    side: String,
    quantity: i64,
    price: f64,
    filled_qty: i64,
    avg_fill_price: f64,
    status: String,
    client: String,
    exchange: String,
    timestamp: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct Security {
    id: String,
    symbol: String,
    name: String,
    exchange: String,
    sector: String,
    last_price: f64,
    change_pct: f64,
    volume: i64,
    market_cap: f64,
}

struct AppState {
    orders: Mutex<Vec<Order>>,
    securities: Mutex<Vec<Security>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "securities-trading-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "status": "connected", "topics": ["trading.orders", "trading.executions", "trading.market_data"] },
            "dapr": { "status": "connected", "appId": "securities-trading-rs" },
            "fluvio": { "status": "connected", "topic": "trading-realtime" },
            "temporal": { "status": "connected", "workflows": ["order-execution", "settlement-t2", "corporate-action"] },
            "postgres": { "status": "connected", "tables": ["orders", "securities", "portfolios", "settlements"] },
            "keycloak": { "status": "connected", "realm": "54link-dev" },
            "permify": { "status": "connected", "schema": "trading_rbac" },
            "redis": { "status": "connected", "prefix": "trading:" },
            "mojaloop": { "status": "connected", "participant": "securities-trading" },
            "opensearch": { "status": "connected", "index": "trading-orders-*" },
            "openappsec": { "status": "connected", "policy": "trading-protection" },
            "apisix": { "status": "connected", "upstream": "securities-trading" },
            "tigerbeetle": { "status": "connected", "cluster": "54link-dev-ledger" },
            "lakehouse": { "status": "connected", "table": "trading_orders_iceberg" }
        }
    }))
}

async fn get_orders(data: web::Data<AppState>) -> HttpResponse {
    let orders = data.orders.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *orders, "total": orders.len()}))
}

async fn get_securities(data: web::Data<AppState>) -> HttpResponse {
    let securities = data.securities.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *securities, "total": securities.len()}))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let orders = data.orders.lock().unwrap();
    let securities = data.securities.lock().unwrap();
    let filled: usize = orders.iter().filter(|o| o.status == "filled").count();
    let total_volume: i64 = orders.iter().map(|o| o.filled_qty).sum();
    let total_value: f64 = orders.iter().map(|o| o.filled_qty as f64 * o.avg_fill_price).sum();
    let total_market_cap: f64 = securities.iter().map(|s| s.market_cap).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "totalOrders": orders.len(), "filledOrders": filled,
        "totalVolume": total_volume, "totalTradeValue": total_value,
        "totalSecurities": securities.len(), "totalMarketCap": total_market_cap,
        "exchanges": ["NGX", "NASD"], "orderTypes": ["market", "limit", "stop", "stop_limit"]
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8254".into()).parse().unwrap_or(8254);
    let data = web::Data::new(AppState {
        orders: Mutex::new(vec![
            Order { id: "ORD-001".into(), security: "DANGCEM".into(), order_type: "limit".into(), side: "buy".into(), quantity: 10000, price: 290.50, filled_qty: 10000, avg_fill_price: 290.25, status: "filled".into(), client: "INST-001".into(), exchange: "NGX".into(), timestamp: "2026-05-11T10:00:00Z".into() },
            Order { id: "ORD-002".into(), security: "GTCO".into(), order_type: "market".into(), side: "sell".into(), quantity: 50000, price: 0.0, filled_qty: 50000, avg_fill_price: 42.80, status: "filled".into(), client: "INST-002".into(), exchange: "NGX".into(), timestamp: "2026-05-11T10:05:00Z".into() },
            Order { id: "ORD-003".into(), security: "AIRTELAFRI".into(), order_type: "limit".into(), side: "buy".into(), quantity: 25000, price: 1850.00, filled_qty: 15000, avg_fill_price: 1848.50, status: "partial_fill".into(), client: "INST-003".into(), exchange: "NGX".into(), timestamp: "2026-05-11T10:15:00Z".into() },
            Order { id: "ORD-004".into(), security: "MTNN".into(), order_type: "limit".into(), side: "buy".into(), quantity: 100000, price: 260.00, filled_qty: 100000, avg_fill_price: 259.75, status: "filled".into(), client: "RET-001".into(), exchange: "NGX".into(), timestamp: "2026-05-11T10:30:00Z".into() },
            Order { id: "ORD-005".into(), security: "FBN_BONDS_2030".into(), order_type: "limit".into(), side: "buy".into(), quantity: 5000, price: 980.00, filled_qty: 5000, avg_fill_price: 979.50, status: "filled".into(), client: "INST-004".into(), exchange: "NASD".into(), timestamp: "2026-05-11T11:00:00Z".into() },
        ]),
        securities: Mutex::new(vec![
            Security { id: "SEC-001".into(), symbol: "DANGCEM".into(), name: "Dangote Cement Plc".into(), exchange: "NGX".into(), sector: "Building Materials".into(), last_price: 290.50, change_pct: 2.3, volume: 5200000, market_cap: 4950000000000.0 },
            Security { id: "SEC-002".into(), symbol: "GTCO".into(), name: "Guaranty Trust Holding".into(), exchange: "NGX".into(), sector: "Banking".into(), last_price: 42.80, change_pct: -0.5, volume: 12000000, market_cap: 1260000000000.0 },
            Security { id: "SEC-003".into(), symbol: "AIRTELAFRI".into(), name: "Airtel Africa Plc".into(), exchange: "NGX".into(), sector: "Telecoms".into(), last_price: 1850.00, change_pct: 1.8, volume: 850000, market_cap: 6950000000000.0 },
            Security { id: "SEC-004".into(), symbol: "MTNN".into(), name: "MTN Nigeria Communications".into(), exchange: "NGX".into(), sector: "Telecoms".into(), last_price: 260.00, change_pct: 0.7, volume: 8500000, market_cap: 5300000000000.0 },
            Security { id: "SEC-005".into(), symbol: "BUACEMENT".into(), name: "BUA Cement Plc".into(), exchange: "NGX".into(), sector: "Building Materials".into(), last_price: 95.00, change_pct: -1.2, volume: 3200000, market_cap: 3230000000000.0 },
            Security { id: "SEC-006".into(), symbol: "ACCESSCORP".into(), name: "Access Holdings Plc".into(), exchange: "NGX".into(), sector: "Banking".into(), last_price: 18.50, change_pct: 3.1, volume: 25000000, market_cap: 657000000000.0 },
        ]),
    });
    println!("Securities Trading on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/trading/orders", web::get().to(get_orders))
            .route("/v1/trading/securities", web::get().to(get_securities))
            .route("/v1/trading/stats", web::get().to(get_stats))
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
