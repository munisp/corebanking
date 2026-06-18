use clap::Parser;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const AUTHOR: &str = "Manus AI";

#[derive(Parser, Debug)]
#[command(name = "rust-reconciliation-auditor")]
#[command(about = "Deterministic reconciliation discrepancy evaluator")]
struct Cli {
    #[arg(long)]
    input: PathBuf,
    #[arg(long)]
    output: Option<PathBuf>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ReconciliationInput {
    reconciliation_id: String,
    account_id: String,
    tigerbeetle_value_minor: i64,
    postgres_value_minor: i64,
    pending_tigerbeetle_minor: i64,
    pending_postgres_minor: i64,
    tolerance_minor: i64,
}

#[derive(Debug, Serialize)]
struct ReconciliationOutput {
    author: String,
    reconciliation_id: String,
    account_id: String,
    discrepancy_type: String,
    severity: String,
    auto_resolve: bool,
    difference_minor: i64,
    pending_difference_minor: i64,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("{}", err);
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let cli = Cli::parse();
    let input: ReconciliationInput = read_json(&cli.input)?;

    let difference_minor = input.tigerbeetle_value_minor - input.postgres_value_minor;
    let pending_difference_minor = input.pending_tigerbeetle_minor - input.pending_postgres_minor;
    let absolute_difference = difference_minor.abs();
    let absolute_pending_difference = pending_difference_minor.abs();

    let (discrepancy_type, severity, auto_resolve) = if absolute_difference == 0 && absolute_pending_difference == 0 {
        ("none", "none", true)
    } else if absolute_difference <= input.tolerance_minor && absolute_pending_difference <= input.tolerance_minor {
        ("within_tolerance", "low", true)
    } else if absolute_difference > input.tolerance_minor && absolute_pending_difference <= input.tolerance_minor {
        ("balance_mismatch", "high", false)
    } else if absolute_pending_difference > input.tolerance_minor && absolute_difference <= input.tolerance_minor {
        ("pending_balance_mismatch", "medium", false)
    } else {
        ("compound_mismatch", "critical", false)
    };

    let output = ReconciliationOutput {
        author: AUTHOR.to_string(),
        reconciliation_id: input.reconciliation_id,
        account_id: input.account_id,
        discrepancy_type: discrepancy_type.to_string(),
        severity: severity.to_string(),
        auto_resolve,
        difference_minor,
        pending_difference_minor,
    };

    emit_json(&output, cli.output)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<T, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("failed to read {}: {e}", path.display()))?;
    serde_json::from_str(&content).map_err(|e| format!("failed to parse JSON from {}: {e}", path.display()))
}

fn emit_json<T: Serialize>(value: &T, output: Option<PathBuf>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| format!("failed to serialize output: {e}"))?;
    if let Some(path) = output {
        fs::write(&path, format!("{}\n", json))
            .map_err(|e| format!("failed to write {}: {e}", path.display()))?;
    }
    println!("{}", json);
    Ok(())
}
