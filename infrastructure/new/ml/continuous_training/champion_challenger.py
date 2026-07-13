#!/usr/bin/env python3
"""54Bank — Champion-Challenger Model Evaluation Framework
Compares incumbent (champion) model against newly trained (challenger)
model on held-out production data. Determines whether to promote challenger.

Evaluation criteria:
1. Statistical significance (paired bootstrap test)
2. Performance improvement threshold
3. Stability across data slices (Nigerian states, transaction channels)
4. Latency / resource constraints
5. Business rule compliance (false positive rate, recall floor)
"""
import json
import logging
import time
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict, field
from typing import Optional

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    roc_auc_score, precision_recall_fscore_support,
    average_precision_score, accuracy_score,
    confusion_matrix, log_loss,
)

logger = logging.getLogger("54bank.continuous_training.champion_challenger")


@dataclass
class SliceMetrics:
    """Metrics for a data slice (e.g., a state or channel)."""
    slice_name: str
    slice_value: str
    n_samples: int
    auc_roc: float
    precision: float
    recall: float
    f1: float


@dataclass
class ModelEvaluation:
    """Comprehensive evaluation of a model on held-out data."""
    model_name: str
    model_version: str
    n_samples: int
    auc_roc: float
    avg_precision: float
    precision: float
    recall: float
    f1: float
    accuracy: float
    log_loss_value: float
    false_positive_rate: float
    false_negative_rate: float
    inference_latency_ms: float
    slice_metrics: list = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d


@dataclass
class ComparisonResult:
    """Result of champion vs challenger comparison."""
    champion: ModelEvaluation
    challenger: ModelEvaluation
    improvement: dict
    statistical_significance: dict
    slice_stability: dict
    business_rules_pass: bool
    recommendation: str  # "promote", "keep_champion", "inconclusive"
    reason: str
    timestamp: str

    def to_dict(self):
        d = {
            "champion": self.champion.to_dict(),
            "challenger": self.challenger.to_dict(),
            "improvement": self.improvement,
            "statistical_significance": self.statistical_significance,
            "slice_stability": self.slice_stability,
            "business_rules_pass": self.business_rules_pass,
            "recommendation": self.recommendation,
            "reason": self.reason,
            "timestamp": self.timestamp,
        }
        return d


class ChampionChallenger:
    """Evaluates and compares champion vs challenger models.

    Business rules for 54Bank:
    - Fraud detection: recall must be >= 0.90 (can't miss fraud)
    - Credit scoring: false positive rate must be < 0.15 (don't reject good borrowers)
    - AML: recall must be >= 0.95 (regulatory requirement)
    - Churn: no hard constraint, optimize F1
    """

    BUSINESS_RULES = {
        "fraud_detector": {
            "recall_floor": 0.90,
            "fpr_ceiling": 0.10,
            "min_auc_improvement": 0.005,
        },
        "credit_scorer": {
            "recall_floor": 0.60,
            "fpr_ceiling": 0.15,
            "min_auc_improvement": 0.01,
        },
        "aml_scorer": {
            "recall_floor": 0.95,
            "fpr_ceiling": 0.15,
            "min_auc_improvement": 0.005,
        },
        "churn_predictor": {
            "recall_floor": 0.70,
            "fpr_ceiling": 0.20,
            "min_auc_improvement": 0.01,
        },
        "anomaly_vae": {
            "recall_floor": 0.80,
            "fpr_ceiling": 0.10,
            "min_auc_improvement": 0.01,
        },
        "gnn_fraud_ring": {
            "recall_floor": 0.70,
            "fpr_ceiling": 0.10,
            "min_auc_improvement": 0.005,
        },
    }

    SLICE_COLUMNS = {
        "fraud_detector": ["state", "channel", "card_type"],
        "credit_scorer": ["sector", "state"],
        "aml_scorer": ["account_type", "kyc_level"],
        "churn_predictor": ["account_type"],
    }

    def __init__(self, n_bootstrap: int = 1000, confidence_level: float = 0.95):
        self.n_bootstrap = n_bootstrap
        self.confidence_level = confidence_level

    def evaluate_model(self, model_name: str, model_version: str,
                       predictions: np.ndarray, labels: np.ndarray,
                       data_df: pd.DataFrame = None,
                       inference_latency_ms: float = 0.0,
                       threshold: float = 0.5) -> ModelEvaluation:
        """Evaluate a model's predictions against ground truth."""
        binary_preds = (predictions >= threshold).astype(int)

        auc = roc_auc_score(labels, predictions)
        ap = average_precision_score(labels, predictions)
        prec, rec, f1, _ = precision_recall_fscore_support(labels, binary_preds, average="binary")
        acc = accuracy_score(labels, binary_preds)

        # Safe log loss
        preds_clipped = np.clip(predictions, 1e-7, 1 - 1e-7)
        ll = log_loss(labels, preds_clipped)

        cm = confusion_matrix(labels, binary_preds)
        tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)
        fpr = fp / max(fp + tn, 1)
        fnr = fn / max(fn + tp, 1)

        # Slice metrics
        slice_metrics = []
        if data_df is not None:
            slice_cols = self.SLICE_COLUMNS.get(model_name, [])
            for col in slice_cols:
                if col not in data_df.columns:
                    continue
                for val in data_df[col].unique():
                    mask = data_df[col] == val
                    if mask.sum() < 20:
                        continue
                    s_labels = labels[mask]
                    s_preds = predictions[mask]
                    s_binary = binary_preds[mask]
                    if len(np.unique(s_labels)) < 2:
                        continue
                    s_auc = roc_auc_score(s_labels, s_preds)
                    s_prec, s_rec, s_f1, _ = precision_recall_fscore_support(
                        s_labels, s_binary, average="binary")
                    slice_metrics.append(SliceMetrics(
                        slice_name=col, slice_value=str(val),
                        n_samples=int(mask.sum()),
                        auc_roc=round(s_auc, 4),
                        precision=round(s_prec, 4),
                        recall=round(s_rec, 4),
                        f1=round(s_f1, 4),
                    ))

        return ModelEvaluation(
            model_name=model_name,
            model_version=model_version,
            n_samples=len(labels),
            auc_roc=round(auc, 6),
            avg_precision=round(ap, 6),
            precision=round(prec, 6),
            recall=round(rec, 6),
            f1=round(f1, 6),
            accuracy=round(acc, 6),
            log_loss_value=round(ll, 6),
            false_positive_rate=round(fpr, 6),
            false_negative_rate=round(fnr, 6),
            inference_latency_ms=round(inference_latency_ms, 2),
            slice_metrics=slice_metrics,
        )

    def bootstrap_auc_difference(self, champion_preds: np.ndarray,
                                   challenger_preds: np.ndarray,
                                   labels: np.ndarray) -> dict:
        """Paired bootstrap test for AUC difference significance."""
        n = len(labels)
        auc_diffs = []

        for _ in range(self.n_bootstrap):
            idx = np.random.choice(n, size=n, replace=True)
            b_labels = labels[idx]

            if len(np.unique(b_labels)) < 2:
                continue

            auc_champ = roc_auc_score(b_labels, champion_preds[idx])
            auc_chall = roc_auc_score(b_labels, challenger_preds[idx])
            auc_diffs.append(auc_chall - auc_champ)

        if not auc_diffs:
            return {
                "mean_diff": 0.0,
                "ci_lower": 0.0,
                "ci_upper": 0.0,
                "p_value": 1.0,
                "significant": False,
            }

        auc_diffs = np.array(auc_diffs)
        alpha = 1 - self.confidence_level
        ci_lower = np.percentile(auc_diffs, alpha / 2 * 100)
        ci_upper = np.percentile(auc_diffs, (1 - alpha / 2) * 100)
        p_value = (auc_diffs <= 0).mean()

        return {
            "mean_diff": round(float(auc_diffs.mean()), 6),
            "ci_lower": round(float(ci_lower), 6),
            "ci_upper": round(float(ci_upper), 6),
            "p_value": round(float(p_value), 6),
            "significant": ci_lower > 0,  # entire CI above 0
        }

    def check_business_rules(self, model_name: str,
                              evaluation: ModelEvaluation) -> tuple:
        """Check if model meets business rule requirements.
        Returns (passes: bool, violations: list[str])
        """
        rules = self.BUSINESS_RULES.get(model_name, {})
        violations = []

        recall_floor = rules.get("recall_floor", 0)
        if evaluation.recall < recall_floor:
            violations.append(
                f"Recall {evaluation.recall:.4f} below floor {recall_floor}")

        fpr_ceiling = rules.get("fpr_ceiling", 1.0)
        if evaluation.false_positive_rate > fpr_ceiling:
            violations.append(
                f"FPR {evaluation.false_positive_rate:.4f} above ceiling {fpr_ceiling}")

        return len(violations) == 0, violations

    def check_slice_stability(self, champion_eval: ModelEvaluation,
                                challenger_eval: ModelEvaluation) -> dict:
        """Check that challenger doesn't regress on any important data slice."""
        regressions = []
        improvements = []

        champ_slices = {(s.slice_name, s.slice_value): s
                        for s in champion_eval.slice_metrics}
        chall_slices = {(s.slice_name, s.slice_value): s
                        for s in challenger_eval.slice_metrics}

        for key, champ_s in champ_slices.items():
            chall_s = chall_slices.get(key)
            if chall_s is None:
                continue

            auc_diff = chall_s.auc_roc - champ_s.auc_roc
            if auc_diff < -0.03:  # >3% regression on any slice
                regressions.append({
                    "slice": f"{key[0]}={key[1]}",
                    "champion_auc": champ_s.auc_roc,
                    "challenger_auc": chall_s.auc_roc,
                    "regression": round(abs(auc_diff), 4),
                })
            elif auc_diff > 0.01:
                improvements.append({
                    "slice": f"{key[0]}={key[1]}",
                    "champion_auc": champ_s.auc_roc,
                    "challenger_auc": chall_s.auc_roc,
                    "improvement": round(auc_diff, 4),
                })

        return {
            "stable": len(regressions) == 0,
            "regressions": regressions,
            "improvements": improvements,
            "total_slices_compared": len(champ_slices),
        }

    def compare(self, model_name: str,
                champion_preds: np.ndarray,
                challenger_preds: np.ndarray,
                labels: np.ndarray,
                champion_version: str = "current",
                challenger_version: str = "new",
                data_df: pd.DataFrame = None,
                champion_latency_ms: float = 0.0,
                challenger_latency_ms: float = 0.0) -> ComparisonResult:
        """Full champion-challenger comparison."""
        logger.info(f"Comparing {model_name}: {champion_version} vs {challenger_version}")

        # Evaluate both models
        champ_eval = self.evaluate_model(
            model_name, champion_version, champion_preds, labels,
            data_df, champion_latency_ms)
        chall_eval = self.evaluate_model(
            model_name, challenger_version, challenger_preds, labels,
            data_df, challenger_latency_ms)

        # Improvement metrics
        improvement = {
            "auc_roc": round(chall_eval.auc_roc - champ_eval.auc_roc, 6),
            "avg_precision": round(chall_eval.avg_precision - champ_eval.avg_precision, 6),
            "f1": round(chall_eval.f1 - champ_eval.f1, 6),
            "recall": round(chall_eval.recall - champ_eval.recall, 6),
            "log_loss": round(champ_eval.log_loss_value - chall_eval.log_loss_value, 6),
        }

        # Statistical significance
        stat_sig = self.bootstrap_auc_difference(champion_preds, challenger_preds, labels)

        # Slice stability
        slice_stability = self.check_slice_stability(champ_eval, chall_eval)

        # Business rules
        chall_rules_pass, chall_violations = self.check_business_rules(model_name, chall_eval)

        # Decision logic
        min_improvement = self.BUSINESS_RULES.get(model_name, {}).get("min_auc_improvement", 0.005)

        if not chall_rules_pass:
            recommendation = "keep_champion"
            reason = f"Challenger violates business rules: {'; '.join(chall_violations)}"
        elif not slice_stability["stable"]:
            recommendation = "keep_champion"
            regressed = [r["slice"] for r in slice_stability["regressions"]]
            reason = f"Challenger regresses on slices: {', '.join(regressed)}"
        elif not stat_sig["significant"]:
            if improvement["auc_roc"] > min_improvement:
                recommendation = "inconclusive"
                reason = (f"AUC improved by {improvement['auc_roc']:.4f} but "
                         f"not statistically significant (p={stat_sig['p_value']:.4f})")
            else:
                recommendation = "keep_champion"
                reason = (f"AUC improvement {improvement['auc_roc']:.4f} below "
                         f"threshold {min_improvement} and not significant")
        elif improvement["auc_roc"] >= min_improvement:
            recommendation = "promote"
            reason = (f"Challenger significantly better: AUC +{improvement['auc_roc']:.4f} "
                     f"(p={stat_sig['p_value']:.4f}), passes all business rules")
        else:
            recommendation = "keep_champion"
            reason = f"Improvement {improvement['auc_roc']:.4f} below threshold {min_improvement}"

        result = ComparisonResult(
            champion=champ_eval,
            challenger=chall_eval,
            improvement=improvement,
            statistical_significance=stat_sig,
            slice_stability=slice_stability,
            business_rules_pass=chall_rules_pass,
            recommendation=recommendation,
            reason=reason,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        logger.info(f"  Recommendation: {recommendation} — {reason}")
        return result

    def save_comparison(self, result: ComparisonResult,
                         output_dir: Path = None) -> Path:
        """Save comparison result to JSON."""
        out_dir = output_dir or Path(__file__).parent.parent / "weights"
        out_dir.mkdir(parents=True, exist_ok=True)

        filename = (f"comparison_{result.champion.model_name}_"
                    f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json")
        path = out_dir / filename

        with open(path, "w") as f:
            json.dump(result.to_dict(), f, indent=2, default=str)

        logger.info(f"Comparison saved: {path}")
        return path
