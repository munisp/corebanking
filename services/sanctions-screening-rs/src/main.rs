use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// ─── Domain types ───────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
struct WatchlistEntry {
    list_id: String,
    list_name: String,
    entity_name: String,
    entity_type: String,
    aliases: Vec<String>,
}

struct AppState {
    start_time: Instant,
    watchlist: Mutex<Vec<WatchlistEntry>>,
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct ScreenRequest {
    entity_name: Option<String>,
    name: Option<String>,
    threshold: Option<f64>,
}

// ─── Matching ───────────────────────────────────────────────────────────────

fn fuzzy_match_score(name1: &str, name2: &str) -> f64 {
    let n1 = name1.to_lowercase(); let n2 = name2.to_lowercase();
    if n1 == n2 { return 1.0; }
    let words1: Vec<&str> = n1.split_whitespace().collect();
    let words2: Vec<&str> = n2.split_whitespace().collect();
    let matches = words1.iter().filter(|w| words2.contains(w)).count();
    matches as f64 / words1.len().max(words2.len()) as f64
}

fn is_hit(score: f64, threshold: f64) -> bool { score >= threshold }

fn sanctions_list_priority(list: &str) -> u8 {
    match list { "OFAC_SDN" => 1, "UN_CONSOLIDATED" => 2, "EU_SANCTIONS" => 3, "CBN_SANCTIONS" => 4, _ => 5 }
}

// ─── JWT auth (real HS256 verification, fail closed) ────────────────────────

fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    let header = match req.headers().get("Authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"}))),
    };
    let secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return Err(HttpResponse::ServiceUnavailable().json(json!({"error": "jwt_validation_unavailable"}))),
    };
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;
    match jsonwebtoken::decode::<serde_json::Value>(token, &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()), &validation) {
        Ok(_) => Ok(()),
        Err(_) => Err(HttpResponse::Unauthorized().json(json!({"error": "invalid or expired token"}))),
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn health(state: web::Data<AppState>) -> HttpResponse {
    let watchlist = state.watchlist.lock().unwrap();
    let mut lists: Vec<String> = watchlist.iter().map(|e| e.list_name.clone()).collect();
    lists.sort_by_key(|l| sanctions_list_priority(l));
    lists.dedup();
    HttpResponse::Ok()
        .insert_header(("content-security-policy", "default-src 'self'"))
        .json(json!({
            "status": "healthy",
            "service": "sanctions-screening-rs",
            "version": "1.0.0",
            "description": "OFAC/EU/UN/CBN sanctions screening",
            "watchlist_entries": watchlist.len(),
            "lists_loaded": lists,
        }))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "sanctions-screening-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"sanctions-screening-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": state.db_client.is_some(),
        "mode": if state.db_client.is_some() { "normal" } else { "degraded" },
    }))
}

/// POST /v1/sanctions/screen — screen a name against the REAL DB-backed
/// watchlist. Fails closed (503 indeterminate) when no watchlist is loaded.
async fn screen_name(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<ScreenRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let name = match body.entity_name.as_deref().or(body.name.as_deref()) {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => return HttpResponse::UnprocessableEntity().json(json!({"error": "entity_name_required"})),
    };
    let threshold = body.threshold.unwrap_or(0.8);

    let (matches, lists_screened) = {
        let watchlist = state.watchlist.lock().unwrap();
        if watchlist.is_empty() {
            // FAIL CLOSED: without a real watchlist there is no safe-negative.
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "watchlist_unavailable",
                "status": "indeterminate",
                "detail": "no sanctions watchlist loaded from DATABASE_URL; screening cannot be performed",
            }));
        }
        let mut matches: Vec<serde_json::Value> = Vec::new();
        for entry in watchlist.iter() {
            let score = fuzzy_match_score(&name, &entry.entity_name);
            let alias_score = entry.aliases.iter().map(|a| fuzzy_match_score(&name, a)).fold(0.0_f64, f64::max);
            let best = score.max(alias_score);
            if is_hit(best, threshold) {
                matches.push(json!({
                    "list": entry.list_name,
                    "entity_name": entry.entity_name,
                    "entity_type": entry.entity_type,
                    "match_score": (best * 100.0).round() / 100.0,
                }));
            }
        }
        matches.sort_by(|a, b| {
            b["match_score"].as_f64().partial_cmp(&a["match_score"].as_f64()).unwrap_or(std::cmp::Ordering::Equal)
        });
        let mut lists: Vec<String> = watchlist.iter().map(|e| e.list_name.clone()).collect();
        lists.sort();
        lists.dedup();
        (matches, lists)
    };

    let best_score = matches.first().and_then(|m| m["match_score"].as_f64()).unwrap_or(0.0);
    let status = if matches.is_empty() { "clear" } else { "potential_match" };
    db_persist(&state, "screen_name", &json!({"entity_name": name, "status": status})).await;
    HttpResponse::Ok().json(json!({
        "service": "sanctions-screening-rs",
        "entity_name": name,
        "status": status,
        "match_score": best_score,
        "matches": matches,
        "lists_screened": lists_screened,
    }))
}

// ─── compliance_records CRUD (in-memory; audit persisted when DB present) ───

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page - 1) * limit).take(limit).collect();
    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "source": if state.db_client.is_some() { "database" } else { "in-memory" },
    }))
}

async fn create_record(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let mut rec = body.into_inner();
    rec["id"] = json!(uuid::Uuid::new_v4().to_string());
    rec["created_at"] = json!(chrono::Utc::now().to_rfc3339());
    state.records.lock().unwrap().push(rec.clone());
    db_persist(&state, "create_record", &rec).await;
    HttpResponse::Created().json(rec)
}

async fn get_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let records = state.records.lock().unwrap();
    match records.iter().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => HttpResponse::Ok().json(r),
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn update_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let mut records = state.records.lock().unwrap();
    match records.iter_mut().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
        Some(r) => {
            if let Some(obj) = body.into_inner().as_object() {
                for (k, v) in obj {
                    if k != "id" { r[k.as_str()] = v.clone(); }
                }
            }
            HttpResponse::Ok().json(r.clone())
        }
        None => HttpResponse::NotFound().json(json!({"error": "not found"})),
    }
}

async fn delete_record(req: actix_web::HttpRequest, state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let id = path.into_inner();
    let mut records = state.records.lock().unwrap();
    let before = records.len();
    records.retain(|r| r.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
    if records.len() == before {
        return HttpResponse::NotFound().json(json!({"error": "not found"}));
    }
    HttpResponse::NoContent().finish()
}

// ─── Persistence ────────────────────────────────────────────────────────────

use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); } });
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            // Watchlist table (schema only — entries are loaded from the DB,
            // never seeded/fabricated by this service).
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS watchlist_entries (
                    list_id TEXT NOT NULL, list_name TEXT NOT NULL,
                    entity_name TEXT NOT NULL, entity_type TEXT DEFAULT 'individual',
                    aliases TEXT DEFAULT '[]'
                )", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — watchlist unavailable (fail closed)", e); None }
    }
}

async fn load_watchlist(client: &tokio_postgres::Client) -> Vec<WatchlistEntry> {
    let rows = match client.query(
        "SELECT list_id, list_name, entity_name, entity_type, aliases FROM watchlist_entries", &[],
    ).await {
        Ok(r) => r,
        Err(e) => { eprintln!("watchlist load failed: {}", e); return Vec::new(); }
    };
    rows.iter().map(|row| {
        let aliases_raw: String = row.get::<_, String>(4);
        WatchlistEntry {
            list_id: row.get(0),
            list_name: row.get(1),
            entity_name: row.get(2),
            entity_type: row.get(3),
            aliases: serde_json::from_str(&aliases_raw).unwrap_or_default(),
        }
    }).collect()
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = uuid::Uuid::new_v4().to_string();
        let svc_name = String::from("sanctions-screening-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &svc_name, &endpoint, &status, &data_str],
        ).await;
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8125);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await.map(Arc::new)
    } else { None };
    let watchlist = if let Some(ref c) = db_client {
        let wl = load_watchlist(c).await;
        println!("sanctions-screening-rs: loaded {} watchlist entries", wl.len());
        wl
    } else {
        println!("sanctions-screening-rs: DATABASE_URL not set — screening will fail closed (503)");
        Vec::new()
    };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        watchlist: Mutex::new(watchlist),
        records: Mutex::new(Vec::new()),
        db_client,
    });
    println!("sanctions-screening-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
            .app_data(state.clone())
            .route("/v1/degradation", web::get().to(degradation_status))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/sanctions/screen", web::post().to(screen_name))
            .route("/api/v1/compliance_records", web::get().to(list_records))
            .route("/api/v1/compliance_records", web::post().to(create_record))
            .route("/api/v1/compliance_records/{id}", web::get().to(get_record))
            .route("/api/v1/compliance_records/{id}", web::put().to(update_record))
            .route("/api/v1/compliance_records/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
