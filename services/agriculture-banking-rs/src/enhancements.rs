use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// B4: Agriculture Banking Enhancements
// Weather integration, USSD channel, warehouse receipt financing

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherData {
    pub id: String,
    pub region: String,
    pub temperature_c: f64,
    pub rainfall_mm: f64,
    pub humidity_pct: f64,
    pub forecast: String, // sunny, rainy, drought, flood_risk
    pub crop_advisory: String,
    pub risk_level: String, // low, moderate, high, critical
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct USSDSession {
    pub session_id: String,
    pub msisdn: String,
    pub menu_state: String,
    pub farmer_id: String,
    pub language: String, // en, ha, yo, ig
    pub last_input: String,
    pub response_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarehouseReceipt {
    pub id: String,
    pub farmer_id: String,
    pub commodity: String,
    pub quantity_kg: f64,
    pub grade: String,     // A, B, C
    pub warehouse_id: String,
    pub market_price_per_kg: f64,
    pub total_value: f64,
    pub financing_available: f64, // 70% of total value
    pub status: String,    // deposited, financed, released, expired
    pub deposit_date: String,
    pub expiry_date: String,
}

pub struct AgriEnhState {
    pub weather: Mutex<Vec<WeatherData>>,
    pub ussd_sessions: Mutex<Vec<USSDSession>>,
    pub warehouse_receipts: Mutex<Vec<WarehouseReceipt>>,
}

impl AgriEnhState {
    pub fn new() -> Self {
        Self {
            weather: Mutex::new(Vec::new()),
            ussd_sessions: Mutex::new(Vec::new()),
            warehouse_receipts: Mutex::new(Vec::new()),
        }
    }
}

pub async fn get_weather(state: web::Data<AgriEnhState>) -> HttpResponse {
    let data = state.weather.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "weather": *data,
        "total": data.len()
    }))
}

#[derive(Deserialize)]
pub struct WeatherInput {
    pub region: Option<String>,
    pub temperature_c: Option<f64>,
    pub rainfall_mm: Option<f64>,
    pub humidity_pct: Option<f64>,
}

pub async fn report_weather(
    state: web::Data<AgriEnhState>,
    body: web::Json<WeatherInput>,
) -> HttpResponse {
    let region = body.region.clone().unwrap_or_default();
    let rainfall = body.rainfall_mm.unwrap_or(0.0);
    let temp = body.temperature_c.unwrap_or(30.0);

    let (forecast, risk_level, advisory) = if rainfall > 200.0 {
        ("flood_risk", "critical", "Move livestock to higher ground. Delay planting.")
    } else if rainfall < 10.0 && temp > 38.0 {
        ("drought", "high", "Implement irrigation. Consider drought-resistant varieties.")
    } else if rainfall > 50.0 {
        ("rainy", "moderate", "Good conditions for planting. Monitor drainage.")
    } else {
        ("sunny", "low", "Normal conditions. Proceed with regular farming activities.")
    };

    let wd = WeatherData {
        id: format!("WX-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        region,
        temperature_c: temp,
        rainfall_mm: rainfall,
        humidity_pct: body.humidity_pct.unwrap_or(65.0),
        forecast: forecast.to_string(),
        crop_advisory: advisory.to_string(),
        risk_level: risk_level.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let mut data = state.weather.lock().unwrap();
    data.push(wd.clone());
    HttpResponse::Created().json(wd)
}

#[derive(Deserialize)]
pub struct USSDInput {
    pub msisdn: Option<String>,
    pub input: Option<String>,
    pub language: Option<String>,
}

pub async fn ussd_handler(
    state: web::Data<AgriEnhState>,
    body: web::Json<USSDInput>,
) -> HttpResponse {
    let msisdn = body.msisdn.clone().unwrap_or_default();
    let input = body.input.clone().unwrap_or("0".to_string());
    let lang = body.language.clone().unwrap_or("en".to_string());

    let response = match input.as_str() {
        "0" | "" => "Welcome to 54Bank AgriBank\n1. Check Balance\n2. Loan Status\n3. Weather\n4. Market Prices\n5. Warehouse Receipts",
        "1" => "Your balance: NGN 125,000.00\nAvailable: NGN 120,000.00",
        "2" => "Active Loans: 1\nLoan AGR-001: NGN 500,000\nStatus: Current\nNext payment: NGN 48,500 on 2026-06-01",
        "3" => "Weather for your area:\nTemp: 32°C\nRainfall: 45mm expected\nAdvisory: Good planting conditions",
        "4" => "Market Prices (per kg):\nMaize: NGN 450\nRice: NGN 780\nCassava: NGN 180\nYam: NGN 350",
        "5" => "Warehouse Receipts:\n1. WR-001: 2000kg Maize (Grade A)\n   Value: NGN 900,000\n   Financing: NGN 630,000",
        _ => "Invalid selection. Please try again.\n0. Main Menu",
    };

    let session = USSDSession {
        session_id: format!("USSD-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        msisdn: msisdn.clone(),
        menu_state: input.clone(),
        farmer_id: format!("FMR-{}", &msisdn[msisdn.len().saturating_sub(4)..]),
        language: lang,
        last_input: input,
        response_text: response.to_string(),
    };

    let mut sessions = state.ussd_sessions.lock().unwrap();
    sessions.push(session.clone());
    HttpResponse::Ok().json(session)
}

#[derive(Deserialize)]
pub struct WarehouseInput {
    pub farmer_id: Option<String>,
    pub commodity: Option<String>,
    pub quantity_kg: Option<f64>,
    pub grade: Option<String>,
    pub warehouse_id: Option<String>,
    pub market_price_per_kg: Option<f64>,
}

pub async fn list_warehouse_receipts(state: web::Data<AgriEnhState>) -> HttpResponse {
    let receipts = state.warehouse_receipts.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "receipts": *receipts,
        "total": receipts.len()
    }))
}

pub async fn create_warehouse_receipt(
    state: web::Data<AgriEnhState>,
    body: web::Json<WarehouseInput>,
) -> HttpResponse {
    let qty = body.quantity_kg.unwrap_or(0.0);
    let price = body.market_price_per_kg.unwrap_or(0.0);
    let total_value = qty * price;
    let financing = total_value * 0.70; // 70% LTV for warehouse receipts

    let receipt = WarehouseReceipt {
        id: format!("WR-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        farmer_id: body.farmer_id.clone().unwrap_or_default(),
        commodity: body.commodity.clone().unwrap_or_default(),
        quantity_kg: qty,
        grade: body.grade.clone().unwrap_or("B".to_string()),
        warehouse_id: body.warehouse_id.clone().unwrap_or("WH-LAGOS-01".to_string()),
        market_price_per_kg: price,
        total_value,
        financing_available: financing,
        status: "deposited".to_string(),
        deposit_date: chrono::Utc::now().to_rfc3339(),
        expiry_date: (chrono::Utc::now() + chrono::Duration::days(180)).to_rfc3339(),
    };

    let mut receipts = state.warehouse_receipts.lock().unwrap();
    receipts.push(receipt.clone());
    HttpResponse::Created().json(receipt)
}
