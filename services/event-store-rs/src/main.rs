use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;
use uuid::Uuid;

// --- 54Bank Event Store — Append-Only Immutable Event Log ---

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

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "event-store",
        "version": "1.0.0"
    }))
}

async fn append_event(state: web::Data<AppState>, body: web::Json<AppendRequest>) -> HttpResponse {
    let mut events = state.events.lock().unwrap_or_else(|e| e.into_inner());
    
    // Calculate next version for this aggregate
    let current_version = events.iter()
        .filter(|e| e.aggregate_id == body.aggregate_id)
        .map(|e| e.version)
        .max()
        .unwrap_or(0);
    
    // Optimistic concurrency check
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
    snapshots.push(snapshot);
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8098".to_string()).parse().unwrap_or(8098);
    let state = web::Data::new(AppState {
        events: Mutex::new(Vec::new()),
        snapshots: Mutex::new(Vec::new()),
    });
    
    println!("54Bank Event Store listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
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
