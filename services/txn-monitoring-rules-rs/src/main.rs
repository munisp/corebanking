use actix_web::{web, App, HttpServer, HttpResponse};
use sqlx::PgPool;

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

fn mw() -> serde_json::Value { serde_json::json!({"kafka":{"broker":ev("KAFKA_BROKER","localhost:9092"),"topics":["txn.monitored","txn.alert-generated","txn.rule-triggered","txn.case-opened","txn.sar-recommended"]},"dapr":{"app_id":"txn-monitoring-rules-rs"},"fluvio":{"url":ev("FLUVIO_URL","localhost:9003"),"topics":["txn-monitoring-stream","txn-alert-stream"]},"temporal":{"url":ev("TEMPORAL_URL","localhost:7233"),"namespace":"txn-monitoring","workflows":["RealTimeMonitorWorkflow","BatchMonitorWorkflow","CaseManagementWorkflow"]},"postgres":{"tables":["txn_monitoring_rules","txn_alerts","txn_cases","txn_scenarios"]},"keycloak":{"url":ev("KEYCLOAK_URL","http://localhost:8080"),"realm":"54link-dev","client_id":"txn-monitoring"},"redis":{"url":ev("REDIS_URL","redis://localhost:6379"),"keys":["txn:velocity:{customer_id}","txn:pattern:{customer_id}","txn:alert-count"]},"opensearch":{"url":ev("OPENSEARCH_URL","http://localhost:9200"),"indices":["txn-monitoring-alerts","txn-cases"]}}) }

struct St {
    /// Postgres pool for the REAL monitoring data. Rules/alerts/cases are read
    /// from the database; when the DB is unavailable the API returns honest
    /// empty lists — never seeded/fabricated AML alerts, cases or SAR outcomes.
    pool: Option<PgPool>,
}

async fn healthz(d: web::Data<St>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "txn-monitoring-rules-rs",
        "version": "1.0.0",
        "db_available": d.pool.is_some(),
        "middleware": mw(),
    }))
}

/// Read all rows of a table as JSON objects. Returns None on DB error.
async fn read_table(pool: &PgPool, table: &str) -> Option<Vec<serde_json::Value>> {
    // Table names are fixed literals from this binary — never user input.
    let sql = format!("SELECT row_to_json(t)::text AS data FROM {} t", table);
    let rows: Vec<String> = sqlx::query_scalar(&sql).fetch_all(pool).await.ok()?;
    Some(rows.iter().filter_map(|r| serde_json::from_str(r).ok()).collect())
}

async fn list_table(d: &web::Data<St>, table: &str) -> HttpResponse {
    match &d.pool {
        Some(pool) => match read_table(pool, table).await {
            Some(items) => HttpResponse::Ok().json(serde_json::json!({"items": items, "total": items.len()})),
            None => HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database_unavailable", "items": [], "total": 0})),
        },
        // Honest empty list — no fabricated records.
        None => HttpResponse::Ok().json(serde_json::json!({"items": [], "total": 0})),
    }
}

async fn get_rules(d: web::Data<St>) -> HttpResponse { list_table(&d, "txn_monitoring_rules").await }
async fn get_alerts(d: web::Data<St>) -> HttpResponse { list_table(&d, "txn_alerts").await }
async fn get_cases(d: web::Data<St>) -> HttpResponse { list_table(&d, "txn_cases").await }

/// POST /api/cases/{id}/file-sar — the ONLY way a SAR outcome may be set on a
/// case. Records a real filing action in the database; fails closed (503) when
/// the database is unavailable rather than pretending a filing occurred.
async fn file_sar(d: web::Data<St>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let id = path.into_inner();
    let sar_reference = body.get("sar_reference").and_then(|v| v.as_str()).map(|s| s.to_string());
    let filed_by = body.get("filed_by").and_then(|v| v.as_str()).unwrap_or("compliance-officer").to_string();
    let pool = match &d.pool {
        Some(p) => p,
        None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "database_unavailable", "sar_filed": false})),
    };
    let outcome = match &sar_reference {
        Some(r) => format!("SAR filed — {}", r),
        None => "SAR filed".to_string(),
    };
    let res = sqlx::query(
        "UPDATE txn_cases SET outcome = $2, sar_filed = TRUE, status = 'closed_sar_filed', assigned_to = $3 WHERE id = $1"
    )
    .bind(&id)
    .bind(&outcome)
    .bind(&filed_by)
    .execute(pool)
    .await;
    match res {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::Ok().json(serde_json::json!({
            "id": id, "sar_filed": true, "outcome": outcome, "filed_by": filed_by,
        })),
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "case_not_found", "id": id})),
        Err(e) => HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": format!("sar_filing_failed: {}", e), "sar_filed": false})),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT", "8285").parse().unwrap_or(8285);
    let pool = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => match PgPool::connect(&url).await {
            Ok(p) => Some(p),
            Err(e) => {
                eprintln!("txn-monitoring-rules-rs: DATABASE_URL connect failed: {} — serving honest empty lists", e);
                None
            }
        },
        _ => {
            eprintln!("txn-monitoring-rules-rs: DATABASE_URL not set — serving honest empty lists");
            None
        }
    };
    let d = web::Data::new(St { pool });
    println!("txn-monitoring-rules-rs listening on :{}", port);
    HttpServer::new(move || App::new()
        .app_data(d.clone())
        .route("/healthz", web::get().to(healthz))
        .route("/api/rules", web::get().to(get_rules))
        .route("/api/alerts", web::get().to(get_alerts))
        .route("/api/cases", web::get().to(get_cases))
        .route("/api/cases/{id}/file-sar", web::post().to(file_sar))
    ).bind(("0.0.0.0", port))?.run().await
}
