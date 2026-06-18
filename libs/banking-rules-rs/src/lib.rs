//! banking_rules — Shared Nigerian banking domain logic for Rust services.
//! All monetary amounts are in kobo (i64) to avoid float precision errors.

use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;

// ─── Monetary Type ──────────────────────────────────────────────────────────

/// AmountKobo: money in smallest unit (kobo = 1/100 Naira). Never use f64 for money.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct AmountKobo(pub i64);

impl AmountKobo {
    pub fn from_naira(naira: f64) -> Self { Self((naira * 100.0).round() as i64) }
    pub fn naira(&self) -> f64 { self.0 as f64 / 100.0 }
    pub fn kobo(&self) -> i64 { self.0 }
}

impl std::ops::Add for AmountKobo {
    type Output = Self;
    fn add(self, other: Self) -> Self { Self(self.0 + other.0) }
}

impl std::ops::Sub for AmountKobo {
    type Output = Self;
    fn sub(self, other: Self) -> Self { Self(self.0 - other.0) }
}

impl std::fmt::Display for AmountKobo {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "₦{}.{:02}", self.0 / 100, (self.0 % 100).abs())
    }
}

// ─── CBN Tiered KYC Limits ──────────────────────────────────────────────────

pub struct TierLimits {
    pub max_single_debit: AmountKobo,
    pub max_daily: AmountKobo,
    pub max_balance: AmountKobo,
}

pub fn cbn_tier_limits(tier: &str) -> Option<TierLimits> {
    match tier {
        "tier1" => Some(TierLimits { max_single_debit: AmountKobo(5_000_000), max_daily: AmountKobo(30_000_000), max_balance: AmountKobo(30_000_000) }),
        "tier2" => Some(TierLimits { max_single_debit: AmountKobo(20_000_000), max_daily: AmountKobo(50_000_000), max_balance: AmountKobo(50_000_000) }),
        "tier3" => Some(TierLimits { max_single_debit: AmountKobo(500_000_000), max_daily: AmountKobo(1_000_000_000), max_balance: AmountKobo(0) }),
        _ => None,
    }
}

pub fn validate_tier_transaction(tier: &str, amount: AmountKobo, daily_total: AmountKobo) -> Result<(), String> {
    let limits = cbn_tier_limits(tier).ok_or_else(|| "unknown KYC tier".to_string())?;
    if amount > limits.max_single_debit {
        return Err(format!("exceeds {} single debit limit {}", tier, limits.max_single_debit));
    }
    if AmountKobo(daily_total.0 + amount.0) > limits.max_daily {
        return Err(format!("exceeds {} daily cumulative limit {}", tier, limits.max_daily));
    }
    Ok(())
}

// ─── NUBAN Validation ───────────────────────────────────────────────────────

pub fn validate_nuban(bank_code: &str, account_number: &str) -> Result<(), String> {
    if account_number.len() != 10 {
        return Err("NUBAN must be 10 digits".into());
    }
    if bank_code.len() != 3 {
        return Err("bank code must be 3 digits".into());
    }
    let serial: Vec<u8> = format!("{}{}", bank_code, &account_number[..9])
        .bytes().map(|b| b - b'0').collect();
    let weights: [u8; 12] = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    let total: u32 = serial.iter().zip(weights.iter())
        .map(|(d, w)| *d as u32 * *w as u32).sum();
    let check_digit = ((10 - (total % 10)) % 10) as u8;
    let actual = account_number.as_bytes()[9] - b'0';
    if check_digit != actual {
        return Err(format!("NUBAN check digit mismatch: expected {}", check_digit));
    }
    Ok(())
}

// ─── BVN / NIN Validation ───────────────────────────────────────────────────

pub fn validate_bvn(bvn: &str) -> Result<(), String> {
    if bvn.len() != 11 { return Err("BVN must be 11 digits".into()); }
    if !bvn.chars().all(|c| c.is_ascii_digit()) { return Err("BVN must contain only digits".into()); }
    if &bvn[..2] == "00" { return Err("invalid BVN issuer code".into()); }
    Ok(())
}

pub fn validate_nin(nin: &str) -> Result<(), String> {
    if nin.len() != 11 { return Err("NIN must be 11 digits".into()); }
    if !nin.chars().all(|c| c.is_ascii_digit()) { return Err("NIN must contain only digits".into()); }
    Ok(())
}

// ─── NFIU Threshold Reporting ───────────────────────────────────────────────

pub fn check_nfiu_threshold(amount: AmountKobo, txn_type: &str) -> Option<String> {
    match txn_type {
        "cash_deposit" | "cash_withdrawal" => {
            if amount.0 >= 500_000_000 { Some("NFIU: Cash ≥₦5M requires CTR".into()) } else { None }
        }
        "transfer" | "wire" => {
            if amount.0 >= 1_000_000_000 { Some("NFIU: Transfer ≥₦10M requires CTR".into()) } else { None }
        }
        _ => None,
    }
}

// ─── AML Risk Scoring ───────────────────────────────────────────────────────

pub struct AMLFactors {
    pub is_pep: bool,
    pub is_high_risk_country: bool,
    pub cash_intensive: bool,
    pub is_structuring: bool,
    pub has_adverse_media: bool,
    pub txn_amount: AmountKobo,
    pub account_age_months: u32,
}

pub fn compute_aml_risk_score(f: &AMLFactors) -> (f64, Vec<&'static str>) {
    let mut score = 0.0;
    let mut indicators = Vec::new();
    if f.is_pep { score += 30.0; indicators.push("PEP_STATUS"); }
    if f.is_high_risk_country { score += 25.0; indicators.push("HIGH_RISK_JURISDICTION"); }
    if f.cash_intensive { score += 15.0; indicators.push("CASH_INTENSIVE"); }
    if f.is_structuring { score += 35.0; indicators.push("STRUCTURING_DETECTED"); }
    if f.has_adverse_media { score += 20.0; indicators.push("ADVERSE_MEDIA"); }
    if f.txn_amount.0 > 1_000_000_000 { score += 10.0; indicators.push("HIGH_VALUE_TXN"); }
    if f.account_age_months < 3 { score += 10.0; indicators.push("NEW_ACCOUNT"); }
    (score.min(100.0), indicators)
}

pub fn detect_structuring(amounts: &[AmountKobo], threshold: AmountKobo) -> bool {
    let floor = AmountKobo((threshold.0 as f64 * 0.8) as i64);
    let count = amounts.iter().filter(|a| **a >= floor && **a < threshold).count();
    count >= 3
}

// ─── Financial Calculations ─────────────────────────────────────────────────

pub fn compute_emi(principal: AmountKobo, annual_rate_pct: f64, tenor_months: u32) -> AmountKobo {
    if tenor_months == 0 { return AmountKobo(0); }
    if annual_rate_pct == 0.0 { return AmountKobo(principal.0 / tenor_months as i64); }
    let r = annual_rate_pct / 12.0 / 100.0;
    let n = tenor_months as f64;
    let p = principal.0 as f64;
    let power = (1.0 + r).powf(n);
    let emi = p * r * power / (power - 1.0);
    AmountKobo((emi + 0.5) as i64)
}

pub fn compute_dti(monthly_income: AmountKobo, existing_debt: AmountKobo, proposed_emi: AmountKobo) -> f64 {
    if monthly_income.0 <= 0 { return 100.0; }
    (existing_debt.0 + proposed_emi.0) as f64 / monthly_income.0 as f64 * 100.0
}

pub fn compute_daily_accrual(principal: AmountKobo, annual_rate_pct: f64, day_basis: u32) -> AmountKobo {
    let basis = if day_basis == 0 { 365 } else { day_basis };
    let daily = principal.0 as f64 * annual_rate_pct / 100.0 / basis as f64;
    AmountKobo((daily + 0.5) as i64)
}

pub fn provisioning_rate(days_past_due: u32) -> f64 {
    match days_past_due {
        0..=90 => 1.0,
        91..=180 => 10.0,
        181..=360 => 50.0,
        361..=720 => 75.0,
        _ => 100.0,
    }
}

pub fn compute_wht(interest: AmountKobo) -> AmountKobo {
    AmountKobo((interest.0 as f64 * 0.10) as i64)
}

// ─── State Machine ──────────────────────────────────────────────────────────

pub fn banking_transitions() -> HashMap<&'static str, Vec<&'static str>> {
    let mut m = HashMap::new();
    m.insert("draft", vec!["submitted", "cancelled"]);
    m.insert("submitted", vec!["under_review", "rejected", "cancelled"]);
    m.insert("under_review", vec!["approved", "rejected"]);
    m.insert("approved", vec!["processing", "cancelled"]);
    m.insert("processing", vec!["completed", "failed"]);
    m.insert("completed", vec!["reversed"]);
    m.insert("failed", vec!["submitted"]);
    m
}

pub fn can_transition(from: &str, to: &str, transitions: &HashMap<&str, Vec<&str>>) -> bool {
    transitions.get(from).map_or(false, |allowed| allowed.contains(&to))
}

// ─── Idempotency ────────────────────────────────────────────────────────────

pub fn compute_idempotency_hash(method: &str, path: &str, body: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}:", method, path).as_bytes());
    hasher.update(body);
    format!("{:x}", hasher.finalize())[..32].to_string()
}

// ─── Maker-Checker ──────────────────────────────────────────────────────────

pub fn requires_maker_checker(operation: &str, amount: AmountKobo) -> bool {
    let threshold = match operation {
        "transfer" => 100_000_000,      // ₦1M
        "loan_disburse" => 100_000_000, // ₦1M
        "gl_posting" => 50_000_000,     // ₦500K
        "account_close" => 0,           // Always
        _ => 100_000_000,               // Default ₦1M
    };
    amount.0 >= threshold
}

// ─── PII Masking (NDPR) ─────────────────────────────────────────────────────

pub fn mask_pii(value: &str, field_type: &str) -> String {
    if value.is_empty() { return "***".into(); }
    match field_type {
        "bvn" | "nin" => {
            if value.len() >= 4 { format!("***{}", &value[value.len()-4..]) } else { "***".into() }
        }
        "account" => {
            if value.len() >= 4 { format!("****{}", &value[value.len()-4..]) } else { "****".into() }
        }
        "phone" => {
            if value.len() >= 4 { format!("+234***{}", &value[value.len()-4..]) } else { "+234***".into() }
        }
        "email" => {
            if let Some(at) = value.find('@') {
                if at > 0 { format!("{}***@{}", &value[..1], &value[at+1..]) } else { "***".into() }
            } else { "***".into() }
        }
        _ => "***".into(),
    }
}
