#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Sha256, Digest};
use std::sync::Mutex;
use std::collections::HashMap;

// code-signing-rs — Deployment artifact signature verification
// Prevents tampered binaries from being deployed to production.
// Every container image, binary, and config must have a valid cryptographic signature.

struct AppState {
    signatures: Mutex<HashMap<String, ArtifactSignature>>,
    verification_log: Mutex<Vec<VerificationEvent>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ArtifactSignature {
    artifact_id: String,
    artifact_type: String,   // "container_image", "binary", "config", "helm_chart"
    sha256_hash: String,
    signer_id: String,
    signer_role: String,
    signature: String,       // hex-encoded HMAC-SHA256
    signed_at: String,
    valid_until: String,
    metadata: serde_json::Value,
}

#[derive(Clone, Serialize, Deserialize)]
struct VerificationEvent {
    id: String,
    artifact_id: String,
    verified: bool,
    verifier: String,
    reason: String,
    timestamp: String,
}

fn compute_signature(data: &str, key: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key);
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

async fn sign_artifact(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let artifact_id = body["artifact_id"].as_str().unwrap_or("").to_string();
    let artifact_type = body["artifact_type"].as_str().unwrap_or("binary").to_string();
    let sha256_hash = body["sha256_hash"].as_str().unwrap_or("").to_string();
    let signer_id = body["signer_id"].as_str().unwrap_or("").to_string();
    let signer_role = body["signer_role"].as_str().unwrap_or("").to_string();

    if artifact_id.is_empty() || sha256_hash.is_empty() || signer_id.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "missing required fields"}));
    }

    // Only authorized roles can sign
    let allowed_roles = ["release_manager", "security_admin", "sre", "ci_pipeline"];
    if !allowed_roles.contains(&signer_role.as_str()) {
        return HttpResponse::Forbidden().json(json!({
            "error": format!("role '{}' is not authorized to sign artifacts", signer_role)
        }));
    }

    let signing_key = std::env::var("SIGNING_KEY").unwrap_or_else(|_| "54bank-default-signing-key-change-in-production".to_string());
    let sign_data = format!("{}:{}:{}", artifact_id, sha256_hash, signer_id);
    let signature = compute_signature(&sign_data, signing_key.as_bytes());

    let now = chrono::Utc::now();
    let sig = ArtifactSignature {
        artifact_id: artifact_id.clone(),
        artifact_type,
        sha256_hash,
        signer_id,
        signer_role,
        signature,
        signed_at: now.to_rfc3339(),
        valid_until: (now + chrono::Duration::days(90)).to_rfc3339(),
        metadata: body.get("metadata").cloned().unwrap_or(json!({})),
    };

    let mut sigs = state.signatures.lock().unwrap();
    sigs.insert(artifact_id, sig.clone());

    HttpResponse::Created().json(sig)
}

async fn verify_artifact(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let artifact_id = body["artifact_id"].as_str().unwrap_or("").to_string();
    let sha256_hash = body["sha256_hash"].as_str().unwrap_or("").to_string();
    let verifier = body["verifier"].as_str().unwrap_or("system").to_string();

    let sigs = state.signatures.lock().unwrap();
    let sig = match sigs.get(&artifact_id) {
        Some(s) => s.clone(),
        None => {
            let evt = VerificationEvent {
                id: format!("VER-{}", hex::encode(&Sha256::digest(artifact_id.as_bytes())[..6])),
                artifact_id: artifact_id.clone(),
                verified: false,
                verifier: verifier.clone(),
                reason: "no signature found — UNSIGNED ARTIFACT".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            let mut log = state.verification_log.lock().unwrap();
            log.push(evt.clone());
            return HttpResponse::Forbidden().json(json!({
                "verified": false,
                "reason": "no signature found — deployment BLOCKED",
                "event": evt
            }));
        }
    };
    drop(sigs);

    let signing_key = std::env::var("SIGNING_KEY").unwrap_or_else(|_| "54bank-default-signing-key-change-in-production".to_string());
    let sign_data = format!("{}:{}:{}", sig.artifact_id, sig.sha256_hash, sig.signer_id);
    let expected = compute_signature(&sign_data, signing_key.as_bytes());

    let hash_match = sig.sha256_hash == sha256_hash;
    let sig_valid = sig.signature == expected;
    let verified = hash_match && sig_valid;

    let reason = if !hash_match {
        "SHA-256 hash mismatch — ARTIFACT TAMPERED".to_string()
    } else if !sig_valid {
        "signature verification failed — POSSIBLE KEY COMPROMISE".to_string()
    } else {
        "signature valid".to_string()
    };

    let evt = VerificationEvent {
        id: format!("VER-{}", hex::encode(&Sha256::digest(format!("{}{}", artifact_id, chrono::Utc::now()).as_bytes())[..6])),
        artifact_id,
        verified,
        verifier,
        reason: reason.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let mut log = state.verification_log.lock().unwrap();
    log.push(evt.clone());

    if verified {
        HttpResponse::Ok().json(json!({"verified": true, "signer": sig.signer_id, "signed_at": sig.signed_at}))
    } else {
        HttpResponse::Forbidden().json(json!({"verified": false, "reason": reason, "event": evt}))
    }
}

async fn list_signatures(state: web::Data<AppState>) -> HttpResponse {
    let sigs = state.signatures.lock().unwrap();
    let list: Vec<&ArtifactSignature> = sigs.values().collect();
    HttpResponse::Ok().json(list)
}

async fn list_verifications(state: web::Data<AppState>) -> HttpResponse {
    let log = state.verification_log.lock().unwrap();
    HttpResponse::Ok().json(log.clone())
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let sigs = state.signatures.lock().unwrap();
    let log = state.verification_log.lock().unwrap();
    let failed = log.iter().filter(|e| !e.verified).count();
    HttpResponse::Ok().json(json!({
        "total_signatures": sigs.len(),
        "total_verifications": log.len(),
        "failed_verifications": failed,
        "service": "code-signing-rs"
    }))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "code-signing-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "alive"})) }
async fn readyz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "ready"})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080);
    let state = web::Data::new(AppState {
        signatures: Mutex::new(HashMap::new()),
        verification_log: Mutex::new(Vec::new()),
    });

    println!("[code-signing-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/api/v1/signing/sign", web::post().to(sign_artifact))
            .route("/api/v1/signing/verify", web::post().to(verify_artifact))
            .route("/api/v1/signing/signatures", web::get().to(list_signatures))
            .route("/api/v1/signing/verifications", web::get().to(list_verifications))
            .route("/api/v1/signing/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
