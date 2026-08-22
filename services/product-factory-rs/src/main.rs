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

// --- JWT Auth Check (fail-closed; N-2 remediation) ---
// Raw-socket variant of the canonical C-10 pattern (see jwt-validator-rs /
// gl-engine-rs), extended to RS256: tokens are verified against the Keycloak JWKS
// (KEYCLOAK_JWKS_URL, or derived from KEYCLOAK_REALM_URL) with a 300s cache and a
// 5s fetch timeout (blocking client, matching falkordb-graph-engine-rs); HS256 via
// JWT_SECRET is supported when JWKS is not configured. 401 on
// missing/malformed/expired/unknown-kid tokens; 503 when the verification backend
// (JWKS endpoint or JWT_SECRET) is unavailable.

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

fn jwks_unavailable(detail: &str) -> (u16, String) {
    (503, serde_json::json!({"error": "jwks_unavailable", "detail": detail}).to_string())
}

fn unauthorized(detail: &str) -> (u16, String) {
    (401, serde_json::json!({"error": detail}).to_string())
}

fn fetch_jwks() -> Result<jsonwebtoken::jwk::JwkSet, (u16, String)> {
    const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(300);
    let url = match jwks_url() {
        Some(u) => u,
        None => return Err(jwks_unavailable("no JWKS endpoint configured")),
    };
    {
        let cache = jwks_cache().lock().unwrap();
        if let Some(entry) = cache.as_ref() {
            if entry.fetched_at.elapsed() < JWKS_TTL {
                return Ok(entry.keys.clone());
            }
        }
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| jwks_unavailable("client init failed"))?;
    let resp = client.get(&url).send().map_err(|_| jwks_unavailable("fetch failed"))?;
    if !resp.status().is_success() {
        return Err(jwks_unavailable("upstream returned error status"));
    }
    let keys = resp.json::<jsonwebtoken::jwk::JwkSet>().map_err(|_| jwks_unavailable("malformed JWKS payload"))?;
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

fn verify_jwt_token(token: &str) -> Result<serde_json::Value, (u16, String)> {
    let header = jsonwebtoken::decode_header(token)
        .map_err(|_| unauthorized("malformed token header"))?;
    match header.alg {
        jsonwebtoken::Algorithm::RS256 => {
            let kid = match header.kid.clone() {
                Some(k) if !k.is_empty() => k,
                _ => return Err(unauthorized("missing kid")),
            };
            // JWKS outage => 503 (fail closed). Unknown kid => force one cache
            // refresh (key rotation), then 401 if still unknown.
            let jwks = fetch_jwks()?;
            let jwk = match jwks.find(&kid) {
                Some(j) => j.clone(),
                None => {
                    {
                        let mut cache = jwks_cache().lock().unwrap();
                        *cache = None;
                    }
                    let refreshed = fetch_jwks()?;
                    match refreshed.find(&kid) {
                        Some(j) => j.clone(),
                        None => return Err(unauthorized("unknown kid")),
                    }
                }
            };
            let key = jsonwebtoken::DecodingKey::from_jwk(&jwk)
                .map_err(|_| unauthorized("invalid jwk"))?;
            let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
            validation.validate_exp = true;
            validation.validate_nbf = true;
            apply_iss_aud(&mut validation);
            match jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation) {
                Ok(data) => Ok(data.claims),
                Err(_) => Err(unauthorized("invalid or expired token")),
            }
        }
        jsonwebtoken::Algorithm::HS256 => {
            // FAIL CLOSED: without JWT_SECRET there is no way to verify — 503, not accept-all.
            let secret = match std::env::var("JWT_SECRET") {
                Ok(s) if !s.is_empty() => s,
                _ => {
                    return Err((503, serde_json::json!({
                        "error": "jwt_validation_unavailable",
                        "detail": "JWT_SECRET is not configured; refusing to validate"
                    }).to_string()))
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
                Err(_) => Err(unauthorized("invalid or expired token")),
            }
        }
        other => Err(unauthorized(&format!("unsupported alg {:?}", other))),
    }
}

/// Extract a header value from the raw HTTP request text (case-insensitive name).
fn raw_header<'a>(request: &'a str, name: &str) -> Option<&'a str> {
    for line in request.lines().skip(1) {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            if k.trim().eq_ignore_ascii_case(name) {
                return Some(v.trim());
            }
        }
    }
    None
}

/// Fail-closed JWT gate for the raw TcpListener dispatch. Returns Ok(claims) or
/// Err((status, body)) ready to be written to the socket.
fn check_jwt(request: &str, path: &str) -> Result<serde_json::Value, (u16, String)> {
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(serde_json::json!({}));
    }
    let header = match raw_header(request, "Authorization") {
        Some(h) => h,
        None => return Err(unauthorized("missing Authorization header")),
    };
    let token = match header.strip_prefix("Bearer ") {
        Some(t) if !t.is_empty() => t,
        _ => return Err(unauthorized("invalid auth header")),
    };
    verify_jwt_token(token)
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

        // N-2: fail-closed JWT auth on every route except health probes.
        if let Err((code, body)) = check_jwt(&req, path) {
            let st = match code {
                401 => "401 Unauthorized",
                503 => "503 Service Unavailable",
                _ => "500 Internal Server Error",
            };
            let resp = format!("HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", st, body.len(), body);
            let _ = stream.write_all(resp.as_bytes());
            continue;
        }

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

