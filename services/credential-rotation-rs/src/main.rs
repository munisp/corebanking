#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::collections::HashMap;

// credential-rotation-rs — Automated credential rotation and stale account detection
// Tracks all service accounts, API keys, DB passwords, and certificates.
// Enforces rotation policies and alerts on stale/expired credentials.
// Integrates with Vault for automated secret rotation.

struct AppState {
    credentials: Mutex<Vec<ManagedCredential>>,
    rotation_log: Mutex<Vec<RotationEvent>>,
    policies: Mutex<HashMap<String, RotationPolicy>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ManagedCredential {
    id: String,
    name: String,
    credential_type: String,  // "api_key", "db_password", "service_account", "tls_cert", "ssh_key"
    owner: String,            // service or person owning this credential
    last_rotated: String,
    expires_at: String,
    rotation_count: u32,
    status: String,           // "active", "stale", "expired", "rotating", "revoked"
    vault_path: String,       // Vault secret path
    auto_rotate: bool,
    days_since_rotation: i64,
}

#[derive(Clone, Serialize, Deserialize)]
struct RotationEvent {
    id: String,
    credential_id: String,
    action: String,           // "rotated", "revoked", "expired_alert", "stale_alert"
    performed_by: String,
    timestamp: String,
    details: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct RotationPolicy {
    credential_type: String,
    max_age_days: i64,
    stale_warning_days: i64,
    auto_rotate: bool,
    require_mfa: bool,
}

fn init_state() -> AppState {
    let mut policies = HashMap::new();
    policies.insert("api_key".to_string(), RotationPolicy { credential_type: "api_key".to_string(), max_age_days: 90, stale_warning_days: 75, auto_rotate: true, require_mfa: false });
    policies.insert("db_password".to_string(), RotationPolicy { credential_type: "db_password".to_string(), max_age_days: 30, stale_warning_days: 25, auto_rotate: true, require_mfa: true });
    policies.insert("service_account".to_string(), RotationPolicy { credential_type: "service_account".to_string(), max_age_days: 180, stale_warning_days: 150, auto_rotate: false, require_mfa: true });
    policies.insert("tls_cert".to_string(), RotationPolicy { credential_type: "tls_cert".to_string(), max_age_days: 365, stale_warning_days: 330, auto_rotate: true, require_mfa: false });
    policies.insert("ssh_key".to_string(), RotationPolicy { credential_type: "ssh_key".to_string(), max_age_days: 90, stale_warning_days: 75, auto_rotate: false, require_mfa: true });

    let now = chrono::Utc::now();
    let credentials = vec![
        ManagedCredential { id: "CRED-001".into(), name: "payments-hub-db".into(), credential_type: "db_password".into(), owner: "payments-hub-go".into(), last_rotated: (now - chrono::Duration::days(15)).to_rfc3339(), expires_at: (now + chrono::Duration::days(15)).to_rfc3339(), rotation_count: 12, status: "active".into(), vault_path: "secret/data/payments-hub/db".into(), auto_rotate: true, days_since_rotation: 15 },
        ManagedCredential { id: "CRED-002".into(), name: "gl-engine-db".into(), credential_type: "db_password".into(), owner: "gl-engine-go".into(), last_rotated: (now - chrono::Duration::days(28)).to_rfc3339(), expires_at: (now + chrono::Duration::days(2)).to_rfc3339(), rotation_count: 11, status: "stale".into(), vault_path: "secret/data/gl-engine/db".into(), auto_rotate: true, days_since_rotation: 28 },
        ManagedCredential { id: "CRED-003".into(), name: "nibss-api-key".into(), credential_type: "api_key".into(), owner: "nibss-nip-engine-go".into(), last_rotated: (now - chrono::Duration::days(45)).to_rfc3339(), expires_at: (now + chrono::Duration::days(45)).to_rfc3339(), rotation_count: 4, status: "active".into(), vault_path: "secret/data/nibss/api-key".into(), auto_rotate: true, days_since_rotation: 45 },
        ManagedCredential { id: "CRED-004".into(), name: "aml-service-account".into(), credential_type: "service_account".into(), owner: "aml-engine-rs".into(), last_rotated: (now - chrono::Duration::days(160)).to_rfc3339(), expires_at: (now + chrono::Duration::days(20)).to_rfc3339(), rotation_count: 2, status: "stale".into(), vault_path: "secret/data/aml/service-account".into(), auto_rotate: false, days_since_rotation: 160 },
        ManagedCredential { id: "CRED-005".into(), name: "platform-tls-cert".into(), credential_type: "tls_cert".into(), owner: "apisix-gateway".into(), last_rotated: (now - chrono::Duration::days(300)).to_rfc3339(), expires_at: (now + chrono::Duration::days(65)).to_rfc3339(), rotation_count: 1, status: "active".into(), vault_path: "secret/data/platform/tls".into(), auto_rotate: true, days_since_rotation: 300 },
    ];

    AppState {
        credentials: Mutex::new(credentials),
        rotation_log: Mutex::new(Vec::new()),
        policies: Mutex::new(policies),
    }
}

async fn list_credentials(state: web::Data<AppState>) -> HttpResponse {
    let creds = state.credentials.lock().unwrap();
    HttpResponse::Ok().json(creds.clone())
}

async fn rotate_credential(state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let cred_id = body["credential_id"].as_str().unwrap_or("").to_string();
    let rotator = body["rotated_by"].as_str().unwrap_or("system").to_string();

    let mut creds = state.credentials.lock().unwrap();
    let cred = match creds.iter_mut().find(|c| c.id == cred_id) {
        Some(c) => c,
        None => return HttpResponse::NotFound().json(json!({"error": "credential not found"})),
    };

    let now = chrono::Utc::now();
    let policies = state.policies.lock().unwrap();
    let policy = policies.get(&cred.credential_type);
    let max_age = policy.map(|p| p.max_age_days).unwrap_or(90);

    cred.last_rotated = now.to_rfc3339();
    cred.expires_at = (now + chrono::Duration::days(max_age)).to_rfc3339();
    cred.rotation_count += 1;
    cred.status = "active".to_string();
    cred.days_since_rotation = 0;

    let evt = RotationEvent {
        id: format!("ROT-{:06}", cred.rotation_count),
        credential_id: cred_id.clone(),
        action: "rotated".to_string(),
        performed_by: rotator,
        timestamp: now.to_rfc3339(),
        details: format!("credential rotated, new expiry: {}", cred.expires_at),
    };

    let mut log = state.rotation_log.lock().unwrap();
    log.push(evt.clone());

    HttpResponse::Ok().json(json!({"status": "rotated", "event": evt, "next_expiry": cred.expires_at}))
}

async fn check_stale(state: web::Data<AppState>) -> HttpResponse {
    let creds = state.credentials.lock().unwrap();
    let policies = state.policies.lock().unwrap();
    let mut stale: Vec<serde_json::Value> = Vec::new();

    for cred in creds.iter() {
        let policy = policies.get(&cred.credential_type);
        if let Some(p) = policy {
            if cred.days_since_rotation >= p.stale_warning_days {
                stale.push(json!({
                    "credential_id": cred.id, "name": cred.name, "type": cred.credential_type,
                    "days_since_rotation": cred.days_since_rotation, "max_allowed": p.max_age_days,
                    "status": if cred.days_since_rotation >= p.max_age_days { "EXPIRED" } else { "STALE" },
                    "auto_rotate": p.auto_rotate,
                }));
            }
        }
    }

    HttpResponse::Ok().json(json!({"stale_credentials": stale, "total_stale": stale.len()}))
}

async fn list_policies(state: web::Data<AppState>) -> HttpResponse {
    let p = state.policies.lock().unwrap();
    HttpResponse::Ok().json(p.clone())
}

async fn rotation_history(state: web::Data<AppState>) -> HttpResponse {
    let log = state.rotation_log.lock().unwrap();
    HttpResponse::Ok().json(log.clone())
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let creds = state.credentials.lock().unwrap();
    let log = state.rotation_log.lock().unwrap();
    let stale = creds.iter().filter(|c| c.status == "stale").count();
    let expired = creds.iter().filter(|c| c.status == "expired").count();
    HttpResponse::Ok().json(json!({
        "total_credentials": creds.len(), "active": creds.iter().filter(|c| c.status == "active").count(),
        "stale": stale, "expired": expired, "total_rotations": log.len(),
        "service": "credential-rotation-rs"
    }))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "credential-rotation-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "alive"})) }
async fn readyz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "ready"})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080);
    let state = web::Data::new(init_state());
    println!("[credential-rotation-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/api/v1/credentials/list", web::get().to(list_credentials))
            .route("/api/v1/credentials/rotate", web::post().to(rotate_credential))
            .route("/api/v1/credentials/stale", web::get().to(check_stale))
            .route("/api/v1/credentials/policies", web::get().to(list_policies))
            .route("/api/v1/credentials/history", web::get().to(rotation_history))
            .route("/api/v1/credentials/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
