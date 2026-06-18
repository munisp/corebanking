#!/usr/bin/env python3
"""54Bank — Data & Model Drift Detection
Monitors production data distribution shifts and model performance degradation.

Drift types detected:
1. Feature drift — input distribution shift (KS test, PSI)
2. Prediction drift — output distribution shift
3. Label drift — target distribution shift (delayed)
4. Concept drift — relationship between features and labels has changed (AUC drop)

Triggers retraining when drift exceeds configured thresholds.
"""
import json
import logging
import math
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger("54bank.continuous_training.drift")


@dataclass
class DriftResult:
    """Result of a drift detection check."""
    feature_name: str
    drift_type: str  # "feature", "prediction", "label", "concept"
    metric: str  # "ks_statistic", "psi", "auc_drop", "chi2"
    value: float
    threshold: float
    drifted: bool
    p_value: Optional[float] = None
    severity: str = "none"  # "none", "warning", "critical"

    def to_dict(self):
        return asdict(self)


@dataclass
class DriftReport:
    """Complete drift report for a model."""
    model_name: str
    timestamp: str
    reference_window: str
    current_window: str
    total_features_checked: int
    features_drifted: int
    overall_drift_detected: bool
    should_retrain: bool
    results: list
    prediction_drift: Optional[DriftResult] = None
    concept_drift: Optional[DriftResult] = None

    def to_dict(self):
        d = asdict(self)
        d["results"] = [r if isinstance(r, dict) else asdict(r) for r in self.results]
        if self.prediction_drift:
            d["prediction_drift"] = asdict(self.prediction_drift) if not isinstance(self.prediction_drift, dict) else self.prediction_drift
        if self.concept_drift:
            d["concept_drift"] = asdict(self.concept_drift) if not isinstance(self.concept_drift, dict) else self.concept_drift
        return d


class DriftDetector:
    """Detects data and model drift between reference and current distributions.

    Algorithms:
    - Kolmogorov-Smirnov test (numerical features)
    - Population Stability Index (PSI) for distribution shift
    - Chi-squared test (categorical features)
    - AUC degradation (concept drift)
    """

    DEFAULT_THRESHOLDS = {
        "ks_statistic": 0.10,       # KS statistic threshold
        "ks_p_value": 0.01,         # KS p-value threshold (reject H0 if p < threshold)
        "psi": 0.20,                # PSI > 0.20 = significant shift
        "chi2_p_value": 0.01,       # Chi-squared p-value
        "auc_drop": 0.05,           # AUC degradation threshold
        "prediction_ks": 0.10,      # Prediction distribution shift
        "label_shift": 0.03,        # Label ratio shift (absolute)
        "retrain_feature_pct": 0.30, # Retrain if >30% features drifted
    }

    # Feature configurations per model
    MODEL_FEATURES = {
        "fraud_detector": {
            "numerical": ["amount", "hour", "velocity_1h", "velocity_24h",
                          "amount_vs_avg", "geo_distance_km", "device_age_days",
                          "account_age_days", "balance_ratio"],
            "categorical": ["merchant_category", "channel", "card_type", "state"],
            "label": "is_fraud",
        },
        "credit_scorer": {
            "numerical": ["age", "monthly_income", "total_debt", "dti_ratio",
                          "employment_years", "num_prior_loans", "num_defaults",
                          "loan_amount_requested", "loan_tenure_months",
                          "collateral_value", "account_age_months",
                          "avg_monthly_balance", "num_dependents"],
            "categorical": ["sector", "state"],
            "label": "will_default",
        },
        "aml_scorer": {
            "numerical": ["transaction_count_30d", "unique_counterparties_30d",
                          "cash_ratio", "international_ratio",
                          "avg_transaction_amount", "max_transaction_amount",
                          "round_amount_ratio", "night_ratio",
                          "structuring_score", "days_since_last_kyc_update"],
            "categorical": ["account_type", "kyc_level"],
            "label": "is_suspicious",
        },
        "churn_predictor": {
            "numerical": ["transaction_count", "total_amount", "avg_balance",
                          "product_count", "complaint_count", "login_count",
                          "channel_diversity", "nps_score"],
            "categorical": [],
            "label": "churned",
        },
    }

    def __init__(self, thresholds: dict = None):
        self.thresholds = {**self.DEFAULT_THRESHOLDS, **(thresholds or {})}

    def compute_ks_test(self, reference: np.ndarray, current: np.ndarray) -> DriftResult:
        """Two-sample Kolmogorov-Smirnov test for numerical feature drift."""
        statistic, p_value = stats.ks_2samp(reference, current)
        threshold = self.thresholds["ks_statistic"]
        drifted = statistic > threshold and p_value < self.thresholds["ks_p_value"]

        severity = "none"
        if drifted:
            severity = "critical" if statistic > threshold * 2 else "warning"

        return DriftResult(
            feature_name="",  # filled by caller
            drift_type="feature",
            metric="ks_statistic",
            value=round(statistic, 6),
            threshold=threshold,
            drifted=drifted,
            p_value=round(p_value, 6),
            severity=severity,
        )

    def compute_psi(self, reference: np.ndarray, current: np.ndarray,
                    n_bins: int = 10) -> DriftResult:
        """Population Stability Index for distribution shift.
        PSI < 0.10: no shift
        PSI 0.10-0.20: moderate shift
        PSI > 0.20: significant shift
        """
        # Create bins from reference distribution
        ref_min, ref_max = reference.min(), reference.max()
        if ref_min == ref_max:
            return DriftResult(
                feature_name="", drift_type="feature", metric="psi",
                value=0.0, threshold=self.thresholds["psi"],
                drifted=False, severity="none",
            )

        bins = np.linspace(ref_min, ref_max, n_bins + 1)
        bins[0] = -np.inf
        bins[-1] = np.inf

        ref_counts = np.histogram(reference, bins=bins)[0]
        cur_counts = np.histogram(current, bins=bins)[0]

        # Add small constant to avoid log(0)
        ref_pct = (ref_counts + 1) / (len(reference) + n_bins)
        cur_pct = (cur_counts + 1) / (len(current) + n_bins)

        psi = np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct))
        threshold = self.thresholds["psi"]
        drifted = psi > threshold

        severity = "none"
        if psi > threshold * 2:
            severity = "critical"
        elif drifted:
            severity = "warning"

        return DriftResult(
            feature_name="", drift_type="feature", metric="psi",
            value=round(float(psi), 6), threshold=threshold,
            drifted=drifted, severity=severity,
        )

    def compute_chi2_test(self, reference: pd.Series, current: pd.Series) -> DriftResult:
        """Chi-squared test for categorical feature drift."""
        all_cats = set(reference.unique()) | set(current.unique())

        ref_counts = reference.value_counts()
        cur_counts = current.value_counts()

        ref_freq = np.array([ref_counts.get(c, 0) for c in all_cats])
        cur_freq = np.array([cur_counts.get(c, 0) for c in all_cats])

        # Normalize to expected frequencies
        total_ref = ref_freq.sum()
        total_cur = cur_freq.sum()
        if total_ref == 0 or total_cur == 0:
            return DriftResult(
                feature_name="", drift_type="feature", metric="chi2",
                value=0.0, threshold=self.thresholds["chi2_p_value"],
                drifted=False, severity="none",
            )

        expected = ref_freq * (total_cur / total_ref)
        expected = np.maximum(expected, 1e-8)

        chi2_stat, p_value = stats.chisquare(cur_freq, f_exp=expected)
        threshold = self.thresholds["chi2_p_value"]
        drifted = p_value < threshold

        return DriftResult(
            feature_name="", drift_type="feature", metric="chi2",
            value=round(float(chi2_stat), 4), threshold=threshold,
            drifted=drifted, p_value=round(float(p_value), 6),
            severity="warning" if drifted else "none",
        )

    def detect_feature_drift(self, model_name: str,
                              reference_df: pd.DataFrame,
                              current_df: pd.DataFrame) -> list:
        """Detect drift across all features for a model."""
        config = self.MODEL_FEATURES.get(model_name, {})
        numerical = config.get("numerical", [])
        categorical = config.get("categorical", [])
        results = []

        # Numerical features: KS test + PSI
        for feat in numerical:
            if feat not in reference_df.columns or feat not in current_df.columns:
                continue

            ref_vals = reference_df[feat].dropna().values
            cur_vals = current_df[feat].dropna().values

            if len(ref_vals) < 10 or len(cur_vals) < 10:
                continue

            # KS test
            ks_result = self.compute_ks_test(ref_vals, cur_vals)
            ks_result.feature_name = feat
            results.append(ks_result)

            # PSI
            psi_result = self.compute_psi(ref_vals, cur_vals)
            psi_result.feature_name = feat
            results.append(psi_result)

        # Categorical features: Chi-squared
        for feat in categorical:
            if feat not in reference_df.columns or feat not in current_df.columns:
                continue

            chi2_result = self.compute_chi2_test(reference_df[feat], current_df[feat])
            chi2_result.feature_name = feat
            results.append(chi2_result)

        return results

    def detect_prediction_drift(self, reference_predictions: np.ndarray,
                                 current_predictions: np.ndarray) -> DriftResult:
        """Detect shift in model prediction distribution."""
        ks_result = self.compute_ks_test(reference_predictions, current_predictions)
        ks_result.feature_name = "predictions"
        ks_result.drift_type = "prediction"
        ks_result.threshold = self.thresholds["prediction_ks"]
        ks_result.drifted = ks_result.value > self.thresholds["prediction_ks"]
        return ks_result

    def detect_label_drift(self, reference_labels: np.ndarray,
                            current_labels: np.ndarray,
                            label_name: str = "label") -> DriftResult:
        """Detect shift in label distribution (class balance change)."""
        ref_rate = reference_labels.mean()
        cur_rate = current_labels.mean()
        shift = abs(cur_rate - ref_rate)
        threshold = self.thresholds["label_shift"]
        drifted = shift > threshold

        return DriftResult(
            feature_name=label_name,
            drift_type="label",
            metric="rate_shift",
            value=round(shift, 6),
            threshold=threshold,
            drifted=drifted,
            severity="warning" if drifted else "none",
        )

    def detect_concept_drift(self, reference_auc: float,
                              current_auc: float) -> DriftResult:
        """Detect concept drift via AUC degradation."""
        auc_drop = reference_auc - current_auc
        threshold = self.thresholds["auc_drop"]
        drifted = auc_drop > threshold

        severity = "none"
        if auc_drop > threshold * 2:
            severity = "critical"
        elif drifted:
            severity = "warning"

        return DriftResult(
            feature_name="model_performance",
            drift_type="concept",
            metric="auc_drop",
            value=round(auc_drop, 6),
            threshold=threshold,
            drifted=drifted,
            severity=severity,
        )

    def full_drift_check(self, model_name: str,
                          reference_df: pd.DataFrame,
                          current_df: pd.DataFrame,
                          reference_predictions: np.ndarray = None,
                          current_predictions: np.ndarray = None,
                          reference_auc: float = None,
                          current_auc: float = None) -> DriftReport:
        """Run complete drift detection for a model."""
        config = self.MODEL_FEATURES.get(model_name, {})
        label_col = config.get("label")

        # Feature drift
        feature_results = self.detect_feature_drift(model_name, reference_df, current_df)

        # Prediction drift
        pred_drift = None
        if reference_predictions is not None and current_predictions is not None:
            pred_drift = self.detect_prediction_drift(reference_predictions, current_predictions)

        # Label drift
        label_drift = None
        if label_col and label_col in reference_df.columns and label_col in current_df.columns:
            ref_labels = reference_df[label_col].dropna().values
            cur_labels = current_df[label_col].dropna().values
            if len(ref_labels) > 0 and len(cur_labels) > 0:
                label_drift = self.detect_label_drift(ref_labels, cur_labels, label_col)
                feature_results.append(label_drift)

        # Concept drift
        concept_drift = None
        if reference_auc is not None and current_auc is not None:
            concept_drift = self.detect_concept_drift(reference_auc, current_auc)

        # Determine if retraining needed
        drifted_features = [r for r in feature_results if r.drifted]
        total_unique_features = len(set(r.feature_name for r in feature_results))
        drifted_unique = len(set(r.feature_name for r in drifted_features))
        drift_pct = drifted_unique / max(total_unique_features, 1)

        should_retrain = (
            drift_pct > self.thresholds["retrain_feature_pct"]
            or (concept_drift is not None and concept_drift.drifted)
            or any(r.severity == "critical" for r in feature_results)
        )

        report = DriftReport(
            model_name=model_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
            reference_window=f"{len(reference_df)} samples",
            current_window=f"{len(current_df)} samples",
            total_features_checked=total_unique_features,
            features_drifted=drifted_unique,
            overall_drift_detected=len(drifted_features) > 0,
            should_retrain=should_retrain,
            results=[r.to_dict() for r in feature_results],
            prediction_drift=pred_drift,
            concept_drift=concept_drift,
        )

        return report

    def save_report(self, report: DriftReport, output_dir: Path = None):
        """Save drift report as JSON."""
        out_dir = output_dir or Path(__file__).parent.parent / "weights"
        out_dir.mkdir(parents=True, exist_ok=True)

        filename = f"drift_report_{report.model_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        path = out_dir / filename

        with open(path, "w") as f:
            json.dump(report.to_dict(), f, indent=2, default=str)

        logger.info(f"Drift report saved: {path}")
        return path
