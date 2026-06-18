use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mortgage {
    pub id: String,
    pub tenant_id: String,
    pub applicant_id: String,
    pub applicant_name: String,
    pub property_value: f64,
    pub loan_amount: f64,
    pub down_payment: f64,
    pub interest_rate_pct: f64,
    pub tenor_months: i32,
    pub mortgage_type: String,
    pub emi: f64,
    pub total_repayable: f64,
    pub total_interest: f64,
    pub total_repaid: f64,
    pub outstanding_balance: f64,
    pub ltv_pct: f64,
    pub ltv_grade: String,
    pub dti_ratio: f64,
    pub affordable: bool,
    pub monthly_income: f64,
    pub property_address: String,
    pub property_type: String,
    pub status: String,
    pub schedule: Vec<AmortizationEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disbursed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmortizationEntry {
    pub month: i32,
    pub emi: f64,
    pub principal: f64,
    pub interest: f64,
    pub balance: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMortgageRequest {
    pub applicant_id: String,
    pub applicant_name: String,
    pub property_value: f64,
    pub loan_amount: f64,
    pub monthly_income: f64,
    pub interest_rate_pct: Option<f64>,
    pub tenor_months: Option<i32>,
    pub mortgage_type: Option<String>,
    pub property_address: Option<String>,
    pub property_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepayRequest {
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MortgagePayment {
    pub id: String,
    pub mortgage_id: String,
    pub amount: f64,
    pub payment_type: String,
    pub outstanding_after: f64,
    pub created_at: String,
}
