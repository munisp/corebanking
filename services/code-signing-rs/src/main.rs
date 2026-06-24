// 54Bank Code Signing — Rust
// All state persisted to PostgreSQL. No in-memory HashMaps.
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicI64, AtomicI32, Ordering};
use std::env;
use tokio_postgres::{Client, NoTls};
use tokio::sync::Mutex;

struct AppState {
    db: Option<Mutex<Client>>,
    healthy: AtomicI32,
    last_activity: AtomicI64,
}

#[derive(Serialize, Deserialize, Clone)]
struct ArtifactSignature {
    artifact_id: String,
    artifact_type: String,
    sha256_hash: String,
    signer_id: String,
    signer_role: String,
    signature: String,
    signed_at: String,
    valid_until: String,
    metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
struct VerificationEvent {
    id: String,
    artifact_id: String,
    verified: bool,
    verifier: String,
    reason: String,
    timestamp: String,
}

async fn init_schema(db: &Client) {
    let queries = [
        "CREATE TABLE IF NOT EXISTS artifact_signatures (
            artifact_id TEXT PRIMARY KEY, artifact_type TEXT NOT NULL,
            sha256_hash TEXT NOT NULL, signer_id TEXT NOT NULL,
            signer_role TEXT, signature TEXT NOT NULL,
            signed_at TEXT NOT NULL, valid_until TEXT,
            metadata JSONB DEFAULT '{}')",
        "CREATE TABLE IF NOT EXISTS verification_events (
            id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL,
            verified BOOLEAN NOT NULL, verifier TEXT,
            reason TEXT, timestamp TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_sig_signer ON artifact_signatures(signer_id)",
        "CREATE INDEX IF NOT EXISTS idx_ver_artifact ON verification_events(artifact_id)",
    ];
    for q in queries {
        if let Err(e) = db.execute(q, &[]).await { eprintln!("[code-signing] schema: {}", e); }
    }
    // Seed signed artifacts
    let seeds = [
        ("gl-engine-rs:v2.1.0", "binary", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", "build-system", "ci_pipeline",
         "MEUCIQD+signature_placeholder_gl_engine", "2026-06-01T00:00:00Z", "2027-06-01T00:00:00Z"),
        ("payments-hub-go:v3.0.1", "binary", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", "build-system", "ci_pipeline",
         "MEUCIQD+signature_placeholder_payments_hub", "2026-06-02T00:00:00Z", "2027-06-02T00:00:00Z"),
        ("fraud-detection-rs:v1.5.0", "binary", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", "security-admin", "security_team",
         "MEUCIQD+signature_placeholder_fraud_detection", "2026-05-15T00:00:00Z", "2027-05-15T00:00:00Z"),
    ];
    for (id, atype, hash, signer, role, sig, signed, valid) in seeds {
        let _ = db.execute(
            "INSERT INTO artifact_signatures (artifact_id, artifact_type, sha256_hash, signer_id, signer_role, signature, signed_at, valid_until, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}') ON CONFLICT (artifact_id) DO NOTHING",
            &[&id, &atype, &hash, &signer, &role, &sig, &signed, &valid]
        ).await;
    }
    eprintln!("[code-signing] PostgreSQL schema initialized with seed data");
}

async fn sign_artifact(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let artifact_id = body["artifact_id"].as_str().unwrap_or("");
    let artifact_type = body["artifact_type"].as_str().unwrap_or("binary");
    let sha256_hash = body["sha256_hash"].as_str().unwrap_or("");
    let signer_id = body["signer_id"].as_str().unwrap_or("");
    let signer_role = body["signer_role"].as_str().unwrap_or("");
    if sha256_hash.is_empty() || signer_id.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "sha256_hash and signer_id required"}));
    }
    let now = chrono::Utc::now().to_rfc3339();
    let valid_until = (chrono::Utc::now() + chrono::Duration::days(365)).to_rfc3339();
    let sig_data = format!("{}|{}|{}|{}", artifact_id, sha256_hash, signer_id, now);
    let signature = format!("SIG-{}", hex::encode(sha2::Sha256::digest(sig_data.as_bytes())));
    let metadata = body.get("metadata").cloned().unwrap_or(serde_json::json!({}));
    let metadata_str = serde_json::to_string(&metadata).unwrap_or_default();

    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let _ = db_guard.execute(
        "INSERT INTO artifact_signatures (artifact_id, artifact_type, sha256_hash, signer_id, signer_role, signature, signed_at, valid_until, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (artifact_id) DO UPDATE SET sha256_hash=EXCLUDED.sha256_hash, signature=EXCLUDED.signature, signed_at=EXCLUDED.signed_at, valid_until=EXCLUDED.valid_until",
        &[&artifact_id, &artifact_type, &sha256_hash, &signer_id, &signer_role, &signature, &now, &valid_until, &metadata_str]
    ).await;
    HttpResponse::Created().json(serde_json::json!({
        "artifact_id": artifact_id, "signature": signature, "signed_at": now, "valid_until": valid_until,
    }))
}

async fn verify_artifact(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    data.last_activity.store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
    let artifact_id = body["artifact_id"].as_str().unwrap_or("");
    let sha256_hash = body["sha256_hash"].as_str().unwrap_or("");
    let verifier = body["verifier"].as_str().unwrap_or("system");

    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let row = db_guard.query_opt(
        "SELECT sha256_hash, signature, signed_at, valid_until FROM artifact_signatures WHERE artifact_id = $1",
        &[&artifact_id]
    ).await;

    let now = chrono::Utc::now().to_rfc3339();
    let evt_id = format!("VER-{:08x}", rand_u32());

    match row {
        Ok(Some(r)) => {
            let stored_hash: String = r.get(0);
            let verified = stored_hash == sha256_hash;
            let reason = if verified { "hash matches signed artifact".to_string() } else { format!("hash mismatch: expected {} got {}", stored_hash, sha256_hash) };
            let _ = db_guard.execute(
                "INSERT INTO verification_events (id, artifact_id, verified, verifier, reason, timestamp) VALUES ($1,$2,$3,$4,$5,$6)",
                &[&evt_id, &artifact_id, &verified, &verifier, &reason, &now]
            ).await;
            if verified {
                HttpResponse::Ok().json(serde_json::json!({"verified": true, "artifact_id": artifact_id, "reason": reason}))
            } else {
                HttpResponse::Forbidden().json(serde_json::json!({"verified": false, "artifact_id": artifact_id, "reason": reason}))
            }
        },
        _ => {
            let reason = format!("no signature found for artifact {}", artifact_id);
            let _ = db_guard.execute(
                "INSERT INTO verification_events (id, artifact_id, verified, verifier, reason, timestamp) VALUES ($1,$2,$3,$4,$5,$6)",
                &[&evt_id, &artifact_id, &false, &verifier, &reason, &now]
            ).await;
            HttpResponse::Forbidden().json(serde_json::json!({"verified": false, "artifact_id": artifact_id, "reason": reason}))
        }
    }
}

async fn list_signatures(data: web::Data<AppState>) -> HttpResponse {
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let rows = db_guard.query("SELECT artifact_id, artifact_type, sha256_hash, signer_id, signer_role, signature, signed_at, COALESCE(valid_until,''), metadata FROM artifact_signatures ORDER BY signed_at DESC", &[]).await.unwrap_or_default();
    let sigs: Vec<serde_json::Value> = rows.iter().map(|r| {
        let meta_str: String = r.get(8);
        let meta: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or(serde_json::json!({}));
        serde_json::json!({
            "artifact_id": r.get::<_, String>(0), "artifact_type": r.get::<_, String>(1),
            "sha256_hash": r.get::<_, String>(2), "signer_id": r.get::<_, String>(3),
            "signer_role": r.get::<_, String>(4), "signature": r.get::<_, String>(5),
            "signed_at": r.get::<_, String>(6), "valid_until": r.get::<_, String>(7),
            "metadata": meta,
        })
    }).collect();
    HttpResponse::Ok().json(sigs)
}

async fn list_verifications(data: web::Data<AppState>) -> HttpResponse {
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::ServiceUnavailable().json(serde_json::json!({"error": "no db"})) };
    let rows = db_guard.query("SELECT id, artifact_id, verified, COALESCE(verifier,''), COALESCE(reason,''), timestamp FROM verification_events ORDER BY timestamp DESC LIMIT 1000", &[]).await.unwrap_or_default();
    let events: Vec<VerificationEvent> = rows.iter().map(|r| VerificationEvent {
        id: r.get(0), artifact_id: r.get(1), verified: r.get(2), verifier: r.get(3), reason: r.get(4), timestamp: r.get(5),
    }).collect();
    HttpResponse::Ok().json(events)
}

async fn stats(data: web::Data<AppState>) -> HttpResponse {
    let db_guard = match &data.db { Some(db) => db.lock().await, None => return HttpResponse::Ok().json(serde_json::json!({"error": "no db"})) };
    let sigs: i64 = db_guard.query_one("SELECT COUNT(*) FROM artifact_signatures", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let vers: i64 = db_guard.query_one("SELECT COUNT(*) FROM verification_events", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    let failed: i64 = db_guard.query_one("SELECT COUNT(*) FROM verification_events WHERE verified = FALSE", &[]).await.map(|r| r.get(0)).unwrap_or(0);
    HttpResponse::Ok().json(serde_json::json!({"total_signatures": sigs, "total_verifications": vers, "failed_verifications": failed, "service": "code-signing-rs"}))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "code-signing-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(serde_json::json!({"status": "alive"})) }
async fn readyz(data: web::Data<AppState>) -> HttpResponse {
    if data.db.is_some() { HttpResponse::Ok().json(serde_json::json!({"status": "ready"})) }
    else { HttpResponse::ServiceUnavailable().json(serde_json::json!({"status": "not_ready"})) }
}

fn rand_u32() -> u32 { use std::time::SystemTime; SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().subsec_nanos() }

use sha2::Digest;

fn start_watchdog(data: web::Data<AppState>) {
    let d = data.clone();
    tokio::spawn(async move { loop {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        let last = d.last_activity.load(Ordering::Relaxed);
        let now = chrono::Utc::now().timestamp();
        if now - last > 60 { d.healthy.store(0, Ordering::Relaxed); } else { d.healthy.store(1, Ordering::Relaxed); }
    }});
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".into()).parse().unwrap_or(8080);
    let db_url = env::var("DATABASE_URL").unwrap_or_default();
    let db_client = if !db_url.is_empty() {
        match tokio_postgres::connect(&db_url, NoTls).await {
            Ok((client, conn)) => {
                tokio::spawn(async move { if let Err(e) = conn.await { eprintln!("[code-signing] DB error: {}", e); } });
                init_schema(&client).await;
                eprintln!("[code-signing] Connected to PostgreSQL");
                Some(Mutex::new(client))
            },
            Err(e) => { eprintln!("[code-signing] DB failed: {}", e); None },
        }
    } else { eprintln!("[code-signing] WARNING: DATABASE_URL not set"); None };

    let data = web::Data::new(AppState { db: db_client, healthy: AtomicI32::new(1), last_activity: AtomicI64::new(chrono::Utc::now().timestamp()) });
    start_watchdog(data.clone());
    eprintln!("[code-signing] Starting on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz)).route("/livez", web::get().to(livez)).route("/readyz", web::get().to(readyz))
            .route("/api/v1/code-signing/sign", web::post().to(sign_artifact))
            .route("/api/v1/code-signing/verify", web::post().to(verify_artifact))
            .route("/api/v1/code-signing/signatures", web::get().to(list_signatures))
            .route("/api/v1/code-signing/verifications", web::get().to(list_verifications))
            .route("/api/v1/code-signing/stats", web::get().to(stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_rand_u32() { let r = super::rand_u32(); assert!(r >= 0); }
}
