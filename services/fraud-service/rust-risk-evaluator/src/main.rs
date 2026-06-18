use axum::{routing::{get, post}, Json, Router};
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
        .route("/evaluate", post(evaluate_handler));

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
