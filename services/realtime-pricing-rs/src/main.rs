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
