"""
54Bank ML Inference Client — Integrates with ML Pipeline (port 8500)
Provides real-time scoring for fraud, credit, AML, anomaly, and churn models.
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

logger = logging.getLogger("54bank.ml_client")

ML_INFERENCE_URL = os.environ.get("ML_INFERENCE_URL", "http://ml-inference-server:8500")


def _call_ml(endpoint: str, payload: Dict[str, Any], timeout: float = 5.0) -> Optional[Dict[str, Any]]:
    """Make HTTP POST to ML inference server with timeout and error handling."""
    url = f"{ML_INFERENCE_URL}{endpoint}"
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        logger.warning(f"ML inference unavailable ({endpoint}): {e}")
        return None
    except Exception as e:
        logger.error(f"ML inference error ({endpoint}): {e}")
        return None


def score_fraud(amount: float, hour: int, day_of_week: int, velocity_1h: int,
                velocity_24h: int, amount_vs_avg: float, geo_distance_km: float = 0,
                device_age_days: int = 365, is_new_beneficiary: int = 0,
                is_international: int = 0, account_age_days: int = 365,
                balance_ratio: float = 0.1) -> Optional[Dict[str, Any]]:
    """Score a transaction for fraud probability using ML model.
    
    Returns: {"predictions": [{"fraud_probability": float, "risk_action": str}], "latency_ms": float}
    or None if ML service unavailable (fallback to rules).
    """
    return _call_ml("/v1/fraud/predict", {
        "amount": amount, "hour": hour, "day_of_week": day_of_week,
        "velocity_1h": velocity_1h, "velocity_24h": velocity_24h,
        "amount_vs_avg": amount_vs_avg, "geo_distance_km": geo_distance_km,
        "device_age_days": device_age_days, "is_new_beneficiary": is_new_beneficiary,
        "is_international": is_international, "account_age_days": account_age_days,
        "balance_ratio": balance_ratio
    })


def score_credit(age: int, monthly_income: int, total_debt: int, dti_ratio: float,
                 employment_years: int, num_prior_loans: int, num_defaults: int,
                 loan_amount_requested: int, loan_tenure_months: int,
                 collateral_value: int = 0, has_guarantor: int = 0,
                 account_age_months: int = 12, avg_monthly_balance: int = 0,
                 num_dependents: int = 0, sector_idx: int = 0,
                 state_idx: int = 0) -> Optional[Dict[str, Any]]:
    """Score a loan application using ML credit model.
    
    Returns: {"credit_score": float, "credit_band": str, "approved": bool, "max_loan_amount": float}
    or None if ML service unavailable.
    """
    return _call_ml("/v1/credit/predict", {
        "age": age, "monthly_income": monthly_income, "total_debt": total_debt,
        "dti_ratio": dti_ratio, "employment_years": employment_years,
        "num_prior_loans": num_prior_loans, "num_defaults": num_defaults,
        "loan_amount_requested": loan_amount_requested,
        "loan_tenure_months": loan_tenure_months,
        "collateral_value": collateral_value, "has_guarantor": has_guarantor,
        "account_age_months": account_age_months,
        "avg_monthly_balance": avg_monthly_balance,
        "num_dependents": num_dependents, "sector_idx": sector_idx,
        "state_idx": state_idx
    })


def score_aml(transaction_count_30d: int, unique_counterparties_30d: int,
              cash_ratio: float, international_ratio: float,
              avg_transaction_amount: float, max_transaction_amount: float,
              round_amount_ratio: float = 0, night_ratio: float = 0,
              structuring_score: float = 0, days_since_last_kyc_update: int = 30,
              pep_flag: int = 0, high_risk_country: int = 0,
              account_type_idx: int = 0, kyc_level_idx: int = 0) -> Optional[Dict[str, Any]]:
    """Score customer for AML risk using ML model.
    
    Returns: {"suspicious_probability": float, "risk_tier": str, "requires_str": bool, "requires_edd": bool}
    or None if ML service unavailable.
    """
    return _call_ml("/v1/aml/predict", {
        "transaction_count_30d": transaction_count_30d,
        "unique_counterparties_30d": unique_counterparties_30d,
        "cash_ratio": cash_ratio, "international_ratio": international_ratio,
        "avg_transaction_amount": avg_transaction_amount,
        "max_transaction_amount": max_transaction_amount,
        "round_amount_ratio": round_amount_ratio, "night_ratio": night_ratio,
        "structuring_score": structuring_score,
        "days_since_last_kyc_update": days_since_last_kyc_update,
        "pep_flag": pep_flag, "high_risk_country": high_risk_country,
        "account_type_idx": account_type_idx, "kyc_level_idx": kyc_level_idx
    })


def score_anomaly(amount: float, hour: int, day_of_week: int, velocity_1h: int,
                  velocity_24h: int, amount_vs_avg: float, balance_ratio: float,
                  merchant_cat_idx: int = 0, channel_idx: int = 0) -> Optional[Dict[str, Any]]:
    """Score a transaction for anomaly using ML model.
    
    Returns: {"anomaly_score": float, "is_anomaly": bool, "threshold": float}
    or None if ML service unavailable.
    """
    return _call_ml("/v1/anomaly/score", {
        "amount": amount, "hour": hour, "day_of_week": day_of_week,
        "velocity_1h": velocity_1h, "velocity_24h": velocity_24h,
        "amount_vs_avg": amount_vs_avg, "balance_ratio": balance_ratio,
        "merchant_cat_idx": merchant_cat_idx, "channel_idx": channel_idx
    })


def predict_churn(monthly_activity: list) -> Optional[Dict[str, Any]]:
    """Predict customer churn from 12-month activity history.
    
    monthly_activity: list of 12 lists, each with [txn_count, volume, logins, products, digital_flag, complaint_flag, balance, active_flag]
    Returns: {"churn_probability": float, "churn_risk": str, "attention_weights": list, "critical_months": list}
    or None if ML service unavailable.
    """
    return _call_ml("/v1/churn/predict", {"monthly_activity": monthly_activity})
