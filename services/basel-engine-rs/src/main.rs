use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct RwaExposure {
    id: String,
    asset_class: String, // sovereign, bank, corporate, retail, mortgage, sme, equity, securitization
    exposure_type: String, // on_balance, off_balance, derivative, repo
    counterparty: String,
    rating: String, // AAA, AA, A, BBB, BB, B, CCC, unrated
    original_exposure: f64,
    credit_conversion_factor: f64,
    ead: f64, // exposure at default
    risk_weight: f64, // percentage
    rwa: f64, // risk-weighted asset
    currency: String,
    maturity_date: String,
    collateral_value: f64,
    collateral_type: String,
    netting_set: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct CapitalRatio {
    id: String,
    report_date: String,
    tier1_common_equity: f64,
    additional_tier1: f64,
    tier2_capital: f64,
    total_capital: f64,
    total_rwa: f64,
    credit_rwa: f64,
    market_rwa: f64,
    operational_rwa: f64,
    cet1_ratio: f64,
    tier1_ratio: f64,
    total_car: f64,
    leverage_ratio: f64,
    lcr: f64, // liquidity coverage ratio
    nsfr: f64, // net stable funding ratio
    countercyclical_buffer: f64,
    systemic_buffer: f64,
    capital_conservation_buffer: f64,
    minimum_cet1: f64,
    minimum_tier1: f64,
    minimum_total: f64,
    cet1_surplus: f64,
    compliant: bool,
}

#[derive(Deserialize)]
struct RwaCalcRequest {
    asset_class: String,
    rating: String,
    exposure: f64,
    collateral_value: Option<f64>,
    maturity_years: Option<f64>,
}

struct AppState {
    exposures: Mutex<Vec<RwaExposure>>,
    capital: Mutex<Vec<CapitalRatio>>,
}

fn risk_weight(asset_class: &str, rating: &str) -> f64 {
    match (asset_class, rating) {
        ("sovereign", "AAA") | ("sovereign", "AA") => 0.0,
        ("sovereign", "A") => 20.0,
        ("sovereign", "BBB") => 50.0,
        ("sovereign", "BB") | ("sovereign", "B") => 100.0,
        ("sovereign", _) => 150.0,
        ("bank", "AAA") | ("bank", "AA") => 20.0,
        ("bank", "A") => 50.0,
        ("bank", "BBB") | ("bank", "BB") => 100.0,
        ("bank", _) => 150.0,
        ("corporate", "AAA") | ("corporate", "AA") => 20.0,
        ("corporate", "A") => 50.0,
        ("corporate", "BBB") => 100.0,
        ("corporate", _) => 150.0,
        ("retail", _) => 75.0,
        ("mortgage", _) => 35.0,
        ("sme", _) => 85.0,
        ("equity", _) => 100.0,
        ("securitization", "AAA") => 20.0,
        ("securitization", "AA") => 25.0,
        ("securitization", "A") => 50.0,
        ("securitization", _) => 1250.0,
        _ => 100.0,
    }
}

fn seed() -> (Vec<RwaExposure>, Vec<CapitalRatio>) {
    let exposures = vec![
        RwaExposure { id: "RWA-001".into(), asset_class: "sovereign".into(), exposure_type: "on_balance".into(), counterparty: "Federal Government of Nigeria".into(), rating: "B".into(), original_exposure: 150_000_000_000.0, credit_conversion_factor: 1.0, ead: 150_000_000_000.0, risk_weight: 100.0, rwa: 150_000_000_000.0, currency: "NGN".into(), maturity_date: "2030-12-31".into(), collateral_value: 0.0, collateral_type: "none".into(), netting_set: None },
        RwaExposure { id: "RWA-002".into(), asset_class: "bank".into(), exposure_type: "on_balance".into(), counterparty: "First Bank of Nigeria".into(), rating: "BBB".into(), original_exposure: 50_000_000_000.0, credit_conversion_factor: 1.0, ead: 50_000_000_000.0, risk_weight: 100.0, rwa: 50_000_000_000.0, currency: "NGN".into(), maturity_date: "2027-06-30".into(), collateral_value: 10_000_000_000.0, collateral_type: "cash".into(), netting_set: Some("NETTING-FBN-001".into()) },
        RwaExposure { id: "RWA-003".into(), asset_class: "corporate".into(), exposure_type: "on_balance".into(), counterparty: "Dangote Industries".into(), rating: "A".into(), original_exposure: 80_000_000_000.0, credit_conversion_factor: 1.0, ead: 80_000_000_000.0, risk_weight: 50.0, rwa: 40_000_000_000.0, currency: "NGN".into(), maturity_date: "2028-03-15".into(), collateral_value: 30_000_000_000.0, collateral_type: "property".into(), netting_set: None },
        RwaExposure { id: "RWA-004".into(), asset_class: "retail".into(), exposure_type: "on_balance".into(), counterparty: "Retail Portfolio".into(), rating: "unrated".into(), original_exposure: 200_000_000_000.0, credit_conversion_factor: 1.0, ead: 200_000_000_000.0, risk_weight: 75.0, rwa: 150_000_000_000.0, currency: "NGN".into(), maturity_date: "various".into(), collateral_value: 50_000_000_000.0, collateral_type: "mixed".into(), netting_set: None },
        RwaExposure { id: "RWA-005".into(), asset_class: "mortgage".into(), exposure_type: "on_balance".into(), counterparty: "Mortgage Portfolio".into(), rating: "unrated".into(), original_exposure: 120_000_000_000.0, credit_conversion_factor: 1.0, ead: 120_000_000_000.0, risk_weight: 35.0, rwa: 42_000_000_000.0, currency: "NGN".into(), maturity_date: "various".into(), collateral_value: 180_000_000_000.0, collateral_type: "residential_property".into(), netting_set: None },
        RwaExposure { id: "RWA-006".into(), asset_class: "sme".into(), exposure_type: "on_balance".into(), counterparty: "SME Portfolio".into(), rating: "unrated".into(), original_exposure: 60_000_000_000.0, credit_conversion_factor: 1.0, ead: 60_000_000_000.0, risk_weight: 85.0, rwa: 51_000_000_000.0, currency: "NGN".into(), maturity_date: "various".into(), collateral_value: 15_000_000_000.0, collateral_type: "inventory".into(), netting_set: None },
        RwaExposure { id: "RWA-007".into(), asset_class: "derivative".into(), exposure_type: "derivative".into(), counterparty: "OTC Derivative Portfolio".into(), rating: "A".into(), original_exposure: 25_000_000_000.0, credit_conversion_factor: 0.5, ead: 12_500_000_000.0, risk_weight: 50.0, rwa: 6_250_000_000.0, currency: "NGN".into(), maturity_date: "various".into(), collateral_value: 5_000_000_000.0, collateral_type: "cash_margin".into(), netting_set: Some("NETTING-OTC-001".into()) },
        RwaExposure { id: "RWA-008".into(), asset_class: "off_balance".into(), exposure_type: "off_balance".into(), counterparty: "Guarantee Portfolio".into(), rating: "BBB".into(), original_exposure: 40_000_000_000.0, credit_conversion_factor: 0.5, ead: 20_000_000_000.0, risk_weight: 100.0, rwa: 20_000_000_000.0, currency: "NGN".into(), maturity_date: "various".into(), collateral_value: 15_000_000_000.0, collateral_type: "cash_margin".into(), netting_set: None },
    ];

    // CBN minimum ratios: CET1=6%, Tier1=8%, Total CAR=15% (for systemically important banks)
    let credit_rwa = 509_250_000_000.0;
    let market_rwa = 25_000_000_000.0;
    let operational_rwa = 45_000_000_000.0;
    let total_rwa = credit_rwa + market_rwa + operational_rwa;
    let cet1 = 120_000_000_000.0;
    let at1 = 15_000_000_000.0;
    let t2 = 25_000_000_000.0;
    let total_cap = cet1 + at1 + t2;

    let capital = vec![CapitalRatio {
        id: "CAP-2026Q1".into(), report_date: "2026-03-31".into(),
        tier1_common_equity: cet1, additional_tier1: at1, tier2_capital: t2, total_capital: total_cap,
        total_rwa, credit_rwa, market_rwa, operational_rwa,
        cet1_ratio: (cet1 / total_rwa * 10000.0).round() / 100.0,
        tier1_ratio: ((cet1 + at1) / total_rwa * 10000.0).round() / 100.0,
        total_car: (total_cap / total_rwa * 10000.0).round() / 100.0,
        leverage_ratio: ((cet1 + at1) / 800_000_000_000.0 * 10000.0).round() / 100.0,
        lcr: 145.0, nsfr: 112.0,
        countercyclical_buffer: 0.0, systemic_buffer: 1.0, capital_conservation_buffer: 2.5,
        minimum_cet1: 6.0, minimum_tier1: 8.0, minimum_total: 15.0,
        cet1_surplus: (cet1 / total_rwa * 100.0) - 6.0,
        compliant: (total_cap / total_rwa * 100.0) >= 15.0,
    }];

    (exposures, capital)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok", "service": "basel-engine"
    }))
}

async fn list_exposures(data: web::Data<AppState>) -> HttpResponse {
    let e = data.exposures.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *e, "total": e.len() }))
}

async fn capital_ratios(data: web::Data<AppState>) -> HttpResponse {
    let c = data.capital.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *c, "total": c.len() }))
}

async fn calculate_rwa(body: web::Json<RwaCalcRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.exposure <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "exposure must be positive"}));
    }
    let valid_classes = ["sovereign", "bank", "corporate", "retail", "mortgage", "sme", "equity", "securitization"];
    if !valid_classes.contains(&req.asset_class.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "invalid asset_class"}));
    }
    let rw = risk_weight(&req.asset_class, &req.rating);
    let collateral = req.collateral_value.unwrap_or(0.0);
    let ead = (req.exposure - collateral * 0.8).max(0.0); // 80% LGD mitigation
    let rwa = ead * rw / 100.0;
    let capital_charge = rwa * 0.15; // 15% CBN minimum CAR
    HttpResponse::Ok().json(serde_json::json!({
        "assetClass": req.asset_class, "rating": req.rating,
        "originalExposure": req.exposure, "collateralValue": collateral,
        "ead": (ead * 100.0).round() / 100.0,
        "riskWeight": rw, "rwa": (rwa * 100.0).round() / 100.0,
        "capitalCharge": (capital_charge * 100.0).round() / 100.0,
    }))
}

async fn pillar3(data: web::Data<AppState>) -> HttpResponse {
    let exposures = data.exposures.lock().unwrap();
    let capital = data.capital.lock().unwrap();
    let latest = capital.last();
    let mut by_asset_class: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for e in exposures.iter() {
        *by_asset_class.entry(e.asset_class.clone()).or_insert(0.0) += e.rwa;
    }
    HttpResponse::Ok().json(serde_json::json!({
        "pillar3Disclosure": {
            "reportDate": latest.map(|c| c.report_date.clone()).unwrap_or_default(),
            "capitalRatios": latest,
            "rwaByAssetClass": by_asset_class,
            "totalExposures": exposures.len(),
            "regulatoryMinimums": { "cet1": 6.0, "tier1": 8.0, "totalCar": 15.0, "lcr": 100.0, "nsfr": 100.0 },
            "buffers": { "capitalConservation": 2.5, "countercyclical": 0.0, "systemic": 1.0 },
        }
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (exposures, capital) = seed();
    let state = web::Data::new(AppState { exposures: Mutex::new(exposures), capital: Mutex::new(capital) });
    println!("Basel III/IV Engine on :8163");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/basel/exposures", web::get().to(list_exposures))
            .route("/v1/basel/capital", web::get().to(capital_ratios))
            .route("/v1/basel/calculate-rwa", web::post().to(calculate_rwa))
            .route("/v1/basel/pillar3", web::get().to(pillar3))
    })
    .bind("0.0.0.0:8163")?
    .run()
    .await
}
