use postgres::{Client, NoTls};
use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn get_env(key: &str, default: &str) -> String { env::var(key).unwrap_or_else(|_| default.to_string()) }

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "liquidity.lcr-computed,liquidity.nsfr-computed,liquidity.limit-breached"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "liquidity-ratio-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "lcr_reports,nsfr_reports,liquidity_buckets"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "liquidity-metrics"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev", "role": "treasury-officer,alco-member,risk-officer"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "liquidity:compute,liquidity:override,liquidity:report"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "liquidity-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "liquidity-ratios"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "LiquidityComputationWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-flow-data"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "balance-sheet-data"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "lcr_history,nsfr_history"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/liquidity/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "liquidity-data-protection"}
    })
}

fn source_unavailable(detail: &str) -> (u16, String) {
    (503, serde_json::json!({
        "error": "source_unavailable",
        "detail": detail,
    }).to_string())
}

// LCR/NSFR are regulatory ratios: NEVER fabricate them.
// Both are computed from the liquidity reporting tables; any DB failure => 503.
fn with_db<T>(f: impl FnOnce(&mut Client) -> Result<T, String>) -> Result<T, String> {
    let url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL not set; refusing to fabricate LCR/NSFR".to_string())?;
    if url.is_empty() {
        return Err("DATABASE_URL empty; refusing to fabricate LCR/NSFR".to_string());
    }
    let mut client = Client::connect(&url, NoTls)
        .map_err(|e| format!("postgres connect failed: {}", e))?;
    f(&mut client)
}

struct LcrRow { report_date: String, total_hqla: f64, net_outflows: f64 }
struct NsfrRow { report_date: String, total_asf: f64, total_rsf: f64 }

fn latest_lcr(c: &mut Client) -> Result<LcrRow, String> {
    let row = c.query_opt(
        "SELECT report_date::text, total_hqla::float8, net_outflows::float8 FROM lcr_reports ORDER BY report_date DESC LIMIT 1",
        &[],
    ).map_err(|e| format!("lcr_reports query failed: {}", e))?
    .ok_or_else(|| "lcr_reports is empty — no HQLA/outflow data available".to_string())?;
    Ok(LcrRow { report_date: row.get(0), total_hqla: row.get(1), net_outflows: row.get(2) })
}

fn latest_nsfr(c: &mut Client) -> Result<NsfrRow, String> {
    let row = c.query_opt(
        "SELECT report_date::text, total_asf::float8, total_rsf::float8 FROM nsfr_reports ORDER BY report_date DESC LIMIT 1",
        &[],
    ).map_err(|e| format!("nsfr_reports query failed: {}", e))?
    .ok_or_else(|| "nsfr_reports is empty — no ASF/RSF data available".to_string())?;
    Ok(NsfrRow { report_date: row.get(0), total_asf: row.get(1), total_rsf: row.get(2) })
}

fn lcr_json(l: &LcrRow) -> serde_json::Value {
    let lcr = if l.net_outflows > 0.0 { l.total_hqla / l.net_outflows * 100.0 } else { 0.0 };
    let lcr = (lcr * 10.0).round() / 10.0;
    serde_json::json!({
        "reportDate": l.report_date,
        "totalHQLA": l.total_hqla,
        "netCashOutflows": l.net_outflows,
        "lcr": lcr,
        "minimum": 100.0,
        "buffer": (lcr - 100.0 * 10.0).round() / 10.0,
        "status": if lcr >= 100.0 { "compliant" } else { "breach" },
    })
}

fn nsfr_json(n: &NsfrRow) -> serde_json::Value {
    let nsfr = if n.total_rsf > 0.0 { n.total_asf / n.total_rsf * 100.0 } else { 0.0 };
    let nsfr = (nsfr * 10.0).round() / 10.0;
    serde_json::json!({
        "reportDate": n.report_date,
        "totalASF": n.total_asf,
        "totalRSF": n.total_rsf,
        "nsfr": nsfr,
        "minimum": 100.0,
        "buffer": (nsfr - 100.0 * 10.0).round() / 10.0,
        "status": if nsfr >= 100.0 { "compliant" } else { "breach" },
    })
}

fn handle_request(request: &str) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];

    if path == "/healthz" {
        let db_ok = with_db(|c| c.query_one("SELECT 1", &[]).map(|_| ()).map_err(|e| e.to_string())).is_ok();
        return (200, serde_json::json!({"status": if db_ok { "healthy" } else { "degraded" }, "service": "lcr-nsfr",
            "database": if db_ok { "connected" } else { "unavailable" },
            "middleware": middleware_config()}).to_string());
    }
    if path == "/v1/lcr" {
        return match with_db(|c| latest_lcr(c)) {
            Ok(l) => (200, lcr_json(&l).to_string()),
            Err(e) => { eprintln!("[lcr-nsfr] LCR unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/nsfr" {
        return match with_db(|c| latest_nsfr(c)) {
            Ok(n) => (200, nsfr_json(&n).to_string()),
            Err(e) => { eprintln!("[lcr-nsfr] NSFR unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/history" {
        return match with_db(|c| {
            let lrows = c.query(
                "SELECT report_date::text, total_hqla::float8, net_outflows::float8 FROM lcr_reports ORDER BY report_date DESC LIMIT 30",
                &[],
            ).map_err(|e| e.to_string())?;
            let nrows = c.query(
                "SELECT report_date::text, total_asf::float8, total_rsf::float8 FROM nsfr_reports ORDER BY report_date DESC LIMIT 30",
                &[],
            ).map_err(|e| e.to_string())?;
            let mut items: Vec<serde_json::Value> = Vec::new();
            for r in &lrows {
                let date: String = r.get(0);
                let hqla: f64 = r.get(1);
                let outflows: f64 = r.get(2);
                let lcr = if outflows > 0.0 { (hqla / outflows * 1000.0).round() / 10.0 } else { 0.0 };
                let nsfr = nrows.iter().find(|n| n.get::<usize, String>(0) == date).map(|n| {
                    let asf: f64 = n.get(1);
                    let rsf: f64 = n.get(2);
                    if rsf > 0.0 { (asf / rsf * 1000.0).round() / 10.0 } else { 0.0 }
                });
                items.push(serde_json::json!({"date": date, "lcr": lcr, "nsfr": nsfr}));
            }
            Ok(items)
        }) {
            Ok(items) => (200, serde_json::json!({"items": items, "total": items.len()}).to_string()),
            Err(e) => { eprintln!("[lcr-nsfr] history unavailable: {}", e); source_unavailable(&e) }
        };
    }
    if path == "/v1/stats" {
        return match with_db(|c| Ok((latest_lcr(c)?, latest_nsfr(c)?))) {
            Ok((l, n)) => {
                let lj = lcr_json(&l);
                let nj = nsfr_json(&n);
                (200, serde_json::json!({
                    "currentLCR": lj["lcr"], "currentNSFR": nj["nsfr"],
                    "lcrMinimum": 100.0, "nsfrMinimum": 100.0,
                    "totalHQLA": l.total_hqla, "netCashOutflows30D": l.net_outflows,
                    "totalASF": n.total_asf, "totalRSF": n.total_rsf,
                    "complianceStatus": if lj["lcr"].as_f64().unwrap_or(0.0) >= 100.0 && nj["nsfr"].as_f64().unwrap_or(0.0) >= 100.0 { "fully_compliant" } else { "breach" },
                }).to_string())
            }
            Err(e) => { eprintln!("[lcr-nsfr] stats unavailable: {}", e); source_unavailable(&e) }
        };
    }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8217");
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[lcr-nsfr] Listening on :{} — LCR/NSFR computed from Postgres (fail-fast 503 when unavailable)", port);
    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            std::thread::spawn(move || {
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&req);
                let st = match status { 200 => "OK", _ => "Error" };
                let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, st, body.len(), body);
                let _ = stream.write_all(resp.as_bytes());
            });
        }
    }
}
