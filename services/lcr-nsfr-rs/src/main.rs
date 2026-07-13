use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

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

fn seed_data() -> serde_json::Value {
    serde_json::json!({
        "lcr": {
            "reportDate": "2026-05-10",
            "hqla": {
                "level1": {"cashAndReserves": 78000000000.0, "govSecurities": 45000000000.0, "total": 123000000000.0, "weight": 1.0},
                "level2a": {"corporateBonds": 12000000000.0, "coveredBonds": 5000000000.0, "total": 17000000000.0, "weight": 0.85, "weighted": 14450000000.0},
                "level2b": {"equities": 3000000000.0, "rmbs": 2000000000.0, "total": 5000000000.0, "weight": 0.5, "weighted": 2500000000.0},
                "totalHQLA": 139950000000.0
            },
            "netCashOutflows": {
                "retailDepositsStable": {"amount": 180000000000.0, "runoffRate": 0.05, "outflow": 9000000000.0},
                "retailDepositsLessStable": {"amount": 98000000000.0, "runoffRate": 0.10, "outflow": 9800000000.0},
                "wholesaleOperational": {"amount": 120000000000.0, "runoffRate": 0.25, "outflow": 30000000000.0},
                "wholesaleNonOperational": {"amount": 45000000000.0, "runoffRate": 0.40, "outflow": 18000000000.0},
                "committedFacilities": {"amount": 75600000000.0, "drawdownRate": 0.10, "outflow": 7560000000.0},
                "totalOutflows": 74360000000.0,
                "inflows": {"retailInflows": 8000000000.0, "wholesaleInflows": 12000000000.0, "totalInflows": 20000000000.0, "cappedInflows": 20000000000.0},
                "netOutflows": 54360000000.0
            },
            "lcr": 257.4,
            "minimum": 100.0,
            "buffer": 157.4,
            "status": "compliant"
        },
        "nsfr": {
            "reportDate": "2026-05-10",
            "asf": {
                "tier1Capital": {"amount": 62000000000.0, "factor": 1.0, "weighted": 62000000000.0},
                "tier2Capital": {"amount": 13000000000.0, "factor": 1.0, "weighted": 13000000000.0},
                "stableRetailDeposits": {"amount": 180000000000.0, "factor": 0.95, "weighted": 171000000000.0},
                "lessStableRetailDeposits": {"amount": 98000000000.0, "factor": 0.90, "weighted": 88200000000.0},
                "wholesaleFunding1Y": {"amount": 85000000000.0, "factor": 1.0, "weighted": 85000000000.0},
                "wholesaleFundingLess1Y": {"amount": 45000000000.0, "factor": 0.50, "weighted": 22500000000.0},
                "totalASF": 441700000000.0
            },
            "rsf": {
                "cashAndReserves": {"amount": 78000000000.0, "factor": 0.0, "weighted": 0.0},
                "govSecurities": {"amount": 45000000000.0, "factor": 0.05, "weighted": 2250000000.0},
                "corporateLoans1Y": {"amount": 120000000000.0, "factor": 0.50, "weighted": 60000000000.0},
                "retailLoans": {"amount": 220000000000.0, "factor": 0.85, "weighted": 187000000000.0},
                "mortgages": {"amount": 45000000000.0, "factor": 0.65, "weighted": 29250000000.0},
                "otherAssets": {"amount": 12000000000.0, "factor": 1.0, "weighted": 12000000000.0},
                "offBalanceSheet": {"amount": 75600000000.0, "factor": 0.05, "weighted": 3780000000.0},
                "totalRSF": 294280000000.0
            },
            "nsfr": 150.1,
            "minimum": 100.0,
            "buffer": 50.1,
            "status": "compliant"
        },
        "history": [
            {"date": "2026-05-10", "lcr": 257.4, "nsfr": 150.1},
            {"date": "2026-04-30", "lcr": 245.2, "nsfr": 148.5},
            {"date": "2026-03-31", "lcr": 238.8, "nsfr": 145.2},
            {"date": "2026-02-28", "lcr": 232.1, "nsfr": 142.8},
            {"date": "2025-12-31", "lcr": 225.5, "nsfr": 138.9},
        ],
        "stats": {
            "currentLCR": 257.4, "currentNSFR": 150.1,
            "lcrMinimum": 100.0, "nsfrMinimum": 100.0,
            "lcrTrend": "improving", "nsfrTrend": "improving",
            "totalHQLA": 139950000000.0, "netCashOutflows30D": 54360000000.0,
            "totalASF": 441700000000.0, "totalRSF": 294280000000.0,
            "complianceStatus": "fully_compliant"
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
        return (200, serde_json::json!({"status": "healthy", "service": "lcr-nsfr",
            "compliance": {"lcr": d["stats"]["currentLCR"], "nsfr": d["stats"]["currentNSFR"], "status": "compliant"},
            "middleware": middleware_config()}).to_string());
    }
    if path == "/v1/lcr" { return (200, d["lcr"].to_string()); }
    if path == "/v1/nsfr" { return (200, d["nsfr"].to_string()); }
    if path == "/v1/history" { return (200, serde_json::json!({"items": d["history"], "total": d["history"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/stats" { return (200, d["stats"].to_string()); }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8217");
    let data = Arc::new(RwLock::new(seed_data()));
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[lcr-nsfr] Listening on :{} — LCR: 257.4%, NSFR: 150.1%", port);
    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let data = Arc::clone(&data);
            std::thread::spawn(move || {
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&req, &data);
                let st = match status { 200 => "OK", _ => "Error" };
                let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, st, body.len(), body);
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
