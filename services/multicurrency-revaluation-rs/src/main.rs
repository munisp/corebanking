use postgres::{Client, NoTls};
use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "fx.revaluation-completed,fx.rate-updated,fx.position-changed"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "rate-cache,position-cache"},
        "postgres": {"url": env::var("DATABASE_URL").expect("DATABASE_URL must be set - refusing to boot with default database credentials"), "tables": "fx_rates,fx_positions,fx_revaluations,currency_accounts"},
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

fn source_unavailable(detail: &str) -> (u16, String) {
    (503, serde_json::json!({
        "error": "source_unavailable",
        "detail": detail,
    }).to_string())
}

// FX rates, nostro positions and revaluation P&L are financial data: NEVER fabricate.
// Rates come from the fx_rates table (populated by fx-service); positions from fx_positions;
// run history from fx_revaluations. Any source failure => 503 source_unavailable.
fn with_db<T>(f: impl FnOnce(&mut Client) -> Result<T, String>) -> Result<T, String> {
    let url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL not set; refusing to fabricate FX data".to_string())?;
    if url.is_empty() {
        return Err("DATABASE_URL empty; refusing to fabricate FX data".to_string());
    }
    let mut client = Client::connect(&url, NoTls)
        .map_err(|e| format!("postgres connect failed: {}", e))?;
    f(&mut client)
}

fn load_rates(c: &mut Client) -> Result<Vec<(String, String, f64, String)>, String> {
    let rows = c.query(
        "SELECT from_currency, to_currency, rate::float8, COALESCE(updated_at::text, '') FROM fx_rates",
        &[],
    ).map_err(|e| format!("fx_rates query failed: {}", e))?;
    Ok(rows.iter().map(|r| (r.get(0), r.get(1), r.get(2), r.get(3))).collect())
}

fn rate_ngn(rates: &[(String, String, f64, String)], ccy: &str) -> Option<f64> {
    rates.iter()
        .find(|(f, t, _, _)| f == ccy && t == "NGN")
        .map(|(_, _, r, _)| *r)
        .or_else(|| rates.iter().find(|(f, t, _, _)| f == "NGN" && t == ccy).map(|(_, _, r, _)| 1.0 / *r))
}

fn handle_request(request: &str) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];

    if path == "/healthz" {
        let db_ok = with_db(|c| c.query_one("SELECT 1", &[]).map(|_| ()).map_err(|e| e.to_string())).is_ok();
        return (200, serde_json::json!({
            "status": if db_ok { "healthy" } else { "degraded" }, "service": "multicurrency-revaluation",
            "database": if db_ok { "connected" } else { "unavailable" },
            "middleware": middleware_config()
        }).to_string());
    }
    if path == "/v1/currencies" {
        return match with_db(|c| {
            let rows = c.query(
                "SELECT code, name, type, decimal_places, is_base_currency FROM currencies ORDER BY code",
                &[],
            ).map_err(|e| format!("currencies query failed: {}", e))?;
            Ok(rows.iter().map(|r| serde_json::json!({
                "code": r.get::<usize, String>(0),
                "name": r.get::<usize, String>(1),
                "type": r.get::<usize, String>(2),
                "decimalPlaces": r.get::<usize, i32>(3),
                "isBaseCurrency": r.get::<usize, bool>(4),
            })).collect::<Vec<_>>())
        }) {
            Ok(items) => (200, serde_json::json!({"items": items, "total": items.len()}).to_string()),
            Err(e) => { eprintln!("[fx-reval] currencies unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/rates" {
        return match with_db(|c| load_rates(c)) {
            Ok(rates) => {
                let items: Vec<serde_json::Value> = rates.iter().map(|(f, t, r, u)| serde_json::json!({
                    "pair": format!("{}/{}", f, t),
                    "midRate": r,
                    "updatedAt": u,
                })).collect();
                (200, serde_json::json!({"items": items, "total": items.len()}).to_string())
            }
            Err(e) => { eprintln!("[fx-reval] rates unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/positions" {
        return match with_db(|c| {
            let rates = load_rates(c)?;
            let rows = c.query(
                "SELECT id, currency, account_type, balance::float8, account_count FROM fx_positions ORDER BY id",
                &[],
            ).map_err(|e| format!("fx_positions query failed: {}", e))?;
            let mut items = Vec::new();
            for r in &rows {
                let id: String = r.get(0);
                let ccy: String = r.get(1);
                let acct: String = r.get(2);
                let bal: f64 = r.get(3);
                let count: i32 = r.get(4);
                let local = if ccy == "NGN" { bal } else {
                    match rate_ngn(&rates, &ccy) {
                        Some(rate) => bal * rate,
                        None => return Err(format!("no fx rate for {} — cannot compute local equivalent without fabricating", ccy)),
                    }
                };
                // Previous close for P&L: only from real rate history; otherwise omit (never fabricate P&L).
                let prev = c.query_opt(
                    "SELECT rate::float8 FROM fx_rate_history WHERE from_currency = $1 AND to_currency = 'NGN' ORDER BY rate_date DESC LIMIT 1 OFFSET 1",
                    &[&ccy],
                ).ok().flatten().map(|pr| pr.get::<usize, f64>(0));
                let mut item = serde_json::json!({
                    "id": id, "currency": ccy, "accountType": acct,
                    "balance": bal, "localEquivalent": local, "accountCount": count,
                });
                if let Some(p) = prev {
                    item["prevLocalEquivalent"] = serde_json::json!(bal * p);
                    item["revalPnL"] = serde_json::json!(bal * (item["localEquivalent"].as_f64().unwrap_or(0.0) / bal.max(1.0) - p));
                }
                items.push(item);
            }
            Ok(items)
        }) {
            Ok(items) => (200, serde_json::json!({"items": items, "total": items.len()}).to_string()),
            Err(e) => { eprintln!("[fx-reval] positions unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/revaluation-runs" {
        return match with_db(|c| {
            let rows = c.query(
                "SELECT id, business_date::text, status, executed_at::text, total_positions, total_accounts, total_pnl::float8 FROM fx_revaluations ORDER BY business_date DESC LIMIT 30",
                &[],
            ).map_err(|e| format!("fx_revaluations query failed: {}", e))?;
            Ok(rows.iter().map(|r| serde_json::json!({
                "id": r.get::<usize, String>(0),
                "businessDate": r.get::<usize, String>(1),
                "status": r.get::<usize, String>(2),
                "executedAt": r.get::<usize, String>(3),
                "totalPositions": r.get::<usize, i32>(4),
                "totalAccounts": r.get::<usize, i32>(5),
                "totalPnL": r.get::<usize, f64>(6),
            })).collect::<Vec<_>>())
        }) {
            Ok(items) => (200, serde_json::json!({"items": items, "total": items.len()}).to_string()),
            Err(e) => { eprintln!("[fx-reval] revaluation runs unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/stats" {
        // Aggregate stats from the same real sources; any failure => 503.
        return match with_db(|c| {
            let rates = load_rates(c)?;
            let row = c.query_one(
                "SELECT COUNT(*)::int, COALESCE(SUM(balance),0)::float8 FROM fx_positions",
                &[],
            ).map_err(|e| format!("fx_positions aggregate failed: {}", e))?;
            let n_pos: i32 = row.get(0);
            let _total_fcy: f64 = row.get(1);
            let latest_pnl: Option<f64> = c.query_opt(
                "SELECT total_pnl::float8 FROM fx_revaluations ORDER BY business_date DESC LIMIT 1",
                &[],
            ).ok().flatten().map(|r| r.get(0));
            Ok(serde_json::json!({
                "activePairs": rates.len(),
                "totalPositions": n_pos,
                "netRevalPnLToday": latest_pnl,
                "revaluationMethod": "closing-rate",
            }))
        }) {
            Ok(stats) => (200, stats.to_string()),
            Err(e) => { eprintln!("[fx-reval] stats unavailable: {}", e); source_unavailable(&e) }
        };
    }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8211");
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[multicurrency-revaluation] Listening on :{} — FX rates/positions from Postgres (fail-fast 503 when unavailable)", port);

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&request);
                let st = match status { 200 => "OK", 404 => "Not Found", _ => "Error" };
                let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nX-Service: multicurrency-revaluation\r\n\r\n{}", status, st, body.len(), body);
                let _ = stream.write_all(resp.as_bytes());
            });
        }
    }
}
