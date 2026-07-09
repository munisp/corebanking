#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use chrono::{NaiveDate, Datelike};
use std::env;

// Day-Count Convention Engine for Nigerian Banking
// Supports: Actual/365, Actual/360, 30/360 (ISDA), 30E/360 (Eurobond), Actual/Actual

#[derive(Deserialize, Clone, Copy)]
enum DayCountConvention {
    #[serde(rename = "actual_365")]
    Actual365,
    #[serde(rename = "actual_360")]
    Actual360,
    #[serde(rename = "30_360")]
    Thirty360,
    #[serde(rename = "30e_360")]
    ThirtyE360,
    #[serde(rename = "actual_actual")]
    ActualActual,
}

fn day_count_fraction(start: NaiveDate, end: NaiveDate, convention: DayCountConvention) -> (i64, f64) {
    match convention {
        DayCountConvention::Actual365 => {
            let days = (end - start).num_days();
            (days, days as f64 / 365.0)
        }
        DayCountConvention::Actual360 => {
            let days = (end - start).num_days();
            (days, days as f64 / 360.0)
        }
        DayCountConvention::Thirty360 => {
            let mut d1 = start.day() as i64;
            let mut d2 = end.day() as i64;
            let m1 = start.month() as i64;
            let m2 = end.month() as i64;
            let y1 = start.year() as i64;
            let y2 = end.year() as i64;
            if d1 == 31 { d1 = 30; }
            if d2 == 31 && d1 >= 30 { d2 = 30; }
            let days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
            (days, days as f64 / 360.0)
        }
        DayCountConvention::ThirtyE360 => {
            let mut d1 = start.day().min(30) as i64;
            let mut d2 = end.day().min(30) as i64;
            let m1 = start.month() as i64;
            let m2 = end.month() as i64;
            let y1 = start.year() as i64;
            let y2 = end.year() as i64;
            let days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
            (days, days as f64 / 360.0)
        }
        DayCountConvention::ActualActual => {
            let days = (end - start).num_days();
            let year = start.year();
            let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
            let year_days = if is_leap { 366.0 } else { 365.0 };
            (days, days as f64 / year_days)
        }
    }
}

fn calculate_interest_kobo(principal_kobo: i64, annual_rate_pct: f64, fraction: f64) -> i64 {
    let interest = principal_kobo as f64 * (annual_rate_pct / 100.0) * fraction;
    interest.round() as i64
}

#[derive(Deserialize)]
struct AccrueRequest {
    principal_kobo: i64,
    annual_rate_pct: f64,
    start_date: String,
    end_date: String,
    convention: DayCountConvention,
    compounding: Option<String>, // "simple", "daily", "monthly"
}

async fn accrue(body: web::Json<AccrueRequest>) -> HttpResponse {
    let start = match NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d") {
        Ok(d) => d, Err(_) => return HttpResponse::BadRequest().json(json!({"error": "invalid start_date"})),
    };
    let end = match NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d") {
        Ok(d) => d, Err(_) => return HttpResponse::BadRequest().json(json!({"error": "invalid end_date"})),
    };
    
    let (days, fraction) = day_count_fraction(start, end, body.convention);
    let compounding = body.compounding.as_deref().unwrap_or("simple");
    
    let interest_kobo = match compounding {
        "daily" => {
            let daily_rate = body.annual_rate_pct / 100.0 / 365.0;
            let factor = (1.0 + daily_rate).powi(days as i32);
            ((body.principal_kobo as f64 * factor) - body.principal_kobo as f64).round() as i64
        }
        "monthly" => {
            let months = days / 30;
            let monthly_rate = body.annual_rate_pct / 100.0 / 12.0;
            let factor = (1.0 + monthly_rate).powi(months as i32);
            ((body.principal_kobo as f64 * factor) - body.principal_kobo as f64).round() as i64
        }
        _ => calculate_interest_kobo(body.principal_kobo, body.annual_rate_pct, fraction),
    };
    
    HttpResponse::Ok().json(json!({
        "principal_kobo": body.principal_kobo,
        "interest_kobo": interest_kobo,
        "total_kobo": body.principal_kobo + interest_kobo,
        "annual_rate_pct": body.annual_rate_pct,
        "days": days,
        "day_count_fraction": fraction,
        "compounding": compounding,
        "start_date": body.start_date,
        "end_date": body.end_date,
    }))
}

async fn compare_conventions(body: web::Json<AccrueRequest>) -> HttpResponse {
    let start = NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d").unwrap();
    let end = NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d").unwrap();
    let conventions = vec![
        ("actual_365", DayCountConvention::Actual365),
        ("actual_360", DayCountConvention::Actual360),
        ("30_360", DayCountConvention::Thirty360),
        ("30e_360", DayCountConvention::ThirtyE360),
        ("actual_actual", DayCountConvention::ActualActual),
    ];
    let results: Vec<serde_json::Value> = conventions.iter().map(|(name, conv)| {
        let (days, fraction) = day_count_fraction(start, end, *conv);
        let interest = calculate_interest_kobo(body.principal_kobo, body.annual_rate_pct, fraction);
        json!({"convention": name, "days": days, "fraction": fraction, "interest_kobo": interest})
    }).collect();
    HttpResponse::Ok().json(json!({"comparisons": results}))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "daycount-engine-rs", "version": "1.0.0",
        "conventions": ["actual_365", "actual_360", "30_360", "30e_360", "actual_actual"]}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9045);
    eprintln!("[daycount-engine-rs] Starting on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/interest/accrue", web::post().to(accrue))
            .route("/api/v1/interest/compare", web::post().to(compare_conventions))
    }).bind(("0.0.0.0", port))?.run().await
}
