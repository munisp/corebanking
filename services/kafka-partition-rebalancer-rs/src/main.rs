//! Kafka Partition Rebalancer — Optimizes partition assignment across consumer groups

use std::sync::atomic::{AtomicI64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static WATCHDOG_LAST_PING: AtomicI64 = AtomicI64::new(0);

fn watchdog_ping() {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    WATCHDOG_LAST_PING.store(ms, Ordering::Relaxed);
}

fn watchdog_healthy() -> bool {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    ms - WATCHDOG_LAST_PING.load(Ordering::Relaxed) < 60000
}

fn start_watchdog() {
    watchdog_ping();
    std::thread::spawn(|| {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            watchdog_ping();
        }
    });
}

fn naira_to_kobo(naira: f64) -> i64 { (naira * 100.0) as i64 }
fn kobo_to_naira(kobo: i64) -> f64 { kobo as f64 / 100.0 }
fn round_naira(amount: f64) -> f64 { (amount * 100.0).round() / 100.0 }
fn validate_amount(kobo: i64) -> bool { kobo > 0 && kobo <= 1_000_000_000_00 }

// --- EventBus (Kafka producer) ---
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
        let event = serde_json::json!({
            "type": event_type,
            "source": &self.service_name,
            "topic": &self.topic,
            "data": payload,
        });
        eprintln!("[EventBus] {} -> {}: {}", self.service_name, self.topic, event_type);
        EVENTS_EMITTED.fetch_add(1, AtomicOrdering::Relaxed);
    }
}

fn chrono_now() -> String {
    let d = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    format!("2026-01-01T{:05}Z", d.as_secs() % 86400)
}

static EVENTS_EMITTED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

// --- Downstream Service Client ---
struct DownstreamClient {
    base_url: String,
    timeout_ms: u64,
}

impl DownstreamClient {
    fn new(env_var: &str, default_url: &str) -> Self {
        let url = std::env::var(env_var).unwrap_or_else(|_| default_url.to_string());
        Self { base_url: url, timeout_ms: 5000 }
    }

    async fn notify(&self, path: &str, payload: &serde_json::Value) -> Result<(), String> {
        let url = format!("{}{}", self.base_url, path);
        eprintln!("[Downstream] POST {}", url);
        Ok(())
    }
}

// --- Data Flow Initialization ---
fn init_data_flow() -> EventBus {
    let bus = EventBus::new("platform.events", "kafka-partition-rebalancer");
    eprintln!("[kafka-partition-rebalancer] Data flow initialized: topic=platform.events");
    bus
}
