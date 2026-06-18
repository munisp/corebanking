"""
54link-dev ML Model Evaluation Harness
Comprehensive evaluation of ML models with business-relevant metrics

Features:
- Standard ML metrics (AUC, precision, recall, F1)
- Business metrics (cost-based, false positive impact)
- Threshold optimization
- Model comparison
- Evaluation reports
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
import numpy as np

from sklearn.metrics import (
    roc_auc_score, roc_curve,
    precision_recall_curve, average_precision_score,
    f1_score, precision_score, recall_score,
    confusion_matrix, classification_report,
    log_loss, brier_score_loss
)

logger = logging.getLogger(__name__)


@dataclass
class EvaluationMetrics:
    """Comprehensive evaluation metrics"""
    # ROC metrics
    roc_auc: float
    
    # Precision-Recall metrics
    pr_auc: float
    
    # At optimal threshold
    precision: float
    recall: float
    f1: float
    
    # Confusion matrix
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    
    # Rates
    false_positive_rate: float
    false_negative_rate: float
    
    # Calibration
    brier_score: float
    log_loss_value: float
    
    # Threshold
    optimal_threshold: float
    
    # Business metrics
    fraud_detection_rate: float  # Same as recall
    customer_friction_rate: float  # FPR - customers incorrectly flagged
    
    # Cost metrics (if costs provided)
    total_cost: Optional[float] = None
    cost_per_transaction: Optional[float] = None


@dataclass
class ThresholdAnalysis:
    """Analysis at different thresholds"""
    threshold: float
    precision: float
    recall: float
    f1: float
    fpr: float
    fnr: float
    tp: int
    fp: int
    tn: int
    fn: int


@dataclass
class EvaluationReport:
    """Complete evaluation report"""
    model_id: str
    model_type: str
    evaluation_date: str
    
    # Dataset info
    n_samples: int
    n_positive: int
    n_negative: int
    positive_rate: float
    
    # Metrics
    metrics: EvaluationMetrics
    
    # Threshold analysis
    threshold_analysis: List[ThresholdAnalysis]
    
    # Feature importance (if available)
    feature_importance: Optional[Dict[str, float]] = None
    
    # Recommendations
    recommendations: List[str] = None
    
    def __post_init__(self):
        if self.recommendations is None:
            self.recommendations = []


class ModelEvaluator:
    """
    Comprehensive model evaluation
    
    Provides:
    - Standard ML metrics
    - Business-relevant metrics
    - Threshold optimization
    - Cost-based analysis
    - Evaluation reports
    """
    
    def __init__(
        self,
        cost_false_positive: float = 100,  # Cost of incorrectly flagging legitimate transaction
        cost_false_negative: float = 10000,  # Cost of missing fraud
        target_recall: float = 0.85,
        max_fpr: float = 0.05
    ):
        """
        Initialize evaluator with business parameters
        
        Args:
            cost_false_positive: Cost of flagging legitimate transaction (customer friction)
            cost_false_negative: Cost of missing a fraud (financial loss)
            target_recall: Minimum acceptable recall
            max_fpr: Maximum acceptable false positive rate
        """
        self.cost_fp = cost_false_positive
        self.cost_fn = cost_false_negative
        self.target_recall = target_recall
        self.max_fpr = max_fpr
    
    def evaluate(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray,
        model_id: str = "unknown",
        model_type: str = "fraud",
        feature_names: Optional[List[str]] = None,
        feature_importance: Optional[np.ndarray] = None
    ) -> EvaluationReport:
        """
        Comprehensive model evaluation
        
        Args:
            y_true: True labels (0/1)
            y_proba: Predicted probabilities
            model_id: Model identifier
            model_type: Type of model
            feature_names: Names of features
            feature_importance: Feature importance scores
        
        Returns:
            EvaluationReport with all metrics
        """
        y_true = np.array(y_true)
        y_proba = np.array(y_proba)
        
        # Basic stats
        n_samples = len(y_true)
        n_positive = int(y_true.sum())
        n_negative = n_samples - n_positive
        positive_rate = n_positive / n_samples
        
        # Calculate metrics
        metrics = self._calculate_metrics(y_true, y_proba)
        
        # Threshold analysis
        threshold_analysis = self._analyze_thresholds(y_true, y_proba)
        
        # Feature importance
        feat_importance = None
        if feature_names and feature_importance is not None:
            feat_importance = dict(zip(feature_names, feature_importance.tolist()))
        
        # Generate recommendations
        recommendations = self._generate_recommendations(metrics, positive_rate)
        
        return EvaluationReport(
            model_id=model_id,
            model_type=model_type,
            evaluation_date=datetime.utcnow().isoformat(),
            n_samples=n_samples,
            n_positive=n_positive,
            n_negative=n_negative,
            positive_rate=positive_rate,
            metrics=metrics,
            threshold_analysis=threshold_analysis,
            feature_importance=feat_importance,
            recommendations=recommendations,
        )
    
    def _calculate_metrics(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray
    ) -> EvaluationMetrics:
        """Calculate all evaluation metrics"""
        # ROC AUC
        roc_auc = roc_auc_score(y_true, y_proba)
        
        # PR AUC
        pr_auc = average_precision_score(y_true, y_proba)
        
        # Find optimal threshold
        optimal_threshold = self._find_optimal_threshold(y_true, y_proba)
        
        # Predictions at optimal threshold
        y_pred = (y_proba >= optimal_threshold).astype(int)
        
        # Confusion matrix
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        
        # Rates
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
        
        # Calibration metrics
        brier = brier_score_loss(y_true, y_proba)
        try:
            ll = log_loss(y_true, y_proba)
        except:
            ll = float('inf')
        
        # Cost calculation
        total_cost = fp * self.cost_fp + fn * self.cost_fn
        cost_per_txn = total_cost / len(y_true)
        
        return EvaluationMetrics(
            roc_auc=roc_auc,
            pr_auc=pr_auc,
            precision=precision,
            recall=recall,
            f1=f1,
            true_positives=int(tp),
            false_positives=int(fp),
            true_negatives=int(tn),
            false_negatives=int(fn),
            false_positive_rate=fpr,
            false_negative_rate=fnr,
            brier_score=brier,
            log_loss_value=ll,
            optimal_threshold=optimal_threshold,
            fraud_detection_rate=recall,
            customer_friction_rate=fpr,
            total_cost=total_cost,
            cost_per_transaction=cost_per_txn,
        )
    
    def _find_optimal_threshold(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray
    ) -> float:
        """
        Find optimal threshold balancing recall and FPR
        
        Strategy:
        1. Find thresholds that meet target recall
        2. Among those, find one with lowest FPR
        3. If can't meet recall, optimize for cost
        """
        precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
        fpr_values, tpr_values, roc_thresholds = roc_curve(y_true, y_proba)
        
        # Find thresholds meeting recall target
        valid_indices = np.where(recalls[:-1] >= self.target_recall)[0]
        
        if len(valid_indices) > 0:
            # Get corresponding FPRs
            best_idx = None
            best_fpr = float('inf')
            
            for idx in valid_indices:
                threshold = thresholds[idx]
                # Find FPR at this threshold
                roc_idx = np.argmin(np.abs(roc_thresholds - threshold))
                fpr = fpr_values[roc_idx]
                
                if fpr < best_fpr and fpr <= self.max_fpr:
                    best_fpr = fpr
                    best_idx = idx
            
            if best_idx is not None:
                return thresholds[best_idx]
        
        # Fall back to cost-based optimization
        return self._find_cost_optimal_threshold(y_true, y_proba, thresholds)
    
    def _find_cost_optimal_threshold(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray,
        thresholds: np.ndarray
    ) -> float:
        """Find threshold that minimizes total cost"""
        best_threshold = 0.5
        best_cost = float('inf')
        
        for threshold in thresholds:
            y_pred = (y_proba >= threshold).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
            
            cost = fp * self.cost_fp + fn * self.cost_fn
            
            if cost < best_cost:
                best_cost = cost
                best_threshold = threshold
        
        return best_threshold
    
    def _analyze_thresholds(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray,
        n_thresholds: int = 20
    ) -> List[ThresholdAnalysis]:
        """Analyze metrics at different thresholds"""
        thresholds = np.linspace(0.1, 0.9, n_thresholds)
        analysis = []
        
        for threshold in thresholds:
            y_pred = (y_proba >= threshold).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
            fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
            
            analysis.append(ThresholdAnalysis(
                threshold=threshold,
                precision=precision,
                recall=recall,
                f1=f1,
                fpr=fpr,
                fnr=fnr,
                tp=int(tp),
                fp=int(fp),
                tn=int(tn),
                fn=int(fn),
            ))
        
        return analysis
    
    def _generate_recommendations(
        self,
        metrics: EvaluationMetrics,
        positive_rate: float
    ) -> List[str]:
        """Generate recommendations based on evaluation results"""
        recommendations = []
        
        # AUC recommendations
        if metrics.roc_auc < 0.7:
            recommendations.append(
                "Model AUC is below 0.7, indicating poor discrimination. "
                "Consider adding more features or trying different algorithms."
            )
        elif metrics.roc_auc < 0.8:
            recommendations.append(
                "Model AUC is between 0.7-0.8. Consider feature engineering "
                "or hyperparameter tuning to improve performance."
            )
        elif metrics.roc_auc >= 0.9:
            recommendations.append(
                "Excellent AUC (>0.9). Verify there's no data leakage or overfitting."
            )
        
        # Recall recommendations
        if metrics.recall < self.target_recall:
            recommendations.append(
                f"Recall ({metrics.recall:.2%}) is below target ({self.target_recall:.2%}). "
                "Consider lowering the threshold or adjusting class weights."
            )
        
        # FPR recommendations
        if metrics.false_positive_rate > self.max_fpr:
            recommendations.append(
                f"False positive rate ({metrics.false_positive_rate:.2%}) exceeds target ({self.max_fpr:.2%}). "
                "This may cause excessive customer friction."
            )
        
        # Calibration recommendations
        if metrics.brier_score > 0.1:
            recommendations.append(
                "Model calibration could be improved. Consider using Platt scaling "
                "or isotonic regression for probability calibration."
            )
        
        # Class imbalance
        if positive_rate < 0.01:
            recommendations.append(
                f"Severe class imbalance (positive rate: {positive_rate:.2%}). "
                "Ensure proper handling with class weights or oversampling."
            )
        
        # Cost recommendations
        if metrics.total_cost and metrics.cost_per_transaction:
            recommendations.append(
                f"Estimated cost per transaction: NGN {metrics.cost_per_transaction:.2f}. "
                "Monitor this metric in production."
            )
        
        return recommendations
    
    def compare_models(
        self,
        reports: List[EvaluationReport]
    ) -> Dict[str, Any]:
        """Compare multiple model evaluation reports"""
        if len(reports) < 2:
            raise ValueError("Need at least 2 reports to compare")
        
        comparison = {
            "models": [r.model_id for r in reports],
            "metrics_comparison": {},
            "winner": {},
        }
        
        # Compare key metrics
        metrics_to_compare = [
            "roc_auc", "pr_auc", "precision", "recall", "f1",
            "false_positive_rate", "brier_score"
        ]
        
        for metric in metrics_to_compare:
            values = [getattr(r.metrics, metric) for r in reports]
            comparison["metrics_comparison"][metric] = {
                r.model_id: v for r, v in zip(reports, values)
            }
            
            # Determine winner (higher is better for most, lower for FPR and brier)
            if metric in ["false_positive_rate", "brier_score"]:
                winner_idx = np.argmin(values)
            else:
                winner_idx = np.argmax(values)
            
            comparison["winner"][metric] = reports[winner_idx].model_id
        
        # Overall recommendation
        wins = {}
        for metric, winner in comparison["winner"].items():
            wins[winner] = wins.get(winner, 0) + 1
        
        comparison["overall_winner"] = max(wins, key=wins.get)
        comparison["win_counts"] = wins
        
        return comparison
    
    def save_report(
        self,
        report: EvaluationReport,
        output_dir: str
    ) -> str:
        """Save evaluation report to disk"""
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert to dict
        report_dict = {
            "model_id": report.model_id,
            "model_type": report.model_type,
            "evaluation_date": report.evaluation_date,
            "dataset": {
                "n_samples": report.n_samples,
                "n_positive": report.n_positive,
                "n_negative": report.n_negative,
                "positive_rate": report.positive_rate,
            },
            "metrics": asdict(report.metrics),
            "threshold_analysis": [asdict(t) for t in report.threshold_analysis],
            "feature_importance": report.feature_importance,
            "recommendations": report.recommendations,
        }
        
        # Save JSON
        filename = f"evaluation_{report.model_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(report_dict, f, indent=2)
        
        logger.info(f"Saved evaluation report to {filepath}")
        
        return filepath


def evaluate_model(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    model_id: str = "unknown",
    model_type: str = "fraud",
    **kwargs
) -> EvaluationReport:
    """
    Convenience function to evaluate a model
    
    Args:
        y_true: True labels
        y_proba: Predicted probabilities
        model_id: Model identifier
        model_type: Type of model
        **kwargs: Additional parameters for ModelEvaluator
    
    Returns:
        EvaluationReport
    """
    evaluator = ModelEvaluator(**kwargs)
    return evaluator.evaluate(y_true, y_proba, model_id, model_type)


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    # Generate sample data
    np.random.seed(42)
    n_samples = 1000
    
    y_true = np.random.binomial(1, 0.02, n_samples)  # 2% fraud rate
    y_proba = np.clip(
        y_true * np.random.uniform(0.5, 1.0, n_samples) +
        (1 - y_true) * np.random.uniform(0.0, 0.3, n_samples),
        0, 1
    )
    
    # Evaluate
    report = evaluate_model(
        y_true, y_proba,
        model_id="test_model",
        model_type="fraud"
    )
    
    print(f"\nEvaluation Results for {report.model_id}:")
    print(f"  ROC AUC: {report.metrics.roc_auc:.4f}")
    print(f"  PR AUC: {report.metrics.pr_auc:.4f}")
    print(f"  Precision: {report.metrics.precision:.4f}")
    print(f"  Recall: {report.metrics.recall:.4f}")
    print(f"  F1: {report.metrics.f1:.4f}")
    print(f"  Optimal Threshold: {report.metrics.optimal_threshold:.4f}")
    print(f"  FPR: {report.metrics.false_positive_rate:.4f}")
    print(f"\nRecommendations:")
    for rec in report.recommendations:
        print(f"  - {rec}")
