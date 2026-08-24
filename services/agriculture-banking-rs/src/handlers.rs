use actix_web::{web, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

use crate::models::*;
use crate::AppState;

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn default_tenant() -> String {
    std::env::var("TENANT_ID").unwrap_or_else(|_| "54link-dev-platform-prod".to_string())
}

fn tigerbeetle_url() -> Option<String> {
    std::env::var("TIGERBEETLE_URL").ok().filter(|u| !u.is_empty())
}

// Post a REAL double-entry transfer to the TigerBeetle adapter.
// Returns Ok(response_body) only when the ledger accepted the transfer;
// Err otherwise. Money movement is never fabricated: callers must not mutate
// loan state when this fails.
async fn post_ledger_transfer(
    transfer_id: &str,
    debit_account: &str,
    credit_account: &str,
    amount_ngn: f64,
    currency: &str,
    narration: &str,
) -> Result<serde_json::Value, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let base = tigerbeetle_url().ok_or_else(|| "TIGERBEETLE_URL not configured".to_string())?;
    let url = format!("{}/transfers", base.trim_end_matches('/'));
    let amount_kobo = (amount_ngn * 100.0).round() as i64;
    let body = serde_json::json!({
        "transfers": [{
            "id": transfer_id,
            "debitAccount": debit_account,
            "creditAccount": credit_account,
            "amount": amount_kobo,
            "currency": currency,
            "narration": narration,
        }]
    })
    .to_string();

    let stripped = url.strip_prefix("http://").ok_or_else(|| "TIGERBEETLE_URL must be http://".to_string())?;
    let (hostport, path) = match stripped.find('/') {
        Some(i) => (&stripped[..i], &stripped[i..]),
        None => (stripped, "/"),
    };
    let addr = if hostport.contains(':') { hostport.to_string() } else { format!("{}:80", hostport) };
    let mut stream = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Err(format!("ledger connect failed: {}", e)),
        Err(_) => return Err("ledger connect timed out".to_string()),
    };
    let req = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, hostport, body.len(), body
    );
    stream.write_all(req.as_bytes()).await.map_err(|e| format!("ledger write failed: {}", e))?;
    let mut resp = String::new();
    stream.read_to_string(&mut resp).await.map_err(|e| format!("ledger read failed: {}", e))?;
    let status_ok = resp.starts_with("HTTP/1.1 2") || resp.starts_with("HTTP/1.0 2");
    if !status_ok {
        return Err(format!("ledger rejected transfer: {}", resp.lines().next().unwrap_or("unknown")));
    }
    let json_start = resp.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    let parsed: serde_json::Value = serde_json::from_str(&resp[json_start..]).unwrap_or(serde_json::json!({}));
    if parsed.get("error").is_some() {
        return Err(format!("ledger error: {}", parsed["error"]));
    }
    Ok(parsed)
}

pub async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "agriculture-banking-rs",
        "timestamp": now(),
        "database": "postgres",
        "ledger": if tigerbeetle_url().is_some() { "configured" } else { "not_configured" },
    }))
}

// ── Farmer CRUD ──

pub async fn list_farmers(state: web::Data<AppState>) -> HttpResponse {
    let farmers = state.farmers.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "asOf": now(),
        "items": *farmers,
        "total": farmers.len()
    }))
}

pub async fn create_farmer(state: web::Data<AppState>, body: web::Json<CreateFarmerRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.name.is_empty() || req.bvn.is_empty() || req.region.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "name, bvn, and region are required"
        }));
    }
    let risk_score = compute_farmer_risk_score(req.farm_size_hectares, req.cooperative_id.is_some());
    let farmer = Farmer {
        id: format!("FRM-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
        tenant_id: req.tenant_id.unwrap_or_else(default_tenant),
        name: req.name,
        bvn: req.bvn,
        phone: req.phone,
        region: req.region,
        local_government: req.local_government,
        farm_size_hectares: req.farm_size_hectares,
        primary_crop: req.primary_crop,
        secondary_crops: req.secondary_crops.unwrap_or_default(),
        cooperative_id: req.cooperative_id,
        cooperative_name: req.cooperative_name,
        bank_account_number: req.bank_account_number,
        risk_score,
        risk_tier: risk_tier_from_score(risk_score),
        status: "active".to_string(),
        geo_coordinates: req.geo_coordinates,
        registration_channel: req.registration_channel.unwrap_or_else(|| "platform".to_string()),
        created_at: now(),
        updated_at: now(),
    };
    let mut farmers = state.farmers.lock().unwrap();
    farmers.push(farmer.clone());
    HttpResponse::Created().json(farmer)
}

pub async fn get_farmer(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let farmers = state.farmers.lock().unwrap();
    match farmers.iter().find(|f| f.id == id) {
        Some(f) => HttpResponse::Ok().json(f),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Farmer not found"})),
    }
}

pub async fn update_farmer(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let id = path.into_inner();
    let mut farmers = state.farmers.lock().unwrap();
    match farmers.iter_mut().find(|f| f.id == id) {
        Some(farmer) => {
            if let Some(v) = body.get("name").and_then(|v| v.as_str()) { farmer.name = v.to_string(); }
            if let Some(v) = body.get("phone").and_then(|v| v.as_str()) { farmer.phone = v.to_string(); }
            if let Some(v) = body.get("region").and_then(|v| v.as_str()) { farmer.region = v.to_string(); }
            if let Some(v) = body.get("localGovernment").and_then(|v| v.as_str()) { farmer.local_government = v.to_string(); }
            if let Some(v) = body.get("farmSizeHectares").and_then(|v| v.as_f64()) { farmer.farm_size_hectares = v; }
            if let Some(v) = body.get("primaryCrop").and_then(|v| v.as_str()) { farmer.primary_crop = v.to_string(); }
            if let Some(v) = body.get("status").and_then(|v| v.as_str()) { farmer.status = v.to_string(); }
            if let Some(v) = body.get("bankAccountNumber").and_then(|v| v.as_str()) { farmer.bank_account_number = Some(v.to_string()); }
            farmer.risk_score = compute_farmer_risk_score(farmer.farm_size_hectares, farmer.cooperative_id.is_some());
            farmer.risk_tier = risk_tier_from_score(farmer.risk_score);
            farmer.updated_at = now();
            HttpResponse::Ok().json(farmer.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Farmer not found"})),
    }
}

pub async fn delete_farmer(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut farmers = state.farmers.lock().unwrap();
    let before = farmers.len();
    farmers.retain(|f| f.id != id);
    if farmers.len() < before {
        HttpResponse::Ok().json(serde_json::json!({"deleted": true, "id": id}))
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"message": "Farmer not found"}))
    }
}

// ── Agri-Loan CRUD ──

pub async fn list_agri_loans(state: web::Data<AppState>) -> HttpResponse {
    let loans = state.agri_loans.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "asOf": now(),
        "items": *loans,
        "total": loans.len()
    }))
}

pub async fn create_agri_loan(state: web::Data<AppState>, body: web::Json<CreateAgriLoanRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.farmer_id.is_empty() || req.principal_amount <= 0.0 || req.tenor_months == 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "farmerId, principalAmount (>0), and tenorMonths (>0) are required"
        }));
    }
    let farmers = state.farmers.lock().unwrap();
    let farmer_name = farmers.iter()
        .find(|f| f.id == req.farmer_id)
        .map(|f| f.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    drop(farmers);

    let interest_bps = req.interest_rate_bps.unwrap_or(1200);
    let schedule = generate_repayment_schedule(req.principal_amount, interest_bps, req.tenor_months);
    let risk_grade = compute_loan_risk_grade(req.principal_amount, req.collateral_value);

    let loan = AgriLoan {
        id: format!("ALOAN-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
        tenant_id: req.tenant_id.unwrap_or_else(default_tenant),
        farmer_id: req.farmer_id,
        farmer_name,
        loan_type: req.loan_type,
        product_code: "AGRI-SEASONAL".to_string(),
        principal_amount: req.principal_amount,
        interest_rate_bps: interest_bps,
        tenor_months: req.tenor_months,
        currency: req.currency.unwrap_or_else(|| "NGN".to_string()),
        purpose: req.purpose,
        collateral_type: req.collateral_type,
        collateral_value: req.collateral_value,
        crop_cycle: req.crop_cycle,
        expected_harvest_date: req.expected_harvest_date,
        disbursement_date: None,
        maturity_date: None,
        outstanding_balance: req.principal_amount,
        total_repaid: 0.0,
        status: "pending_approval".to_string(),
        approval_status: "pending".to_string(),
        risk_grade,
        repayment_schedule: schedule,
        middleware: vec![
            "TigerBeetle".to_string(), "Kafka".to_string(), "Temporal".to_string(),
            "Permify".to_string(), "Postgres".to_string(),
        ],
        created_at: now(),
        updated_at: now(),
    };
    let mut loans = state.agri_loans.lock().unwrap();
    loans.push(loan.clone());
    HttpResponse::Created().json(loan)
}

pub async fn get_agri_loan(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let loans = state.agri_loans.lock().unwrap();
    match loans.iter().find(|l| l.id == id) {
        Some(l) => HttpResponse::Ok().json(l),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
    }
}

pub async fn update_agri_loan(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let id = path.into_inner();
    let mut loans = state.agri_loans.lock().unwrap();
    match loans.iter_mut().find(|l| l.id == id) {
        Some(loan) => {
            if let Some(v) = body.get("approvalStatus").and_then(|v| v.as_str()) {
                loan.approval_status = v.to_string();
                if v == "approved" { loan.status = "approved".to_string(); }
                if v == "rejected" { loan.status = "rejected".to_string(); }
            }
            if let Some(v) = body.get("status").and_then(|v| v.as_str()) { loan.status = v.to_string(); }
            loan.updated_at = now();
            HttpResponse::Ok().json(loan.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
    }
}

pub async fn disburse_agri_loan(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();

    // Phase 1: validate + capture disbursement details (lock released before await).
    let (principal, currency, current_status) = {
        let loans = state.agri_loans.lock().unwrap();
        match loans.iter().find(|l| l.id == id) {
            Some(loan) => {
                if loan.approval_status != "approved" {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "message": "Loan must be approved before disbursement"
                    }));
                }
                (loan.principal_amount, loan.currency.clone(), loan.status.clone())
            }
            None => return HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
        }
    };

    // Phase 2: post the REAL ledger transfer FIRST. Money movement must exist
    // before the loan is marked disbursed; on failure return 502 and leave
    // the loan status unchanged.
    let transfer_id = format!("DSB-{}", id);
    let ledger = match post_ledger_transfer(
        &transfer_id,
        "agri-loan-receivable",
        "farmer-settlement-account",
        principal,
        &currency,
        &format!("Agri loan disbursement {}", id),
    )
    .await
    {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("[agriculture-banking-rs] disbursement ledger post failed for {}: {}", id, e);
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": "ledger_unavailable",
                "detail": e,
                "loanId": id,
                "status": current_status,
                "message": "Disbursement NOT applied: ledger transfer could not be posted"
            }));
        }
    };

    // Phase 3: ledger accepted — now mutate the loan.
    let mut loans = state.agri_loans.lock().unwrap();
    match loans.iter_mut().find(|l| l.id == id) {
        Some(loan) => {
            loan.status = "disbursed".to_string();
            loan.disbursement_date = Some(now());
            loan.updated_at = now();
            HttpResponse::Ok().json(serde_json::json!({
                "loan": loan.clone(),
                "ledgerEntry": {
                    "debit": "agri-loan-receivable",
                    "credit": "farmer-settlement-account",
                    "amount": loan.principal_amount,
                    "currency": loan.currency,
                    "transferId": transfer_id,
                    "ledgerResponse": ledger,
                }
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
    }
}

pub async fn repay_agri_loan(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<RepaymentRequest>) -> HttpResponse {
    let id = path.into_inner();
    let req = body.into_inner();
    if req.amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"message": "Repayment amount must be positive"}));
    }

    // Phase 1: validate + compute application (lock released before await).
    let (payment, currency) = {
        let loans = state.agri_loans.lock().unwrap();
        match loans.iter().find(|l| l.id == id) {
            Some(loan) => {
                if loan.status != "disbursed" {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "message": "Loan must be disbursed before repayment"
                    }));
                }
                (req.amount.min(loan.outstanding_balance), loan.currency.clone())
            }
            None => return HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
        }
    };

    // Phase 2: post the REAL repayment transfer to the ledger first.
    let transfer_id = format!("RPY-{}-{}", id, Uuid::new_v4().to_string()[..8].to_uppercase());
    let ledger = match post_ledger_transfer(
        &transfer_id,
        "farmer-settlement-account",
        "agri-loan-receivable",
        payment,
        &currency,
        &format!("Agri loan repayment {}", id),
    )
    .await
    {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("[agriculture-banking-rs] repayment ledger post failed for {}: {}", id, e);
            return HttpResponse::BadGateway().json(serde_json::json!({
                "error": "ledger_unavailable",
                "detail": e,
                "loanId": id,
                "message": "Repayment NOT applied: ledger transfer could not be posted"
            }));
        }
    };

    // Phase 3: ledger accepted — apply the repayment.
    let mut loans = state.agri_loans.lock().unwrap();
    match loans.iter_mut().find(|l| l.id == id) {
        Some(loan) => {
            loan.outstanding_balance -= payment;
            loan.total_repaid += payment;
            if loan.outstanding_balance <= 0.01 {
                loan.status = "fully_repaid".to_string();
                loan.outstanding_balance = 0.0;
            }
            loan.updated_at = now();
            HttpResponse::Ok().json(serde_json::json!({
                "loan": loan.clone(),
                "payment": { "applied": payment, "reference": req.payment_reference },
                "ledgerEntry": {
                    "debit": "farmer-settlement-account",
                    "credit": "agri-loan-receivable",
                    "amount": payment,
                    "transferId": transfer_id,
                    "ledgerResponse": ledger,
                }
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Agri-loan not found"})),
    }
}

// ── Crop Insurance CRUD ──

pub async fn list_crop_insurance(state: web::Data<AppState>) -> HttpResponse {
    let policies = state.crop_insurance.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "asOf": now(),
        "items": *policies,
        "total": policies.len()
    }))
}

pub async fn create_crop_insurance(state: web::Data<AppState>, body: web::Json<CreateCropInsuranceRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.farmer_id.is_empty() || req.sum_insured <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "farmerId and sumInsured (>0) are required"
        }));
    }
    let farmers = state.farmers.lock().unwrap();
    let farmer_name = farmers.iter()
        .find(|f| f.id == req.farmer_id)
        .map(|f| f.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    drop(farmers);

    let policy = CropInsurancePolicy {
        id: format!("CINS-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
        tenant_id: req.tenant_id.unwrap_or_else(default_tenant),
        farmer_id: req.farmer_id,
        farmer_name,
        policy_type: req.policy_type,
        crop_covered: req.crop_covered,
        coverage_area_hectares: req.coverage_area_hectares,
        sum_insured: req.sum_insured,
        premium_amount: req.premium_amount,
        premium_frequency: req.premium_frequency.unwrap_or_else(|| "annual".to_string()),
        policy_start: req.policy_start,
        policy_end: req.policy_end,
        weather_trigger_threshold: req.weather_trigger_threshold,
        claims: Vec::new(),
        status: "active".to_string(),
        underwriter: req.underwriter.unwrap_or_else(|| "54link-dev Insurance Pool".to_string()),
        middleware: vec![
            "weather-intelligence".to_string(), "Kafka".to_string(),
            "Temporal".to_string(), "Postgres".to_string(),
        ],
        created_at: now(),
        updated_at: now(),
    };
    let mut policies = state.crop_insurance.lock().unwrap();
    policies.push(policy.clone());
    HttpResponse::Created().json(policy)
}

pub async fn get_crop_insurance(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let policies = state.crop_insurance.lock().unwrap();
    match policies.iter().find(|p| p.id == id) {
        Some(p) => HttpResponse::Ok().json(p),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Insurance policy not found"})),
    }
}

pub async fn file_insurance_claim(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<FileClaimRequest>) -> HttpResponse {
    let id = path.into_inner();
    let req = body.into_inner();
    if req.amount_claimed <= 0.0 || req.reason.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "reason and amountClaimed (>0) are required"
        }));
    }
    let mut policies = state.crop_insurance.lock().unwrap();
    match policies.iter_mut().find(|p| p.id == id) {
        Some(policy) => {
            let claim = InsuranceClaim {
                claim_id: format!("CLM-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
                filed_date: now(),
                reason: req.reason,
                amount_claimed: req.amount_claimed,
                amount_approved: None,
                status: "filed".to_string(),
                assessment_notes: None,
                resolved_date: None,
            };
            policy.claims.push(claim.clone());
            policy.updated_at = now();
            HttpResponse::Created().json(serde_json::json!({
                "claim": claim,
                "policy": policy.clone(),
                "middleware": ["weather-intelligence", "Kafka", "Temporal", "compliance-service"]
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Insurance policy not found"})),
    }
}

// ── Value Chain CRUD ──

pub async fn list_value_chain(state: web::Data<AppState>) -> HttpResponse {
    let contracts = state.value_chain.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "asOf": now(),
        "items": *contracts,
        "total": contracts.len()
    }))
}

pub async fn create_value_chain_contract(state: web::Data<AppState>, body: web::Json<CreateValueChainRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.seller_farmer_id.is_empty() || req.commodity.is_empty() || req.quantity_tonnes <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "sellerFarmerId, commodity, and quantityTonnes (>0) are required"
        }));
    }
    let farmers = state.farmers.lock().unwrap();
    let seller_name = farmers.iter()
        .find(|f| f.id == req.seller_farmer_id)
        .map(|f| f.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    drop(farmers);

    let total_value = req.quantity_tonnes * req.price_per_tonne;
    let contract = ValueChainContract {
        id: format!("VCC-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
        tenant_id: req.tenant_id.unwrap_or_else(default_tenant),
        contract_type: req.contract_type,
        buyer_name: req.buyer_name,
        buyer_id: req.buyer_id,
        seller_farmer_id: req.seller_farmer_id,
        seller_farmer_name: seller_name,
        commodity: req.commodity,
        quantity_tonnes: req.quantity_tonnes,
        price_per_tonne: req.price_per_tonne,
        total_value,
        currency: req.currency.unwrap_or_else(|| "NGN".to_string()),
        delivery_location: req.delivery_location,
        delivery_deadline: req.delivery_deadline,
        warehouse_receipt_id: None,
        quality_grade: req.quality_grade.unwrap_or_else(|| "Grade A".to_string()),
        milestones: vec![
            ContractMilestone {
                milestone_id: format!("MS-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
                stage: "contract_signed".to_string(),
                description: "Contract signed by both parties".to_string(),
                completed: true,
                completed_at: Some(now()),
                evidence_url: None,
            },
        ],
        status: "active".to_string(),
        middleware: vec![
            "Kafka".to_string(), "Temporal".to_string(), "warehouse-receipt-service".to_string(),
            "Postgres".to_string(), "APISIX".to_string(),
        ],
        created_at: now(),
        updated_at: now(),
    };
    let mut contracts = state.value_chain.lock().unwrap();
    contracts.push(contract.clone());
    HttpResponse::Created().json(contract)
}

pub async fn get_value_chain_contract(state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let contracts = state.value_chain.lock().unwrap();
    match contracts.iter().find(|c| c.id == id) {
        Some(c) => HttpResponse::Ok().json(c),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Value chain contract not found"})),
    }
}

pub async fn record_milestone(state: web::Data<AppState>, path: web::Path<String>, body: web::Json<RecordMilestoneRequest>) -> HttpResponse {
    let id = path.into_inner();
    let req = body.into_inner();
    let mut contracts = state.value_chain.lock().unwrap();
    match contracts.iter_mut().find(|c| c.id == id) {
        Some(contract) => {
            let milestone = ContractMilestone {
                milestone_id: format!("MS-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
                stage: req.stage,
                description: req.description,
                completed: true,
                completed_at: Some(now()),
                evidence_url: req.evidence_url,
            };
            contract.milestones.push(milestone.clone());
            contract.updated_at = now();
            HttpResponse::Ok().json(serde_json::json!({
                "milestone": milestone,
                "contract": contract.clone()
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Contract not found"})),
    }
}

// ── Business Logic ──

fn compute_farmer_risk_score(farm_hectares: f64, has_cooperative: bool) -> f64 {
    let base = if farm_hectares >= 50.0 { 30.0 }
        else if farm_hectares >= 10.0 { 50.0 }
        else { 70.0 };
    let coop_bonus = if has_cooperative { -10.0 } else { 0.0 };
    let score: f64 = base + coop_bonus;
    score.clamp(0.0, 100.0)
}

fn risk_tier_from_score(score: f64) -> String {
    if score <= 30.0 { "Low".to_string() }
    else if score <= 60.0 { "Medium".to_string() }
    else { "High".to_string() }
}

fn compute_loan_risk_grade(principal: f64, collateral: f64) -> String {
    let ltv = if collateral > 0.0 { principal / collateral } else { 10.0 };
    if ltv <= 0.5 { "A".to_string() }
    else if ltv <= 0.75 { "B".to_string() }
    else if ltv <= 1.0 { "C".to_string() }
    else { "D".to_string() }
}

fn generate_repayment_schedule(principal: f64, interest_bps: u32, tenor_months: u32) -> Vec<RepaymentInstalment> {
    let monthly_rate = (interest_bps as f64) / 10000.0 / 12.0;
    let n = tenor_months as f64;
    let emi = if monthly_rate > 0.0 {
        principal * monthly_rate * (1.0 + monthly_rate).powf(n) / ((1.0 + monthly_rate).powf(n) - 1.0)
    } else {
        principal / n
    };
    let mut balance = principal;
    (1..=tenor_months).map(|i| {
        let interest = balance * monthly_rate;
        let principal_part = emi - interest;
        balance -= principal_part;
        if balance < 0.01 { balance = 0.0; }
        RepaymentInstalment {
            instalment_number: i,
            due_date: format!("2026-{:02}-01", ((i - 1) % 12) + 1),
            principal: (principal_part * 100.0).round() / 100.0,
            interest: (interest * 100.0).round() / 100.0,
            total: (emi * 100.0).round() / 100.0,
            status: "scheduled".to_string(),
            paid_date: None,
        }
    }).collect()
}
