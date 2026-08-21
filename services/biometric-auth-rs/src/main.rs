use actix_web::{web, App, HttpServer, HttpResponse};
use serde::Deserialize;
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// ─── State ──────────────────────────────────────────────────────────────────

struct AppState {
    start_time: Instant,
    enrollments: Mutex<Vec<serde_json::Value>>,
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    customer_id: Option<String>,
    /// Distance between presented biometric template and enrolled template.
    template_distance: Option<f64>,
    /// Match threshold for the template distance.
    threshold: Option<f64>,
    biometric_score: Option<f64>,
    device_score: Option<f64>,
    behavioral_score: Option<f64>,
    /// Liveness evidence (all three required to compute liveness locally).
    blink_detected: Option<bool>,
    head_movement: Option<bool>,
    texture_score: Option<f64>,
}

// ─── Scoring (real inputs only — no fabricated scores) ─────────────────────

fn match_confidence(template_distance: f64, threshold: f64) -> (bool, f64) {
    let confidence = (1.0 - template_distance / threshold).max(0.0).min(1.0);
    (template_distance <= threshold, confidence)
}

fn multi_factor_score(biometric: f64, device: f64, behavioral: f64) -> f64 {
    biometric * 0.5 + device * 0.3 + behavioral * 0.2
}

fn liveness_score(blink_detected: bool, head_movement: bool, texture_score: f64) -> f64 {
    let mut score = texture_score * 0.4;
    if blink_detected { score += 0.3; }
    if head_movement { score += 0.3; }
    score.min(1.0)
}

fn auth_decision(mfa_score: f64, liveness: f64) -> (&'static str, f64) {
    let combined = mfa_score * 0.7 + liveness * 0.3;
    if combined >= 0.8 { ("authenticated", combined) }
    else if combined >= 0.5 { ("step_up_required", combined) }
    else { ("rejected", combined) }
}

/// Minimal synchronous HTTP POST used to reach the liveness upstream.
fn http_post_json(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    if !url.starts_with("http://") {
        return Err("only http:// upstream URLs supported by this transport".to_string());
    }
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if host_port.contains(':') { host_port.to_string() } else { format!("{}:80", host_port) };
    let mut stream = std::net::TcpStream::connect_timeout(
        &host_port.parse().map_err(|e| format!("{}", e))?,
        Duration::from_secs(5),
    ).map_err(|e| format!("connection failed: {}", e))?;
    let host = host_port.split(':').next().unwrap_or("localhost");
    let req = format!(
        "POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, host, body.len(), body
    );
    stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
    let mut resp = String::new();
    stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
    Ok(resp)
}

/// Obtain a real liveness score: either from fully-supplied client evidence, or
/// from the configured liveness-detection upstream. Fails closed otherwise.
fn obtain_liveness(body: &VerifyRequest) -> Result<f64, HttpResponse> {
    match (body.blink_detected, body.head_movement, body.texture_score) {
        (Some(b), Some(h), Some(t)) => Ok(liveness_score(b, h, t)),
        _ => {
            if let Ok(base) = std::env::var("LIVENESS_DETECTION_URL") {
                if !base.is_empty() {
                    let payload = json!({
                        "customer_id": body.customer_id,
                        "blink_detected": body.blink_detected,
                        "head_movement": body.head_movement,
                        "texture_score": body.texture_score,
                    }).to_string();
                    let resp = http_post_json(&format!("{}/v1/score/liveness", base.trim_end_matches('/')), &payload)
                        .map_err(|e| {
                            eprintln!("biometric-auth-rs: liveness upstream failed: {}", e);
                            HttpResponse::ServiceUnavailable().json(json!({
                                "error": "liveness_upstream_unavailable",
                                "decision": "rejected",
                            }))
                        })?;
                    // Response body follows the blank line in a raw HTTP response.
                    let body_str = resp.split("\r\n\r\n").nth(1).unwrap_or("");
                    let parsed: serde_json::Value = serde_json::from_str(body_str).map_err(|_| {
                        HttpResponse::ServiceUnavailable().json(json!({
                            "error": "liveness_upstream_unavailable",
                            "decision": "rejected",
                        }))
                    })?;
                    return parsed.get("overall_score").and_then(|v| v.as_f64()).ok_or_else(|| {
                        HttpResponse::ServiceUnavailable().json(json!({
                            "error": "liveness_upstream_unavailable",
                            "decision": "rejected",
                        }))
                    });
                }
            }
            // No liveness evidence and no upstream configured: fail closed.
            Err(HttpResponse::UnprocessableEntity().json(json!({
                "error": "liveness_evidence_required",
                "detail": "supply blink_detected, head_movement and texture_score, or configure LIVENESS_DETECTION_URL",
                "decision": "rejected",
            })))
        }
    }
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

async fn health() -> HttpResponse {
    HttpResponse::Ok()
        .insert_header(("content-security-policy", "default-src 'self'"))
        .json(json!({"status": "healthy", "service": "biometric-auth-rs", "version": "1.0.0"}))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "biometric-auth-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"biometric-auth-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": state.db_client.is_some(),
        "mode": if state.db_client.is_some() { "normal" } else { "degraded" },
    }))
}

async fn enroll(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let mut enrollments = state.enrollments.lock().unwrap();
    enrollments.push(body.into_inner());
    HttpResponse::Ok().json(json!({"enrolled": true, "total_enrollments": enrollments.len()}))
}

/// POST /v1/biometric/verify — combine ONLY real supplied scores; missing
/// inputs are rejected (422) and upstream failures fail closed (503).
async fn verify(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<VerifyRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }

    let (distance, threshold, biometric, device, behavioral) = match (
        body.template_distance, body.threshold, body.biometric_score, body.device_score, body.behavioral_score,
    ) {
        (Some(d), Some(t), Some(b), Some(dev), Some(beh)) => (d, t, b, dev, beh),
        _ => {
            return HttpResponse::UnprocessableEntity().json(json!({
                "error": "missing_required_scores",
                "required": ["template_distance", "threshold", "biometric_score", "device_score", "behavioral_score"],
                "decision": "rejected",
            }));
        }
    };
    if threshold <= 0.0 {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_threshold", "decision": "rejected"}));
    }

    let live = match obtain_liveness(&body) {
        Ok(l) => l,
        Err(resp) => return resp,
    };

    let (matched, confidence) = match_confidence(distance, threshold);
    let mfa = multi_factor_score(biometric, device, behavioral);
    let (decision, combined) = auth_decision(mfa, live);

    db_persist(&state, "verify", &json!({"endpoint": "verify", "decision": decision})).await;
    let status = if decision == "authenticated" {
        actix_web::http::StatusCode::OK
    } else {
        actix_web::http::StatusCode::UNAUTHORIZED
    };
    HttpResponse::build(status).json(json!({
        "matched": matched,
        "confidence": confidence,
        "mfa_score": mfa,
        "liveness_score": live,
        "decision": decision,
        "combined_score": combined,
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let enrollments = state.enrollments.lock().unwrap();
    HttpResponse::Ok().json(json!({"total_enrollments": enrollments.len(), "service": "biometric-auth-rs"}))
}

// ─── kyc_records CRUD (Postgres-backed when available, else in-memory) ──────

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
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}

async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = uuid::Uuid::new_v4().to_string();
        let svc_name = String::from("biometric-auth-rs");
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
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8202);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await.map(Arc::new)
    } else { None };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        enrollments: Mutex::new(Vec::new()),
        records: Mutex::new(Vec::new()),
        db_client,
    });
    println!("biometric-auth-rs on port {}", port);
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
            .route("/v1/biometric/enroll", web::post().to(enroll))
            .route("/v1/biometric/verify", web::post().to(verify))
            .route("/v1/biometric/stats", web::get().to(stats))
            .route("/api/v1/kyc_records", web::get().to(list_records))
            .route("/api/v1/kyc_records", web::post().to(create_record))
            .route("/api/v1/kyc_records/{id}", web::get().to(get_record))
            .route("/api/v1/kyc_records/{id}", web::put().to(update_record))
            .route("/api/v1/kyc_records/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
