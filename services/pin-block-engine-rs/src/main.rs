use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

const PBKDF2_ITERATIONS: u32 = 310_000;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

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
        // No seeded/fake records: state starts empty and only real operations populate it.
        AppState {
            start_time: Instant::now(),
            pin_blocks: Arc::new(RwLock::new(Vec::new())),
            pin_hashes: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

fn now_utc() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 { return None; }
    (0..s.len()).step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

/// Constant-time byte comparison to avoid timing oracles on PIN hashes.
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// PBKDF2-HMAC-SHA256 with a cryptographically secure random salt.
fn pbkdf2_hash_pin(pin: &str, salt: &[u8], iterations: u32) -> Vec<u8> {
    let mut out = vec![0u8; HASH_LEN];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), salt, iterations, &mut out);
    out
}

fn valid_pin(pin: &str) -> bool {
    pin.len() >= 4 && pin.len() <= 12 && pin.chars().all(|c| c.is_ascii_digit())
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "pin-block-engine-rs",
        "status": "healthy",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "capabilities": ["pbkdf2-hmac-sha256-hashing", "pin-verification"],
        "hsm": {
            "pin_block_encoding": "unavailable — no HSM/3DES backend configured; /v1/pin/blocks/encode fails closed with 503"
        }
    }))
}

async fn list_blocks(state: web::Data<AppState>) -> HttpResponse {
    let blocks = state.pin_blocks.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *blocks, "total": blocks.len()}))
}

async fn encode_pin_block(_state: web::Data<AppState>, body: web::Json<EncodeRequest>) -> HttpResponse {
    // Validate inputs, then fail closed: there is no HSM/3DES backend in this
    // service, so a real ISO-0/ISO-3 PIN block cannot be produced. Returning a
    // fabricated block would be a security-critical fake, so we return 503.
    let format = body.format.clone().unwrap_or_else(|| "ISO-0".into());
    if format != "ISO-0" && format != "ISO-3" {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "unsupported_pin_block_format"}));
    }
    if body.pan.len() < 12 || !body.pan.chars().all(|c| c.is_ascii_digit()) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pan"}));
    }
    if !valid_pin(&body.pin) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pin"}));
    }
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "hsm_unavailable",
        "detail": "PIN block encoding requires an HSM (3DES/AES under ZPK); no HSM backend is configured",
        "encoded": false
    }))
}

async fn list_hashes(state: web::Data<AppState>) -> HttpResponse {
    let hashes = state.pin_hashes.read().unwrap();
    HttpResponse::Ok().json(json!({"items": *hashes, "total": hashes.len()}))
}

async fn hash_pin(state: web::Data<AppState>, body: web::Json<HashRequest>) -> HttpResponse {
    if !valid_pin(&body.pin) {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "invalid_pin", "detail": "PIN must be 4-12 ASCII digits"}));
    }
    let algo = body.algorithm.clone().unwrap_or_else(|| "PBKDF2-SHA256".into());
    if algo != "PBKDF2-SHA256" {
        return HttpResponse::UnprocessableEntity().json(json!({"error": "unsupported_algorithm", "supported": ["PBKDF2-SHA256"]}));
    }
    let mut salt = [0u8; SALT_LEN];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    let hash = pbkdf2_hash_pin(&body.pin, &salt, PBKDF2_ITERATIONS);
    let rec = PinHashRecord {
        id: format!("PH-{}", uuid::Uuid::new_v4()),
        account_number: body.account_number.clone(),
        algorithm: algo.clone(),
        hash_hex: hex_encode(&hash),
        salt: hex_encode(&salt),
        iterations: PBKDF2_ITERATIONS,
        created_at: now_utc(),
    };
    state.pin_hashes.write().unwrap().push(rec.clone());
    HttpResponse::Created().json(json!({"id": rec.id, "algorithm": algo, "hashStored": true}))
}

async fn verify_pin(state: web::Data<AppState>, body: web::Json<VerifyRequest>) -> HttpResponse {
    if !valid_pin(&body.pin) {
        // Fail closed: an invalid candidate PIN is never verified.
        return HttpResponse::Ok().json(json!({"hashId": body.hash_id, "verified": false, "reason": "invalid_pin_format"}));
    }
    let rec = {
        let hashes = state.pin_hashes.read().unwrap();
        hashes.iter().find(|h| h.id == body.hash_id).cloned()
    };
    let rec = match rec {
        Some(r) => r,
        None => return HttpResponse::NotFound().json(json!({"error": "hash record not found"})),
    };
    let salt = match hex_decode(&rec.salt) {
        Some(s) => s,
        None => return HttpResponse::InternalServerError().json(json!({"error": "corrupt_hash_record"})),
    };
    let expected = match hex_decode(&rec.hash_hex) {
        Some(h) => h,
        None => return HttpResponse::InternalServerError().json(json!({"error": "corrupt_hash_record"})),
    };
    let actual = pbkdf2_hash_pin(&body.pin, &salt, rec.iterations);
    let verified = ct_eq(&actual, &expected);
    HttpResponse::Ok().json(json!({
        "hashId": body.hash_id,
        "verified": verified,
        "matchedAt": if verified { json!(now_utc()) } else { json!(null) },
    }))
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
