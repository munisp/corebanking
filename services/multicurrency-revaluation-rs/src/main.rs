use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "fx.revaluation-completed,fx.rate-updated,fx.position-changed"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "rate-cache,position-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "fx_rates,fx_positions,fx_revaluations,currency_accounts"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "fx-revaluation-history"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev", "role": "treasury-officer"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "fx:revalue,fx:override-rate,fx:close-position"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "fx-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "fx-rate-feed"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "FXRevaluationBatchWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "cross-border-fx-settlement"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "fx-pnl-double-entry"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "fx_rate_history,revaluation_pnl"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/fx/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "fx-trading-protection"}
    })
}

fn seed_data() -> serde_json::Value {
    serde_json::json!({
        "currencies": [
            {"code": "NGN", "name": "Nigerian Naira", "type": "local", "decimalPlaces": 2, "isBaseCurrency": true},
            {"code": "USD", "name": "US Dollar", "type": "major", "decimalPlaces": 2, "isBaseCurrency": false},
            {"code": "GBP", "name": "British Pound", "type": "major", "decimalPlaces": 2, "isBaseCurrency": false},
            {"code": "EUR", "name": "Euro", "type": "major", "decimalPlaces": 2, "isBaseCurrency": false},
            {"code": "CNY", "name": "Chinese Yuan", "type": "emerging", "decimalPlaces": 2, "isBaseCurrency": false},
            {"code": "XAF", "name": "CFA Franc", "type": "regional", "decimalPlaces": 0, "isBaseCurrency": false},
            {"code": "GHS", "name": "Ghanaian Cedi", "type": "regional", "decimalPlaces": 2, "isBaseCurrency": false},
        ],
        "rates": [
            {"pair": "USD/NGN", "bidRate": 1580.00, "askRate": 1585.00, "midRate": 1582.50, "cbnRate": 1550.00, "previousClose": 1575.00, "source": "NAFEM", "updatedAt": "2026-05-10T16:00:00Z"},
            {"pair": "GBP/NGN", "bidRate": 1990.00, "askRate": 1998.00, "midRate": 1994.00, "cbnRate": 1960.00, "previousClose": 1985.00, "source": "NAFEM", "updatedAt": "2026-05-10T16:00:00Z"},
            {"pair": "EUR/NGN", "bidRate": 1720.00, "askRate": 1726.00, "midRate": 1723.00, "cbnRate": 1700.00, "previousClose": 1715.00, "source": "NAFEM", "updatedAt": "2026-05-10T16:00:00Z"},
            {"pair": "CNY/NGN", "bidRate": 218.00, "askRate": 220.00, "midRate": 219.00, "cbnRate": 215.00, "previousClose": 217.50, "source": "CBN", "updatedAt": "2026-05-10T16:00:00Z"},
        ],
        "positions": [
            {"id": "POS-USD-001", "currency": "USD", "accountType": "nostro", "balance": 45000000.00, "localEquivalent": 71212500.00, "prevLocalEquivalent": 70875000.00, "revalPnL": 337500.00, "accountCount": 12500},
            {"id": "POS-GBP-001", "currency": "GBP", "accountType": "nostro", "balance": 12000000.00, "localEquivalent": 23928000.00, "prevLocalEquivalent": 23820000.00, "revalPnL": 108000.00, "accountCount": 3200},
            {"id": "POS-EUR-001", "currency": "EUR", "accountType": "nostro", "balance": 18000000.00, "localEquivalent": 31014000.00, "prevLocalEquivalent": 30870000.00, "revalPnL": 144000.00, "accountCount": 5800},
            {"id": "POS-CNY-001", "currency": "CNY", "accountType": "vostro", "balance": 25000000.00, "localEquivalent": 5475000.00, "prevLocalEquivalent": 5437500.00, "revalPnL": 37500.00, "accountCount": 450},
        ],
        "revaluationRuns": [
            {"id": "REVAL-2026-05-10", "businessDate": "2026-05-10", "status": "completed", "executedAt": "2026-05-10T22:01:15Z", "totalPositions": 4, "totalAccounts": 21950, "totalPnL": 627000.00, "pnlBreakdown": {"USD": 337500.00, "GBP": 108000.00, "EUR": 144000.00, "CNY": 37500.00}, "glEntries": [
                {"debit": "GL-2200-DOM-FCY", "credit": "GL-4200-REVAL-GAIN", "amount": 627000.00, "narrative": "FX revaluation gain 2026-05-10"}
            ]},
            {"id": "REVAL-2026-05-09", "businessDate": "2026-05-09", "status": "completed", "executedAt": "2026-05-09T22:01:08Z", "totalPositions": 4, "totalAccounts": 21890, "totalPnL": -234000.00, "pnlBreakdown": {"USD": -180000.00, "GBP": 45000.00, "EUR": -120000.00, "CNY": 21000.00}, "glEntries": [
                {"debit": "GL-5200-REVAL-LOSS", "credit": "GL-2200-DOM-FCY", "amount": 234000.00, "narrative": "FX revaluation loss 2026-05-09"}
            ]},
        ],
        "stats": {
            "totalCurrencies": 7, "activePairs": 4, "totalFCYBalance": 100000000.00,
            "totalLocalEquivalent": 131629500.00, "netRevalPnLToday": 627000.00,
            "netRevalPnLMTD": 393000.00, "totalAccountsRevalued": 21950,
            "revaluationMethod": "closing-rate", "glAccountGain": "GL-4200-REVAL-GAIN",
            "glAccountLoss": "GL-5200-REVAL-LOSS"
        }
    })
}

fn handle_request(request: &str, data: &Arc<RwLock<serde_json::Value>>) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];
    let d = data.read().unwrap();

    if path == "/healthz" {
        return (200, serde_json::json!({
            "status": "healthy", "service": "multicurrency-revaluation",
            "fx": {"currencies": d["stats"]["totalCurrencies"], "activePairs": d["stats"]["activePairs"], "todayPnL": d["stats"]["netRevalPnLToday"]},
            "middleware": middleware_config()
        }).to_string());
    }
    if path == "/v1/currencies" { return (200, serde_json::json!({"items": d["currencies"], "total": d["currencies"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/rates" { return (200, serde_json::json!({"items": d["rates"], "total": d["rates"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/positions" { return (200, serde_json::json!({"items": d["positions"], "total": d["positions"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/revaluation-runs" { return (200, serde_json::json!({"items": d["revaluationRuns"], "total": d["revaluationRuns"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/stats" { return (200, d["stats"].to_string()); }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8211");
    let data = Arc::new(RwLock::new(seed_data()));
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[multicurrency-revaluation] Listening on :{} with 7 currencies, 4 rate pairs, 4 positions", port);

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let data = Arc::clone(&data);
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&request, &data);
                let st = match status { 200 => "OK", 404 => "Not Found", _ => "Error" };
                let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Service: multicurrency-revaluation\r\n\r\n{}", status, st, body.len(), body);
                let _ = stream.write_all(resp.as_bytes());
            });
        }
    }
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
