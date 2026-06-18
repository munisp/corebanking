// kpi-threshold-monitor-rs/middleware.rs — Rust middleware integration layer
// Connects to: Kafka (alert publishing), Redis (alert dedup), Fluvio (streaming),
//              Temporal (scheduled evaluation), OpenSearch (alert indexing)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Middleware connection status
#[derive(Clone, Serialize, Deserialize)]
pub struct MiddlewareConnection {
    pub name: String,
    pub status: String,
    pub endpoint: String,
    pub latency_ms: f64,
    pub last_check: String,
    pub purpose: String,
}

/// Kafka alert event for KPI threshold breaches
#[derive(Clone, Serialize, Deserialize)]
pub struct KafkaAlertEvent {
    pub event_type: String,      // "kpi.breach", "kpi.recovery", "kpi.escalation"
    pub topic: String,           // "kpi-alerts", "kpi-critical", "kpi-notifications"
    pub role: String,
    pub metric_id: String,
    pub metric_name: String,
    pub current_value: f64,
    pub threshold_value: f64,
    pub severity: String,
    pub timestamp: String,
    pub notification_channels: Vec<String>, // ["kafka", "email", "sms", "webhook"]
    pub escalation_chain: Vec<String>,      // ["analyst", "manager", "cro", "ceo"]
}

/// Fluvio streaming topic for real-time KPI data
#[derive(Clone, Serialize, Deserialize)]
pub struct FluvioKPIStream {
    pub topic: String,
    pub partitions: u32,
    pub retention_hours: u32,
    pub consumers: Vec<String>,
}

pub fn get_fluvio_topics() -> Vec<FluvioKPIStream> {
    vec![
        FluvioKPIStream { topic: "kpi.computed".into(), partitions: 11, retention_hours: 168, consumers: vec!["dashboard".into(), "analytics".into(), "opensearch".into()] },
        FluvioKPIStream { topic: "kpi.alerts".into(), partitions: 4, retention_hours: 720, consumers: vec!["notification-service".into(), "audit-trail".into()] },
        FluvioKPIStream { topic: "kpi.trends".into(), partitions: 11, retention_hours: 8760, consumers: vec!["lakehouse".into(), "forecasting".into()] },
    ]
}

/// Temporal workflow definitions for scheduled KPI evaluations
#[derive(Clone, Serialize, Deserialize)]
pub struct TemporalSchedule {
    pub workflow_id: String,
    pub cron: String,
    pub role: String,
    pub description: String,
}

pub fn get_temporal_schedules() -> Vec<TemporalSchedule> {
    vec![
        TemporalSchedule { workflow_id: "kpi-eval-cro-15min".into(), cron: "*/15 * * * *".into(), role: "cro".into(), description: "CRO AML alert evaluation every 15 min".into() },
        TemporalSchedule { workflow_id: "kpi-eval-cso-15min".into(), cron: "*/15 * * * *".into(), role: "cso".into(), description: "CSO security incident check every 15 min".into() },
        TemporalSchedule { workflow_id: "kpi-eval-coo-5min".into(), cron: "*/5 * * * *".into(), role: "coo".into(), description: "COO transaction health every 5 min".into() },
        TemporalSchedule { workflow_id: "kpi-eval-treasury-hourly".into(), cron: "0 * * * *".into(), role: "treasury".into(), description: "Treasury liquidity check hourly".into() },
        TemporalSchedule { workflow_id: "kpi-eval-all-daily".into(), cron: "0 7 * * *".into(), role: "all".into(), description: "Full KPI computation daily at 7 AM".into() },
        TemporalSchedule { workflow_id: "kpi-report-weekly".into(), cron: "0 8 * * 1".into(), role: "ceo".into(), description: "CEO weekly summary report".into() },
    ]
}

/// Redis alert deduplication
#[derive(Clone, Serialize, Deserialize)]
pub struct RedisAlertDedup {
    pub key_pattern: String,     // "kpi:alert:{role}:{metric_id}"
    pub ttl_seconds: u64,        // cooldown period
    pub dedup_strategy: String,  // "latest_only", "aggregate", "suppress"
}

pub fn get_redis_dedup_config() -> Vec<RedisAlertDedup> {
    vec![
        RedisAlertDedup { key_pattern: "kpi:alert:cro:aml_alerts".into(), ttl_seconds: 900, dedup_strategy: "latest_only".into() },
        RedisAlertDedup { key_pattern: "kpi:alert:cso:incidents".into(), ttl_seconds: 300, dedup_strategy: "latest_only".into() },
        RedisAlertDedup { key_pattern: "kpi:alert:coo:fail_rate".into(), ttl_seconds: 1800, dedup_strategy: "aggregate".into() },
        RedisAlertDedup { key_pattern: "kpi:alert:treasury:liquidity".into(), ttl_seconds: 1800, dedup_strategy: "latest_only".into() },
    ]
}

/// OpenSearch index mapping for KPI alerts
#[derive(Clone, Serialize, Deserialize)]
pub struct OpenSearchMapping {
    pub index_pattern: String,
    pub retention_days: u32,
    pub fields: Vec<String>,
}

pub fn get_opensearch_config() -> OpenSearchMapping {
    OpenSearchMapping {
        index_pattern: "kpi-alerts-*".into(),
        retention_days: 365,
        fields: vec![
            "role".into(), "metric_id".into(), "metric_name".into(),
            "value".into(), "threshold".into(), "severity".into(),
            "status".into(), "triggered_at".into(), "resolved_at".into(),
            "notification_sent".into(), "acknowledged_by".into(),
        ],
    }
}

/// Permify authorization check for KPI access
#[derive(Clone, Serialize, Deserialize)]
pub struct PermifyCheck {
    pub entity: String,       // "kpi_dashboard"
    pub relation: String,     // "viewer", "editor", "admin"
    pub subject: String,      // "user:{user_id}"
}

pub fn check_kpi_permission(user_role: &str, target_role: &str) -> bool {
    // CEO can view all
    if user_role == "ceo" || user_role == "admin" {
        return true;
    }
    // Users can view their own
    if user_role == target_role {
        return true;
    }
    // Managers can view direct reports (defined in org hierarchy)
    let direct_reports: HashMap<&str, Vec<&str>> = HashMap::from([
        ("ceo", vec!["coo", "cro", "cto", "cso", "treasury", "credit", "customer_service"]),
        ("coo", vec!["head_teller"]),
        ("cro", vec!["compliance", "internal_audit"]),
    ]);
    
    if let Some(reports) = direct_reports.get(user_role) {
        return reports.contains(&target_role);
    }
    false
}

/// Probe middleware connectivity
pub async fn probe_middleware(name: &str, endpoint: &str) -> MiddlewareConnection {
    let start = Instant::now();
    let status = match name {
        "kafka" | "redis" | "fluvio" | "temporal" | "tigerbeetle" | "permify" => {
            probe_tcp(endpoint).await
        }
        _ => probe_http(endpoint).await,
    };
    
    MiddlewareConnection {
        name: name.to_string(),
        status,
        endpoint: endpoint.to_string(),
        latency_ms: start.elapsed().as_secs_f64() * 1000.0,
        last_check: format!("{:?}", std::time::SystemTime::now()),
        purpose: get_middleware_purpose(name).to_string(),
    }
}

async fn probe_tcp(endpoint: &str) -> String {
    match tokio::time::timeout(
        Duration::from_secs(2),
        tokio::net::TcpStream::connect(endpoint),
    ).await {
        Ok(Ok(_)) => "connected".to_string(),
        _ => "disconnected".to_string(),
    }
}

async fn probe_http(endpoint: &str) -> String {
    let url = if endpoint.starts_with("http") {
        endpoint.to_string()
    } else {
        format!("http://{}", endpoint)
    };
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build();
    
    match client {
        Ok(c) => match c.get(&url).send().await {
            Ok(resp) if resp.status().as_u16() < 500 => "connected".to_string(),
            Ok(_) => "degraded".to_string(),
            Err(_) => "disconnected".to_string(),
        },
        Err(_) => "disconnected".to_string(),
    }
}

fn get_middleware_purpose(name: &str) -> &str {
    match name {
        "kafka" => "Event publishing for KPI threshold breach alerts and audit trail",
        "dapr" => "State management, pub/sub integration, service-to-service calls",
        "fluvio" => "Real-time KPI metric streaming and CDC event processing",
        "temporal" => "Scheduled KPI evaluation workflows and SLA tracking",
        "postgres" => "Primary data source for all 267 tables and KPI calculations",
        "keycloak" => "SSO authentication, session metrics, MFA adoption tracking",
        "permify" => "Fine-grained RBAC for KPI dashboard access control",
        "redis" => "KPI result caching (30s TTL), alert deduplication, rate limiting",
        "mojaloop" => "Interoperability transfer metrics and DFSP performance KPIs",
        "opensearch" => "KPI alert indexing, historical search, analytics dashboards",
        "openappsec" => "WAF security metrics, threat blocking, CSO dashboard data",
        "apisix" => "API gateway metrics, rate limit monitoring, upstream health",
        "tigerbeetle" => "Double-entry ledger performance, transfer throughput KPIs",
        "lakehouse" => "Materialized KPI views via Apache Iceberg + Sedona geospatial",
        _ => "Unknown middleware",
    }
}
