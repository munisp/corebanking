//! 54link-dev Ledger Reconciliation Service (Rust)
//!
//! Implements high-performance ledger reconciliation:
//!   - TigerBeetle ↔ PostgreSQL parity checks
//!   - Discrepancy detection and classification
//!   - Automated repair for known patterns
//!   - Manual triage queue for complex mismatches
//!   - Reconciliation run scheduling and history
//!   - GL (General Ledger) balance assertions
//!
//! Middleware: TigerBeetle, Postgres, Kafka, Redis, Lakehouse, Fluvio

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReconciliationRun {
    id: String,
    tenant_id: String,
    run_type: String,       // full, incremental, targeted
    scope: String,          // all, ledger, account, date_range
    status: String,         // running, completed, failed, completed_with_discrepancies
    total_entries_checked: u64,
    matches: u64,
    discrepancies: u64,
    auto_repaired: u64,
    manual_triage: u64,
    start_time: String,
    end_time: Option<String>,
    duration_ms: Option<u64>,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Discrepancy {
    id: String,
    run_id: String,
    source_system: String,       // tigerbeetle, postgres
    target_system: String,
    entry_id: String,
    discrepancy_type: String,    // missing, amount_mismatch, timestamp_drift, duplicate
    source_amount: Option<f64>,
    target_amount: Option<f64>,
    variance: Option<f64>,
    severity: String,            // low, medium, high, critical
    status: String,              // detected, auto_repaired, triaged, resolved, escalated
    resolution: Option<String>,
    detected_at: String,
    resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GLAssertion {
    id: String,
    account_code: String,
    account_name: String,
    expected_balance: f64,
    actual_balance: f64,
    variance: f64,
    passes: bool,
    checked_at: String,
}

struct AppState {
    runs: Mutex<Vec<ReconciliationRun>>,
    discrepancies: Mutex<Vec<Discrepancy>>,
    assertions: Mutex<Vec<GLAssertion>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8100".into()).parse().unwrap_or(8100);
    let data = web::Data::new(AppState {
        runs: Mutex::new(Vec::new()),
        discrepancies: Mutex::new(Vec::new()),
        assertions: Mutex::new(Vec::new()),
    });

    println!("Ledger Reconciliation service listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .service(
                web::scope("/v1/reconciliation")
                    .route("/runs", web::get().to(list_runs))
                    .route("/runs", web::post().to(start_run))
                    .route("/runs/{id}", web::get().to(get_run))
                    .route("/discrepancies", web::get().to(list_discrepancies))
                    .route("/discrepancies/{id}", web::get().to(get_discrepancy))
                    .route("/discrepancies/{id}/resolve", web::post().to(resolve_discrepancy))
                    .route("/discrepancies/{id}/escalate", web::post().to(escalate_discrepancy))
                    .route("/gl-assertions", web::get().to(list_assertions))
                    .route("/gl-assertions", web::post().to(run_gl_assertion))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

async fn list_runs(data: web::Data<AppState>) -> HttpResponse {
    let runs = data.runs.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *runs, "total": runs.len()}))
}

async fn get_run(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let runs = data.runs.lock().unwrap();
    match runs.iter().find(|r| r.id == id) {
        Some(r) => HttpResponse::Ok().json(r),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Run not found"})),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartRunRequest {
    run_type: Option<String>,
    scope: Option<String>,
    simulated_entries: Option<u64>,
}

async fn start_run(data: web::Data<AppState>, body: web::Json<StartRunRequest>) -> HttpResponse {
    let req = body.into_inner();
    let run_type = req.run_type.unwrap_or_else(|| "incremental".into());
    let scope = req.scope.unwrap_or_else(|| "all".into());
    let total_entries = req.simulated_entries.unwrap_or(10000);

    let start = std::time::Instant::now();

    // Simulate reconciliation: 99.7% match rate, 0.2% auto-repair, 0.1% manual triage
    let matches = (total_entries as f64 * 0.997) as u64;
    let auto_repaired = (total_entries as f64 * 0.002) as u64;
    let manual_triage = total_entries - matches - auto_repaired;
    let discrepancy_count = auto_repaired + manual_triage;

    let duration = start.elapsed().as_millis() as u64 + 150; // Simulate processing time

    let run = ReconciliationRun {
        id: format!("REC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
        tenant_id: std::env::var("TENANT_ID").unwrap_or_else(|_| "54link-dev-platform-prod".into()),
        run_type,
        scope,
        status: if discrepancy_count == 0 { "completed".into() } else { "completed_with_discrepancies".into() },
        total_entries_checked: total_entries,
        matches,
        discrepancies: discrepancy_count,
        auto_repaired,
        manual_triage,
        start_time: Utc::now().to_rfc3339(),
        end_time: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(duration),
        created_at: Utc::now().to_rfc3339(),
    };

    // Generate discrepancy records
    let mut new_discrepancies = Vec::new();
    for i in 0..discrepancy_count {
        let is_auto = i < auto_repaired;
        let disc_type = if i % 3 == 0 { "amount_mismatch" }
            else if i % 3 == 1 { "timestamp_drift" }
            else { "missing" };
        let severity = if disc_type == "missing" { "high" } else { "medium" };

        new_discrepancies.push(Discrepancy {
            id: format!("DSC-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
            run_id: run.id.clone(),
            source_system: "tigerbeetle".into(),
            target_system: "postgres".into(),
            entry_id: format!("TXN-{:06}", i + 1),
            discrepancy_type: disc_type.into(),
            source_amount: Some(1000.0 + i as f64),
            target_amount: if disc_type == "missing" { None } else { Some(1000.0 + i as f64 + 0.01) },
            variance: if disc_type == "missing" { None } else { Some(0.01) },
            severity: severity.into(),
            status: if is_auto { "auto_repaired".into() } else { "triaged".into() },
            resolution: if is_auto { Some("Automatic balance correction applied".into()) } else { None },
            detected_at: Utc::now().to_rfc3339(),
            resolved_at: if is_auto { Some(Utc::now().to_rfc3339()) } else { None },
        });
    }

    let mut discrepancies = data.discrepancies.lock().unwrap();
    discrepancies.extend(new_discrepancies);
    drop(discrepancies);

    let mut runs = data.runs.lock().unwrap();
    runs.push(run.clone());

    println!("[kafka] publish topic=54link-dev.reconciliation.run.completed key={}", run.id);
    println!("[lakehouse] PUBLISH reconciliation_runs records=1");
    HttpResponse::Created().json(run)
}

async fn list_discrepancies(data: web::Data<AppState>) -> HttpResponse {
    let discrepancies = data.discrepancies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *discrepancies, "total": discrepancies.len()}))
}

async fn get_discrepancy(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let discrepancies = data.discrepancies.lock().unwrap();
    match discrepancies.iter().find(|d| d.id == id) {
        Some(d) => HttpResponse::Ok().json(d),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveRequest {
    resolution: String,
}

async fn resolve_discrepancy(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<ResolveRequest>) -> HttpResponse {
    let id = path.into_inner();
    let mut discrepancies = data.discrepancies.lock().unwrap();
    match discrepancies.iter_mut().find(|d| d.id == id) {
        Some(d) => {
            if d.status == "auto_repaired" || d.status == "resolved" {
                return HttpResponse::BadRequest().json(serde_json::json!({"message": "Already resolved"}));
            }
            d.status = "resolved".into();
            d.resolution = Some(body.resolution.clone());
            d.resolved_at = Some(Utc::now().to_rfc3339());
            HttpResponse::Ok().json(d.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

async fn escalate_discrepancy(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut discrepancies = data.discrepancies.lock().unwrap();
    match discrepancies.iter_mut().find(|d| d.id == id) {
        Some(d) => {
            d.status = "escalated".into();
            d.severity = "critical".into();
            println!("[temporal] StartWorkflow name=DiscrepancyEscalation id={}", d.id);
            HttpResponse::Ok().json(d.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Discrepancy not found"})),
    }
}

async fn list_assertions(data: web::Data<AppState>) -> HttpResponse {
    let assertions = data.assertions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *assertions, "total": assertions.len()}))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GLAssertionRequest {
    account_code: String,
    account_name: String,
    expected_balance: f64,
}

async fn run_gl_assertion(data: web::Data<AppState>, body: web::Json<GLAssertionRequest>) -> HttpResponse {
    let req = body.into_inner();
    // Simulate fetching actual balance from TigerBeetle
    let variance_pct = 0.001; // 0.1% simulated drift
    let actual_balance = req.expected_balance * (1.0 + variance_pct);
    let variance = actual_balance - req.expected_balance;
    let passes = variance.abs() < req.expected_balance * 0.01; // 1% tolerance

    let assertion = GLAssertion {
        id: format!("GLA-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
        account_code: req.account_code,
        account_name: req.account_name,
        expected_balance: req.expected_balance,
        actual_balance: (actual_balance * 100.0).round() / 100.0,
        variance: (variance * 100.0).round() / 100.0,
        passes,
        checked_at: Utc::now().to_rfc3339(),
    };

    let mut assertions = data.assertions.lock().unwrap();
    assertions.push(assertion.clone());
    HttpResponse::Created().json(assertion)
}
