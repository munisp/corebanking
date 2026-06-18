use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// B5: Mortgage Enhancements
// NHF integration, variable rate adjustment, foreclosure workflow, property valuation

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NHFApplication {
    pub id: String,
    pub employee_id: String,
    pub employer_name: String,
    pub nhf_number: String,
    pub monthly_contribution: f64,
    pub contribution_years: u32,
    pub eligible_amount: f64, // max 15M NGN
    pub interest_rate: f64,   // 6% for NHF
    pub status: String,       // pending, verified, approved, rejected
    pub verification_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateAdjustment {
    pub id: String,
    pub mortgage_id: String,
    pub previous_rate: f64,
    pub new_rate: f64,
    pub adjustment_type: String, // cbn_policy, market, promotional, penalty
    pub effective_date: String,
    pub reason: String,
    pub new_monthly_payment: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeclosureCase {
    pub id: String,
    pub mortgage_id: String,
    pub arrears_amount: f64,
    pub months_in_arrears: u32,
    pub stage: String, // notice_sent, legal_action, court_order, auction, completed
    pub notice_date: String,
    pub legal_ref: String,
    pub property_valuation: f64,
    pub reserve_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyValuation {
    pub id: String,
    pub mortgage_id: String,
    pub property_address: String,
    pub valuer_name: String,
    pub market_value: f64,
    pub forced_sale_value: f64,
    pub valuation_date: String,
    pub condition: String, // excellent, good, fair, poor
    pub ltv_ratio: f64,
}

pub struct MortgageEnhState {
    pub nhf_applications: Mutex<Vec<NHFApplication>>,
    pub rate_adjustments: Mutex<Vec<RateAdjustment>>,
    pub foreclosures: Mutex<Vec<ForeclosureCase>>,
    pub valuations: Mutex<Vec<PropertyValuation>>,
}

impl MortgageEnhState {
    pub fn new() -> Self {
        Self {
            nhf_applications: Mutex::new(Vec::new()),
            rate_adjustments: Mutex::new(Vec::new()),
            foreclosures: Mutex::new(Vec::new()),
            valuations: Mutex::new(Vec::new()),
        }
    }
}

pub async fn list_nhf(state: web::Data<MortgageEnhState>) -> HttpResponse {
    let apps = state.nhf_applications.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"applications": *apps, "total": apps.len()}))
}

#[derive(Deserialize)]
pub struct NHFInput {
    pub employee_id: Option<String>,
    pub employer_name: Option<String>,
    pub nhf_number: Option<String>,
    pub monthly_contribution: Option<f64>,
    pub contribution_years: Option<u32>,
}

pub async fn create_nhf(
    state: web::Data<MortgageEnhState>,
    body: web::Json<NHFInput>,
) -> HttpResponse {
    let years = body.contribution_years.unwrap_or(0);
    let monthly = body.monthly_contribution.unwrap_or(0.0);
    // NHF eligible amount: max 15M, based on contributions
    let eligible = (monthly * 12.0 * years as f64 * 3.0).min(15_000_000.0);

    let app = NHFApplication {
        id: format!("NHF-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        employee_id: body.employee_id.clone().unwrap_or_default(),
        employer_name: body.employer_name.clone().unwrap_or_default(),
        nhf_number: body.nhf_number.clone().unwrap_or_default(),
        monthly_contribution: monthly,
        contribution_years: years,
        eligible_amount: eligible,
        interest_rate: 6.0,
        status: "pending".to_string(),
        verification_date: chrono::Utc::now().to_rfc3339(),
    };

    let mut apps = state.nhf_applications.lock().unwrap();
    apps.push(app.clone());
    HttpResponse::Created().json(app)
}

pub async fn list_rate_adjustments(state: web::Data<MortgageEnhState>) -> HttpResponse {
    let adj = state.rate_adjustments.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"adjustments": *adj, "total": adj.len()}))
}

#[derive(Deserialize)]
pub struct RateAdjInput {
    pub mortgage_id: Option<String>,
    pub new_rate: Option<f64>,
    pub adjustment_type: Option<String>,
    pub reason: Option<String>,
    pub outstanding_balance: Option<f64>,
    pub remaining_months: Option<u32>,
}

pub async fn create_rate_adjustment(
    state: web::Data<MortgageEnhState>,
    body: web::Json<RateAdjInput>,
) -> HttpResponse {
    let new_rate = body.new_rate.unwrap_or(15.0);
    let balance = body.outstanding_balance.unwrap_or(10_000_000.0);
    let months = body.remaining_months.unwrap_or(240) as f64;
    let monthly_rate = new_rate / 100.0 / 12.0;
    let new_payment = if monthly_rate > 0.0 {
        balance * monthly_rate * (1.0 + monthly_rate).powf(months) / ((1.0 + monthly_rate).powf(months) - 1.0)
    } else {
        balance / months
    };

    let adj = RateAdjustment {
        id: format!("RA-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        mortgage_id: body.mortgage_id.clone().unwrap_or_default(),
        previous_rate: 0.0,
        new_rate,
        adjustment_type: body.adjustment_type.clone().unwrap_or("market".to_string()),
        effective_date: chrono::Utc::now().to_rfc3339(),
        reason: body.reason.clone().unwrap_or_default(),
        new_monthly_payment: (new_payment * 100.0).round() / 100.0,
    };

    let mut adjs = state.rate_adjustments.lock().unwrap();
    adjs.push(adj.clone());
    HttpResponse::Created().json(adj)
}

pub async fn list_foreclosures(state: web::Data<MortgageEnhState>) -> HttpResponse {
    let cases = state.foreclosures.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"cases": *cases, "total": cases.len()}))
}

#[derive(Deserialize)]
pub struct ForeclosureInput {
    pub mortgage_id: Option<String>,
    pub arrears_amount: Option<f64>,
    pub months_in_arrears: Option<u32>,
    pub property_valuation: Option<f64>,
}

pub async fn initiate_foreclosure(
    state: web::Data<MortgageEnhState>,
    body: web::Json<ForeclosureInput>,
) -> HttpResponse {
    let months = body.months_in_arrears.unwrap_or(0);
    if months < 3 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Foreclosure requires minimum 3 months in arrears"
        }));
    }

    let valuation = body.property_valuation.unwrap_or(0.0);
    let case = ForeclosureCase {
        id: format!("FC-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        mortgage_id: body.mortgage_id.clone().unwrap_or_default(),
        arrears_amount: body.arrears_amount.unwrap_or(0.0),
        months_in_arrears: months,
        stage: "notice_sent".to_string(),
        notice_date: chrono::Utc::now().to_rfc3339(),
        legal_ref: format!("LR/{}/FC", chrono::Utc::now().format("%Y")),
        property_valuation: valuation,
        reserve_price: valuation * 0.75,
    };

    let mut cases = state.foreclosures.lock().unwrap();
    cases.push(case.clone());
    HttpResponse::Created().json(case)
}

pub async fn list_valuations(state: web::Data<MortgageEnhState>) -> HttpResponse {
    let vals = state.valuations.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"valuations": *vals, "total": vals.len()}))
}

#[derive(Deserialize)]
pub struct ValuationInput {
    pub mortgage_id: Option<String>,
    pub property_address: Option<String>,
    pub valuer_name: Option<String>,
    pub market_value: Option<f64>,
    pub condition: Option<String>,
    pub outstanding_balance: Option<f64>,
}

pub async fn create_valuation(
    state: web::Data<MortgageEnhState>,
    body: web::Json<ValuationInput>,
) -> HttpResponse {
    let market_val = body.market_value.unwrap_or(0.0);
    let forced_sale = market_val * 0.70;
    let balance = body.outstanding_balance.unwrap_or(0.0);
    let ltv = if market_val > 0.0 { (balance / market_val) * 100.0 } else { 0.0 };

    let val = PropertyValuation {
        id: format!("PV-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        mortgage_id: body.mortgage_id.clone().unwrap_or_default(),
        property_address: body.property_address.clone().unwrap_or_default(),
        valuer_name: body.valuer_name.clone().unwrap_or_default(),
        market_value: market_val,
        forced_sale_value: forced_sale,
        valuation_date: chrono::Utc::now().to_rfc3339(),
        condition: body.condition.clone().unwrap_or("good".to_string()),
        ltv_ratio: (ltv * 100.0).round() / 100.0,
    };

    let mut vals = state.valuations.lock().unwrap();
    vals.push(val.clone());
    HttpResponse::Created().json(val)
}
