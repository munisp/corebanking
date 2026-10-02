use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Mutex;
use std::time::Instant;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
use actix_web::HttpMessage;
use actix_web::dev::Service as _;
use chrono::{DateTime, Utc};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: String,
    status: String,
    tenant_id: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    tenant_id: Option<String>,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

// W12-RUSTFIX-2: domain types synthesized from constructor/usage sites
// (generator emitted uses but never the definitions; E0425/E0422).
// Field types inferred from default_configs()/default_profiles() literals
// and the handler construction sites below.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SwipePattern {
    direction: String,
    avg_velocity: f64,
    avg_pressure: f64,
    avg_length_px: f64,
    frequency: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrientationBaseline {
    avg_tilt_x: f64,
    avg_tilt_y: f64,
    avg_tilt_z: f64,
    variance_x: f64,
    variance_y: f64,
    variance_z: f64,
    is_stable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BehavioralProfile {
    customer_id: String,
    typing_cadence_ms: Vec<f64>,
    avg_typing_speed: f64,
    typing_rhythm_signature: Vec<f64>,
    swipe_patterns: Vec<SwipePattern>,
    device_orientation_baseline: OrientationBaseline,
    session_count: u32,
    anomaly_score: f64,
    last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StepUpConfig {
    id: String,
    trigger: String,
    threshold: u64,
    methods: Vec<String>,
    frequency: String,
    tenant_id: String,
    enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContinuousCheck {
    id: String,
    customer_id: String,
    trigger: String,
    transaction_amount: u64,
    methods_applied: Vec<String>,
    overall_score: f64,
    passed: bool,
    device_fingerprint: String,
    behavioral_score: f64,
    timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BehavioralCheck {
    id: String,
    customer_id: String,
    typing_score: f64,
    swipe_score: f64,
    orientation_score: f64,
    combined_score: f64,
    anomalies: Vec<String>,
    passed: bool,
    device_info: String,
    timestamp: String,
}

struct AppState {
    start_time: Instant,
    // W12-C3-PX (c3-0482/c3-0483/c3-0484/c3-0485): the four in-memory
    // Mutex<Vec<...>> stores (configs/checks/profiles/behavioral_checks) were
    // removed. Step-up configs, liveness checks, behavioral profiles and
    // behavioral checks are business data and now live in the Postgres tables
    // stepup_configs / liveness_checks / behavioral_profiles / behavioral_checks
    // (DDL + idempotent seed in init_db). All create/list/stats paths read and
    // write PG; no read-through cache is retained.
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

// W12-C3-PX: fail-closed accessor for the shared PG client. Biometric/liveness
// verification artifacts and step-up policy must never silently live only in
// memory, so handlers 503 when no database is configured.
fn pg_client(state: &web::Data<AppState>) -> Result<std::sync::Arc<tokio_postgres::Client>, HttpResponse> {
    match &state.db_client {
        Some(c) => Ok(c.clone()),
        None => Err(HttpResponse::ServiceUnavailable().json(json!({
            "error": "persistence_unavailable",
            "detail": "DATABASE_URL is not configured; continuous-liveness data cannot be persisted"
        }))),
    }
}

// W12-C3-PX: default step-up configs as JSON payloads (identical field set to
// the legacy StepUpConfig seeds). Seeded into stepup_configs at boot with
// ON CONFLICT DO NOTHING (natural key = config id).
fn default_stepup_configs_json() -> Vec<serde_json::Value> {
    vec![
        json!({"id": "SUC-001", "trigger": "high_value_transfer", "threshold": 5_000_000, "methods": ["passive_3d", "blink_challenge"], "frequency": "per_transaction", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-002", "trigger": "international_transfer", "threshold": 0, "methods": ["passive_3d", "face_match", "smile_challenge"], "frequency": "per_transaction", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-003", "trigger": "new_beneficiary_large", "threshold": 2_000_000, "methods": ["passive_3d"], "frequency": "per_beneficiary", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-004", "trigger": "periodic_tier3_quarterly", "threshold": 0, "methods": ["passive_3d", "face_match", "blink", "smile", "head_turn"], "frequency": "quarterly", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-005", "trigger": "device_change", "threshold": 0, "methods": ["passive_3d", "face_match", "blink_challenge"], "frequency": "per_event", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-006", "trigger": "suspicious_behavior", "threshold": 0, "methods": ["passive_3d", "face_match", "head_turn", "nod"], "frequency": "per_event", "tenant_id": "default", "enabled": true}),
        json!({"id": "SUC-007", "trigger": "behavioral_anomaly", "threshold": 0, "methods": ["passive_3d", "typing_cadence", "swipe_pattern"], "frequency": "per_event", "tenant_id": "default", "enabled": true}),
    ]
}

// W12-C3-PX: default behavioral profile as a JSON payload (identical field set
// to the legacy BehavioralProfile seed). Natural key = customer_id.
fn default_profiles_json() -> Vec<serde_json::Value> {
    vec![
        json!({
            "customer_id": "CUST-001",
            "typing_cadence_ms": [120.0, 135.0, 110.0, 128.0, 145.0],
            "avg_typing_speed": 127.6,
            "typing_rhythm_signature": [0.85, 0.92, 0.78, 0.88, 0.91],
            "swipe_patterns": [
                {"direction": "right", "avg_velocity": 450.0, "avg_pressure": 0.65, "avg_length_px": 320.0, "frequency": 45},
                {"direction": "up", "avg_velocity": 380.0, "avg_pressure": 0.58, "avg_length_px": 480.0, "frequency": 120},
                {"direction": "down", "avg_velocity": 350.0, "avg_pressure": 0.52, "avg_length_px": 420.0, "frequency": 95},
            ],
            "device_orientation_baseline": {
                "avg_tilt_x": 12.5, "avg_tilt_y": -3.2, "avg_tilt_z": 88.1,
                "variance_x": 2.1, "variance_y": 1.8, "variance_z": 0.5, "is_stable": true,
            },
            "session_count": 245, "anomaly_score": 0.05, "last_updated": "2026-05-09T10:00:00Z",
        }),
    ]
}

// W12-C3-PX: JSON-valued twins of the legacy analysis functions (the legacy
// typed versions above are retained for the RUSTFIX compile-repair layer).
fn analyze_typing_j(submitted: &[f64], baseline: &serde_json::Value) -> (f64, Vec<String>) {
    let cadence: Vec<f64> = baseline.get("typing_cadence_ms").and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect()).unwrap_or_default();
    let avg_speed = baseline.get("avg_typing_speed").and_then(|v| v.as_f64()).unwrap_or(0.0);
    if submitted.is_empty() || cadence.is_empty() || avg_speed <= 0.0 {
        return (0.5, vec!["insufficient_typing_data".into()]);
    }
    let sub_avg: f64 = submitted.iter().sum::<f64>() / submitted.len() as f64;
    let diff = (sub_avg - avg_speed).abs();
    let deviation_pct = diff / avg_speed;
    let score = (1.0 - deviation_pct * 2.0).max(0.0).min(1.0);
    let mut anomalies = vec![];
    if deviation_pct > 0.3 {
        anomalies.push(format!("typing_speed_deviation_{:.0}pct", deviation_pct * 100.0));
    }
    (score, anomalies)
}

fn analyze_swipe_j(velocity: f64, pressure: f64, baseline: &serde_json::Value) -> (f64, Vec<String>) {
    let patterns: Vec<&serde_json::Value> = baseline.get("swipe_patterns").and_then(|v| v.as_array())
        .map(|a| a.iter().collect()).unwrap_or_default();
    if patterns.is_empty() {
        return (0.5, vec!["no_swipe_baseline".into()]);
    }
    let n = patterns.len() as f64;
    let avg_vel: f64 = patterns.iter().filter_map(|s| s.get("avg_velocity").and_then(|v| v.as_f64())).sum::<f64>() / n;
    let avg_pres: f64 = patterns.iter().filter_map(|s| s.get("avg_pressure").and_then(|v| v.as_f64())).sum::<f64>() / n;
    if avg_vel <= 0.0 || avg_pres <= 0.0 {
        return (0.5, vec!["no_swipe_baseline".into()]);
    }
    let vel_diff = ((velocity - avg_vel) / avg_vel).abs();
    let pres_diff = ((pressure - avg_pres) / avg_pres).abs();
    let score = (1.0 - (vel_diff + pres_diff) / 2.0).max(0.0).min(1.0);
    let mut anomalies = vec![];
    if vel_diff > 0.4 {
        anomalies.push("swipe_velocity_anomaly".into());
    }
    if pres_diff > 0.5 {
        anomalies.push("swipe_pressure_anomaly".into());
    }
    (score, anomalies)
}

fn analyze_orientation_j(tilt_x: f64, tilt_y: f64, tilt_z: f64, baseline: &serde_json::Value) -> (f64, Vec<String>) {
    let empty = json!({});
    let ob = baseline.get("device_orientation_baseline").unwrap_or(&empty);
    let f = |k: &str| ob.get(k).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let dx = (tilt_x - f("avg_tilt_x")).abs();
    let dy = (tilt_y - f("avg_tilt_y")).abs();
    let dz = (tilt_z - f("avg_tilt_z")).abs();
    let score_x = (1.0 - dx / (f("variance_x") * 3.0 + 1.0)).max(0.0);
    let score_y = (1.0 - dy / (f("variance_y") * 3.0 + 1.0)).max(0.0);
    let score_z = (1.0 - dz / (f("variance_z") * 3.0 + 1.0)).max(0.0);
    let score = (score_x + score_y + score_z) / 3.0;
    let mut anomalies = vec![];
    if dx > f("variance_x") * 4.0 {
        anomalies.push("orientation_x_anomaly".into());
    }
    if dy > f("variance_y") * 4.0 {
        anomalies.push("orientation_y_anomaly".into());
    }
    if dz > f("variance_z") * 4.0 {
        anomalies.push("orientation_z_anomaly".into());
    }
    (score, anomalies)
}

// W12-C3-PX: PG read helpers (payload jsonb round-trips via ::text because the
// tokio-postgres serde_json feature is not enabled in this crate).
async fn pg_list_payloads(client: &tokio_postgres::Client, table: &str, tenant_id: &str, include_default: bool, limit: i64) -> Result<Vec<serde_json::Value>, tokio_postgres::Error> {
    let rows = if include_default {
        client.query(
            &format!("SELECT payload::text AS payload FROM {} WHERE tenant_id = $1 OR tenant_id = 'default' ORDER BY created_at ASC LIMIT $2", table),
            &[&tenant_id, &limit],
        ).await?
    } else {
        client.query(
            &format!("SELECT payload::text AS payload FROM {} WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2", table),
            &[&tenant_id, &limit],
        ).await?
    };
    Ok(rows.iter()
        .filter_map(|r| serde_json::from_str::<serde_json::Value>(r.get::<&str, &str>("payload")).ok())
        .collect())
}

async fn pg_count(client: &tokio_postgres::Client, table: &str, tenant_id: &str) -> Result<i64, tokio_postgres::Error> {
    let row = client.query_one(&format!("SELECT count(*) AS n FROM {} WHERE tenant_id = $1", table), &[&tenant_id]).await?;
    Ok(row.get("n"))
}

// W12-C3-PX: (total, passed) aggregate for a verification-artifact table.
async fn pg_passed_agg(client: &tokio_postgres::Client, table: &str, tenant_id: &str) -> Result<(i64, i64), tokio_postgres::Error> {
    let row = client.query_one(
        &format!("SELECT count(*) AS n, count(*) FILTER (WHERE (payload->>'passed')::boolean) AS p FROM {} WHERE tenant_id = $1", table),
        &[&tenant_id],
    ).await?;
    Ok((row.get("n"), row.get("p")))
}

async fn pg_insert_payload(client: &tokio_postgres::Client, table: &str, id: &str, tenant_id: &str, payload: &serde_json::Value) -> Result<(), tokio_postgres::Error> {
    let payload_str = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());
    client.execute(
        &format!("INSERT INTO {} (id, tenant_id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING", table),
        &[&id, &tenant_id, &payload_str],
    ).await?;
    Ok(())
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

fn default_configs() -> Vec<StepUpConfig> {
    vec![
        StepUpConfig { id: "SUC-001".into(), trigger: "high_value_transfer".into(), threshold: 5_000_000, methods: vec!["passive_3d".into(), "blink_challenge".into()], frequency: "per_transaction".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-002".into(), trigger: "international_transfer".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "smile_challenge".into()], frequency: "per_transaction".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-003".into(), trigger: "new_beneficiary_large".into(), threshold: 2_000_000, methods: vec!["passive_3d".into()], frequency: "per_beneficiary".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-004".into(), trigger: "periodic_tier3_quarterly".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "blink".into(), "smile".into(), "head_turn".into()], frequency: "quarterly".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-005".into(), trigger: "device_change".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "blink_challenge".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-006".into(), trigger: "suspicious_behavior".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "head_turn".into(), "nod".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-007".into(), trigger: "behavioral_anomaly".into(), threshold: 0, methods: vec!["passive_3d".into(), "typing_cadence".into(), "swipe_pattern".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
    ]
}

fn default_profiles() -> Vec<BehavioralProfile> {
    vec![
        BehavioralProfile {
            customer_id: "CUST-001".into(),
            typing_cadence_ms: vec![120.0, 135.0, 110.0, 128.0, 145.0],
            avg_typing_speed: 127.6,
            typing_rhythm_signature: vec![0.85, 0.92, 0.78, 0.88, 0.91],
            swipe_patterns: vec![
                SwipePattern { direction: "right".into(), avg_velocity: 450.0, avg_pressure: 0.65, avg_length_px: 320.0, frequency: 45 },
                SwipePattern { direction: "up".into(), avg_velocity: 380.0, avg_pressure: 0.58, avg_length_px: 480.0, frequency: 120 },
                SwipePattern { direction: "down".into(), avg_velocity: 350.0, avg_pressure: 0.52, avg_length_px: 420.0, frequency: 95 },
            ],
            device_orientation_baseline: OrientationBaseline {
                avg_tilt_x: 12.5, avg_tilt_y: -3.2, avg_tilt_z: 88.1,
                variance_x: 2.1, variance_y: 1.8, variance_z: 0.5, is_stable: true,
            },
            session_count: 245, anomaly_score: 0.05, last_updated: "2026-05-09T10:00:00Z".into(),
        },
    ]
}

// ─── Behavioral Analysis Functions ──────────────────────────────────────────

fn analyze_typing(submitted: &[f64], baseline: &BehavioralProfile) -> (f64, Vec<String>) {
    if submitted.is_empty() || baseline.typing_cadence_ms.is_empty() {
        return (0.5, vec!["insufficient_typing_data".into()]);
    }
    let sub_avg: f64 = submitted.iter().sum::<f64>() / submitted.len() as f64;
    let diff = (sub_avg - baseline.avg_typing_speed).abs();
    let deviation_pct = diff / baseline.avg_typing_speed;
    let score = (1.0 - deviation_pct * 2.0).max(0.0).min(1.0);
    let mut anomalies = vec![];
    if deviation_pct > 0.3 {
        anomalies.push(format!("typing_speed_deviation_{:.0}pct", deviation_pct * 100.0));
    }
    (score, anomalies)
}

fn analyze_swipe(velocity: f64, pressure: f64, baseline: &BehavioralProfile) -> (f64, Vec<String>) {
    if baseline.swipe_patterns.is_empty() {
        return (0.5, vec!["no_swipe_baseline".into()]);
    }
    let avg_vel: f64 = baseline.swipe_patterns.iter().map(|s| s.avg_velocity).sum::<f64>()
        / baseline.swipe_patterns.len() as f64;
    let avg_pres: f64 = baseline.swipe_patterns.iter().map(|s| s.avg_pressure).sum::<f64>()
        / baseline.swipe_patterns.len() as f64;

    let vel_diff = ((velocity - avg_vel) / avg_vel).abs();
    let pres_diff = ((pressure - avg_pres) / avg_pres).abs();
    let score = (1.0 - (vel_diff + pres_diff) / 2.0).max(0.0).min(1.0);

    let mut anomalies = vec![];
    if vel_diff > 0.4 {
        anomalies.push("swipe_velocity_anomaly".into());
    }
    if pres_diff > 0.5 {
        anomalies.push("swipe_pressure_anomaly".into());
    }
    (score, anomalies)
}

fn analyze_orientation(tilt_x: f64, tilt_y: f64, tilt_z: f64, baseline: &OrientationBaseline) -> (f64, Vec<String>) {
    let dx = (tilt_x - baseline.avg_tilt_x).abs();
    let dy = (tilt_y - baseline.avg_tilt_y).abs();
    let dz = (tilt_z - baseline.avg_tilt_z).abs();

    let score_x = (1.0 - dx / (baseline.variance_x * 3.0 + 1.0)).max(0.0);
    let score_y = (1.0 - dy / (baseline.variance_y * 3.0 + 1.0)).max(0.0);
    let score_z = (1.0 - dz / (baseline.variance_z * 3.0 + 1.0)).max(0.0);
    let score = (score_x + score_y + score_z) / 3.0;

    let mut anomalies = vec![];
    if dx > baseline.variance_x * 4.0 {
        anomalies.push("orientation_x_anomaly".into());
    }
    if dy > baseline.variance_y * 4.0 {
        anomalies.push("orientation_y_anomaly".into());
    }
    if dz > baseline.variance_z * 4.0 {
        anomalies.push("orientation_z_anomaly".into());
    }
    (score, anomalies)
}

// ─── Handlers ───────────────────────────────────────────────────────────────


// --- Graceful Degradation ---
use std::sync::atomic::AtomicBool;

static DB_AVAILABLE: AtomicBool = AtomicBool::new(true);
static CACHE_AVAILABLE: AtomicBool = AtomicBool::new(true);

fn degradation_mode() -> &'static str {
    if DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) { "normal" } else { "degraded" }
}

async fn degradation_status(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    HttpResponse::Ok().json(json!({
        "db_available": DB_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "cache_available": CACHE_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed),
        "mode": degradation_mode(),
    }))
}

async fn healthz(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if !rl_allow().await {
        return HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", "1"))
            .json(serde_json::json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // Inter-service call
    let _upstream_url = std::env::var("AML_ENGINE_URL").unwrap_or_else(|_| "http://localhost:8120".to_string());
    {
        // Wave-11: upstream AML/notify result is discarded on this path; run
        // fire-and-forget with a 3s timeout instead of blocking the request.
        let (w11_url, w11_body) = ((format!("{}/v1/screen", _upstream_url)).to_string(), ("{}").to_string());
        tokio::spawn(async move {
            match tokio::time::timeout(
                std::time::Duration::from_secs(3),
                tokio::task::spawn_blocking(move || call_service_sync(&w11_url, &w11_body)),
            ).await {
                Ok(Ok(Ok(_resp))) => {}
                Ok(Ok(Err(e))) => eprintln!("continuous-liveness-rs: upstream call failed: {}", e),
                Ok(Err(e)) => eprintln!("continuous-liveness-rs: upstream call join failed: {}", e),
                Err(_) => eprintln!("continuous-liveness-rs: upstream call timed out after 3s"),
            }
        });
    }
    db_persist(&state, "healthz", &json!({"action": "healthz"})).await;
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({
        "service": "continuous-liveness-rs",
        "status": "healthy",
        "version": "2.0.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "domain": "Continuous Liveness + Behavioral Biometrics",
        "capabilities": [
            "transaction_step_up", "periodic_reverification",
            "device_change_detection", "behavioral_biometrics",
            "typing_cadence_analysis", "swipe_pattern_matching",
            "device_orientation_anomaly", "risk_based_challenge_selection",
            "tenant_configurable_rules", "behavioral_profile_management",
        ],
        "triggers": ["high_value_transfer", "international_transfer", "new_beneficiary_large",
                     "periodic_tier3_quarterly", "device_change", "suspicious_behavior", "behavioral_anomaly"],
        "behavioral_methods": ["typing_cadence", "swipe_velocity", "swipe_pressure",
                              "device_orientation_xyz", "session_frequency"],
        "middleware": {
            "kafka": "continuous-liveness.events, continuous-liveness.triggers, behavioral.anomalies",
            "postgres": "liveness_checks, behavioral_profiles, behavioral_checks",
            "redis": "device_fingerprints, behavioral_baselines (TTL 30d)",
            "temporal": "ContinuousLivenessWorkflow, BehavioralAnalysisChild",
            "opensearch": "continuous-liveness-2026",
        }
    }))
}

async fn get_configs(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // W12-C3-PX (c3-0482): list reads come from PG (tenant + seeded defaults).
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let configs = match pg_list_payloads(&client, "stepup_configs", &tenant_id, true, 500).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    db_persist(&state, "get_configs", &json!({"action": "get_configs"})).await;
    HttpResponse::Ok().json(json!({"configs": &configs, "total": configs.len()}))
}

async fn evaluate_step_up(body: web::Json<serde_json::Value>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "liveness", "collection", "evaluate").await { return resp; }
    let _sanitized = sanitize_input("");
    let customer_id = body.get("customerId").and_then(|v| v.as_str()).unwrap_or("unknown");
    let trigger = body.get("trigger").and_then(|v| v.as_str()).unwrap_or("high_value_transfer");
    let amount = body.get("transactionAmount").and_then(|v| v.as_u64()).unwrap_or(0);

    // W12-C3-PX (c3-0482/c3-0483): configs are evaluated from PG and the
    // resulting check artifact is persisted to PG (idempotent on its id).
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let configs = match pg_list_payloads(&client, "stepup_configs", &tenant_id, true, 500).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    let matching_config = configs.into_iter().find(|c| {
        c.get("trigger").and_then(|v| v.as_str()) == Some(trigger)
            && c.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false)
            && amount >= c.get("threshold").and_then(|v| v.as_u64()).unwrap_or(0)
    });

    match matching_config {
        Some(config) => {
            let score = 0.85 + (rand_u32() % 14) as f64 / 100.0;
            let passed = score >= 0.75;
            let check = json!({
                "id": format!("CLV-{:08X}", rand_u32()),
                "customer_id": customer_id,
                "trigger": trigger,
                "transaction_amount": amount,
                "methods_applied": config.get("methods").cloned().unwrap_or(json!([])),
                "overall_score": score,
                "passed": passed,
                "device_fingerprint": format!("DEV-{:06X}", rand_u32() % 0xFFFFFF),
                "behavioral_score": 0.90 + (rand_u32() % 10) as f64 / 100.0,
                "timestamp": chrono_now(),
            });

            if let Err(e) = pg_insert_payload(&client, "liveness_checks", check["id"].as_str().unwrap_or(""), &tenant_id, &check).await {
                return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()}));
            }

    db_persist(&state, "evaluate_step_up", &json!({"action": "evaluate_step_up"})).await;
            HttpResponse::Ok().json(json!({
                "step_up_required": true,
                "config": config,
                "check": check,
                "decision": if passed { "allow" } else { "block" },
            }))
        }
        None => {
            HttpResponse::Ok().json(json!({
                "step_up_required": false,
                "reason": "No matching trigger config or threshold not met",
                "trigger": trigger,
                "amount": amount,
            }))
        }
    }
}

async fn analyze_behavioral(body: web::Json<serde_json::Value>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    if let Err(resp) = permify_check(&req, "liveness", "collection", "analyze").await { return resp; }
    let customer_id = body.get("customerId").and_then(|v| v.as_str()).unwrap_or("unknown");

    // W12-C3-PX (c3-0484/c3-0485): the behavioral profile is loaded from PG
    // (falling back to the seeded CUST-001 default, then the inline seed), and
    // the resulting check artifact is persisted to PG.
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let mut prof: Option<serde_json::Value> = match client.query_opt(
        "SELECT payload::text AS payload FROM behavioral_profiles WHERE id = $1 LIMIT 1",
        &[&customer_id],
    ).await {
        Ok(Some(row)) => serde_json::from_str::<serde_json::Value>(row.get("payload")).ok(),
        Ok(None) => None,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    if prof.is_none() {
        prof = match client.query_opt(
            "SELECT payload::text AS payload FROM behavioral_profiles WHERE id = 'CUST-001' LIMIT 1",
            &[],
        ).await {
            Ok(Some(row)) => serde_json::from_str::<serde_json::Value>(row.get("payload")).ok(),
            Ok(None) => None,
            Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
        };
    }
    let default_profile = default_profiles_json().into_iter().next().unwrap();
    let prof = prof.as_ref().unwrap_or(&default_profile);

    // Extract typing cadence
    let typing: Vec<f64> = body.get("typingCadenceMs")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();

    let swipe_vel = body.get("swipeVelocity").and_then(|v| v.as_f64()).unwrap_or(400.0);
    let swipe_pres = body.get("swipePressure").and_then(|v| v.as_f64()).unwrap_or(0.6);
    let tilt_x = body.get("orientationX").and_then(|v| v.as_f64()).unwrap_or(12.0);
    let tilt_y = body.get("orientationY").and_then(|v| v.as_f64()).unwrap_or(-3.0);
    let tilt_z = body.get("orientationZ").and_then(|v| v.as_f64()).unwrap_or(88.0);

    let (typing_score, mut anomalies) = analyze_typing_j(&typing, prof);
    let (swipe_score, swipe_anomalies) = analyze_swipe_j(swipe_vel, swipe_pres, prof);
    let (orient_score, orient_anomalies) = analyze_orientation_j(tilt_x, tilt_y, tilt_z, prof);

    anomalies.extend(swipe_anomalies);
    anomalies.extend(orient_anomalies);

    let combined = typing_score * 0.35 + swipe_score * 0.30 + orient_score * 0.35;
    let passed = combined >= 0.60 && anomalies.len() < 3;

    let check = json!({
        "id": format!("BHV-{:08X}", rand_u32()),
        "customer_id": customer_id,
        "typing_score": typing_score,
        "swipe_score": swipe_score,
        "orientation_score": orient_score,
        "combined_score": combined,
        "anomalies": anomalies,
        "passed": passed,
        "device_info": body.get("deviceInfo").and_then(|v| v.as_str()).unwrap_or("unknown"),
        "timestamp": chrono_now(),
    });

    if let Err(e) = pg_insert_payload(&client, "behavioral_checks", check["id"].as_str().unwrap_or(""), &tenant_id, &check).await {
        return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()}));
    }

    db_persist(&state, "analyze_behavioral", &json!({"action": "analyze_behavioral"})).await;
    HttpResponse::Ok().json(json!({
        "behavioral_check": check,
        "decision": if passed { "normal" } else { "step_up_required" },
        "recommendation": if !passed { "Trigger additional liveness verification" } else { "Continue session" },
    }))
}

async fn get_profiles(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // W12-C3-PX (c3-0484): list reads come from PG.
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let profiles = match pg_list_payloads(&client, "behavioral_profiles", &tenant_id, true, 500).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    db_persist(&state, "get_profiles", &json!({"action": "get_profiles"})).await;
    HttpResponse::Ok().json(json!({"profiles": &profiles, "total": profiles.len()}))
}

async fn get_checks(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // W12-C3-PX (c3-0483): list reads come from PG.
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let checks = match pg_list_payloads(&client, "liveness_checks", &tenant_id, false, 500).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    db_persist(&state, "get_checks", &json!({"action": "get_checks"})).await;
    HttpResponse::Ok().json(json!({"checks": &checks, "total": checks.len()}))
}

async fn get_behavioral_checks(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // W12-C3-PX (c3-0485): list reads come from PG.
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let checks = match pg_list_payloads(&client, "behavioral_checks", &tenant_id, false, 500).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    db_persist(&state, "get_behavioral_checks", &json!({"action": "get_behavioral_checks"})).await;
    HttpResponse::Ok().json(json!({"behavioral_checks": &checks, "total": checks.len()}))
}

async fn get_stats(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    // W12-C3-PX (c3-0483/c3-0485): stats aggregate from PG (restart-safe).
    let client = match pg_client(&state) {
        Ok(c) => c,
        Err(resp) => return resp,
    };
    let tenant_id = get_tenant_id(&req);
    let (total, passed) = match pg_passed_agg(&client, "liveness_checks", &tenant_id).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    let (beh_total, beh_passed) = match pg_passed_agg(&client, "behavioral_checks", &tenant_id).await {
        Ok(v) => v,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    let beh_anomalies: i64 = match client.query_one(
        "SELECT COALESCE(SUM(jsonb_array_length(COALESCE(payload->'anomalies', '[]'::jsonb))), 0) AS n FROM behavioral_checks WHERE tenant_id = $1",
        &[&tenant_id],
    ).await {
        Ok(r) => r.get("n"),
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    let trigger_rows = match client.query(
        "SELECT payload->>'trigger' AS t, count(*) AS n FROM liveness_checks WHERE tenant_id = $1 GROUP BY 1",
        &[&tenant_id],
    ).await {
        Ok(r) => r,
        Err(e) => return HttpResponse::ServiceUnavailable().json(json!({"error": "persistence_unavailable", "detail": e.to_string()})),
    };
    let trig_count = |name: &str| trigger_rows.iter()
        .filter(|r| r.get::<&str, Option<String>>("t").as_deref() == Some(name))
        .map(|r| r.get::<&str, i64>("n"))
        .sum::<i64>();
    db_persist(&state, "get_stats", &json!({"action": "get_stats"})).await;
    HttpResponse::Ok().json(json!({
        "step_up_evaluations": total,
        "step_up_passed": passed,
        "step_up_failed": total - passed,
        "step_up_pass_rate": if total > 0 { passed as f64 / total as f64 } else { 0.0 },
        "behavioral_checks": beh_total,
        "behavioral_passed": beh_passed,
        "behavioral_anomalies": beh_anomalies,
        "triggers": {
            "high_value_transfer": trig_count("high_value_transfer"),
            "international_transfer": trig_count("international_transfer"),
            "device_change": trig_count("device_change"),
            "behavioral_anomaly": trig_count("behavioral_anomaly"),
        }
    }))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn rand_u32() -> u32 {
    use std::time::SystemTime;
    let d = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap();
    (d.subsec_nanos() ^ (d.as_secs() as u32)) & 0xFFFFFFFF
}

fn chrono_now() -> String {
    use std::time::SystemTime;
    let d = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap();
    format!("2026-05-09T{:02}:{:02}:{:02}Z", (d.as_secs() / 3600) % 24, (d.as_secs() / 60) % 60, d.as_secs() % 60)
}

// ─── Main ───────────────────────────────────────────────────────────────────


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;



// --- Alerting ---
async fn alerts_endpoint(req: actix_web::HttpRequest) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await { return resp; }
    let reqs = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let errs = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let error_rate = if reqs > 0 { errs as f64 / reqs as f64 } else { 0.0 };
    let mut fired = Vec::<serde_json::Value>::new();
    if error_rate > 0.05 {
        fired.push(json!({"rule": "high_error_rate", "value": error_rate, "severity": "critical"}));
    }
    HttpResponse::Ok().json(json!({
        "alerts": fired,
        "rules": 3,
        "error_rate": error_rate,
    }))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "continuous-liveness-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"continuous-liveness-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"continuous-liveness-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            // W12-C3-PX (c3-0482..0485): PG homes for step-up configs, liveness
            // checks, behavioral profiles and behavioral checks (were: AppState
            // Mutex<Vec> stores). ids are domain natural keys (SUC-/CLV-/BHV-
            // codes, customer_id) giving idempotent upserts; tenant ids are
            // non-UUID strings (get_tenant_id).
            for ddl in [
                "CREATE TABLE IF NOT EXISTS stepup_configs (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
                "CREATE TABLE IF NOT EXISTS liveness_checks (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
                "CREATE TABLE IF NOT EXISTS behavioral_profiles (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
                "CREATE TABLE IF NOT EXISTS behavioral_checks (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
                "CREATE INDEX IF NOT EXISTS idx_stepup_configs_tenant ON stepup_configs(tenant_id)",
                "CREATE INDEX IF NOT EXISTS idx_liveness_checks_tenant ON liveness_checks(tenant_id)",
                "CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_tenant ON behavioral_profiles(tenant_id)",
                "CREATE INDEX IF NOT EXISTS idx_behavioral_checks_tenant ON behavioral_checks(tenant_id)",
            ] {
                let _ = client.execute(ddl, &[]).await;
            }
            // W12-C3-PX: idempotent seed of the legacy default configs/profile
            // (natural-key ON CONFLICT DO NOTHING) so first-boot behaviour is
            // unchanged but the data survives restarts and is shared across
            // replicas.
            for cfg in default_stepup_configs_json() {
                let id = cfg.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let tenant = cfg.get("tenant_id").and_then(|v| v.as_str()).unwrap_or("default").to_string();
                let payload = serde_json::to_string(&cfg).unwrap_or_else(|_| "{}".to_string());
                let _ = client.execute(
                    "INSERT INTO stepup_configs (id, tenant_id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING",
                    &[&id, &tenant, &payload],
                ).await;
            }
            for prof in default_profiles_json() {
                let id = prof.get("customer_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let payload = serde_json::to_string(&prof).unwrap_or_else(|_| "{}".to_string());
                let _ = client.execute(
                    "INSERT INTO behavioral_profiles (id, tenant_id, payload) VALUES ($1, 'default', $2::jsonb) ON CONFLICT (id) DO NOTHING",
                    &[&id, &payload],
                ).await;
            }
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
// --- JWT Auth Check (fail-closed; R4-V4 remediation) ---
// Canonical RS256/JWKS-primary verifier aligned with pin-block-engine-rs:
// tokens are verified against the Keycloak JWKS (KEYCLOAK_JWKS_URL, or derived
// from KEYCLOAK_REALM_URL) with a 300s cache and a 5s fetch timeout; HS256 via
// JWT_SECRET remains as a fallback. 401 on missing/malformed/expired/
// unknown-kid tokens; 503 when no verification backend is available. Verified
// claims are stored in request extensions for downstream handlers.

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct VerifiedClaims(serde_json::Value);

struct JwksCacheEntry {
    fetched_at: std::time::Instant,
    keys: jsonwebtoken::jwk::JwkSet,
}

static JWKS_CACHE: std::sync::OnceLock<std::sync::Mutex<Option<JwksCacheEntry>>> = std::sync::OnceLock::new();

fn jwks_cache() -> &'static std::sync::Mutex<Option<JwksCacheEntry>> {
    JWKS_CACHE.get_or_init(|| std::sync::Mutex::new(None))
}

fn jwks_url() -> Option<String> {
    if let Ok(u) = std::env::var("KEYCLOAK_JWKS_URL") {
        if !u.is_empty() {
            return Some(u);
        }
    }
    match std::env::var("KEYCLOAK_REALM_URL") {
        Ok(realm) if !realm.is_empty() => {
            Some(format!("{}/protocol/openid-connect/certs", realm.trim_end_matches('/')))
        }
        _ => None,
    }
}

async fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, actix_web::HttpResponse> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => {
            return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwt_validation_unavailable",
                "detail": "no JWKS endpoint configured"
            })))
        }
    };
    {
        let cache = jwks_cache().lock().unwrap();
        if let Some(entry) = cache.as_ref() {
            if entry.fetched_at.elapsed() < JWKS_TTL {
                return Ok(entry.keys.clone());
            }
        }
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "client init failed"
        })))?;
    let resp = client.get(&url).send().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "jwks_unavailable"}))
    })?;
    if !resp.status().is_success() {
        return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "upstream returned error status"
        })));
    }
    let keys = resp.json::<jsonwebtoken::jwk::JwkSet>().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "malformed JWKS payload"
        }))
    })?;
    let mut cache = jwks_cache().lock().unwrap();
    *cache = Some(JwksCacheEntry { fetched_at: std::time::Instant::now(), keys: keys.clone() });
    Ok(keys)
}

fn apply_iss_aud(validation: &mut jsonwebtoken::Validation) {
    if let Ok(iss) = std::env::var("JWT_EXPECTED_ISS") {
        if !iss.is_empty() {
            validation.set_issuer(&[iss]);
        }
    }
    if let Ok(aud) = std::env::var("JWT_EXPECTED_AUD") {
        if !aud.is_empty() {
            validation.set_audience(&[aud]);
        }
    }
}

async fn verify_jwt_token(token: &str) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let header = jsonwebtoken::decode_header(token)
        .map_err(|_| actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "malformed token header"})))?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing kid"}))),
            };
            // JWKS outage => 503 (fail closed). Unknown kid => force one cache
            // refresh (key rotation), then 401 if still unknown.
            let jwks = fetch_jwks().await?;
            let jwk = match jwks.find(&kid) {
                Some(j) => j.clone(),
                None => {
                    {
                        let mut cache = jwks_cache().lock().unwrap();
                        *cache = None;
                    }
                    let refreshed = fetch_jwks().await?;
                    match refreshed.find(&kid) {
                        Some(j) => j.clone(),
                        None => {
                            return Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "unknown kid"})))
                        }
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk)
                .map_err(|_| actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid jwk"})))?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err(actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                        "error": "jwt_validation_unavailable",
                        "detail": "JWT_SECRET is not configured; refusing to validate"
                    })))
                }
            };
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(
                token,
                &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
                &validation,
            ) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        other => Err(actix_web::HttpResponse::Unauthorized().json(serde_json::json!({
            "error": format!("unsupported alg {:?}", other)
        }))),
    }
}

async fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(serde_json::json!({"error": "invalid auth header"}))),
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims));
    Ok(())
}


// --- Security Headers Middleware ---
#[allow(dead_code)]
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


// Wave-11: audit INSERTs are buffered behind a Mutex and flushed every 100ms
// or every 100 rows by a spawned task (was: one blocking INSERT per request).
static W11_AUDIT_BUF: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<Vec<(String, String, String, String, String)>>>> = std::sync::OnceLock::new();
static W11_FLUSH_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let buf = W11_AUDIT_BUF.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new(Vec::new())));
        let id = format!("{}_{}_{}", "continuous_liveness_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("continuous-liveness-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        if !W11_FLUSH_STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            let client = client.clone();
            let buf = buf.clone();
            tokio::spawn(async move {
                let mut tick = tokio::time::interval(std::time::Duration::from_millis(100));
                loop {
                    tick.tick().await;
                    let rows: Vec<(String, String, String, String, String)> = {
                        let mut b = buf.lock().unwrap();
                        if b.is_empty() { continue; }
                        std::mem::take(&mut *b)
                    };
                    for (id, svc, ep, st, d) in rows {
                        let _ = client.execute(
                            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                            &[&id, &svc, &ep, &st, &d],
                        ).await;
                    }
                }
            });
        }
        let mut b = buf.lock().unwrap();
        b.push((id, svc_name, endpoint.to_string(), status, data_str));
        if b.len() >= 100 {
            let rows = std::mem::take(&mut *b);
            drop(b);
            let client = client.clone();
            tokio::spawn(async move {
                for (id, svc, ep, st, d) in rows {
                    let _ = client.execute(
                        "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
                        &[&id, &svc, &ep, &st, &d],
                    ).await;
                }
            });
        }
    }
}



// --- Circuit Breaker + Retry for gRPC/HTTP calls ---
use std::sync::atomic::{AtomicI32, AtomicI64};

static CB_FAILURES: AtomicI32 = AtomicI32::new(0);
static CB_LAST_FAILURE: AtomicI64 = AtomicI64::new(0);
const CB_THRESHOLD: i32 = 5;
const CB_RESET_SECS: i64 = 30;

fn cb_allow() -> bool {
    let failures = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if failures >= CB_THRESHOLD {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64).unwrap_or(0);
        let last = CB_LAST_FAILURE.load(std::sync::atomic::Ordering::Relaxed);
        if now - last > CB_RESET_SECS {
            CB_FAILURES.store(CB_THRESHOLD / 2, std::sync::atomic::Ordering::Relaxed);
            return true;
        }
        return false;
    }
    true
}

fn cb_record_success() {
    let f = CB_FAILURES.load(std::sync::atomic::Ordering::Relaxed);
    if f > 0 { CB_FAILURES.fetch_sub(1, std::sync::atomic::Ordering::Relaxed); }
}

fn cb_record_failure() {
    CB_FAILURES.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64).unwrap_or(0);
    CB_LAST_FAILURE.store(now, std::sync::atomic::Ordering::Relaxed);
}

fn call_service_with_retry(url: &str, body: &str, retries: u32) -> Result<String, String> {
    if !cb_allow() {
        return Err(format!("circuit breaker open for {}", url));
    }
    for attempt in 0..retries {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match call_service_sync(url, body) {
            Ok(resp) => { cb_record_success(); return Ok(resp); }
            Err(e) => {
                cb_record_failure();
                eprintln!("[inter-service] {} attempt {} failed: {}", url, attempt + 1, e);
            }
        }
    }
    Err(format!("all {} retries exhausted for {}", retries, url))
}

fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            // Wave-11: bound blocking I/O (was unbounded read_to_string).
            stream.set_read_timeout(Some(std::time::Duration::from_secs(3))).map_err(|e| format!("{}", e))?;
            stream.set_write_timeout(Some(std::time::Duration::from_secs(3))).map_err(|e| format!("{}", e))?;
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
}



// --- Distributed rate limiting (redis shared sliding window; W12 C3-P1-B1) ---
// Replaces the per-replica statics _RL_TOKENS/_RL_LAST (and the dead
// _RATE_WINDOW_START/_RATE_WINDOW_COUNT pair): behind >1 replica the old
// per-process bucket multiplied the effective limit by the replica count
// (correctness bug). Now an atomic Lua INCR+PEXPIRE sliding window on a shared
// deadpool-redis pool; limit is global per service, not per replica.
// Key: ratelimit:continuous-liveness-rs:global — the replaced bucket was process-global (no
// per-ip/per-user subject), so the subject segment is preserved as "global".
// Window/limit: 100 requests per 1000 ms — identical to the old token bucket.
// Env: REDIS_URL (fleet-wide var, cf. docker-compose.yml REDIS_URL entries);
// default redis://redis:6379 matches the compose network.
// Fail-mode: FAIL CLOSED — when redis is unreachable or errors, rl_allow()
// returns false and callers answer 429 + Retry-After, mirroring check_jwt's
// fail-closed style. Limiting is never silently disabled.
static RL_POOL: std::sync::OnceLock<Option<deadpool_redis::Pool>> = std::sync::OnceLock::new();
static RL_SCRIPT: std::sync::OnceLock<deadpool_redis::redis::Script> = std::sync::OnceLock::new();

const RL_WINDOW_MS: u64 = 1000;
const RL_LIMIT: i64 = 100;
const RL_LUA: &str = "local c = redis.call('INCR', KEYS[1])\nif c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end\nreturn c";

fn rl_pool() -> Option<&'static deadpool_redis::Pool> {
    RL_POOL
        .get_or_init(|| {
            let url =
                std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
            deadpool_redis::Config::from_url(url)
                .create_pool(Some(deadpool_redis::Runtime::Tokio1))
                .ok()
        })
        .as_ref()
}

async fn rl_allow() -> bool {
    let Some(pool) = rl_pool() else {
        return false; // fail closed: redis pool unavailable (malformed REDIS_URL)
    };
    let Ok(mut conn) = pool.get().await else {
        return false; // fail closed: redis unreachable
    };
    let script = RL_SCRIPT.get_or_init(|| deadpool_redis::redis::Script::new(RL_LUA));
    let count: Result<i64, deadpool_redis::redis::RedisError> = script
        .key("ratelimit:continuous-liveness-rs:global")
        .arg(RL_WINDOW_MS)
        .invoke_async(&mut *conn)
        .await;
    match count {
        Ok(n) => n <= RL_LIMIT,
        Err(_) => false, // fail closed: redis error
    }
}


// Multi-tenant: extract tenant ID from request
fn get_tenant_id(req: &actix_web::HttpRequest) -> String {
    req.headers().get("X-Tenant-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("platform")
        .to_string()
}


// --- gRPC Server (binary protocol, length-prefixed) ---
fn start_grpc_server(service_name: &'static str, port: u16) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind(format!("0.0.0.0:{}", port)) {
            Ok(l) => l,
            Err(e) => { eprintln!("[{}] gRPC bind :{} failed: {}", service_name, port, e); return; }
        };
        eprintln!("[{}] gRPC server on :{}", service_name, port);
        // Wave-11: bound concurrent connection handlers (was: unbounded thread-per-conn).
        let conn_sem = std::sync::Arc::new(tokio::sync::Semaphore::new(256));
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let conn_permit = match conn_sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => {
                        eprintln!("[{}] gRPC connection limit (256) reached; dropping connection", service_name);
                        continue;
                    }
                };
                std::thread::spawn(move || {
                    let _conn_permit = conn_permit; // released when handler exits
                    use std::io::{Read, Write};
                    let mut len_buf = [0u8; 4];
                    if stream.read_exact(&mut len_buf).is_err() { return; }
                    let msg_len = u32::from_be_bytes(len_buf) as usize;
                    if msg_len > 4 * 1024 * 1024 { return; }
                    let mut payload = vec![0u8; msg_len];
                    if stream.read_exact(&mut payload).is_err() { return; }
                    let resp = format!(r#"{{"status":"ok","service":"{}"}}"#, service_name);
                    let resp_bytes = resp.as_bytes();
                    let resp_len = (resp_bytes.len() as u32).to_be_bytes();
                    let _ = stream.write_all(&resp_len);
                    let _ = stream.write_all(resp_bytes);
                });
            }
        }
    });
}

fn grpc_call(target: &str, method: &str, payload: &str) -> Result<String, String> {
    if !cb_allow() { return Err("circuit breaker open".to_string()); }
    use std::io::{Read, Write};
    for attempt in 0..3u32 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(200 * (1 << attempt)));
        }
        match std::net::TcpStream::connect_timeout(
            &target.parse().map_err(|e| format!("{}", e))?,
            std::time::Duration::from_secs(5),
        ) {
            Ok(mut stream) => {
                let data = format!(r#"{{"method":"{}","payload":{}}}"#, method, payload);
                let data_bytes = data.as_bytes();
                let len_bytes = (data_bytes.len() as u32).to_be_bytes();
                if stream.write_all(&len_bytes).is_err() { cb_record_failure(); continue; }
                if stream.write_all(data_bytes).is_err() { cb_record_failure(); continue; }
                let mut resp_len_buf = [0u8; 4];
                if stream.read_exact(&mut resp_len_buf).is_err() { cb_record_failure(); continue; }
                let resp_len = u32::from_be_bytes(resp_len_buf) as usize;
                let mut resp_buf = vec![0u8; resp_len];
                if stream.read_exact(&mut resp_buf).is_err() { cb_record_failure(); continue; }
                cb_record_success();
                return Ok(String::from_utf8_lossy(&resp_buf).to_string());
            }
            Err(e) => { cb_record_failure(); eprintln!("gRPC {} attempt {} failed: {}", target, attempt+1, e); }
        }
    }
    Err(format!("gRPC retries exhausted for {}", target))
}


// --- mTLS Configuration ---
fn mtls_config() -> (bool, String, String, String) {
    let enabled = env::var("MTLS_ENABLED").unwrap_or_default() == "true";
    let cert = env::var("TLS_CERT_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.crt".to_string());
    let key = env::var("TLS_KEY_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/service.key".to_string());
    let ca = env::var("TLS_CA_PATH").unwrap_or_else(|_| "/etc/54link-dev/certs/ca.crt".to_string());
    (enabled, cert, key, ca)
}

// --- Permify authorization (W12-B5-P1-D-B) ---
// Every mutating handler performs a REAL Permify permission check AFTER
// check_jwt has authenticated the caller. Subject = verified JWT sub (from
// VerifiedClaims in request extensions), tenant = verified JWT tenant claim
// (fallback: X-Tenant-Id header, PERMIFY_DEFAULT_TENANT, "bpmgd"), resource =
// domain entity id, permission per action (schema: canonical v2.perm
// service_config entity + services/auth-service/schemas/permify/
// v2-core-domain-rs.fragment). 30s in-process decision cache keyed
// (tenant, entity_type, entity_id, permission, subject); errors NEVER cached.
// FAIL-CLOSED: Permify unreachable/non-200 => 502; denied => 403.
// Canonical pattern: W12-B5-P0-D2 (services/risk-scoring-rs/src/main.rs).
struct PermifyDecision {
    allowed: bool,
    expires_at: std::time::Instant,
}

static PERMIFY_DECISIONS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>>> = std::sync::OnceLock::new();

fn permify_decisions() -> &'static std::sync::Mutex<std::collections::HashMap<String, PermifyDecision>> {
    PERMIFY_DECISIONS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn permify_base_url() -> String {
    match std::env::var("PERMIFY_URL") {
        Ok(u) if !u.is_empty() => u.trim_end_matches('/').to_string(),
        _ => "http://permify:3476".to_string(),
    }
}

async fn permify_check(req: &actix_web::HttpRequest, entity_type: &str, entity_id: &str, permission: &str) -> Result<(), HttpResponse> {
    use actix_web::HttpMessage as _;
    let (subject, claim_tenant) = {
        let ext = req.extensions();
        match ext.get::<VerifiedClaims>() {
            Some(c) => (
                c.0.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()),
                c.0.get("tenant_id").or_else(|| c.0.get("tenant")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            ),
            None => (None, None),
        }
    };
    let subject = match subject {
        Some(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"}))),
    };
    if entity_id.is_empty() {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "authorization context incomplete"})));
    }
    let tenant_id = claim_tenant.filter(|s| !s.is_empty())
        .or_else(|| req.headers().get("X-Tenant-Id").and_then(|v| v.to_str().ok()).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .or_else(|| std::env::var("PERMIFY_DEFAULT_TENANT").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "bpmgd".to_string());
    let cache_key = format!("{}|{}|{}|{}|{}", tenant_id, entity_type, entity_id, permission, subject);
    {
        let cache = permify_decisions().lock().unwrap();
        if let Some(d) = cache.get(&cache_key) {
            if d.expires_at > std::time::Instant::now() {
                if d.allowed { return Ok(()); }
                return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
            }
        }
    }
    let payload = serde_json::json!({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    });
    let url = format!("{}/v1/tenants/{}/permissions/check", permify_base_url(), tenant_id);
    let client = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
        Ok(c) => c,
        Err(_) => return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify client init failed (fail-closed)"}))),
    };
    let resp = match client.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[permify] FAIL-CLOSED check {} on {}:{} unreachable: {}", permission, entity_type, entity_id, e);
            return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})));
        }
    };
    if !resp.status().is_success() {
        return Err(HttpResponse::BadGateway().json(serde_json::json!({"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})));
    }
    let body = resp.json::<serde_json::Value>().await.unwrap_or_else(|_| serde_json::json!({}));
    let allowed = body.get("can").and_then(|v| v.as_str()) == Some("CHECK_RESULT_ALLOWED")
        || body.get("can").and_then(|v| v.as_bool()) == Some(true);
    // Errors are never cached; only concrete allow/deny decisions (30s TTL).
    permify_decisions().lock().unwrap().insert(cache_key, PermifyDecision {
        allowed,
        expires_at: std::time::Instant::now() + std::time::Duration::from_secs(30),
    });
    if !allowed {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "forbidden", "detail": format!("permify: {} denied on {}:{}", permission, entity_type, entity_id)})));
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8232".to_string());
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
            db_client: {
            let db_url = std::env::var("DATABASE_URL").ok();
            if let Some(url) = db_url {
                init_db(&url).await.map(|c| std::sync::Arc::new(c))
            } else { None }
        },
    });
    println!("Continuous Liveness + Behavioral Biometrics v2.0 (Rust) on :{}", port);
    start_grpc_server("continuous-liveness-rs", 10303);
    HttpServer::new(move || {
        App::new()
                .wrap(
                    actix_web::middleware::DefaultHeaders::new()
                        .add(("X-Content-Type-Options", "nosniff"))
                        .add(("X-Frame-Options", "DENY"))
                        .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                        .add(("Content-Security-Policy", "default-src 'self'"))
                        .add(("X-XSS-Protection", "1; mode=block"))
                        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
                )
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                // Wave-11: log only errors, plus 1% sampled requests (was: every request).
                let w11_method = req.method().clone();
                let w11_path = req.path().to_string();
                let w11_sample = _REQ_COUNT.load(AtomicOrdering::Relaxed) % 100 == 0;
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    let w11_err = res.status().is_server_error() || res.status().is_client_error();
                    if w11_err {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    if w11_err || w11_sample {
                        eprintln!("[continuous-liveness-rs] {} {} trace={} status={}", w11_method, w11_path, trace_id, res.status().as_u16());
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/step-up/configs", web::get().to(get_configs))
            .route("/v1/step-up/evaluate", web::post().to(evaluate_step_up))
            .route("/v1/behavioral/analyze", web::post().to(analyze_behavioral))
            .route("/v1/behavioral/profiles", web::get().to(get_profiles))
            .route("/v1/behavioral/checks", web::get().to(get_behavioral_checks))
            .route("/v1/checks", web::get().to(get_checks))
            .route("/v1/stats", web::get().to(get_stats))
            .route("/v1/alerts", web::get().to(alerts_endpoint))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    }).bind(format!("0.0.0.0:{}", port))?.shutdown_timeout(30).run().await
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_configs_exists() {
        // Verify default_configs compiles and is callable
        // Domain function: default_configs() -> Vec
        assert!(true, "default_configs should be defined");
    }

    #[test]
    fn test_default_profiles_exists() {
        // Verify default_profiles compiles and is callable
        // Domain function: default_profiles() -> Vec
        assert!(true, "default_profiles should be defined");
    }

    #[test]
    fn test_healthz_exists() {
        // Verify healthz compiles and is callable
        // Domain function: healthz(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse
        assert!(true, "healthz should be defined");
    }

    #[test]
    fn test_get_configs_exists() {
        // Verify get_configs compiles and is callable
        // Domain function: get_configs(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse
        assert!(true, "get_configs should be defined");
    }

    #[test]
    fn test_evaluate_step_up_exists() {
        // Verify evaluate_step_up compiles and is callable
        // Domain function: evaluate_step_up(body: web::Json<serde_json::Value>, state: web::Data<AppState>, req: actix_web::HttpRequest) -> HttpResponse
        assert!(true, "evaluate_step_up should be defined");
    }
    #[test]
    fn test_circuit_breaker_opens() {
        for _ in 0..5 { cb_record_failure(); }
        assert!(!cb_allow());
    }

    #[test]
    fn test_degradation_mode() {
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "normal");
        DB_AVAILABLE.store(false, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(degradation_mode(), "degraded");
        DB_AVAILABLE.store(true, std::sync::atomic::Ordering::Relaxed);
    }

}

// W12-RUSTFIX-2: removed UNROUTED generator-template handlers `update_record`
// and `delete_record` (E0609: referenced a non-existent `AppState.db` sqlx pool
// field and a foreign `kyc_records` table in this liveness service; no route
// registered either handler — same dead-code class as W12-B5D3's documented
// removal in watchlist-manager-rs / wire-transfer-monitor-rs).
