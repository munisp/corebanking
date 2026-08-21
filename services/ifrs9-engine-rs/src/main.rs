use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

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
    #[serde(default)]
    exposure_id: Option<String>,
}

struct AppState {
    db: Option<PgPool>,
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

fn source_unavailable(detail: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "source_unavailable",
        "detail": detail,
    }))
}

// The exposure book and transition matrix are regulatory data: they MUST come
// from the impairment database (ifrs9_exposures / ifrs9_transition_matrix).
// No data source => 503. Never seed a fake book.
async fn fetch_exposures(db: &PgPool) -> Result<Vec<Exposure>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT id, account_id, customer_name, product_type,
                  outstanding_balance_kobo, original_amount_kobo, currency, stage, stage_reason,
                  days_past_due, pd_12m, pd_lifetime, lgd, ead_kobo, ecl_kobo,
                  ecl_12m_kobo, ecl_lifetime_kobo, collateral_value_kobo,
                  origination_date, maturity_date, last_review_date, sicr_triggered, write_off
           FROM ifrs9_exposures ORDER BY id"#,
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .iter()
        .map(|r| Exposure {
            id: r.get("id"),
            account_id: r.get("account_id"),
            customer_name: r.get("customer_name"),
            product_type: r.get("product_type"),
            outstanding_balance_kobo: r.get("outstanding_balance_kobo"),
            original_amount_kobo: r.get("original_amount_kobo"),
            currency: r.get("currency"),
            stage: r.get::<i16, _>("stage") as u8,
            stage_reason: r.get("stage_reason"),
            days_past_due: r.get::<i32, _>("days_past_due") as u32,
            pd_12m: r.get("pd_12m"),
            pd_lifetime: r.get("pd_lifetime"),
            lgd: r.get("lgd"),
            ead_kobo: r.get("ead_kobo"),
            ecl_kobo: r.get("ecl_kobo"),
            ecl_12m_kobo: r.get("ecl_12m_kobo"),
            ecl_lifetime_kobo: r.get("ecl_lifetime_kobo"),
            collateral_value_kobo: r.get("collateral_value_kobo"),
            origination_date: r.get("origination_date"),
            maturity_date: r.get("maturity_date"),
            last_review_date: r.get("last_review_date"),
            sicr_triggered: r.get("sicr_triggered"),
            write_off: r.get("write_off"),
        })
        .collect())
}

async fn fetch_transitions(db: &PgPool) -> Result<Vec<TransitionMatrix>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT from_rating, to_aaa, to_aa, to_a, to_bbb, to_bb, to_b, to_ccc, to_default
           FROM ifrs9_transition_matrix ORDER BY from_rating"#,
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .iter()
        .map(|r| TransitionMatrix {
            from_rating: r.get("from_rating"),
            to_aaa: r.get("to_aaa"),
            to_aa: r.get("to_aa"),
            to_a: r.get("to_a"),
            to_bbb: r.get("to_bbb"),
            to_bb: r.get("to_bb"),
            to_b: r.get("to_b"),
            to_ccc: r.get("to_ccc"),
            to_default: r.get("to_default"),
        })
        .collect())
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok"
    }))
}

async fn list_exposures(data: web::Data<AppState>) -> HttpResponse {
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve a fabricated exposure book"),
    };
    match fetch_exposures(db).await {
        Ok(e) if !e.is_empty() => {
            HttpResponse::Ok().json(serde_json::json!({ "items": e, "total": e.len() }))
        }
        Ok(_) => source_unavailable("ifrs9_exposures is empty — no exposure book available"),
        Err(err) => {
            eprintln!("[ifrs9-engine-rs] exposures query failed: {}", err);
            source_unavailable("ifrs9_exposures query failed; no data served")
        }
    }
}

async fn transition_matrix(data: web::Data<AppState>) -> HttpResponse {
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve a fabricated transition matrix"),
    };
    match fetch_transitions(db).await {
        Ok(t) if !t.is_empty() => {
            HttpResponse::Ok().json(serde_json::json!({ "items": t, "total": t.len() }))
        }
        Ok(_) => source_unavailable("ifrs9_transition_matrix is empty — no rating data available"),
        Err(err) => {
            eprintln!("[ifrs9-engine-rs] transition matrix query failed: {}", err);
            source_unavailable("ifrs9_transition_matrix query failed; no data served")
        }
    }
}

// ── Middleware integration: TigerBeetle ledger + Kafka events ──────────────
// The IFRS9 impairment provision is posted to the ledger (Dr impairment charge
// 5100, Cr loan-loss provision 2600) and an event is published. Fire-and-forget
// raw HTTP (no extra crate dependency); an outage is logged, never fatal.
fn mw_tigerbeetle_url() -> String {
    std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "http://tigerbeetle-adapter:3000".to_string())
}
fn mw_kafka_url() -> String {
    std::env::var("KAFKA_REST_URL")
        .or_else(|_| std::env::var("KAFKA_BROKER_URL"))
        .unwrap_or_else(|_| "http://kafka-rest-proxy:8082".to_string())
}

async fn mw_http_post(url: &str, body: String) {
    use tokio::io::AsyncWriteExt;
    let stripped = match url.strip_prefix("http://") {
        Some(s) => s,
        None => return,
    };
    let (hostport, path) = match stripped.find('/') {
        Some(i) => (&stripped[..i], &stripped[i..]),
        None => (stripped, "/"),
    };
    let addr = if hostport.contains(':') {
        hostport.to_string()
    } else {
        format!("{}:80", hostport)
    };
    let connect = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await;
    let mut stream = match connect {
        Ok(Ok(s)) => s,
        _ => {
            eprintln!("[ifrs9-engine-rs] middleware post: connect failed {}", addr);
            return;
        }
    };
    let req = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, hostport, body.len(), body
    );
    let _ = stream.write_all(req.as_bytes()).await;
    let _ = stream.flush().await;
}

async fn mw_post_provision(exposure_id: &str, ecl_kobo: i64) {
    if ecl_kobo <= 0 {
        return;
    }
    let body = serde_json::json!({
        "transfers": [{
            "id": format!("ECL-{}", exposure_id),
            "debitAccount": "5100",
            "creditAccount": "2600",
            "amount": ecl_kobo,
            "currency": "NGN",
            "ledger": 1,
            "code": 5001,
            "flags": 0,
        }]
    })
    .to_string();
    mw_http_post(&format!("{}/transfers", mw_tigerbeetle_url()), body).await;
}

async fn mw_publish_provision_event(exposure_id: &str, ecl_kobo: i64, stage: u8) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let body = serde_json::json!({
        "eventType": "ifrs9.provision.posted",
        "service": "ifrs9-engine-rs",
        "exposureId": exposure_id,
        "eclKobo": ecl_kobo,
        "stage": stage,
        "timestampMs": ts,
    })
    .to_string();
    mw_http_post(&format!("{}/topics/ifrs9.provisions", mw_kafka_url()), body).await;
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
    let exposure_id = req.exposure_id.clone().unwrap_or_else(|| "unknown".to_string());
    mw_post_provision(&exposure_id, ecl_kobo).await;
    mw_publish_provision_event(&exposure_id, ecl_kobo, req.stage).await;
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
    let db = match &data.db {
        Some(d) => d,
        None => return source_unavailable("DATABASE_URL not configured; refusing to serve a fabricated ECL summary"),
    };
    let exposures = match fetch_exposures(db).await {
        Ok(e) if !e.is_empty() => e,
        Ok(_) => return source_unavailable("ifrs9_exposures is empty — no ECL summary available"),
        Err(err) => {
            eprintln!("[ifrs9-engine-rs] summary query failed: {}", err);
            return source_unavailable("ifrs9_exposures query failed; no data served");
        }
    };
    let e = &exposures;
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
    let db = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            match PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(&url)
                .await
            {
                Ok(p) => Some(p),
                Err(e) => {
                    eprintln!("[ifrs9-engine-rs] DB connect failed: {} — book endpoints will 503 (fail-fast)", e);
                    None
                }
            }
        }
        _ => {
            eprintln!("[ifrs9-engine-rs] DATABASE_URL not set — book endpoints will 503 (fail-fast)");
            None
        }
    };
    let _ = env_or("PORT", "8164");
    let state = web::Data::new(AppState { db });
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
