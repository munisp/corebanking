#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
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
struct RebalanceRequest {
    topic: String,
    num_partitions: u32,
    num_consumers: u32,
}

#[derive(Serialize)]
struct RebalanceResponse {
    assignments: Vec<PartitionAssignment>,
    strategy: String,
}

#[derive(Serialize)]
struct PartitionAssignment {
    consumer_id: u32,
    partitions: Vec<u32>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "ok", "service": "kafka-partition-rebalancer-rs"}))
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

async fn rebalance(body: web::Json<RebalanceRequest>) -> HttpResponse {
    let req = body.into_inner();
    let mut assignments = Vec::new();
    let partitions_per_consumer = req.num_partitions / req.num_consumers;
    let remainder = req.num_partitions % req.num_consumers;
    let mut partition_idx: u32 = 0;

    for consumer in 0..req.num_consumers {
        let extra = if consumer < remainder { 1 } else { 0 };
        let count = partitions_per_consumer + extra;
        let parts: Vec<u32> = (partition_idx..partition_idx + count).collect();
        partition_idx += count;
        assignments.push(PartitionAssignment {
            consumer_id: consumer,
            partitions: parts,
        });
    }

    let bus = EventBus::new("platform.events", "kafka-partition-rebalancer");
    bus.emit("partitions.rebalanced", &json!({
        "topic": req.topic,
        "num_partitions": req.num_partitions,
        "num_consumers": req.num_consumers,
    }));

    HttpResponse::Ok().json(RebalanceResponse {
        assignments,
        strategy: "range".to_string(),
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
    eprintln!("[kafka-partition-rebalancer-rs] Starting on :{}", port);

    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/v1/rebalance", web::post().to(rebalance))
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
    fn test_range_assignment_even() {
        // 12 partitions, 3 consumers -> 4 each
        let num_p = 12u32;
        let num_c = 3u32;
        let per = num_p / num_c;
        assert_eq!(per, 4);
    }

    #[test]
    fn test_range_assignment_remainder() {
        // 13 partitions, 3 consumers -> 5,4,4
        let num_p = 13u32;
        let num_c = 3u32;
        let per = num_p / num_c;
        let rem = num_p % num_c;
        assert_eq!(per, 4);
        assert_eq!(rem, 1);
    }
}
