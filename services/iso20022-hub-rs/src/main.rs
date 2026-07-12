use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct Iso20022Message {
    id: String,
    message_type: String, // pacs.008, pacs.004, pacs.002, pain.001, pain.002, camt.053, camt.054, camt.052
    business_service: String, // credit_transfer, return, status, initiation, notification, statement
    sender_bic: String,
    receiver_bic: String,
    msg_id: String,
    creation_datetime: String,
    number_of_transactions: u32,
    total_amount: f64,
    currency: String,
    settlement_method: String,
    clearing_system: String, // NIP, NEFT, RTGS, SWIFT
    status: String, // received, validated, enriched, routed, settled, rejected
    validation_errors: Vec<String>,
    debtor_name: Option<String>,
    debtor_account: Option<String>,
    creditor_name: Option<String>,
    creditor_account: Option<String>,
    end_to_end_id: Option<String>,
    uetr: Option<String>, // Unique End-to-end Transaction Reference (SWIFT gpi)
}

#[derive(Clone, Serialize, Deserialize)]
struct ValidationRule {
    id: String,
    rule_name: String,
    message_type: String,
    field_path: String,
    validation_type: String, // mandatory, format, length, code_list, business_rule
    description: String,
    severity: String, // error, warning
}

#[derive(Deserialize)]
struct ParseRequest {
    message_type: String,
    sender_bic: String,
    receiver_bic: String,
    amount: f64,
    currency: String,
    debtor_name: Option<String>,
    debtor_account: Option<String>,
    creditor_name: Option<String>,
    creditor_account: Option<String>,
}

struct AppState {
    messages: Mutex<Vec<Iso20022Message>>,
    rules: Mutex<Vec<ValidationRule>>,
}

fn seed() -> (Vec<Iso20022Message>, Vec<ValidationRule>) {
    let messages = vec![
        Iso20022Message {
            id: "ISO-001".into(), message_type: "pacs.008".into(), business_service: "credit_transfer".into(),
            sender_bic: "54link-devLAGOS".into(), receiver_bic: "ABORNGLA".into(),
            msg_id: "PACS008-2026050901".into(), creation_datetime: "2026-05-09T10:00:00Z".into(),
            number_of_transactions: 1, total_amount: 25_000_000.0, currency: "NGN".into(),
            settlement_method: "CLRG".into(), clearing_system: "NIP".into(),
            status: "settled".into(), validation_errors: vec![],
            debtor_name: Some("Dangote Industries".into()), debtor_account: Some("0012345678".into()),
            creditor_name: Some("MTN Nigeria".into()), creditor_account: Some("0098765432".into()),
            end_to_end_id: Some("E2E-DGL-MTN-001".into()), uetr: Some("a1b2c3d4-e5f6-7890-abcd-ef1234567890".into()),
        },
        Iso20022Message {
            id: "ISO-002".into(), message_type: "pacs.004".into(), business_service: "return".into(),
            sender_bic: "ZENITHNGLA".into(), receiver_bic: "54link-devLAGOS".into(),
            msg_id: "PACS004-2026050901".into(), creation_datetime: "2026-05-09T11:30:00Z".into(),
            number_of_transactions: 1, total_amount: 5_000_000.0, currency: "NGN".into(),
            settlement_method: "CLRG".into(), clearing_system: "NIP".into(),
            status: "validated".into(), validation_errors: vec![],
            debtor_name: None, debtor_account: None, creditor_name: None, creditor_account: None,
            end_to_end_id: Some("E2E-RTN-001".into()), uetr: Some("b2c3d4e5-f6a7-8901-bcde-f23456789012".into()),
        },
        Iso20022Message {
            id: "ISO-003".into(), message_type: "pain.001".into(), business_service: "initiation".into(),
            sender_bic: "54link-devLAGOS".into(), receiver_bic: "CLEARING".into(),
            msg_id: "PAIN001-2026050901".into(), creation_datetime: "2026-05-09T09:00:00Z".into(),
            number_of_transactions: 50, total_amount: 500_000_000.0, currency: "NGN".into(),
            settlement_method: "INDA".into(), clearing_system: "NEFT".into(),
            status: "enriched".into(), validation_errors: vec![],
            debtor_name: Some("Access Corp".into()), debtor_account: Some("0033344455".into()),
            creditor_name: None, creditor_account: None,
            end_to_end_id: Some("E2E-BATCH-ACC-001".into()), uetr: None,
        },
        Iso20022Message {
            id: "ISO-004".into(), message_type: "camt.053".into(), business_service: "statement".into(),
            sender_bic: "54link-devLAGOS".into(), receiver_bic: "CBNNGLA".into(),
            msg_id: "CAMT053-20260509".into(), creation_datetime: "2026-05-09T23:59:00Z".into(),
            number_of_transactions: 1250, total_amount: 85_000_000_000.0, currency: "NGN".into(),
            settlement_method: "INDA".into(), clearing_system: "RTGS".into(),
            status: "settled".into(), validation_errors: vec![],
            debtor_name: None, debtor_account: None, creditor_name: None, creditor_account: None,
            end_to_end_id: None, uetr: None,
        },
        Iso20022Message {
            id: "ISO-005".into(), message_type: "pacs.002".into(), business_service: "status".into(),
            sender_bic: "CBNNGLA".into(), receiver_bic: "54link-devLAGOS".into(),
            msg_id: "PACS002-2026050905".into(), creation_datetime: "2026-05-09T14:00:00Z".into(),
            number_of_transactions: 1, total_amount: 0.0, currency: "NGN".into(),
            settlement_method: "CLRG".into(), clearing_system: "RTGS".into(),
            status: "rejected".into(), validation_errors: vec!["AC01: Incorrect Account Number".into()],
            debtor_name: None, debtor_account: None, creditor_name: None, creditor_account: None,
            end_to_end_id: Some("E2E-FAILED-001".into()), uetr: Some("c3d4e5f6-a7b8-9012-cdef-345678901234".into()),
        },
        Iso20022Message {
            id: "ISO-006".into(), message_type: "camt.054".into(), business_service: "notification".into(),
            sender_bic: "54link-devLAGOS".into(), receiver_bic: "DGLNGLA".into(),
            msg_id: "CAMT054-2026050901".into(), creation_datetime: "2026-05-09T16:00:00Z".into(),
            number_of_transactions: 5, total_amount: 150_000_000.0, currency: "NGN".into(),
            settlement_method: "INDA".into(), clearing_system: "NIP".into(),
            status: "settled".into(), validation_errors: vec![],
            debtor_name: None, debtor_account: None,
            creditor_name: Some("Dangote Industries".into()), creditor_account: Some("0012345678".into()),
            end_to_end_id: None, uetr: None,
        },
    ];

    let rules = vec![
        ValidationRule { id: "VR-001".into(), rule_name: "BIC format".into(), message_type: "pacs.008".into(), field_path: "GrpHdr/SttlmInf/SttlmAcct/Id/IBAN".into(), validation_type: "format".into(), description: "BIC must be 8 or 11 characters".into(), severity: "error".into() },
        ValidationRule { id: "VR-002".into(), rule_name: "Amount positive".into(), message_type: "pacs.008".into(), field_path: "CdtTrfTxInf/Amt/InstdAmt".into(), validation_type: "business_rule".into(), description: "Amount must be greater than zero".into(), severity: "error".into() },
        ValidationRule { id: "VR-003".into(), rule_name: "Currency code".into(), message_type: "pacs.008".into(), field_path: "CdtTrfTxInf/Amt/InstdAmt/@Ccy".into(), validation_type: "code_list".into(), description: "Currency must be valid ISO 4217".into(), severity: "error".into() },
        ValidationRule { id: "VR-004".into(), rule_name: "UETR format".into(), message_type: "pacs.008".into(), field_path: "CdtTrfTxInf/PmtId/UETR".into(), validation_type: "format".into(), description: "UETR must be UUID v4 format".into(), severity: "error".into() },
        ValidationRule { id: "VR-005".into(), rule_name: "Debtor account".into(), message_type: "pain.001".into(), field_path: "PmtInf/DbtrAcct/Id".into(), validation_type: "mandatory".into(), description: "Debtor account is mandatory for payment initiation".into(), severity: "error".into() },
    ];

    (messages, rules)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

async fn list_messages(data: web::Data<AppState>) -> HttpResponse {
    let m = data.messages.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *m, "total": m.len() }))
}

async fn list_rules(data: web::Data<AppState>) -> HttpResponse {
    let r = data.rules.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *r, "total": r.len() }))
}

async fn parse_and_validate(body: web::Json<ParseRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    let valid_types = ["pacs.008", "pacs.004", "pacs.002", "pain.001", "pain.002", "camt.053", "camt.054", "camt.052"];
    if !valid_types.contains(&req.message_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": format!("message_type must be one of: {}", valid_types.join(", "))}));
    }
    if req.amount < 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "amount must be non-negative"}));
    }
    if req.sender_bic.len() != 11 && req.sender_bic.len() != 8 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "sender_bic must be 8 or 11 characters"}));
    }
    let mut errors = vec![];
    if req.message_type == "pain.001" && req.debtor_account.is_none() {
        errors.push("VR-005: Debtor account is mandatory for payment initiation".to_string());
    }
    let status = if errors.is_empty() { "validated" } else { "rejected" };
    let mut msgs = data.messages.lock().unwrap();
    let msg = Iso20022Message {
        id: format!("ISO-{:03}", msgs.len() + 1),
        message_type: req.message_type.clone(), business_service: match req.message_type.as_str() {
            "pacs.008" => "credit_transfer", "pacs.004" => "return", "pacs.002" => "status",
            "pain.001" => "initiation", "camt.053" => "statement", "camt.054" => "notification",
            _ => "other"
        }.into(),
        sender_bic: req.sender_bic, receiver_bic: req.receiver_bic,
        msg_id: format!("{}-{}", req.message_type.to_uppercase().replace('.', ""), msgs.len() + 1),
        creation_datetime: "2026-05-10T00:00:00Z".into(),
        number_of_transactions: 1, total_amount: req.amount, currency: req.currency,
        settlement_method: "CLRG".into(), clearing_system: "NIP".into(),
        status: status.into(), validation_errors: errors,
        debtor_name: req.debtor_name, debtor_account: req.debtor_account,
        creditor_name: req.creditor_name, creditor_account: req.creditor_account,
        end_to_end_id: Some(format!("E2E-NEW-{:03}", msgs.len() + 1)), uetr: None,
    };
    msgs.push(msg.clone());
    if msg.status == "rejected" {
        HttpResponse::UnprocessableEntity().json(msg)
    } else {
        HttpResponse::Created().json(msg)
    }
}

async fn stats(data: web::Data<AppState>) -> HttpResponse {
    let m = data.messages.lock().unwrap();
    let settled = m.iter().filter(|x| x.status == "settled").count();
    let rejected = m.iter().filter(|x| x.status == "rejected").count();
    let total_settled_amount: f64 = m.iter().filter(|x| x.status == "settled").map(|x| x.total_amount).sum();
    let mut by_type: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for msg in m.iter() { *by_type.entry(msg.message_type.clone()).or_insert(0) += 1; }
    let mut by_clearing: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for msg in m.iter() { *by_clearing.entry(msg.clearing_system.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({
        "totalMessages": m.len(), "settled": settled, "rejected": rejected,
        "totalSettledAmount": total_settled_amount,
        "byMessageType": by_type, "byClearingSystem": by_clearing,
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (msgs, rules) = seed();
    let state = web::Data::new(AppState { messages: Mutex::new(msgs), rules: Mutex::new(rules) });
    eprintln!("ISO 20022 Hub service on :8162");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/iso20022/messages", web::get().to(list_messages))
            .route("/v1/iso20022/rules", web::get().to(list_rules))
            .route("/v1/iso20022/parse", web::post().to(parse_and_validate))
            .route("/v1/iso20022/stats", web::get().to(stats))
    })
    .bind("0.0.0.0:8162")?
    .run()
    .await
}
