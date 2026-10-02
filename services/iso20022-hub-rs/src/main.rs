use actix_web::{web, App, HttpMessage, HttpResponse, HttpServer}; // Wave-12 drive-by: HttpMessage import required by actix-web resolved in the lockfile
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize, sqlx::FromRow)]
struct Iso20022Message {
    id: String,
    message_type: String, // pacs.008, pacs.004, pacs.002, pain.001, pain.002, camt.053, camt.054, camt.052
    business_service: String, // credit_transfer, return, status, initiation, notification, statement
    sender_bic: String,
    receiver_bic: String,
    msg_id: String,
    creation_datetime: String,
    number_of_transactions: i32,
    total_amount: f64,
    currency: String,
    settlement_method: String,
    clearing_system: String, // NIP, NEFT, RTGS, SWIFT
    status: String,          // received, validated, enriched, routed, settled, rejected
    validation_errors: Vec<String>,
    debtor_name: Option<String>,
    debtor_account: Option<String>,
    creditor_name: Option<String>,
    creditor_account: Option<String>,
    end_to_end_id: Option<String>,
    uetr: Option<String>, // Unique End-to-end Transaction Reference (SWIFT gpi)
}

#[derive(Clone, Serialize, Deserialize, sqlx::FromRow)]
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

// Wave-12 (C3-P0-B5): Postgres is the sole message/rule store (was:
// in-memory Mutex<Vec<..>> lost on every restart). Typed columns — both
// shapes are fully known — per c3 policy; validation_errors is TEXT[].
// DDL at startup per repo convention.
struct AppState {
    db: PgPool,
}

async fn init_db(pool: &PgPool) {
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS iso20022_messages (
            id TEXT PRIMARY KEY,
            message_type TEXT NOT NULL,
            business_service TEXT NOT NULL DEFAULT '',
            sender_bic TEXT NOT NULL DEFAULT '',
            receiver_bic TEXT NOT NULL DEFAULT '',
            msg_id TEXT NOT NULL DEFAULT '',
            creation_datetime TEXT NOT NULL DEFAULT '',
            number_of_transactions INTEGER NOT NULL DEFAULT 0,
            total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT '',
            settlement_method TEXT NOT NULL DEFAULT '',
            clearing_system TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'received',
            validation_errors TEXT[] NOT NULL DEFAULT '{}',
            debtor_name TEXT,
            debtor_account TEXT,
            creditor_name TEXT,
            creditor_account TEXT,
            end_to_end_id TEXT,
            uetr TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await
    {
        eprintln!("iso20022-hub-rs: iso20022_messages DDL failed: {}", e);
    }
    if let Err(e) = sqlx::query(
        "CREATE TABLE IF NOT EXISTS validation_rules (
            id TEXT PRIMARY KEY,
            rule_name TEXT NOT NULL,
            message_type TEXT NOT NULL,
            field_path TEXT NOT NULL DEFAULT '',
            validation_type TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            severity TEXT NOT NULL DEFAULT 'error',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await
    {
        eprintln!("iso20022-hub-rs: validation_rules DDL failed: {}", e);
    }
}

/// Idempotent seed of reference messages/rules (was: in-memory seed on every
/// boot). ON CONFLICT DO NOTHING so restarts never duplicate or overwrite.
async fn seed_to_db(pool: &PgPool) {
    let (messages, rules) = seed();
    for m in messages {
        if let Err(e) = sqlx::query(
            "INSERT INTO iso20022_messages (id, message_type, business_service, sender_bic, receiver_bic,
                msg_id, creation_datetime, number_of_transactions, total_amount, currency, settlement_method,
                clearing_system, status, validation_errors, debtor_name, debtor_account, creditor_name,
                creditor_account, end_to_end_id, uetr)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(&m.id).bind(&m.message_type).bind(&m.business_service).bind(&m.sender_bic).bind(&m.receiver_bic)
        .bind(&m.msg_id).bind(&m.creation_datetime).bind(m.number_of_transactions).bind(m.total_amount)
        .bind(&m.currency).bind(&m.settlement_method).bind(&m.clearing_system).bind(&m.status)
        .bind(&m.validation_errors).bind(&m.debtor_name).bind(&m.debtor_account).bind(&m.creditor_name)
        .bind(&m.creditor_account).bind(&m.end_to_end_id).bind(&m.uetr)
        .execute(pool)
        .await
        {
            eprintln!("iso20022-hub-rs: seed message {} failed: {}", m.id, e);
        }
    }
    for r in rules {
        if let Err(e) = sqlx::query(
            "INSERT INTO validation_rules (id, rule_name, message_type, field_path, validation_type, description, severity)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        )
        .bind(&r.id).bind(&r.rule_name).bind(&r.message_type).bind(&r.field_path)
        .bind(&r.validation_type).bind(&r.description).bind(&r.severity)
        .execute(pool)
        .await
        {
            eprintln!("iso20022-hub-rs: seed rule {} failed: {}", r.id, e);
        }
    }
}

const MESSAGE_SELECT: &str =
    "SELECT id, message_type, business_service, sender_bic, receiver_bic, msg_id, creation_datetime,
        number_of_transactions, total_amount, currency, settlement_method, clearing_system, status,
        validation_errors, debtor_name, debtor_account, creditor_name, creditor_account, end_to_end_id, uetr
     FROM iso20022_messages ORDER BY id";

fn seed() -> (Vec<Iso20022Message>, Vec<ValidationRule>) {
    let messages = vec![
        Iso20022Message {
            id: "ISO-001".into(),
            message_type: "pacs.008".into(),
            business_service: "credit_transfer".into(),
            sender_bic: "54link-devLAGOS".into(),
            receiver_bic: "ABORNGLA".into(),
            msg_id: "PACS008-2026050901".into(),
            creation_datetime: "2026-05-09T10:00:00Z".into(),
            number_of_transactions: 1,
            total_amount: 25_000_000.0,
            currency: "NGN".into(),
            settlement_method: "CLRG".into(),
            clearing_system: "NIP".into(),
            status: "settled".into(),
            validation_errors: vec![],
            debtor_name: Some("Dangote Industries".into()),
            debtor_account: Some("0012345678".into()),
            creditor_name: Some("MTN Nigeria".into()),
            creditor_account: Some("0098765432".into()),
            end_to_end_id: Some("E2E-DGL-MTN-001".into()),
            uetr: Some("a1b2c3d4-e5f6-7890-abcd-ef1234567890".into()),
        },
        Iso20022Message {
            id: "ISO-002".into(),
            message_type: "pacs.004".into(),
            business_service: "return".into(),
            sender_bic: "ZENITHNGLA".into(),
            receiver_bic: "54link-devLAGOS".into(),
            msg_id: "PACS004-2026050901".into(),
            creation_datetime: "2026-05-09T11:30:00Z".into(),
            number_of_transactions: 1,
            total_amount: 5_000_000.0,
            currency: "NGN".into(),
            settlement_method: "CLRG".into(),
            clearing_system: "NIP".into(),
            status: "validated".into(),
            validation_errors: vec![],
            debtor_name: None,
            debtor_account: None,
            creditor_name: None,
            creditor_account: None,
            end_to_end_id: Some("E2E-RTN-001".into()),
            uetr: Some("b2c3d4e5-f6a7-8901-bcde-f23456789012".into()),
        },
        Iso20022Message {
            id: "ISO-003".into(),
            message_type: "pain.001".into(),
            business_service: "initiation".into(),
            sender_bic: "54link-devLAGOS".into(),
            receiver_bic: "CLEARING".into(),
            msg_id: "PAIN001-2026050901".into(),
            creation_datetime: "2026-05-09T09:00:00Z".into(),
            number_of_transactions: 50,
            total_amount: 500_000_000.0,
            currency: "NGN".into(),
            settlement_method: "INDA".into(),
            clearing_system: "NEFT".into(),
            status: "enriched".into(),
            validation_errors: vec![],
            debtor_name: Some("Access Corp".into()),
            debtor_account: Some("0033344455".into()),
            creditor_name: None,
            creditor_account: None,
            end_to_end_id: Some("E2E-BATCH-ACC-001".into()),
            uetr: None,
        },
        Iso20022Message {
            id: "ISO-004".into(),
            message_type: "camt.053".into(),
            business_service: "statement".into(),
            sender_bic: "54link-devLAGOS".into(),
            receiver_bic: "CBNNGLA".into(),
            msg_id: "CAMT053-20260509".into(),
            creation_datetime: "2026-05-09T23:59:00Z".into(),
            number_of_transactions: 1250,
            total_amount: 85_000_000_000.0,
            currency: "NGN".into(),
            settlement_method: "INDA".into(),
            clearing_system: "RTGS".into(),
            status: "settled".into(),
            validation_errors: vec![],
            debtor_name: None,
            debtor_account: None,
            creditor_name: None,
            creditor_account: None,
            end_to_end_id: None,
            uetr: None,
        },
        Iso20022Message {
            id: "ISO-005".into(),
            message_type: "pacs.002".into(),
            business_service: "status".into(),
            sender_bic: "CBNNGLA".into(),
            receiver_bic: "54link-devLAGOS".into(),
            msg_id: "PACS002-2026050905".into(),
            creation_datetime: "2026-05-09T14:00:00Z".into(),
            number_of_transactions: 1,
            total_amount: 0.0,
            currency: "NGN".into(),
            settlement_method: "CLRG".into(),
            clearing_system: "RTGS".into(),
            status: "rejected".into(),
            validation_errors: vec!["AC01: Incorrect Account Number".into()],
            debtor_name: None,
            debtor_account: None,
            creditor_name: None,
            creditor_account: None,
            end_to_end_id: Some("E2E-FAILED-001".into()),
            uetr: Some("c3d4e5f6-a7b8-9012-cdef-345678901234".into()),
        },
        Iso20022Message {
            id: "ISO-006".into(),
            message_type: "camt.054".into(),
            business_service: "notification".into(),
            sender_bic: "54link-devLAGOS".into(),
            receiver_bic: "DGLNGLA".into(),
            msg_id: "CAMT054-2026050901".into(),
            creation_datetime: "2026-05-09T16:00:00Z".into(),
            number_of_transactions: 5,
            total_amount: 150_000_000.0,
            currency: "NGN".into(),
            settlement_method: "INDA".into(),
            clearing_system: "NIP".into(),
            status: "settled".into(),
            validation_errors: vec![],
            debtor_name: None,
            debtor_account: None,
            creditor_name: Some("Dangote Industries".into()),
            creditor_account: Some("0012345678".into()),
            end_to_end_id: None,
            uetr: None,
        },
    ];

    let rules = vec![
        ValidationRule {
            id: "VR-001".into(),
            rule_name: "BIC format".into(),
            message_type: "pacs.008".into(),
            field_path: "GrpHdr/SttlmInf/SttlmAcct/Id/IBAN".into(),
            validation_type: "format".into(),
            description: "BIC must be 8 or 11 characters".into(),
            severity: "error".into(),
        },
        ValidationRule {
            id: "VR-002".into(),
            rule_name: "Amount positive".into(),
            message_type: "pacs.008".into(),
            field_path: "CdtTrfTxInf/Amt/InstdAmt".into(),
            validation_type: "business_rule".into(),
            description: "Amount must be greater than zero".into(),
            severity: "error".into(),
        },
        ValidationRule {
            id: "VR-003".into(),
            rule_name: "Currency code".into(),
            message_type: "pacs.008".into(),
            field_path: "CdtTrfTxInf/Amt/InstdAmt/@Ccy".into(),
            validation_type: "code_list".into(),
            description: "Currency must be valid ISO 4217".into(),
            severity: "error".into(),
        },
        ValidationRule {
            id: "VR-004".into(),
            rule_name: "UETR format".into(),
            message_type: "pacs.008".into(),
            field_path: "CdtTrfTxInf/PmtId/UETR".into(),
            validation_type: "format".into(),
            description: "UETR must be UUID v4 format".into(),
            severity: "error".into(),
        },
        ValidationRule {
            id: "VR-005".into(),
            rule_name: "Debtor account".into(),
            message_type: "pain.001".into(),
            field_path: "PmtInf/DbtrAcct/Id".into(),
            validation_type: "mandatory".into(),
            description: "Debtor account is mandatory for payment initiation".into(),
            severity: "error".into(),
        },
    ];

    (messages, rules)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

async fn list_messages(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let m = match sqlx::query_as::<_, Iso20022Message>(MESSAGE_SELECT)
        .fetch_all(&data.db)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("iso20022-hub-rs: list_messages query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "message_store_unavailable"}));
        }
    };
    HttpResponse::Ok().json(serde_json::json!({ "items": m, "total": m.len() }))
}

async fn list_rules(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let r = match sqlx::query_as::<_, ValidationRule>(
        "SELECT id, rule_name, message_type, field_path, validation_type, description, severity
         FROM validation_rules ORDER BY id",
    )
    .fetch_all(&data.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("iso20022-hub-rs: list_rules query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "rule_store_unavailable"}));
        }
    };
    HttpResponse::Ok().json(serde_json::json!({ "items": r, "total": r.len() }))
}

async fn parse_and_validate(
    req: actix_web::HttpRequest,
    body: web::Json<ParseRequest>,
    data: web::Data<AppState>,
) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    if let Err(resp) = permify::require_permify(&req, "transfer", "validate").await {
        return resp;
    } // W12-B5D1
    let req = body.into_inner();
    let valid_types = [
        "pacs.008", "pacs.004", "pacs.002", "pain.001", "pain.002", "camt.053", "camt.054",
        "camt.052",
    ];
    if !valid_types.contains(&req.message_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": format!("message_type must be one of: {}", valid_types.join(", "))}));
    }
    if req.amount < 0.0 {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "amount must be non-negative"}));
    }
    if req.sender_bic.len() != 11 && req.sender_bic.len() != 8 {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "sender_bic must be 8 or 11 characters"}));
    }
    let mut errors = vec![];
    if req.message_type == "pain.001" && req.debtor_account.is_none() {
        errors.push("VR-005: Debtor account is mandatory for payment initiation".to_string());
    }
    let status = if errors.is_empty() {
        "validated"
    } else {
        "rejected"
    };
    let msg_count: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM iso20022_messages")
        .fetch_one(&data.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            eprintln!("iso20022-hub-rs: parse_and_validate count failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "message_store_unavailable"}));
        }
    };
    let msg = Iso20022Message {
        id: format!("ISO-{:03}", msg_count + 1),
        message_type: req.message_type.clone(),
        business_service: match req.message_type.as_str() {
            "pacs.008" => "credit_transfer",
            "pacs.004" => "return",
            "pacs.002" => "status",
            "pain.001" => "initiation",
            "camt.053" => "statement",
            "camt.054" => "notification",
            _ => "other",
        }
        .into(),
        sender_bic: req.sender_bic,
        receiver_bic: req.receiver_bic,
        msg_id: format!(
            "{}-{}",
            req.message_type.to_uppercase().replace('.', ""),
            msg_count + 1
        ),
        creation_datetime: "2026-05-10T00:00:00Z".into(),
        number_of_transactions: 1,
        total_amount: req.amount,
        currency: req.currency,
        settlement_method: "CLRG".into(),
        clearing_system: "NIP".into(),
        status: status.into(),
        validation_errors: errors,
        debtor_name: req.debtor_name,
        debtor_account: req.debtor_account,
        creditor_name: req.creditor_name,
        creditor_account: req.creditor_account,
        end_to_end_id: Some(format!("E2E-NEW-{:03}", msg_count + 1)),
        uetr: None,
    };
    if let Err(e) = sqlx::query(
        "INSERT INTO iso20022_messages (id, message_type, business_service, sender_bic, receiver_bic,
            msg_id, creation_datetime, number_of_transactions, total_amount, currency, settlement_method,
            clearing_system, status, validation_errors, debtor_name, debtor_account, creditor_name,
            creditor_account, end_to_end_id, uetr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",
    )
    .bind(&msg.id).bind(&msg.message_type).bind(&msg.business_service).bind(&msg.sender_bic).bind(&msg.receiver_bic)
    .bind(&msg.msg_id).bind(&msg.creation_datetime).bind(msg.number_of_transactions).bind(msg.total_amount)
    .bind(&msg.currency).bind(&msg.settlement_method).bind(&msg.clearing_system).bind(&msg.status)
    .bind(&msg.validation_errors).bind(&msg.debtor_name).bind(&msg.debtor_account).bind(&msg.creditor_name)
    .bind(&msg.creditor_account).bind(&msg.end_to_end_id).bind(&msg.uetr)
    .execute(&data.db)
    .await
    {
        eprintln!("iso20022-hub-rs: parse_and_validate insert failed: {}", e);
        return HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"error": "message_store_unavailable"}));
    }
    if msg.status == "rejected" {
        HttpResponse::UnprocessableEntity().json(msg)
    } else {
        HttpResponse::Created().json(msg)
    }
}

async fn stats(req: actix_web::HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req).await {
        return resp;
    }
    let m = match sqlx::query_as::<_, Iso20022Message>(MESSAGE_SELECT)
        .fetch_all(&data.db)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("iso20022-hub-rs: stats query failed: {}", e);
            return HttpResponse::ServiceUnavailable()
                .json(serde_json::json!({"error": "message_store_unavailable"}));
        }
    };
    let settled = m.iter().filter(|x| x.status == "settled").count();
    let rejected = m.iter().filter(|x| x.status == "rejected").count();
    let total_settled_amount: f64 = m
        .iter()
        .filter(|x| x.status == "settled")
        .map(|x| x.total_amount)
        .sum();
    let mut by_type: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for msg in m.iter() {
        *by_type.entry(msg.message_type.clone()).or_insert(0) += 1;
    }
    let mut by_clearing: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    for msg in m.iter() {
        *by_clearing.entry(msg.clearing_system.clone()).or_insert(0) += 1;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "totalMessages": m.len(), "settled": settled, "rejected": rejected,
        "totalSettledAmount": total_settled_amount,
        "byMessageType": by_type, "byClearingSystem": by_clearing,
    }))
}

// --- JWT Auth Check (fail-closed; N-2 remediation) ---
// Canonical pattern aligned with the C-10-repaired fleet (jwt-validator-rs /
// gl-engine-rs) and extended to RS256: tokens are verified against the Keycloak
// JWKS (KEYCLOAK_JWKS_URL, or derived from KEYCLOAK_REALM_URL) with a 300s cache
// and a 5s fetch timeout; HS256 via JWT_SECRET is supported when JWKS is not
// configured. 401 on missing/malformed/expired/unknown-kid tokens; 503 when the
// verification backend (JWKS endpoint or JWT_SECRET) is unavailable. Verified
// claims are stored in request extensions for downstream handlers.

#[derive(Debug, Clone)]
struct VerifiedClaims(serde_json::Value);

struct JwksCacheEntry {
    fetched_at: std::time::Instant,
    keys: jsonwebtoken::jwk::JwkSet,
}

static JWKS_CACHE: std::sync::OnceLock<std::sync::Mutex<Option<JwksCacheEntry>>> =
    std::sync::OnceLock::new();

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
        Ok(realm) if !realm.is_empty() => Some(format!(
            "{}/protocol/openid-connect/certs",
            realm.trim_end_matches('/')
        )),
        _ => None,
    }
}

async fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, actix_web::HttpResponse> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => {
            return Err(
                actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                    "error": "jwt_validation_unavailable",
                    "detail": "no JWKS endpoint configured"
                })),
            )
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
        .map_err(|_| {
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "client init failed"
            }))
        })?;
    let resp = client.get(&url).send().await.map_err(|_| {
        actix_web::HttpResponse::ServiceUnavailable()
            .json(serde_json::json!({"error": "jwks_unavailable"}))
    })?;
    if !resp.status().is_success() {
        return Err(
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "upstream returned error status"
            })),
        );
    }
    let keys = resp
        .json::<jsonwebtoken::jwk::JwkSet>()
        .await
        .map_err(|_| {
            actix_web::HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "jwks_unavailable",
                "detail": "malformed JWKS payload"
            }))
        })?;
    let mut cache = jwks_cache().lock().unwrap();
    *cache = Some(JwksCacheEntry {
        fetched_at: std::time::Instant::now(),
        keys: keys.clone(),
    });
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

async fn verify_jwt_token(token: &str) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let header = jsonwebtoken::decode_header(token).map_err(|_| {
        actix_web::HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "malformed token header"}))
    })?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => {
                    return Err(actix_web::HttpResponse::Unauthorized()
                        .json(serde_json::json!({"error": "missing kid"})))
                }
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
                            return Err(actix_web::HttpResponse::Unauthorized()
                                .json(serde_json::json!({"error": "unknown kid"})))
                        }
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk).map_err(|_| {
                actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid jwk"}))
            })?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err(actix_web::HttpResponse::ServiceUnavailable().json(
                        serde_json::json!({
                            "error": "jwt_validation_unavailable",
                            "detail": "JWT_SECRET is not configured; refusing to validate"
                        }),
                    ))
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
                Err(_) => Err(actix_web::HttpResponse::Unauthorized()
                    .json(serde_json::json!({"error": "invalid or expired token"}))),
            }
        }
        other => Err(
            actix_web::HttpResponse::Unauthorized().json(serde_json::json!({
                "error": format!("unsupported alg {:?}", other)
            })),
        ),
    }
}

async fn check_jwt(
    req: &actix_web::HttpRequest,
) -> Result<serde_json::Value, actix_web::HttpResponse> {
    let path = req.path();
    if path == "/healthz"
        || path == "/readyz"
        || path == "/livez"
        || path == "/metrics"
        || path == "/health"
    {
        return Ok(serde_json::json!({}));
    }
    let header = match req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
    {
        Some(h) => h,
        None => {
            return Err(actix_web::HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "missing Authorization header"})))
        }
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => {
            return Err(actix_web::HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "invalid auth header"})))
        }
    };
    let claims = verify_jwt_token(token).await?;
    req.extensions_mut().insert(VerifiedClaims(claims.clone()));
    Ok(claims)
}

/// Verified tenant id from JWT claims stored in request extensions (never from
/// raw request headers or caller-supplied body fields).
#[allow(dead_code)]
fn claims_tenant(req: &actix_web::HttpRequest) -> Option<String> {
    let ext = req.extensions();
    let claims = ext.get::<VerifiedClaims>()?;
    claims
        .0
        .get("tenant_id")
        .or_else(|| claims.0.get("tenant"))
        .and_then(|v| v.as_str())
        .map(String::from)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Wave-12 (C3-P0-B5): shared sqlx pool (max 25), aligned with the
    // tigerbeetle-batch-engine-rs Wave-11 convention; DATABASE_URL is mandatory.
    let db_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set - refusing to boot with default database credentials");
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(25)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect_lazy(&db_url)
        .expect("DATABASE_URL must parse");
    init_db(&db).await;
    seed_to_db(&db).await;
    let state = web::Data::new(AppState { db });
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

// Wave-12 B5-P0-D1: Permify authorization guard module.
mod permify;
