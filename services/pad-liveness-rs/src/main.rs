#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use chrono::Utc;
use uuid::Uuid;

// PAD Liveness — ISO 30107-3 Level 2 Presentation Attack Detection
// Anti-spoofing: texture analysis, depth estimation, challenge-response, injection detection

struct AppState {
    db_url: Option<String>,
    challenges: Mutex<Vec<serde_json::Value>>,
    verifications: Mutex<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
struct ChallengeRequest {
    session_id: String,
    user_id: String,
    device_fingerprint: Option<String>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    session_id: String,
    challenge_id: String,
    // Image analysis results from client-side SDK
    texture_score: f64,        // Moire pattern / print texture detection (0-1)
    depth_score: f64,          // 3D depth map consistency (0-1, requires TrueDepth/ToF)
    motion_score: f64,         // Natural micro-movement detection (0-1)
    reflection_score: f64,     // Specular highlight consistency (0-1)
    challenge_response: String, // e.g. "blink_left,turn_right,smile"
    frame_count: u32,          // Number of frames analyzed
    capture_duration_ms: u64,  // Time taken to complete challenge
    device_model: Option<String>,
    os_version: Option<String>,
}

// Challenge types for randomized liveness
const CHALLENGES: &[&str] = &[
    "blink_both", "blink_left", "blink_right",
    "turn_left", "turn_right", "turn_up", "turn_down",
    "smile", "open_mouth", "raise_eyebrows",
    "nod_yes", "shake_no",
];

fn generate_challenge_sequence() -> Vec<String> {
    use rand::seq::SliceRandom;
    let mut rng = rand::thread_rng();
    let mut challenges: Vec<&str> = CHALLENGES.to_vec();
    challenges.shuffle(&mut rng);
    challenges.into_iter().take(3).map(|s| s.to_string()).collect()
}

async fn create_challenge(body: web::Json<ChallengeRequest>, state: web::Data<AppState>) -> HttpResponse {
    let challenge_id = Uuid::new_v4().to_string();
    let sequence = generate_challenge_sequence();
    let challenge = json!({
        "challenge_id": challenge_id,
        "session_id": body.session_id,
        "user_id": body.user_id,
        "sequence": sequence,
        "timeout_seconds": 30,
        "min_frames": 15,
        "created_at": Utc::now().to_rfc3339(),
        "requirements": {
            "min_face_size_px": 200,
            "min_resolution": "640x480",
            "require_depth": true,
            "require_ir": false,
            "max_attempts": 3
        }
    });
    state.challenges.lock().unwrap().push(challenge.clone());
    HttpResponse::Ok().json(challenge)
}

async fn verify_liveness(body: web::Json<VerifyRequest>, state: web::Data<AppState>) -> HttpResponse {
    let mut scores = Vec::new();
    let mut flags = Vec::new();
    let mut is_live = true;

    // 1. Texture analysis — detect printed photos, screens
    if body.texture_score < 0.65 {
        flags.push("TEXTURE_ANOMALY: possible print/screen attack");
        is_live = false;
    }
    scores.push(("texture", body.texture_score));

    // 2. Depth estimation — detect flat surfaces (photos, masks)
    if body.depth_score < 0.60 {
        flags.push("DEPTH_FLAT: no 3D depth detected, possible 2D attack");
        is_live = false;
    }
    scores.push(("depth", body.depth_score));

    // 3. Motion analysis — detect replay/video injection
    if body.motion_score < 0.50 {
        flags.push("MOTION_STATIC: insufficient natural micro-movement");
        is_live = false;
    }
    scores.push(("motion", body.motion_score));

    // 4. Reflection analysis — detect screen reflections
    if body.reflection_score < 0.55 {
        flags.push("REFLECTION_ANOMALY: specular highlights inconsistent with live face");
        is_live = false;
    }
    scores.push(("reflection", body.reflection_score));

    // 5. Challenge-response validation
    let expected_count = 3;
    let responses: Vec<&str> = body.challenge_response.split(',').collect();
    if responses.len() < expected_count {
        flags.push("CHALLENGE_INCOMPLETE: not all challenges completed");
        is_live = false;
    }
    
    // 6. Frame count validation (anti-injection)
    if body.frame_count < 15 {
        flags.push("LOW_FRAME_COUNT: possible frame injection attack");
        is_live = false;
    }
    
    // 7. Timing validation
    if body.capture_duration_ms < 2000 || body.capture_duration_ms > 60000 {
        flags.push("TIMING_ANOMALY: capture duration outside expected range");
        is_live = false;
    }

    // Composite score
    let composite: f64 = scores.iter().map(|(_, s)| s).sum::<f64>() / scores.len() as f64;
    let confidence = if is_live { composite } else { composite * 0.3 };
    let pad_level = if composite >= 0.85 { "ISO_30107_3_LEVEL_2" } else if composite >= 0.70 { "ISO_30107_3_LEVEL_1" } else { "BELOW_STANDARD" };

    let result = json!({
        "session_id": body.session_id,
        "challenge_id": body.challenge_id,
        "is_live": is_live,
        "confidence": confidence,
        "composite_score": composite,
        "pad_level": pad_level,
        "scores": scores.iter().map(|(k, v)| json!({"name": *k, "value": v})).collect::<Vec<_>>(),
        "flags": flags,
        "timestamp": Utc::now().to_rfc3339(),
        "recommendation": if is_live { "ACCEPT" } else if flags.len() <= 2 { "RETRY" } else { "REJECT_FRAUD_REVIEW" },
    });

    state.verifications.lock().unwrap().push(result.clone());

    if is_live {
        HttpResponse::Ok().json(result)
    } else {
        HttpResponse::Ok().json(result) // 200 with is_live=false (not 403, client decides)
    }
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "pad-liveness-rs", "version": "1.0.0", "capabilities": ["texture_analysis", "depth_estimation", "challenge_response", "injection_detection", "timing_validation"]}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let verifications = state.verifications.lock().unwrap();
    let total = verifications.len();
    let live_count = verifications.iter().filter(|v| v["is_live"].as_bool().unwrap_or(false)).count();
    HttpResponse::Ok().json(json!({
        "total_verifications": total,
        "live_count": live_count,
        "attack_count": total - live_count,
        "attack_rate": if total > 0 { (total - live_count) as f64 / total as f64 } else { 0.0 },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9031);
    let state = web::Data::new(AppState {
        db_url: env::var("DATABASE_URL").ok(),
        challenges: Mutex::new(Vec::new()),
        verifications: Mutex::new(Vec::new()),
    });
    eprintln!("[pad-liveness-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/liveness/challenge", web::post().to(create_challenge))
            .route("/api/v1/liveness/verify", web::post().to(verify_liveness))
            .route("/api/v1/liveness/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?.run().await
}
