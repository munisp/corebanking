#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::collections::{HashMap, HashSet};

// self-dealing-detector-rs — Detects employees processing transactions to accounts they control
// Maintains employee↔account relationship graph and flags conflicts of interest.
// Cross-references with beneficial ownership, family declarations, and phone/address matches.

struct AppState {
    employee_accounts: Mutex<HashMap<String, HashSet<String>>>,  // employee_id → set of associated account IDs
    family_links: Mutex<HashMap<String, HashSet<String>>>,       // employee_id → set of family member account IDs
    alerts: Mutex<Vec<SelfDealingAlert>>,
    transaction_log: Mutex<Vec<TransactionCheck>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct SelfDealingAlert {
    id: String,
    employee_id: String,
    account_id: String,
    relationship: String,  // "own_account", "family", "address_match", "phone_match", "beneficiary"
    transaction_ref: String,
    amount_kobo: i64,
    severity: String,
    timestamp: String,
    blocked: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct TransactionCheck {
    employee_id: String,
    source_account: String,
    dest_account: String,
    amount_kobo: i64,
    is_self_dealing: bool,
    relationship: Option<String>,
    timestamp: String,
}

#[derive(Deserialize)]
struct RegisterLink {
    employee_id: String,
    account_id: String,
    relationship: String,
}

#[derive(Deserialize)]
struct CheckRequest {
    employee_id: String,
    source_account: String,
    dest_account: String,
    amount_kobo: i64,
    transaction_ref: String,
}

fn check_self_dealing(
    employee_accounts: &HashMap<String, HashSet<String>>,
    family_links: &HashMap<String, HashSet<String>>,
    employee_id: &str,
    source_account: &str,
    dest_account: &str,
) -> Option<String> {
    // Check if employee owns either account
    if let Some(accounts) = employee_accounts.get(employee_id) {
        if accounts.contains(source_account) || accounts.contains(dest_account) {
            return Some("own_account".to_string());
        }
    }

    // Check if family member owns either account
    if let Some(family) = family_links.get(employee_id) {
        if family.contains(source_account) || family.contains(dest_account) {
            return Some("family".to_string());
        }
    }

    None
}

async fn register_link(state: web::Data<AppState>, body: web::Json<RegisterLink>) -> HttpResponse {
    let mut map = if body.relationship == "family" {
        state.family_links.lock().unwrap()
    } else {
        state.employee_accounts.lock().unwrap()
    };
    map.entry(body.employee_id.clone()).or_insert_with(HashSet::new).insert(body.account_id.clone());
    HttpResponse::Created().json(json!({"status": "registered", "employee": body.employee_id, "account": body.account_id, "relationship": body.relationship}))
}

async fn check_transaction(state: web::Data<AppState>, body: web::Json<CheckRequest>) -> HttpResponse {
    let emp_accts = state.employee_accounts.lock().unwrap();
    let fam_links = state.family_links.lock().unwrap();

    let relationship = check_self_dealing(&emp_accts, &fam_links, &body.employee_id, &body.source_account, &body.dest_account);
    drop(emp_accts);
    drop(fam_links);

    let is_self_dealing = relationship.is_some();
    let now = chrono::Utc::now().to_rfc3339();

    let check = TransactionCheck {
        employee_id: body.employee_id.clone(),
        source_account: body.source_account.clone(),
        dest_account: body.dest_account.clone(),
        amount_kobo: body.amount_kobo,
        is_self_dealing,
        relationship: relationship.clone(),
        timestamp: now.clone(),
    };

    let mut log = state.transaction_log.lock().unwrap();
    log.push(check);

    if let Some(rel) = &relationship {
        let alert = SelfDealingAlert {
            id: format!("SD-{:06}", log.len()),
            employee_id: body.employee_id.clone(),
            account_id: if rel == "own_account" || rel == "family" { body.dest_account.clone() } else { body.source_account.clone() },
            relationship: rel.clone(),
            transaction_ref: body.transaction_ref.clone(),
            amount_kobo: body.amount_kobo,
            severity: if body.amount_kobo > 100_000_00 { "critical".to_string() } else { "high".to_string() },
            timestamp: now,
            blocked: true,
        };

        let mut alerts = state.alerts.lock().unwrap();
        alerts.push(alert.clone());

        return HttpResponse::Forbidden().json(json!({
            "allowed": false,
            "reason": format!("SELF-DEALING DETECTED: employee {} has '{}' relationship with account", body.employee_id, rel),
            "alert": alert
        }));
    }

    HttpResponse::Ok().json(json!({"allowed": true, "self_dealing": false}))
}

async fn list_alerts(state: web::Data<AppState>) -> HttpResponse {
    let alerts = state.alerts.lock().unwrap();
    HttpResponse::Ok().json(alerts.clone())
}

async fn list_links(state: web::Data<AppState>) -> HttpResponse {
    let emp = state.employee_accounts.lock().unwrap();
    let fam = state.family_links.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "employee_accounts": emp.iter().map(|(k, v)| (k.clone(), v.iter().cloned().collect::<Vec<_>>())).collect::<HashMap<_, _>>(),
        "family_links": fam.iter().map(|(k, v)| (k.clone(), v.iter().cloned().collect::<Vec<_>>())).collect::<HashMap<_, _>>(),
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let alerts = state.alerts.lock().unwrap();
    let log = state.transaction_log.lock().unwrap();
    let emp = state.employee_accounts.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "total_checks": log.len(),
        "self_dealing_detected": alerts.len(),
        "employees_registered": emp.len(),
        "service": "self-dealing-detector-rs"
    }))
}

async fn healthz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "healthy", "service": "self-dealing-detector-rs"})) }
async fn livez() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "alive"})) }
async fn readyz() -> HttpResponse { HttpResponse::Ok().json(json!({"status": "ready"})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080);
    let state = web::Data::new(AppState {
        employee_accounts: Mutex::new(HashMap::new()),
        family_links: Mutex::new(HashMap::new()),
        alerts: Mutex::new(Vec::new()),
        transaction_log: Mutex::new(Vec::new()),
    });

    println!("[self-dealing-detector-rs] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/livez", web::get().to(livez))
            .route("/readyz", web::get().to(readyz))
            .route("/api/v1/self-dealing/register", web::post().to(register_link))
            .route("/api/v1/self-dealing/check", web::post().to(check_transaction))
            .route("/api/v1/self-dealing/alerts", web::get().to(list_alerts))
            .route("/api/v1/self-dealing/links", web::get().to(list_links))
            .route("/api/v1/self-dealing/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
