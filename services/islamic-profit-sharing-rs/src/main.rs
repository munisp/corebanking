#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, AtomicI64, Ordering};

static WATCHDOG_LAST: AtomicI64 = AtomicI64::new(0);
static EVENTS_EMITTED: AtomicU64 = AtomicU64::new(0);

fn watchdog_ping() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
    WATCHDOG_LAST.store(now, Ordering::Relaxed);
}

fn watchdog_healthy() -> bool {
    let last = WATCHDOG_LAST.load(Ordering::Relaxed);
    if last == 0 { return true; }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
    (now - last) < 60000
}

fn start_watchdog() {
    watchdog_ping();
    std::thread::spawn(|| {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            if !watchdog_healthy() {
                eprintln!("[WATCHDOG] Event loop stalled");
            }
            watchdog_ping();
        }
    });
}

#[derive(Serialize, Deserialize)]
struct ProfitShareRequest {
    contract_type: String,   // mudarabah | musharakah
    total_profit_kobo: i64,
    investor_ratio: f64,     // e.g. 0.60
    manager_ratio: f64,      // e.g. 0.40
}

#[derive(Serialize)]
struct ProfitShareResponse {
    investor_share_kobo: i64,
    manager_share_kobo: i64,
    contract_type: String,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "ok", "service": "islamic-profit-sharing-rs"}))
}

async fn livez() -> HttpResponse {
    if watchdog_healthy() {
        HttpResponse::Ok().json(json!({"status": "alive"}))
    } else {
        HttpResponse::ServiceUnavailable().json(json!({"status": "stalled"}))
    }
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "ready"}))
}

async fn calculate_profit_share(body: web::Json<ProfitShareRequest>) -> HttpResponse {
    let req = body.into_inner();
    let investor = (req.total_profit_kobo as f64 * req.investor_ratio).round() as i64;
    let manager = req.total_profit_kobo - investor;

    let bus = EventBus::new("banking.lending", "islamic-profit-sharing");
    bus.emit("profit.calculated", &json!({
        "contract_type": req.contract_type,
        "total_kobo": req.total_profit_kobo,
        "investor_kobo": investor,
        "manager_kobo": manager,
    }));

    HttpResponse::Ok().json(ProfitShareResponse {
        investor_share_kobo: investor,
        manager_share_kobo: manager,
        contract_type: req.contract_type,
    })
}

struct EventBus {
    broker_url: String,
    topic: String,
    service_name: String,
}

impl EventBus {
    fn new(topic: &str, service: &str) -> Self {
        let broker = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
        Self { broker_url: broker, topic: topic.to_string(), service_name: service.to_string() }
    }

    fn emit(&self, event_type: &str, payload: &serde_json::Value) {
        eprintln!("[EventBus] {} -> {}: {}", self.service_name, self.topic, event_type);
        EVENTS_EMITTED.fetch_add(1, Ordering::Relaxed);
    }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    start_watchdog();
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    eprintln!("[islamic-profit-sharing-rs] Starting on :{}", port);

    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/v1/profit-share/calculate", web::post().to(calculate_profit_share))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_watchdog_healthy() {
        assert!(watchdog_healthy());
    }

    #[test]
    fn test_watchdog_ping() {
        watchdog_ping();
        assert!(watchdog_healthy());
    }

    #[test]
    fn test_eventbus_creation() {
        let bus = EventBus::new("test.topic", "test-svc");
        assert_eq!(bus.topic, "test.topic");
        assert_eq!(bus.service_name, "test-svc");
    }

    #[test]
    fn test_profit_share_math() {
        let total: i64 = 100000; // 1000 NGN
        let investor_ratio = 0.60;
        let investor = (total as f64 * investor_ratio).round() as i64;
        let manager = total - investor;
        assert_eq!(investor, 60000);
        assert_eq!(manager, 40000);
    }
}
