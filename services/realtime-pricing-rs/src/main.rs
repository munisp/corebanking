use actix_web::{web,App,HttpServer,HttpResponse,Responder};
use serde_json::json;
use std::env;
async fn healthz() -> impl Responder { HttpResponse::Ok().json(json!({"status":"healthy","service":"realtime-pricing-rs","port":8343})) }
async fn config() -> impl Responder { HttpResponse::Ok().json(json!({"service":"Real-Time Pricing","port":8343,"status":"active"})) }
async fn mw() -> impl Responder {
    HttpResponse::Ok().json(json!({"kafka":{"topics":["realtime-pricing.events"]},"dapr":{"stateStore":"realtime-pricing-state"},"fluvio":{"topics":["realtime-pricing-stream"]},"temporal":{"workflows":["realtime-pricing-workflow"]},"postgres":{"tables":["realtime-pricing_config"]},"keycloak":{"roles":["realtime-pricing-admin"]},"permify":{"relations":["realtime-pricing:can_manage"]},"redis":{"keys":["realtime-pricing:cache"]},"mojaloop":{"oracle":"realtime-pricing-oracle"},"opensearch":{"indices":["realtime-pricing-events"]},"openappsec":{"policy":"realtime-pricing-protection"},"apisix":{"route":"/api/realtime-pricing/*"},"tigerbeetle":{"accounts":[]},"lakehouse":{"tables":["realtime-pricing_analytics"]}}))
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8343".into()).parse().unwrap_or(8343);
    println!("Real-Time Pricing on :{}",port);
    HttpServer::new(||App::new().route("/healthz",web::get().to(healthz)).route("/api/realtime-pricing/config",web::get().to(config)).route("/api/realtime-pricing/middleware",web::get().to(mw))).bind(("0.0.0.0",port))?.run().await
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
