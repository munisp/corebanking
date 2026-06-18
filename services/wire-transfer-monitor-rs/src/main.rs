use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Clone, Serialize, Deserialize)]
struct WireTransferRecord {
    id: String,
    status: String,
    domain: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

struct AppState {
    start_time: Instant,
    records: Mutex<Vec<WireTransferRecord>>,
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "wire-transfer-monitor-rs",
        "status": "healthy",
        "domain": "Wire Transfer Monitor",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "wire-transfer-monitor.events, wire-transfer-monitor.audit",
            "postgres": "wire_transfer_monitor_records",
            "redis": "wire-transfer-monitor_cache",
            "temporal": "WireTransferMonitorWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "wire-transfer-monitor-2026"
        }
    }))
}

async fn list_records(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap_or_else(|e| e.into_inner());
    HttpResponse::Ok().json(json!({"records": *records, "total": records.len(), "domain": "Wire Transfer Monitor"}))
}

async fn create_record(state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let mut records = state.records.lock().unwrap_or_else(|e| e.into_inner());
    let id = format!("REC-{:03}", records.len() + 1);
    let rec = WireTransferRecord {
        id: id.clone(),
        status: body.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string(),
        domain: "Wire Transfer Monitor".to_string(),
        created_at: body.get("createdAt").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    };
    records.push(rec);
    HttpResponse::Created().json(json!({"created": true, "id": id, "data": *body}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap_or_else(|e| e.into_inner());
    let total = records.len();
    let active = records.iter().filter(|r| r.status == "active").count();
    let pending = records.iter().filter(|r| r.status == "pending" || r.status == "processing").count();
    let archived = records.iter().filter(|r| r.status == "completed" || r.status == "archived").count();
    HttpResponse::Ok().json(json!({"total": total, "active": active, "pending": pending, "archived": archived}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9325".to_string());
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        records: Mutex::new(vec![]),
    });
    println!("Wire Transfer Monitor (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/wire-transfer-monitor/list", web::get().to(list_records))
            .route("/v1/wire-transfer-monitor/create", web::post().to(create_record))
            .route("/v1/wire-transfer-monitor/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
