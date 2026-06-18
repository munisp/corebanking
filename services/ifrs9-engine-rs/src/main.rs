use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

// IFRS9 Exposure — monetary fields stored in kobo (i64).
// Ratios (PD, LGD) remain f64 — they are percentages, not money.
// i64 max = 9,223,372,036,854,775,807 kobo ≈ ₦92 trillion — safe for any Nigerian exposure.
#[derive(Clone, Serialize, Deserialize)]
struct Exposure {
    id: String,
    account_id: String,
    customer_name: String,
    product_type: String,       // term_loan, overdraft, mortgage, credit_card, trade_finance, bond
    outstanding_balance_kobo: i64,  // outstanding principal in kobo
    original_amount_kobo: i64,      // original disbursement in kobo
    currency: String,
    stage: u8,                  // 1 = performing, 2 = SICR, 3 = credit-impaired
    stage_reason: String,
    days_past_due: u32,
    pd_12m: f64,                // 12-month probability of default (%) — ratio, not money
    pd_lifetime: f64,           // lifetime PD (%) — ratio, not money
    lgd: f64,                   // loss given default (%) — ratio, not money
    ead_kobo: i64,              // exposure at default in kobo
    ecl_kobo: i64,              // expected credit loss in kobo
    ecl_12m_kobo: i64,         // 12-month ECL in kobo
    ecl_lifetime_kobo: i64,    // lifetime ECL in kobo
    collateral_value_kobo: i64, // collateral value in kobo
    origination_date: String,
    maturity_date: String,
    last_review_date: String,
    sicr_triggered: bool,       // significant increase in credit risk
    write_off: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct TransitionMatrix {
    from_rating: String,
    to_aaa: f64, to_aa: f64, to_a: f64, to_bbb: f64, to_bb: f64, to_b: f64, to_ccc: f64, to_default: f64,
}

#[derive(Deserialize)]
struct EclCalcRequest {
    outstanding_kobo: i64, // outstanding balance in kobo — integer, no float
    pd_12m: f64,           // probability of default 0–100 — ratio, stays f64
    lgd: f64,              // loss given default 0–100 — ratio, stays f64
    stage: u8,
    remaining_years: f64,
}

struct AppState {
    exposures: Mutex<Vec<Exposure>>,
    transitions: Mutex<Vec<TransitionMatrix>>,
}

// calc_ecl_kobo: returns ECL values in kobo (i64).
// outstanding_kobo: integer kobo input.
// PD and LGD are percentages (f64 ratios) — not money, intermediate float is correct.
// Result is rounded to nearest kobo — no sub-kobo precision stored.
fn calc_ecl_kobo(outstanding_kobo: i64, pd_12m: f64, lgd: f64, stage: u8, years: f64) -> (i64, i64) {
    let outstanding_f = outstanding_kobo as f64;
    let ecl_12m_f = outstanding_f * (pd_12m / 100.0) * (lgd / 100.0);
    let ecl_lifetime_f = if stage == 1 {
        ecl_12m_f
    } else {
        let pd_lt = 1.0 - (1.0 - pd_12m / 100.0).powf(years);
        outstanding_f * pd_lt * (lgd / 100.0)
    };
    (ecl_12m_f.round() as i64, ecl_lifetime_f.round() as i64)
}

// naira_to_kobo: converts NGN amount to kobo integer. Only for seed data initialisation.
fn naira_to_kobo(naira: f64) -> i64 { (naira * 100.0).round() as i64 }

fn seed() -> (Vec<Exposure>, Vec<TransitionMatrix>) {
    // Seed amounts are in NGN (f64) for readability, converted to kobo (i64) immediately.
    // (id, account_id, name, product, outstanding_ngn, original_ngn, stage, reason, dpd, pd12m%, pdlt%, lgd%, orig_date, mat_date, sicr)
    let exposures_raw: Vec<(&str, &str, &str, &str, f64, f64, u8, &str, u32, f64, f64, f64, &str, &str, bool)> = vec![
        ("EXP-001", "LN-001", "Dangote Industries",  "term_loan",    45_000_000_000.0, 50_000_000_000.0,  1, "Performing - current",           0,   0.5,  2.5, 40.0, "2024-01-15", "2029-01-15", false),
        ("EXP-002", "LN-002", "MTN Nigeria",          "term_loan",    30_000_000_000.0, 30_000_000_000.0,  1, "Performing - current",           0,   0.8,  4.0, 45.0, "2025-06-01", "2030-06-01", false),
        ("EXP-003", "LN-003", "Pan Ocean Oil",        "trade_finance",15_000_000_000.0, 20_000_000_000.0,  2, "SICR - rating downgrade",       45,   3.5, 15.0, 55.0, "2024-03-01", "2026-09-01", true),
        ("EXP-004", "LN-004", "Arik Air",             "term_loan",     8_000_000_000.0, 12_000_000_000.0,  3, "Credit-impaired - 90+ DPD",    120,  25.0, 80.0, 65.0, "2023-01-01", "2028-01-01", false),
        ("EXP-005", "MG-001", "Retail Mortgage Pool", "mortgage",    120_000_000_000.0,150_000_000_000.0,  1, "Performing - current",           0,   1.2,  6.0, 25.0, "various",    "various",    false),
        ("EXP-006", "OD-001", "SME Overdraft Pool",   "overdraft",    25_000_000_000.0, 25_000_000_000.0,  2, "SICR - 30+ DPD",                35,   5.0, 20.0, 60.0, "various",    "various",    true),
        ("EXP-007", "CC-001", "Credit Card Pool",     "credit_card",  10_000_000_000.0, 15_000_000_000.0,  1, "Performing - current",           5,   2.0, 10.0, 70.0, "various",    "various",    false),
        ("EXP-008", "BD-001", "Corporate Bond",       "bond",         50_000_000_000.0, 50_000_000_000.0,  1, "Performing - investment grade",  0,   0.3,  1.5, 35.0, "2025-01-01", "2030-12-31", false),
    ];

    let exposures = exposures_raw.into_iter().map(|(id, acc, name, prod, bal_ngn, orig_ngn, stage, reason, dpd, pd12, pdlt, lgd, odate, mdate, sicr)| {
        let bal_kobo  = naira_to_kobo(bal_ngn);
        let orig_kobo = naira_to_kobo(orig_ngn);
        let remaining = 3.0;
        let (ecl_12m_kobo, ecl_lifetime_kobo) = calc_ecl_kobo(bal_kobo, pd12, lgd, stage, remaining);
        let ecl_kobo = if stage == 1 { ecl_12m_kobo } else { ecl_lifetime_kobo };
        let collateral_kobo = (bal_kobo as f64 * 0.3).round() as i64;
        Exposure {
            id: id.into(), account_id: acc.into(), customer_name: name.into(),
            product_type: prod.into(),
            outstanding_balance_kobo: bal_kobo,
            original_amount_kobo: orig_kobo,
            currency: "NGN".into(), stage, stage_reason: reason.into(),
            days_past_due: dpd, pd_12m: pd12, pd_lifetime: pdlt, lgd,
            ead_kobo: bal_kobo,
            ecl_kobo, ecl_12m_kobo, ecl_lifetime_kobo,
            collateral_value_kobo: collateral_kobo,
            origination_date: odate.into(), maturity_date: mdate.into(),
            last_review_date: "2026-03-31".into(), sicr_triggered: sicr, write_off: false,
        }
    }).collect();

    let transitions = vec![
        TransitionMatrix { from_rating: "AAA".into(), to_aaa: 90.0, to_aa: 8.0, to_a: 1.5, to_bbb: 0.3, to_bb: 0.1, to_b: 0.05, to_ccc: 0.03, to_default: 0.02 },
        TransitionMatrix { from_rating: "AA".into(), to_aaa: 2.0, to_aa: 88.0, to_a: 7.0, to_bbb: 2.0, to_bb: 0.5, to_b: 0.3, to_ccc: 0.1, to_default: 0.1 },
        TransitionMatrix { from_rating: "A".into(), to_aaa: 0.5, to_aa: 3.0, to_a: 85.0, to_bbb: 8.0, to_bb: 2.0, to_b: 1.0, to_ccc: 0.3, to_default: 0.2 },
        TransitionMatrix { from_rating: "BBB".into(), to_aaa: 0.1, to_aa: 0.5, to_a: 3.0, to_bbb: 82.0, to_bb: 10.0, to_b: 3.0, to_ccc: 1.0, to_default: 0.4 },
        TransitionMatrix { from_rating: "BB".into(), to_aaa: 0.05, to_aa: 0.1, to_a: 0.5, to_bbb: 5.0, to_bb: 75.0, to_b: 12.0, to_ccc: 5.0, to_default: 2.35 },
        TransitionMatrix { from_rating: "B".into(), to_aaa: 0.02, to_aa: 0.05, to_a: 0.1, to_bbb: 0.5, to_bb: 5.0, to_b: 70.0, to_ccc: 15.0, to_default: 9.33 },
    ];

    (exposures, transitions)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}

async fn list_exposures(data: web::Data<AppState>) -> HttpResponse {
    let e = match data.exposures.lock() {
    Ok(v) => v,
    Err(_) => {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({
                "error": "internal state lock failed"
            }));
    }
};
    HttpResponse::Ok().json(serde_json::json!({ "items": *e, "total": e.len() }))
}

async fn transition_matrix(data: web::Data<AppState>) -> HttpResponse {
    let t = match data.transitions.lock() {
    Ok(v) => v,
    Err(_) => {
        return HttpResponse::InternalServerError().json(
            serde_json::json!({
                "error": "failed to lock transitions state"
            })
        );
    }
};
    HttpResponse::Ok().json(serde_json::json!({ "items": *t, "total": t.len() }))
}

async fn calculate_ecl(body: web::Json<EclCalcRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.outstanding_kobo <= 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "outstanding_kobo must be positive"}));
    }
    if req.pd_12m < 0.0 || req.pd_12m > 100.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "pd_12m must be 0-100"}));
    }
    if req.lgd < 0.0 || req.lgd > 100.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "lgd must be 0-100"}));
    }
    if req.stage < 1 || req.stage > 3 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "stage must be 1, 2, or 3"}));
    }
    let (ecl_12m_kobo, ecl_lifetime_kobo) = calc_ecl_kobo(req.outstanding_kobo, req.pd_12m, req.lgd, req.stage, req.remaining_years);
    let ecl_kobo = if req.stage == 1 { ecl_12m_kobo } else { ecl_lifetime_kobo };
    let coverage_ratio_bps = if req.outstanding_kobo > 0 {
        (ecl_kobo as f64 / req.outstanding_kobo as f64 * 10000.0).round() / 100.0
    } else { 0.0 };
    HttpResponse::Ok().json(serde_json::json!({
        "outstanding_kobo": req.outstanding_kobo,
        "stage": req.stage, "pd_12m": req.pd_12m, "lgd": req.lgd,
        "remaining_years": req.remaining_years,
        "ecl_12m_kobo": ecl_12m_kobo,
        "ecl_lifetime_kobo": ecl_lifetime_kobo,
        "ecl_kobo": ecl_kobo,
        "coverage_ratio_pct": coverage_ratio_bps,
        "measurement_basis": if req.stage == 1 { "12-month ECL" } else { "Lifetime ECL" },
    }))
}

async fn summary(data: web::Data<AppState>) -> HttpResponse {
    let e = match data.exposures.lock() {
    Ok(v) => v,
    Err(_) => {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({
                "error": "internal state lock failed"
            }));
    }
};
    let total_exposure_kobo: i64 = e.iter().map(|x| x.outstanding_balance_kobo).sum();
    let total_ecl_kobo: i64 = e.iter().map(|x| x.ecl_kobo).sum();
    let stage1_exposure_kobo: i64 = e.iter().filter(|x| x.stage == 1).map(|x| x.outstanding_balance_kobo).sum();
    let stage2_exposure_kobo: i64 = e.iter().filter(|x| x.stage == 2).map(|x| x.outstanding_balance_kobo).sum();
    let stage3_exposure_kobo: i64 = e.iter().filter(|x| x.stage == 3).map(|x| x.outstanding_balance_kobo).sum();
    let stage1_ecl_kobo: i64 = e.iter().filter(|x| x.stage == 1).map(|x| x.ecl_kobo).sum();
    let stage2_ecl_kobo: i64 = e.iter().filter(|x| x.stage == 2).map(|x| x.ecl_kobo).sum();
    let stage3_ecl_kobo: i64 = e.iter().filter(|x| x.stage == 3).map(|x| x.ecl_kobo).sum();
    let cov = |ecl: i64, exp: i64| -> f64 {
        if exp == 0 { 0.0 } else { (ecl as f64 / exp as f64 * 10000.0).round() / 100.0 }
    };
    HttpResponse::Ok().json(serde_json::json!({
        "total_exposures": e.len(),
        "total_exposure_kobo": total_exposure_kobo,
        "total_ecl_kobo": total_ecl_kobo,
        "overall_coverage_pct": cov(total_ecl_kobo, total_exposure_kobo),
        "stage1": { "count": e.iter().filter(|x| x.stage == 1).count(), "exposure_kobo": stage1_exposure_kobo, "ecl_kobo": stage1_ecl_kobo, "coverage_pct": cov(stage1_ecl_kobo, stage1_exposure_kobo) },
        "stage2": { "count": e.iter().filter(|x| x.stage == 2).count(), "exposure_kobo": stage2_exposure_kobo, "ecl_kobo": stage2_ecl_kobo, "coverage_pct": cov(stage2_ecl_kobo, stage2_exposure_kobo) },
        "stage3": { "count": e.iter().filter(|x| x.stage == 3).count(), "exposure_kobo": stage3_exposure_kobo, "ecl_kobo": stage3_ecl_kobo, "coverage_pct": cov(stage3_ecl_kobo, stage3_exposure_kobo) },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (exposures, transitions) = seed();
    let state = web::Data::new(AppState { exposures: Mutex::new(exposures), transitions: Mutex::new(transitions) });
    println!("IFRS 9 Engine on :8164");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ifrs9/exposures", web::get().to(list_exposures))
            .route("/v1/ifrs9/transition-matrix", web::get().to(transition_matrix))
            .route("/v1/ifrs9/calculate-ecl", web::post().to(calculate_ecl))
            .route("/v1/ifrs9/summary", web::get().to(summary))
    })
    .bind("0.0.0.0:8164")?
    .run()
    .await
}
