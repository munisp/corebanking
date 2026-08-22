use axum::{routing::{get, post}, Json, Router};
use axum::response::IntoResponse;
use chrono::{DateTime, Timelike, Utc};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;

const AUTHOR: &str = "Manus AI";

#[derive(Parser, Debug)]
#[command(name = "rust-risk-evaluator")]
#[command(about = "Deterministic fraud and risk hot-path evaluator with service mode")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
    #[arg(long)]
    input: Option<PathBuf>,
    #[arg(long)]
    output: Option<PathBuf>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Serve(ServeArgs),
}

#[derive(Parser, Debug, Clone)]
struct ServeArgs {
    #[arg(long, default_value = "0.0.0.0")]
    host: String,
    #[arg(long, default_value_t = 8092)]
    port: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RiskInput {
    transaction_id: String,
    tenant_id: String,
    customer_id: String,
    amount_minor: u64,
    velocity_last_hour: u32,
    unknown_device: bool,
    blocked_ip: bool,
    geo_distance_km: f64,
    account_age_days: u32,
    chargeback_ratio: f64,
    merchant_risk: f64,
    hour_of_day: Option<u32>,
    event_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RiskOutput {
    author: String,
    transaction_id: String,
    score: u32,
    risk_level: String,
    action: String,
    indicators: Vec<String>,
}

#[derive(Debug, Serialize)]
struct HealthOutput {
    status: String,
    service: String,
    mode: String,
}

// ── JWT Auth (fail-closed; R4-V5-rust remediation) ──
// Canonical verifier aligned with the repaired fleet: RS256 via Keycloak JWKS
// (KEYCLOAK_JWKS_URL or derived from KEYCLOAK_REALM_URL, 300s cache, 5s fetch
// timeout) with HS256 JWT_SECRET fallback; exp/nbf always validated, iss/aud
// validated when JWT_EXPECTED_ISS / JWT_EXPECTED_AUD are set. 401 on
// missing/malformed/expired tokens; 503 when no verification backend is
// available. Verified claims are stored in request extensions.

fn jwt_err(status: axum::http::StatusCode, body: serde_json::Value) -> axum::response::Response {
    (status, axum::Json(body)).into_response()
}

#[derive(Debug, Clone)]
struct VerifiedClaims(serde_json::Value);

struct JwksCacheEntry {
    fetched_at: std::time::Instant,
    keys: jsonwebtoken::jwk::JwkSet,
}

static JWKS_CACHE: std::sync::OnceLock<std::sync::Mutex<Option<JwksCacheEntry>>> = std::sync::OnceLock::new();

fn jwks_cache() -> &'static std::sync::Mutex<Option<JwksCacheEntry>> {
    JWKS_CACHE.get_or_init(|| std::sync::Mutex::new(None))
}

fn jwks_url() -> Option<String> {
    if let Ok(u) = std::env::var("KEYCLOAK_JWKS_URL") {
        if !u.is_empty() {
            return Some(u);
        }
    }
    match std::env::var("KEYCLOAK_REALM_URL") {
        Ok(realm) if !realm.is_empty() => {
            Some(format!("{}/protocol/openid-connect/certs", realm.trim_end_matches('/')))
        }
        _ => None,
    }
}

async fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, axum::response::Response> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => {
            return Err(jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({
                "error": "jwt_validation_unavailable",
                "detail": "no JWKS endpoint configured"
            })))
        }
    };
    {
        let cache = jwks_cache().lock().unwrap();
        if let Some(entry) = cache.as_ref() {
            if entry.fetched_at.elapsed() < JWKS_TTL {
                return Ok(entry.keys.clone());
            }
        }
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "client init failed"
        })))?;
    let resp = client.get(&url).send().await.map_err(|_| {
        jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({"error": "jwks_unavailable"}))
    })?;
    if !resp.status().is_success() {
        return Err(jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "upstream returned error status"
        })));
    }
    let keys = resp.json::<jsonwebtoken::jwk::JwkSet>().await.map_err(|_| {
        jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({
            "error": "jwks_unavailable",
            "detail": "malformed JWKS payload"
        }))
    })?;
    let mut cache = jwks_cache().lock().unwrap();
    *cache = Some(JwksCacheEntry { fetched_at: std::time::Instant::now(), keys: keys.clone() });
    Ok(keys)
}

fn apply_iss_aud(validation: &mut jsonwebtoken::Validation) {
    if let Ok(iss) = std::env::var("JWT_EXPECTED_ISS") {
        if !iss.is_empty() {
            validation.set_issuer(&[iss]);
        }
    }
    if let Ok(aud) = std::env::var("JWT_EXPECTED_AUD") {
        if !aud.is_empty() {
            validation.set_audience(&[aud]);
        }
    }
}

async fn verify_jwt_token(token: &str) -> Result<serde_json::Value, axum::response::Response> {
    let header = jsonwebtoken::decode_header(token)
        .map_err(|_| jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "malformed token header"})))?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => return Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "missing kid"}))),
            };
            // JWKS outage => 503 (fail closed). Unknown kid => force one cache
            // refresh (key rotation), then 401 if still unknown.
            let jwks = fetch_jwks().await?;
            let jwk = match jwks.find(&kid) {
                Some(j) => j.clone(),
                None => {
                    {
                        let mut cache = jwks_cache().lock().unwrap();
                        *cache = None;
                    }
                    let refreshed = fetch_jwks().await?;
                    match refreshed.find(&kid) {
                        Some(j) => j.clone(),
                        None => {
                            return Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "unknown kid"})))
                        }
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk)
                .map_err(|_| jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "invalid jwk"})))?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err(jwt_err(axum::http::StatusCode::SERVICE_UNAVAILABLE, serde_json::json!({
                        "error": "jwt_validation_unavailable",
                        "detail": "JWT_SECRET is not configured; refusing to validate"
                    })))
                }
            };
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(
                token,
                &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
                &validation,
            ) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        other => Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({
            "error": format!("unsupported alg {:?}", other)
        }))),
    }
}

async fn check_jwt(headers: &axum::http::HeaderMap) -> Result<serde_json::Value, axum::response::Response> {
    let header = match headers.get(axum::http::header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => return Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "missing Authorization header"}))),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(jwt_err(axum::http::StatusCode::UNAUTHORIZED, serde_json::json!({"error": "invalid auth header"}))),
    };
    verify_jwt_token(token).await
}

async fn jwt_auth_middleware(mut req: axum::extract::Request, next: axum::middleware::Next) -> axum::response::Response {
    match check_jwt(req.headers()).await {
        Ok(claims) => {
            req.extensions_mut().insert(VerifiedClaims(claims));
            next.run(req).await
        }
        Err(resp) => resp,
    }
}

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("{}", err);
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let cli = Cli::parse();
    match cli.command {
        Some(Commands::Serve(args)) => serve(args).await,
        None => {
            let input_path = cli
                .input
                .ok_or_else(|| "--input is required when not running in serve mode".to_string())?;
            let input: RiskInput = read_json(&input_path)?;
            let output = evaluate_risk(input);
            emit_json(&output, cli.output)
        }
    }
}

async fn serve(args: ServeArgs) -> Result<(), String> {
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        .route("/evaluate", post(evaluate_handler).route_layer(axum::middleware::from_fn(jwt_auth_middleware)));

    let addr: SocketAddr = format!("{}:{}", args.host, args.port)
        .parse()
        .map_err(|e| format!("failed to parse socket address: {e}"))?;

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("failed to bind fraud evaluator service: {e}"))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("fraud evaluator service failed: {e}"))
}

async fn health_handler() -> Json<HealthOutput> {
    Json(HealthOutput {
        status: "healthy".to_string(),
        service: "rust-risk-evaluator".to_string(),
        mode: "service".to_string(),
    })
}

async fn ready_handler() -> Json<HealthOutput> {
    Json(HealthOutput {
        status: "ready".to_string(),
        service: "rust-risk-evaluator".to_string(),
        mode: "service".to_string(),
    })
}

async fn evaluate_handler(Json(payload): Json<RiskInput>) -> Json<RiskOutput> {
    Json(evaluate_risk(payload))
}

fn evaluate_risk(input: RiskInput) -> RiskOutput {
    let mut score = 0u32;
    let mut indicators = Vec::new();

    if input.amount_minor >= 100_000_000 {
        score += 30;
        indicators.push("extreme_amount".to_string());
    } else if input.amount_minor >= 10_000_000 {
        score += 15;
        indicators.push("high_amount".to_string());
    }

    if input.velocity_last_hour > 10 {
        score += 20;
        indicators.push("high_velocity".to_string());
    }

    if input.unknown_device {
        score += 18;
        indicators.push("unknown_device".to_string());
    }

    if input.blocked_ip {
        score += 40;
        indicators.push("blocked_ip".to_string());
    }

    if input.geo_distance_km > 500.0 {
        score += 12;
        indicators.push("geo_anomaly".to_string());
    }

    if input.account_age_days < 7 {
        score += 12;
        indicators.push("new_account".to_string());
    }

    if input.chargeback_ratio >= 0.10 {
        score += 20;
        indicators.push("high_chargeback_ratio".to_string());
    } else if input.chargeback_ratio >= 0.03 {
        score += 10;
        indicators.push("elevated_chargeback_ratio".to_string());
    }

    if input.merchant_risk >= 0.80 {
        score += 15;
        indicators.push("high_risk_merchant".to_string());
    }

    let hour = input
        .hour_of_day
        .or_else(|| input.event_time.map(|time| time.hour()))
        .unwrap_or(12);
    if !(5..=22).contains(&hour) {
        score += 8;
        indicators.push("unusual_hour".to_string());
    }

    let score = score.min(100);
    let (risk_level, action) = if score >= 80 {
        ("critical", "block")
    } else if score >= 55 {
        ("high", "challenge")
    } else if score >= 30 {
        ("medium", "review")
    } else {
        ("low", "allow")
    };

    RiskOutput {
        author: AUTHOR.to_string(),
        transaction_id: input.transaction_id,
        score,
        risk_level: risk_level.to_string(),
        action: action.to_string(),
        indicators,
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<T, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("failed to read {}: {e}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("failed to parse JSON from {}: {e}", path.display()))
}

fn emit_json<T: Serialize>(value: &T, output: Option<PathBuf>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("failed to serialize output: {e}"))?;
    if let Some(path) = output {
        fs::write(&path, format!("{}\n", json))
            .map_err(|e| format!("failed to write {}: {e}", path.display()))?;
    }
    println!("{}", json);
    Ok(())
}
