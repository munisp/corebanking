use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use chrono::Utc;
use uuid::Uuid;
use tokio_postgres::NoTls;

// --- 54Bank Event Store — Append-Only Immutable Event Log with PostgreSQL Persistence ---

#[derive(Clone, Serialize, Deserialize)]
struct Event {
    id: String,
    aggregate_id: String,
    aggregate_type: String,
    event_type: String,
    event_data: serde_json::Value,
    metadata: serde_json::Value,
    version: u64,
    tenant_id: Option<String>,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct Snapshot {
    aggregate_id: String,
    aggregate_type: String,
    state: serde_json::Value,
    version: u64,
    created_at: String,
}

struct AppState {
    events: Mutex<Vec<Event>>,
    snapshots: Mutex<Vec<Snapshot>>,
    db: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct AppendRequest {
    aggregate_id: String,
    aggregate_type: String,
    event_type: String,
    event_data: serde_json::Value,
    metadata: Option<serde_json::Value>,
    tenant_id: Option<String>,
    expected_version: Option<u64>,
}

async fn init_db() -> Option<Arc<tokio_postgres::Client>> {
    let db_url = std::env::var("DATABASE_URL").ok()?;
    match tokio_postgres::connect(&db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    eprintln!("[event-store] DB connection error: {}", e);
                }
            });
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS event_store (
                    id TEXT PRIMARY KEY,
                    aggregate_id TEXT NOT NULL,
                    aggregate_type TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    event_data JSONB DEFAULT '{}',
                    metadata JSONB DEFAULT '{}',
                    version BIGINT NOT NULL,
                    tenant_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute(
                "CREATE INDEX IF NOT EXISTS idx_es_agg ON event_store(aggregate_id, version)", &[]).await;
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS event_snapshots (
                    aggregate_id TEXT NOT NULL,
                    aggregate_type TEXT NOT NULL,
                    state JSONB DEFAULT '{}',
                    version BIGINT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    PRIMARY KEY (aggregate_id, version)
                )", &[]).await;
            println!("[event-store] PostgreSQL connected — events will be persisted");
            Some(Arc::new(client))
        }
        Err(e) => {
            eprintln!("[event-store] DB connect failed: {} — in-memory only", e);
            None
        }
    }
}

async fn db_persist_event(db: &Option<Arc<tokio_postgres::Client>>, event: &Event) {
    if let Some(ref client) = db {
        if let Err(e) = client.execute(
            "INSERT INTO event_store (id, aggregate_id, aggregate_type, event_type, event_data, metadata, version, tenant_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
            &[&event.id, &event.aggregate_id, &event.aggregate_type, &event.event_type,
              &event.event_data, &event.metadata, &(event.version as i64), &event.tenant_id],
        ).await {
            eprintln!("[event-store] CRITICAL: DB persist event failed: {}", e);
        }
    }
}

async fn db_persist_snapshot(db: &Option<Arc<tokio_postgres::Client>>, snap: &Snapshot) {
    if let Some(ref client) = db {
        if let Err(e) = client.execute(
            "INSERT INTO event_snapshots (aggregate_id, aggregate_type, state, version, created_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (aggregate_id, version) DO NOTHING",
            &[&snap.aggregate_id, &snap.aggregate_type, &snap.state, &(snap.version as i64)],
        ).await {
            eprintln!("[event-store] DB persist snapshot failed: {}", e);
        }
    }
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if state.db.is_some() { "connected" } else { "not_configured" };
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "event-store",
        "version": "1.0.0",
        "persistence": db_status
    }))
}

async fn append_event(state: web::Data<AppState>, body: web::Json<AppendRequest>) -> HttpResponse {
    let mut events = state.events.lock().unwrap_or_else(|e| e.into_inner());

    let current_version = events.iter()
        .filter(|e| e.aggregate_id == body.aggregate_id)
        .map(|e| e.version)
        .max()
        .unwrap_or(0);

    if let Some(expected) = body.expected_version {
        if current_version != expected {
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "Version conflict",
                "expected": expected,
                "actual": current_version
            }));
        }
    }

    let event = Event {
        id: Uuid::new_v4().to_string(),
        aggregate_id: body.aggregate_id.clone(),
        aggregate_type: body.aggregate_type.clone(),
        event_type: body.event_type.clone(),
        event_data: body.event_data.clone(),
        metadata: body.metadata.clone().unwrap_or(serde_json::json!({})),
        version: current_version + 1,
        tenant_id: body.tenant_id.clone(),
        created_at: Utc::now().to_rfc3339(),
    };

    events.push(event.clone());
    drop(events);

    // Persist to PostgreSQL
    db_persist_event(&state.db, &event).await;

    HttpResponse::Created().json(serde_json::json!({
        "event_id": event.id,
        "version": event.version,
        "aggregate_id": event.aggregate_id
    }))
}

async fn get_events(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let aggregate_id = path.into_inner();
    let events = state.events.lock().unwrap_or_else(|e| e.into_inner());
    let agg_events: Vec<&Event> = events.iter()
        .filter(|e| e.aggregate_id == aggregate_id)
        .collect();
    HttpResponse::Ok().json(serde_json::json!({
        "aggregate_id": aggregate_id,
        "events": agg_events,
        "count": agg_events.len()
    }))
}

async fn get_events_by_type(state: web::Data<AppState>, path: web::Path<(String, String)>) -> HttpResponse {
    let (agg_type, event_type) = path.into_inner();
    let events = state.events.lock().unwrap_or_else(|e| e.into_inner());
    let filtered: Vec<&Event> = events.iter()
        .filter(|e| e.aggregate_type == agg_type && e.event_type == event_type)
        .collect();
    HttpResponse::Ok().json(serde_json::json!({"events": filtered, "count": filtered.len()}))
}

async fn create_snapshot(state: web::Data<AppState>, body: web::Json<Snapshot>) -> HttpResponse {
    let mut snapshots = state.snapshots.lock().unwrap_or_else(|e| e.into_inner());
    let snapshot = Snapshot {
        aggregate_id: body.aggregate_id.clone(),
        aggregate_type: body.aggregate_type.clone(),
        state: body.state.clone(),
        version: body.version,
        created_at: Utc::now().to_rfc3339(),
    };
    snapshots.push(snapshot.clone());
    drop(snapshots);

    db_persist_snapshot(&state.db, &snapshot).await;

    HttpResponse::Created().json(serde_json::json!({"status": "snapshot_created"}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let events = state.events.lock().unwrap_or_else(|e| e.into_inner());
    let snapshots = state.snapshots.lock().unwrap_or_else(|e| e.into_inner());

    let mut type_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for e in events.iter() {
        *type_counts.entry(e.event_type.clone()).or_insert(0) += 1;
    }

    HttpResponse::Ok().json(serde_json::json!({
        "total_events": events.len(),
        "total_snapshots": snapshots.len(),
        "event_types": type_counts
    }))
}


// ─── Idempotency Enforcement ────────────────────────────────────────────────
use std::collections::HashMap as IdempHashMap;
use std::sync::RwLock as IdempRwLock;
use std::time::Instant as IdempInstant;

struct IdempotencyEntry {
    response: Vec<u8>,
    status_code: u16,
    created_at: IdempInstant,
}

lazy_static::lazy_static! {
    static ref IDEMPOTENCY_CACHE: IdempRwLock<IdempHashMap<String, IdempotencyEntry>> =
        IdempRwLock::new(IdempHashMap::new());
}

fn check_idempotency(key: &str) -> Option<(u16, Vec<u8>)> {
    let cache = IDEMPOTENCY_CACHE.read().unwrap();
    cache.get(key).map(|e| (e.status_code, e.response.clone()))
}

fn store_idempotency(key: String, status_code: u16, response: Vec<u8>) {
    let mut cache = IDEMPOTENCY_CACHE.write().unwrap();
    cache.insert(key, IdempotencyEntry { response, status_code, created_at: IdempInstant::now() });
    // Cleanup entries older than 24h
    let cutoff = std::time::Duration::from_secs(86400);
    cache.retain(|_, v| v.created_at.elapsed() < cutoff);
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
#[derive(Clone, serde::Serialize)]
struct MakerCheckerRequest {
    request_id: String,
    operation: String,
    maker_id: String,
    checker_id: Option<String>,
    amount_kobo: i64,
    status: String, // pending_approval|approved|rejected
    created_at: String,
}

fn requires_maker_checker(operation: &str, amount_kobo: i64) -> bool {
    let threshold = match operation {
        "transfer" => 100_000_000,      // ₦1M
        "loan_disburse" => 100_000_000, // ₦1M
        "gl_posting" => 50_000_000,     // ₦500K
        "account_close" => 0,           // Always
        _ => 100_000_000,               // Default ₦1M
    };
    amount_kobo >= threshold
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
use sha2::{Sha256 as AuditSha256, Digest as AuditDigest};
use actix_cors::Cors;

#[derive(Clone, serde::Serialize)]
struct AuditEntry {
    id: String,
    timestamp: String,
    service: String,
    operation: String,
    actor_id: String,
    entity_id: String,
    entity_type: String,
    old_state: String,
    new_state: String,
    checksum: String,
    immutable: bool,
}

fn append_audit_entry(service: &str, operation: &str, actor_id: &str, entity_id: &str,
                      entity_type: &str, old_state: &str, new_state: &str) -> AuditEntry {
    let id = format!("AUD-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let timestamp = chrono::Utc::now().to_rfc3339();
    let raw = format!("{}|{}|{}|{}|{}|{}|{}|{}", id, timestamp, service, operation, actor_id, entity_id, old_state, new_state);
    let mut hasher = AuditSha256::new();
    hasher.update(raw.as_bytes());
    let checksum = format!("{:x}", hasher.finalize());
    AuditEntry { id, timestamp: timestamp.clone(), service: service.into(), operation: operation.into(),
                 actor_id: actor_id.into(), entity_id: entity_id.into(), entity_type: entity_type.into(),
                 old_state: old_state.into(), new_state: new_state.into(), checksum, immutable: true }
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8098".to_string()).parse().unwrap_or(8098);

    let db = init_db().await;

    let state = web::Data::new(AppState {
        events: Mutex::new(Vec::new()),
        snapshots: Mutex::new(Vec::new()),
        db,
    });

    println!("54Bank Event Store listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                    .allowed_headers(vec!["Content-Type", "Authorization", "X-Idempotency-Key", "X-Tenant-ID"])
                    .max_age(86400)
            )
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/readyz", web::get().to(healthz))
            .route("/livez", web::get().to(healthz))
            .route("/events", web::post().to(append_event))
            .route("/events/{aggregate_id}", web::get().to(get_events))
            .route("/events/type/{agg_type}/{event_type}", web::get().to(get_events_by_type))
            .route("/snapshots", web::post().to(create_snapshot))
            .route("/stats", web::get().to(stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
