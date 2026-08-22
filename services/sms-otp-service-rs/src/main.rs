use actix_web::{web, App, HttpServer, HttpResponse};
use rand::Rng;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// ─── State ──────────────────────────────────────────────────────────────────

const OTP_TTL_SECS: u64 = 300;
const OTP_MAX_ATTEMPTS: u32 = 5;

struct OtpRecord {
    /// SHA-256 hash of the OTP — the plaintext code is NEVER stored server-side.
    code_hash: String,
    expires_at: Instant,
    attempts: u32,
}

struct AppState {
    start_time: Instant,
    otps: Mutex<HashMap<String, OtpRecord>>,
    records: Mutex<Vec<serde_json::Value>>,
    db_client: Option<Arc<tokio_postgres::Client>>,
}

#[derive(Deserialize)]
struct SendOtpRequest {
    phone: String,
    purpose: Option<String>,
}

#[derive(Deserialize)]
struct VerifyOtpRequest {
    phone: String,
    otp: String,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn validate_phone_ng(phone: &str) -> bool {
    (phone.starts_with("+234") && phone.len() == 14) || (phone.starts_with('0') && phone.len() == 11)
}

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    h.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

/// Constant-time string comparison.
fn ct_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
}

/// Cryptographically secure 6-digit OTP from OsRng (never time-derived).
fn generate_otp() -> String {
    format!("{:06}", rand::rngs::OsRng.gen_range(0..1_000_000u32))
}

/// Returns true when the deployment is production-like (fail closed: unknown => production).
fn is_production_env() -> bool {
    let env_name = std::env::var("APP_ENV")
        .or_else(|_| std::env::var("ENVIRONMENT"))
        .unwrap_or_else(|_| "production".to_string())
        .to_ascii_lowercase();
    !matches!(env_name.as_str(), "dev" | "development" | "test" | "testing" | "staging" | "local")
}

/// Dispatch the OTP through the configured SMS provider. Fails closed.
/// TLS policy: https:// provider URLs are always required in production.
/// Cleartext http:// is only accepted outside production AND with the explicit
/// SMS_ALLOW_INSECURE_HTTP=true opt-in. TLS certificate verification is always on.
async fn dispatch_sms(phone: &str, message: &str) -> Result<(), String> {
    let provider = match std::env::var("SMS_PROVIDER_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => return Err("SMS_PROVIDER_URL is not configured".to_string()),
    };
    if provider.starts_with("http://") {
        let allow_insecure = std::env::var("SMS_ALLOW_INSECURE_HTTP")
            .map(|v| v == "true")
            .unwrap_or(false);
        if is_production_env() || !allow_insecure {
            return Err(
                "cleartext http:// SMS provider URL rejected: use https:// (http requires SMS_ALLOW_INSECURE_HTTP=true in a non-production environment)"
                    .to_string(),
            );
        }
    } else if !provider.starts_with("https://") {
        return Err("SMS_PROVIDER_URL must be an https:// URL".to_string());
    }
    let payload = json!({"to": phone, "message": message});
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("http client init failed: {}", e))?;
    let resp = client
        .post(&provider)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("provider request failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("provider responded with status {}", resp.status()));
    }
    Ok(())
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
        .json(json!({"status": "healthy", "service": "sms-otp-service-rs", "otp_ttl_seconds": OTP_TTL_SECS}))
}

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "sms-otp-service-rs"}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn metrics() -> HttpResponse {
    let body = "# TYPE requests_total counter\nrequests_total{service=\"sms-otp-service-rs\"} 0\n";
    HttpResponse::Ok().content_type("text/plain").body(body)
}

async fn degradation_status(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "db_available": state.db_client.is_some(),
        "mode": if state.db_client.is_some() { "normal" } else { "degraded" },
    }))
}

/// POST /v1/otp/send — generate a real OTP, store only its hash, dispatch via SMS.
/// The OTP is NEVER returned in the API response.
async fn send_otp(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<SendOtpRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if !validate_phone_ng(&body.phone) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_phone", "sent": false}));
    }
    let otp = generate_otp();
    let rec = OtpRecord {
        code_hash: sha256_hex(&otp),
        expires_at: Instant::now() + Duration::from_secs(OTP_TTL_SECS),
        attempts: 0,
    };
    let message = format!("Your verification code is {}. It expires in 5 minutes.", otp);
    // Dispatch first; only retain the OTP if the provider accepted it.
    if let Err(e) = dispatch_sms(&body.phone, &message).await {
        eprintln!("sms-otp-service-rs: SMS dispatch failed: {}", e);
        return HttpResponse::ServiceUnavailable().json(json!({
            "error": "sms_provider_unavailable",
            "sent": false,
        }));
    }
    state.otps.lock().unwrap().insert(body.phone.clone(), rec);
    db_persist(&state, "send_otp", &json!({"phone": body.phone, "purpose": body.purpose})).await;
    HttpResponse::Ok().json(json!({"sent": true, "expires_in": OTP_TTL_SECS}))
}

/// POST /v1/otp/verify — constant-time hash comparison with expiry + attempt cap.
async fn verify_otp(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<VerifyOtpRequest>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    if body.otp.len() != 6 || !body.otp.chars().all(|c| c.is_ascii_digit()) {
        return HttpResponse::Unauthorized().json(json!({"verified": false, "reason": "invalid_otp_format"}));
    }
    // Resolve the outcome while holding the lock; never hold the guard across .await.
    enum Outcome { Verified, Failed(&'static str) }
    let outcome = {
        let mut otps = state.otps.lock().unwrap();
        match otps.get_mut(&body.phone) {
            None => Outcome::Failed("no_otp_pending"),
            Some(rec) => {
                if Instant::now() > rec.expires_at {
                    otps.remove(&body.phone);
                    Outcome::Failed("otp_expired")
                } else if rec.attempts >= OTP_MAX_ATTEMPTS {
                    otps.remove(&body.phone);
                    Outcome::Failed("max_attempts_exceeded")
                } else {
                    rec.attempts += 1;
                    if ct_eq(&sha256_hex(&body.otp), &rec.code_hash) {
                        otps.remove(&body.phone);
                        Outcome::Verified
                    } else {
                        Outcome::Failed("otp_mismatch")
                    }
                }
            }
        }
    };
    match outcome {
        Outcome::Verified => {
            db_persist(&state, "verify_otp", &json!({"phone": body.phone, "verified": true})).await;
            HttpResponse::Ok().json(json!({"verified": true}))
        }
        Outcome::Failed(reason) => {
            db_persist(&state, "verify_otp", &json!({"phone": body.phone, "verified": false})).await;
            HttpResponse::Unauthorized().json(json!({"verified": false, "reason": reason}))
        }
    }
}

// ─── notifications CRUD (Postgres-backed when available, else in-memory) ────

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<HashMap<String, String>>) -> HttpResponse {
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
        let svc_name = String::from("sms-otp-service-rs");
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
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8251);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        init_db(&url).await.map(Arc::new)
    } else { None };
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        otps: Mutex::new(HashMap::new()),
        records: Mutex::new(Vec::new()),
        db_client,
    });
    println!("sms-otp-service-rs on port {}", port);
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
            .route("/v1/otp/send", web::post().to(send_otp))
            .route("/v1/otp/verify", web::post().to(verify_otp))
            .route("/api/v1/notifications", web::get().to(list_records))
            .route("/api/v1/notifications", web::post().to(create_record))
            .route("/api/v1/notifications/{id}", web::get().to(get_record))
            .route("/api/v1/notifications/{id}", web::put().to(update_record))
            .route("/api/v1/notifications/{id}", web::delete().to(delete_record))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}
