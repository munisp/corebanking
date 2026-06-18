use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Farmer {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub bvn: String,
    pub phone: String,
    pub region: String,
    pub local_government: String,
    pub farm_size_hectares: f64,
    pub primary_crop: String,
    pub secondary_crops: Vec<String>,
    pub cooperative_id: Option<String>,
    pub cooperative_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub risk_score: f64,
    pub risk_tier: String,
    pub status: String,
    pub geo_coordinates: Option<GeoCoordinates>,
    pub registration_channel: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoCoordinates {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFarmerRequest {
    pub tenant_id: Option<String>,
    pub name: String,
    pub bvn: String,
    pub phone: String,
    pub region: String,
    pub local_government: String,
    pub farm_size_hectares: f64,
    pub primary_crop: String,
    pub secondary_crops: Option<Vec<String>>,
    pub cooperative_id: Option<String>,
    pub cooperative_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub geo_coordinates: Option<GeoCoordinates>,
    pub registration_channel: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgriLoan {
    pub id: String,
    pub tenant_id: String,
    pub farmer_id: String,
    pub farmer_name: String,
    pub loan_type: String,
    pub product_code: String,
    pub principal_amount: f64,
    pub interest_rate_bps: u32,
    pub tenor_months: u32,
    pub currency: String,
    pub purpose: String,
    pub collateral_type: String,
    pub collateral_value: f64,
    pub crop_cycle: String,
    pub expected_harvest_date: String,
    pub disbursement_date: Option<String>,
    pub maturity_date: Option<String>,
    pub outstanding_balance: f64,
    pub total_repaid: f64,
    pub status: String,
    pub approval_status: String,
    pub risk_grade: String,
    pub repayment_schedule: Vec<RepaymentInstalment>,
    pub middleware: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepaymentInstalment {
    pub instalment_number: u32,
    pub due_date: String,
    pub principal: f64,
    pub interest: f64,
    pub total: f64,
    pub status: String,
    pub paid_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgriLoanRequest {
    pub tenant_id: Option<String>,
    pub farmer_id: String,
    pub loan_type: String,
    pub principal_amount: f64,
    pub interest_rate_bps: Option<u32>,
    pub tenor_months: u32,
    pub currency: Option<String>,
    pub purpose: String,
    pub collateral_type: String,
    pub collateral_value: f64,
    pub crop_cycle: String,
    pub expected_harvest_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropInsurancePolicy {
    pub id: String,
    pub tenant_id: String,
    pub farmer_id: String,
    pub farmer_name: String,
    pub policy_type: String,
    pub crop_covered: String,
    pub coverage_area_hectares: f64,
    pub sum_insured: f64,
    pub premium_amount: f64,
    pub premium_frequency: String,
    pub policy_start: String,
    pub policy_end: String,
    pub weather_trigger_threshold: Option<WeatherTrigger>,
    pub claims: Vec<InsuranceClaim>,
    pub status: String,
    pub underwriter: String,
    pub middleware: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherTrigger {
    pub trigger_type: String,
    pub threshold_value: f64,
    pub measurement_unit: String,
    pub monitoring_station_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsuranceClaim {
    pub claim_id: String,
    pub filed_date: String,
    pub reason: String,
    pub amount_claimed: f64,
    pub amount_approved: Option<f64>,
    pub status: String,
    pub assessment_notes: Option<String>,
    pub resolved_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCropInsuranceRequest {
    pub tenant_id: Option<String>,
    pub farmer_id: String,
    pub policy_type: String,
    pub crop_covered: String,
    pub coverage_area_hectares: f64,
    pub sum_insured: f64,
    pub premium_amount: f64,
    pub premium_frequency: Option<String>,
    pub policy_start: String,
    pub policy_end: String,
    pub weather_trigger_threshold: Option<WeatherTrigger>,
    pub underwriter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValueChainContract {
    pub id: String,
    pub tenant_id: String,
    pub contract_type: String,
    pub buyer_name: String,
    pub buyer_id: String,
    pub seller_farmer_id: String,
    pub seller_farmer_name: String,
    pub commodity: String,
    pub quantity_tonnes: f64,
    pub price_per_tonne: f64,
    pub total_value: f64,
    pub currency: String,
    pub delivery_location: String,
    pub delivery_deadline: String,
    pub warehouse_receipt_id: Option<String>,
    pub quality_grade: String,
    pub milestones: Vec<ContractMilestone>,
    pub status: String,
    pub middleware: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractMilestone {
    pub milestone_id: String,
    pub stage: String,
    pub description: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub evidence_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateValueChainRequest {
    pub tenant_id: Option<String>,
    pub contract_type: String,
    pub buyer_name: String,
    pub buyer_id: String,
    pub seller_farmer_id: String,
    pub commodity: String,
    pub quantity_tonnes: f64,
    pub price_per_tonne: f64,
    pub currency: Option<String>,
    pub delivery_location: String,
    pub delivery_deadline: String,
    pub quality_grade: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepaymentRequest {
    pub amount: f64,
    pub payment_reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileClaimRequest {
    pub reason: String,
    pub amount_claimed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordMilestoneRequest {
    pub stage: String,
    pub description: String,
    pub evidence_url: Option<String>,
}
