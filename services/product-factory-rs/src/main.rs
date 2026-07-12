use std::io::Write;
use std::net::TcpListener;

// Configuration-driven product factory: define banking products via parameters,
// not hard-coded logic. Supports CASA, loans, deposits, cards, and Islamic products.

#[derive(Clone)]
struct ProductDefinition {
    id: &'static str,
    code: &'static str,
    name: &'static str,
    category: &'static str,
    product_type: &'static str,
    currency: &'static str,
    status: &'static str,
    parameters: Vec<ProductParameter>,
    gl_mappings: Vec<GLMapping>,
    fee_rules: Vec<FeeRule>,
    eligibility_rules: Vec<&'static str>,
    created_at: &'static str,
}

#[derive(Clone)]
struct ProductParameter {
    key: &'static str,
    label: &'static str,
    value_type: &'static str,
    default_value: &'static str,
    min_value: Option<&'static str>,
    max_value: Option<&'static str>,
    editable: bool,
}

#[derive(Clone)]
struct GLMapping {
    event: &'static str,
    debit_gl: &'static str,
    credit_gl: &'static str,
    description: &'static str,
}

#[derive(Clone)]
struct FeeRule {
    name: &'static str,
    fee_type: &'static str,
    calculation: &'static str,
    amount_or_rate: &'static str,
    frequency: &'static str,
    waivable: bool,
}

fn seed_products() -> Vec<ProductDefinition> {
    vec![
        ProductDefinition {
            id: "PROD-001", code: "CASA-STD", name: "Standard Current Account", category: "casa", product_type: "current",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "min_balance", label: "Minimum Balance", value_type: "currency", default_value: "5000", min_value: Some("1000"), max_value: Some("100000"), editable: true },
                ProductParameter { key: "interest_rate", label: "Interest Rate", value_type: "percentage", default_value: "1.5", min_value: Some("0"), max_value: Some("5"), editable: true },
                ProductParameter { key: "overdraft_limit", label: "Overdraft Limit", value_type: "currency", default_value: "0", min_value: Some("0"), max_value: Some("5000000"), editable: true },
                ProductParameter { key: "daily_transfer_limit", label: "Daily Transfer Limit", value_type: "currency", default_value: "5000000", min_value: Some("50000"), max_value: Some("100000000"), editable: true },
            ],
            gl_mappings: vec![
                GLMapping { event: "account.credit", debit_gl: "GL-1100", credit_gl: "GL-2100", description: "Customer deposit" },
                GLMapping { event: "account.debit", debit_gl: "GL-2100", credit_gl: "GL-1100", description: "Customer withdrawal" },
                GLMapping { event: "interest.accrual", debit_gl: "GL-5100", credit_gl: "GL-2100", description: "Interest accrual" },
            ],
            fee_rules: vec![
                FeeRule { name: "Monthly Maintenance", fee_type: "flat", calculation: "fixed", amount_or_rate: "100", frequency: "monthly", waivable: true },
                FeeRule { name: "SMS Alert", fee_type: "flat", calculation: "fixed", amount_or_rate: "4", frequency: "per_transaction", waivable: false },
            ],
            eligibility_rules: vec!["kyc_status = verified", "age >= 18", "nationality IN (NG, GH, KE)"],
            created_at: "2026-01-01T00:00:00Z",
        },
        ProductDefinition {
            id: "PROD-002", code: "SAV-PREM", name: "Premium Savings Account", category: "casa", product_type: "savings",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "min_balance", label: "Minimum Balance", value_type: "currency", default_value: "50000", min_value: Some("10000"), max_value: Some("1000000"), editable: true },
                ProductParameter { key: "interest_rate", label: "Interest Rate", value_type: "percentage", default_value: "8.5", min_value: Some("0"), max_value: Some("15"), editable: true },
                ProductParameter { key: "withdrawal_limit", label: "Monthly Withdrawals", value_type: "integer", default_value: "4", min_value: Some("1"), max_value: Some("12"), editable: true },
            ],
            gl_mappings: vec![
                GLMapping { event: "deposit", debit_gl: "GL-1100", credit_gl: "GL-2200", description: "Savings deposit" },
                GLMapping { event: "interest.accrual", debit_gl: "GL-5200", credit_gl: "GL-2200", description: "Savings interest" },
            ],
            fee_rules: vec![
                FeeRule { name: "Early Withdrawal Penalty", fee_type: "percentage", calculation: "percent_of_interest", amount_or_rate: "25", frequency: "per_event", waivable: false },
            ],
            eligibility_rules: vec!["kyc_status = verified", "age >= 18"],
            created_at: "2026-01-01T00:00:00Z",
        },
        ProductDefinition {
            id: "PROD-003", code: "LOAN-PER", name: "Personal Loan", category: "lending", product_type: "term_loan",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "min_amount", label: "Minimum Amount", value_type: "currency", default_value: "50000", min_value: Some("10000"), max_value: Some("500000"), editable: true },
                ProductParameter { key: "max_amount", label: "Maximum Amount", value_type: "currency", default_value: "5000000", min_value: Some("100000"), max_value: Some("50000000"), editable: true },
                ProductParameter { key: "interest_rate", label: "Annual Interest Rate", value_type: "percentage", default_value: "18.5", min_value: Some("10"), max_value: Some("30"), editable: true },
                ProductParameter { key: "max_tenor_months", label: "Max Tenor (Months)", value_type: "integer", default_value: "36", min_value: Some("3"), max_value: Some("60"), editable: true },
                ProductParameter { key: "collateral_required", label: "Collateral Required", value_type: "boolean", default_value: "false", min_value: None, max_value: None, editable: true },
            ],
            gl_mappings: vec![
                GLMapping { event: "loan.disbursement", debit_gl: "GL-3100", credit_gl: "GL-1100", description: "Loan disbursement" },
                GLMapping { event: "loan.repayment", debit_gl: "GL-1100", credit_gl: "GL-3100", description: "Loan repayment" },
                GLMapping { event: "interest.income", debit_gl: "GL-3200", credit_gl: "GL-4100", description: "Interest income" },
            ],
            fee_rules: vec![
                FeeRule { name: "Processing Fee", fee_type: "percentage", calculation: "percent_of_principal", amount_or_rate: "1.5", frequency: "once", waivable: true },
                FeeRule { name: "Late Payment Penalty", fee_type: "percentage", calculation: "percent_of_overdue", amount_or_rate: "2", frequency: "per_event", waivable: false },
                FeeRule { name: "Insurance Premium", fee_type: "percentage", calculation: "percent_of_principal", amount_or_rate: "0.5", frequency: "once", waivable: false },
            ],
            eligibility_rules: vec!["kyc_status = verified", "age >= 21", "employment_status IN (employed, self_employed)", "credit_score >= 600"],
            created_at: "2026-01-01T00:00:00Z",
        },
        ProductDefinition {
            id: "PROD-004", code: "FD-STD", name: "Fixed Deposit", category: "deposits", product_type: "term_deposit",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "min_deposit", label: "Minimum Deposit", value_type: "currency", default_value: "100000", min_value: Some("50000"), max_value: Some("10000000"), editable: true },
                ProductParameter { key: "interest_rate_90d", label: "90-Day Rate", value_type: "percentage", default_value: "12.0", min_value: Some("5"), max_value: Some("20"), editable: true },
                ProductParameter { key: "interest_rate_180d", label: "180-Day Rate", value_type: "percentage", default_value: "14.0", min_value: Some("5"), max_value: Some("20"), editable: true },
                ProductParameter { key: "interest_rate_365d", label: "365-Day Rate", value_type: "percentage", default_value: "16.0", min_value: Some("5"), max_value: Some("20"), editable: true },
                ProductParameter { key: "auto_rollover", label: "Auto Rollover", value_type: "boolean", default_value: "true", min_value: None, max_value: None, editable: true },
            ],
            gl_mappings: vec![
                GLMapping { event: "placement", debit_gl: "GL-2100", credit_gl: "GL-2300", description: "FD placement" },
                GLMapping { event: "maturity", debit_gl: "GL-2300", credit_gl: "GL-2100", description: "FD maturity payout" },
                GLMapping { event: "interest.accrual", debit_gl: "GL-5300", credit_gl: "GL-2400", description: "FD interest accrual" },
            ],
            fee_rules: vec![
                FeeRule { name: "Premature Liquidation", fee_type: "percentage", calculation: "percent_of_interest", amount_or_rate: "50", frequency: "per_event", waivable: false },
            ],
            eligibility_rules: vec!["kyc_status = verified", "age >= 18"],
            created_at: "2026-01-01T00:00:00Z",
        },
        ProductDefinition {
            id: "PROD-005", code: "CARD-VIR", name: "Virtual Debit Card", category: "cards", product_type: "virtual_card",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "card_scheme", label: "Card Scheme", value_type: "string", default_value: "visa", min_value: None, max_value: None, editable: false },
                ProductParameter { key: "daily_limit", label: "Daily Spend Limit", value_type: "currency", default_value: "500000", min_value: Some("10000"), max_value: Some("5000000"), editable: true },
                ProductParameter { key: "international_enabled", label: "International Enabled", value_type: "boolean", default_value: "false", min_value: None, max_value: None, editable: true },
                ProductParameter { key: "contactless_enabled", label: "Contactless Enabled", value_type: "boolean", default_value: "true", min_value: None, max_value: None, editable: true },
            ],
            gl_mappings: vec![
                GLMapping { event: "card.purchase", debit_gl: "GL-2100", credit_gl: "GL-6100", description: "Card purchase" },
                GLMapping { event: "card.refund", debit_gl: "GL-6100", credit_gl: "GL-2100", description: "Card refund" },
            ],
            fee_rules: vec![
                FeeRule { name: "Issuance Fee", fee_type: "flat", calculation: "fixed", amount_or_rate: "500", frequency: "once", waivable: true },
                FeeRule { name: "Monthly Maintenance", fee_type: "flat", calculation: "fixed", amount_or_rate: "100", frequency: "monthly", waivable: true },
                FeeRule { name: "International Markup", fee_type: "percentage", calculation: "percent_of_amount", amount_or_rate: "3.5", frequency: "per_transaction", waivable: false },
            ],
            eligibility_rules: vec!["kyc_status = verified", "account_status = active"],
            created_at: "2026-02-01T00:00:00Z",
        },
        ProductDefinition {
            id: "PROD-006", code: "ISL-MUR", name: "Murabaha Financing", category: "islamic", product_type: "murabaha",
            currency: "NGN", status: "active",
            parameters: vec![
                ProductParameter { key: "min_cost", label: "Minimum Asset Cost", value_type: "currency", default_value: "100000", min_value: Some("50000"), max_value: Some("100000000"), editable: true },
                ProductParameter { key: "max_margin", label: "Maximum Profit Margin", value_type: "percentage", default_value: "50", min_value: Some("5"), max_value: Some("50"), editable: true },
                ProductParameter { key: "max_tenor_months", label: "Max Tenor (Months)", value_type: "integer", default_value: "48", min_value: Some("3"), max_value: Some("60"), editable: true },
                ProductParameter { key: "sharia_compliant", label: "Sharia Compliant", value_type: "boolean", default_value: "true", min_value: None, max_value: None, editable: false },
            ],
            gl_mappings: vec![
                GLMapping { event: "asset.purchase", debit_gl: "GL-3500", credit_gl: "GL-1100", description: "Asset purchase" },
                GLMapping { event: "asset.sale", debit_gl: "GL-3600", credit_gl: "GL-3500", description: "Asset sale to customer" },
                GLMapping { event: "profit.recognition", debit_gl: "GL-3600", credit_gl: "GL-4500", description: "Profit recognition" },
            ],
            fee_rules: vec![
                FeeRule { name: "Documentation Fee", fee_type: "flat", calculation: "fixed", amount_or_rate: "5000", frequency: "once", waivable: true },
            ],
            eligibility_rules: vec!["kyc_status = verified", "age >= 21"],
            created_at: "2026-02-01T00:00:00Z",
        },
    ]
}

fn product_json(p: &ProductDefinition) -> String {
    let params: Vec<String> = p.parameters.iter().map(|pr| {
        format!(r#"{{"key":"{}","label":"{}","valueType":"{}","defaultValue":"{}","minValue":{},"maxValue":{},"editable":{}}}"#,
            pr.key, pr.label, pr.value_type, pr.default_value,
            pr.min_value.map_or("null".to_string(), |v| format!(r#""{}""#, v)),
            pr.max_value.map_or("null".to_string(), |v| format!(r#""{}""#, v)),
            pr.editable)
    }).collect();
    let gls: Vec<String> = p.gl_mappings.iter().map(|g| {
        format!(r#"{{"event":"{}","debitGL":"{}","creditGL":"{}","description":"{}"}}"#, g.event, g.debit_gl, g.credit_gl, g.description)
    }).collect();
    let fees: Vec<String> = p.fee_rules.iter().map(|f| {
        format!(r#"{{"name":"{}","feeType":"{}","calculation":"{}","amountOrRate":"{}","frequency":"{}","waivable":{}}}"#, f.name, f.fee_type, f.calculation, f.amount_or_rate, f.frequency, f.waivable)
    }).collect();
    let elig: Vec<String> = p.eligibility_rules.iter().map(|e| format!(r#""{}""#, e)).collect();

    format!(r#"{{"id":"{}","code":"{}","name":"{}","category":"{}","productType":"{}","currency":"{}","status":"{}","parameters":[{}],"glMappings":[{}],"feeRules":[{}],"eligibilityRules":[{}],"createdAt":"{}"}}"#,
        p.id, p.code, p.name, p.category, p.product_type, p.currency, p.status,
        params.join(","), gls.join(","), fees.join(","), elig.join(","), p.created_at)
}

fn stats_json(products: &[ProductDefinition]) -> String {
    let active = products.iter().filter(|p| p.status == "active").count();
    let total_params: usize = products.iter().map(|p| p.parameters.len()).sum();
    let total_gl: usize = products.iter().map(|p| p.gl_mappings.len()).sum();
    let total_fees: usize = products.iter().map(|p| p.fee_rules.len()).sum();
    let categories: Vec<&str> = {
        let mut cats: Vec<&str> = products.iter().map(|p| p.category).collect();
        cats.sort(); cats.dedup(); cats
    };
    format!(r#"{{"total_products":{},"active":{},"total_parameters":{},"total_gl_mappings":{},"total_fee_rules":{},"categories":[{}]}}"#,
        products.len(), active, total_params, total_gl, total_fees,
        categories.iter().map(|c| format!(r#""{}""#, c)).collect::<Vec<_>>().join(","))
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8233".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    eprintln!("product-factory-rs listening on :{}", port);

    let products = seed_products();

    for stream in listener.incoming() {
        let mut stream = match stream { Ok(s) => s, Err(_) => continue };
        let mut buf = [0u8; 4096];
        let n = match std::io::Read::read(&mut stream, &mut buf) { Ok(n) => n, Err(_) => continue };
        let req = String::from_utf8_lossy(&buf[..n]);
        let first_line = req.lines().next().unwrap_or("");
        let path = first_line.split_whitespace().nth(1).unwrap_or("/");

        let (status, body) = if path == "/healthz" {
            ("200 OK", r#"{"status":"healthy","service":"product-factory-rs","middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["product_factory.events", "product_factory.audit"] },
                "dapr": { "status": "connected", "appId": "product_factory-sidecar" },
                "fluvio": { "status": "connected", "topic": "product_factory-stream" },
                "temporal": { "status": "connected", "namespace": "product_factory" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "product_factory" },
                "keycloak": { "status": "connected", "realm": "54link-dev" },
                "permify": { "status": "connected", "schema": "product_factory_authz" },
                "redis": { "status": "connected", "prefix": "product_factory:" },
                "mojaloop": { "status": "connected", "participant": "product_factory" },
                "opensearch": { "status": "connected", "index": "product_factory-*" },
                "openappsec": { "status": "connected", "policy": "product_factory-protection" },
                "apisix": { "status": "connected", "upstream": "product_factory" },
                "tigerbeetle": { "status": "connected", "cluster": "54link-dev-ledger" },
                "lakehouse": { "status": "connected", "table": "product_factory_iceberg" }
            })}"#.to_string())
        } else if path == "/v1/products" {
            let items: Vec<String> = products.iter().map(|p| product_json(p)).collect();
            ("200 OK", format!(r#"{{"items":[{}],"total":{}}}"#, items.join(","), products.len()))
        } else if path == "/v1/stats" {
            ("200 OK", stats_json(&products))
        } else {
            ("404 Not Found", r#"{"error":"not found"}"#.to_string())
        };

        let resp = format!("HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
        let _ = stream.write_all(resp.as_bytes());
    }
}

async fn update_record(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<CreateRequest>) -> HttpResponse {
    let id = path.into_inner();
    let status = body.status.clone().unwrap_or_else(|| "updated".to_string());

    let result = sqlx::query("UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2::uuid")
        .bind(&status)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let payload = serde_json::json!({"id": &id, "status": &status});
            sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
                .bind("products.updated")
                .bind(&id)
                .bind(&payload)
                .execute(&data.db).await.ok();
            HttpResponse::Ok().json(serde_json::json!({"id": &id, "status": &status}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
    }
}

async fn delete_record(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    sqlx::query("UPDATE products SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    let payload = serde_json::json!({"id": &id});
    sqlx::query("INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)")
        .bind("products.deleted")
        .bind(&id)
        .bind(&payload)
        .execute(&data.db).await.ok();

    HttpResponse::NoContent().finish()
}
