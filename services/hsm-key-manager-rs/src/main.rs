use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "hsm-key-manager-rs",
        "status": "healthy",
        "domain": "Hsm Key Manager",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "hsm-key-manager.events, hsm-key-manager.audit",
            "postgres": "hsm_key_manager_records",
            "redis": "hsm-key-manager_cache",
            "temporal": "HsmKeyManagerWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "hsm-key-manager-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "REC-001", "status": "active", "domain": "Hsm Key Manager", "createdAt": "2026-05-09T10:00:00Z"},
        {"id": "REC-002", "status": "processing", "domain": "Hsm Key Manager", "createdAt": "2026-05-09T11:00:00Z"},
        {"id": "REC-003", "status": "completed", "domain": "Hsm Key Manager", "createdAt": "2026-05-08T14:00:00Z"},
    ], "total": 3, "domain": "Hsm Key Manager"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"total": 1247, "active": 1100, "pending": 120, "archived": 27}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9240".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Hsm Key Manager (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/hsm-key-manager/list", web::get().to(list_records))
            .route("/v1/hsm-key-manager/create", web::post().to(create_record))
            .route("/v1/hsm-key-manager/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
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
