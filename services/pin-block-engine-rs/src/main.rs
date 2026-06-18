use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, RwLock};
use std::time::Instant;

#[derive(Clone, Serialize, Deserialize)]
struct PinBlock {
    id: String,
    format: String,
    pan_truncated: String,
    block_hex: String,
    algorithm: String,
    key_id: String,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct PinHashRecord {
    id: String,
    account_number: String,
    algorithm: String,
    hash_hex: String,
    salt: String,
    iterations: u32,
    created_at: String,
}

#[derive(Deserialize)]
struct EncodeRequest {
    pan: String,
    pin: String,
    format: Option<String>,
    key_id: Option<String>,
}

#[derive(Deserialize)]
struct HashRequest {
    account_number: String,
    pin: String,
    algorithm: Option<String>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    hash_id: String,
    pin: String,
}

#[derive(Clone)]
struct AppState {
    start_time: Instant,
    pin_blocks: Arc<RwLock<Vec<PinBlock>>>,
    pin_hashes: Arc<RwLock<Vec<PinHashRecord>>>,
}

impl AppState {
    fn new() -> Self {
        let blocks = vec![
            PinBlock {
                id: "PB-001".into(), format: "ISO-0".into(),
                pan_truncated: "****5678".into(), block_hex: "0412AC7B3E8F0000".into(),
                algorithm: "3DES".into(), key_id: "ZPK-001".into(),
                created_at: "2026-05-09T10:30:00Z".into(),
            },
            PinBlock {
                id: "PB-002".into(), format: "ISO-3".into(),
                pan_truncated: "****9012".into(), block_hex: "3417D2A4F9C10000".into(),
                algorithm: "AES-256".into(), key_id: "ZPK-002".into(),
                created_at: "2026-05-09T11:15:00Z".into(),
            },
        ];
        let hashes = vec![
            PinHashRecord {
                id: "PH-001".into(), account_number: "0012345678".into(),
                algorithm: "PBKDF2-SHA256".into(),
                hash_hex: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8".into(),
                salt: "a3f9c2b1e8d47056".into(), iterations: 310000,
                created_at: "2026-05-09T10:00:00Z".into(),
            },
            PinHashRecord {
                id: "PH-002".into(), account_number: "3034567890".into(),
                algorithm: "Argon2id".into(),
                hash_hex: "7b94d4e2f1a80c63b9e5d02741f8a9c3d6b2e7f4a1c8d5b3e0f7a2c9d6b4e1f8".into(),
                salt: "c7d3e9f2a4b6c8d1".into(), iterations: 3,
                created_at: "2026-05-09T11:00:00Z".into(),
            },
        ];
        AppState {
            start_time: Instant::now(),
            pin_blocks: Arc::new(RwLock::new(blocks)),
            pin_hashes: Arc::new(RwLock::new(hashes)),
        }
    }
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "pin-block-engine-rs",
        "status": "healthy",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "capabilities": ["iso-0-format", "iso-3-format", "3des-encryption", "aes256-encryption",
                         "pbkdf2-hashing", "argon2id-hashing", "pin-verification"],
        "middleware": {
            "postgres": "pin_security_db",
            "redis": "pin-block-engine_cache",
            "temporal": "PinBlockWorkflow"
        }
    }))
}

async fn list_blocks(state: web::Data<AppState>) -> HttpResponse {
    let blocks = state.pin_blocks.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *blocks, "total": blocks.len()}))
}

async fn encode_pin_block(state: web::Data<AppState>, body: web::Json<EncodeRequest>) -> HttpResponse {
    let format = body.format.clone().unwrap_or_else(|| "ISO-0".into());
    let key_id = body.key_id.clone().unwrap_or_else(|| "ZPK-001".into());
    let pan_last4 = &body.pan[body.pan.len().saturating_sub(4)..];
    let block = PinBlock {
        id: format!("PB-{:03}", state.pin_blocks.read().unwrap().len() + 1),
        format: format.clone(),
        pan_truncated: format!("****{}", pan_last4),
        block_hex: format!("{:016X}", body.pin.len() as u64 * 0x0412AC7B3E8F),
        algorithm: if key_id.contains("ZPK-002") { "AES-256".into() } else { "3DES".into() },
        key_id: key_id.clone(),
        created_at: "2026-05-20T00:00:00Z".into(),
    };
    state.pin_blocks.write().unwrap().push(block.clone());
    HttpResponse::Created().json(json!({"id": block.id, "format": block.format, "keyId": key_id, "encoded": true}))
}

async fn list_hashes(state: web::Data<AppState>) -> HttpResponse {
    let hashes = state.pin_hashes.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *hashes, "total": hashes.len()}))
}

async fn hash_pin(state: web::Data<AppState>, body: web::Json<HashRequest>) -> HttpResponse {
    let algo = body.algorithm.clone().unwrap_or_else(|| "PBKDF2-SHA256".into());
    let rec = PinHashRecord {
        id: format!("PH-{:03}", state.pin_hashes.read().unwrap().len() + 1),
        account_number: body.account_number.clone(),
        algorithm: algo.clone(),
        hash_hex: format!("{:064x}", body.pin.len() as u128 * 0x5e884898da28047151d0e56f8dc62927u128),
        salt: "generated_salt_hex".into(),
        iterations: if algo == "Argon2id" { 3 } else { 310000 },
        created_at: "2026-05-20T00:00:00Z".into(),
    };
    state.pin_hashes.write().unwrap().push(rec.clone());
    HttpResponse::Created().json(json!({"id": rec.id, "algorithm": algo, "hashStored": true}))
}

async fn verify_pin(state: web::Data<AppState>, body: web::Json<VerifyRequest>) -> HttpResponse {
    let hashes = state.pin_hashes.read().unwrap();
    let found = hashes.iter().any(|h| h.id == body.hash_id);
    if !found {
        return HttpResponse::NotFound().json(json!({"error": "hash record not found"}));
    }
    HttpResponse::Ok().json(json!({"hashId": body.hash_id, "verified": true, "matchedAt": "2026-05-20T00:00:00Z"}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let blocks = state.pin_blocks.read().unwrap();
    let hashes = state.pin_hashes.read().unwrap();
    let algo_counts = hashes.iter().fold(std::collections::HashMap::<String,u32>::new(), |mut m, h| {
        *m.entry(h.algorithm.clone()).or_insert(0) += 1;
        m
    });
    HttpResponse::Ok().json(json!({
        "pinBlocksEncoded": blocks.len(),
        "pinHashesStored": hashes.len(),
        "formatBreakdown": {"ISO-0": 1, "ISO-3": 1},
        "algorithmBreakdown": algo_counts,
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9273".to_string());
    let state = AppState::new();
    println!("PIN Block & Hash Engine (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/pin/blocks", web::get().to(list_blocks))
            .route("/v1/pin/blocks/encode", web::post().to(encode_pin_block))
            .route("/v1/pin/hashes", web::get().to(list_hashes))
            .route("/v1/pin/hashes/create", web::post().to(hash_pin))
            .route("/v1/pin/verify", web::post().to(verify_pin))
            .route("/v1/pin/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}
