#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::env;
use chrono::Utc;
use uuid::Uuid;
use tokio_postgres::NoTls;

struct AppState {
    db: Option<Arc<tokio_postgres::Client>>,
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
    texture_score: f64,
    depth_score: f64,
    motion_score: f64,
    reflection_score: f64,
    challenge_response: String,
    frame_count: u32,
    capture_duration_ms: u64,
    device_model: Option<String>,
    os_version: Option<String>,
}

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
    let now = Utc::now().to_rfc3339();
    let seq_json = serde_json::to_string(&sequence).unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO liveness_challenges (challenge_id, session_id, user_id, sequence, created_at) VALUES ($1, $2, $3, $4, $5)",
            &[&challenge_id, &body.session_id, &body.user_id, &seq_json, &now],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "challenge_id": challenge_id,
        "session_id": body.session_id,
        "user_id": body.user_id,
        "sequence": sequence,
        "timeout_seconds": 30,
        "min_frames": 15,
        "created_at": now,
        "requirements": {
            "min_face_size_px": 200,
            "min_resolution": "640x480",
            "require_depth": true,
            "require_ir": false,
            "max_attempts": 3
        }
    }))
}

async fn verify_liveness(body: web::Json<VerifyRequest>, state: web::Data<AppState>) -> HttpResponse {
    let mut scores = Vec::new();
    let mut flags = Vec::new();
    let mut is_live = true;

    if body.texture_score < 0.65 {
        flags.push("TEXTURE_ANOMALY: possible print/screen attack");
        is_live = false;
    }
    scores.push(("texture", body.texture_score));

    if body.depth_score < 0.60 {
        flags.push("DEPTH_FLAT: no 3D depth detected, possible 2D attack");
        is_live = false;
    }
    scores.push(("depth", body.depth_score));

    if body.motion_score < 0.50 {
        flags.push("MOTION_STATIC: insufficient natural micro-movement");
        is_live = false;
    }
    scores.push(("motion", body.motion_score));

    if body.reflection_score < 0.55 {
        flags.push("REFLECTION_ANOMALY: specular highlights inconsistent with live face");
        is_live = false;
    }
    scores.push(("reflection", body.reflection_score));

    let responses: Vec<&str> = body.challenge_response.split(',').collect();
    if responses.len() < 3 {
        flags.push("CHALLENGE_INCOMPLETE: not all challenges completed");
        is_live = false;
    }
    if body.frame_count < 15 {
        flags.push("LOW_FRAME_COUNT: possible frame injection attack");
        is_live = false;
    }
    if body.capture_duration_ms < 2000 || body.capture_duration_ms > 60000 {
        flags.push("TIMING_ANOMALY: capture duration outside expected range");
        is_live = false;
    }

    let composite: f64 = scores.iter().map(|(_, s)| s).sum::<f64>() / scores.len() as f64;
    let confidence = if is_live { composite } else { composite * 0.3 };
    let pad_level = if composite >= 0.85 { "ISO_30107_3_LEVEL_2" } else if composite >= 0.70 { "ISO_30107_3_LEVEL_1" } else { "BELOW_STANDARD" };
    let recommendation = if is_live { "ACCEPT" } else if flags.len() <= 2 { "RETRY" } else { "REJECT_FRAUD_REVIEW" };

    let verification_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let flags_json = serde_json::to_string(&flags).unwrap_or_default();

    if let Some(ref db) = state.db {
        let _ = db.execute(
            "INSERT INTO liveness_verifications (verification_id, session_id, challenge_id, is_live, confidence, composite_score, pad_level, flags, recommendation, verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            &[&verification_id, &body.session_id, &body.challenge_id, &is_live, &confidence, &composite, &pad_level.to_string(), &flags_json, &recommendation.to_string(), &now],
        ).await;
    }

    HttpResponse::Ok().json(json!({
        "verification_id": verification_id,
        "session_id": body.session_id,
        "challenge_id": body.challenge_id,
        "is_live": is_live,
        "confidence": confidence,
        "composite_score": composite,
        "pad_level": pad_level,
        "scores": scores.iter().map(|(k, v)| json!({"name": *k, "value": v})).collect::<Vec<_>>(),
        "flags": flags,
        "timestamp": now,
        "recommendation": recommendation,
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    if let Some(ref db) = state.db {
        let row = db.query_one(
            "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_live = true) as live_count FROM liveness_verifications", &[],
        ).await;
        if let Ok(row) = row {
            let total: i64 = row.get(0);
            let live_count: i64 = row.get(1);
            let attack_count = total - live_count;
            let attack_rate = if total > 0 { attack_count as f64 / total as f64 } else { 0.0 };
            return HttpResponse::Ok().json(json!({
                "total_verifications": total,
                "live_count": live_count,
                "attack_count": attack_count,
                "attack_rate": attack_rate,
                "source": "postgresql",
            }));
        }
    }
    HttpResponse::Ok().json(json!({"total_verifications": 0, "source": "no_database"}))
}

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    let db_status = if let Some(ref db) = state.db {
        match db.execute("SELECT 1", &[]).await { Ok(_) => "connected", Err(_) => "unhealthy" }
    } else { "not_configured" };
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "pad-liveness-rs", "version": "1.0.0", "database": db_status,
        "capabilities": ["texture_analysis", "depth_estimation", "challenge_response", "injection_detection", "timing_validation"]}))
}

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB error: {}", e); }});
            let _ = client.batch_execute(
                "CREATE TABLE IF NOT EXISTS liveness_challenges (
                    challenge_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT NOT NULL,
                    sequence TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS liveness_verifications (
                    verification_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, challenge_id TEXT NOT NULL,
                    is_live BOOLEAN NOT NULL, confidence DOUBLE PRECISION NOT NULL, composite_score DOUBLE PRECISION NOT NULL,
                    pad_level TEXT NOT NULL, flags TEXT NOT NULL DEFAULT '[]', recommendation TEXT NOT NULL,
                    verified_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_lv_session ON liveness_verifications(session_id);",
            ).await;
            eprintln!("[pad-liveness-rs] PostgreSQL connected, schema ready");
            Some(client)
        }
        Err(e) => { eprintln!("[pad-liveness-rs] DB connect failed: {}", e); None }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9031);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "host=localhost dbname=corebanking".to_string());
    let db_client = init_db(&db_url).await;
    let state = web::Data::new(AppState {
        db: db_client.map(Arc::new),
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
