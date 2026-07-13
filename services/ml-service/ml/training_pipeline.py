"""
54link-dev ML Training Pipeline
Trains fraud detection and credit scoring models from historical data

Features:
- Data loading from PostgreSQL/Parquet
- Feature engineering using shared feature store logic
- Model training with cross-validation
- Hyperparameter tuning
- Class imbalance handling
- Model evaluation and threshold optimization
"""

import os
import json
import logging
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
import hashlib

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, precision_recall_curve, f1_score,
    confusion_matrix, classification_report, average_precision_score
)
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier,
    HistGradientBoostingClassifier
)

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from .feature_store import TransactionFeatures

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Configuration for model training"""
    model_type: str  # fraud, credit
    algorithm: str = "hist_gradient_boosting"  # random_forest, gradient_boosting, hist_gradient_boosting, xgboost, lightgbm
    
    # Data settings
    train_start_date: Optional[str] = None
    train_end_date: Optional[str] = None
    validation_days: int = 30  # Days to hold out for validation
    
    # Training settings
    test_size: float = 0.2
    n_folds: int = 5
    random_state: int = 42
    
    # Class imbalance handling
    class_weight: str = "balanced"  # balanced, balanced_subsample, or dict
    
    # Hyperparameters (algorithm-specific)
    n_estimators: int = 100
    max_depth: int = 10
    learning_rate: float = 0.1
    min_samples_leaf: int = 10
    
    # Threshold optimization
    optimize_threshold: bool = True
    target_recall: float = 0.85  # Minimum recall for fraud detection
    max_fpr: float = 0.05  # Maximum false positive rate


@dataclass
class TrainingResult:
    """Results from model training"""
    model_id: str
    model_type: str
    algorithm: str
    version: str
    
    # Training metadata
    training_start: str
    training_end: str
    data_start_date: str
    data_end_date: str
    n_samples: int
    n_positive: int
    n_negative: int
    
    # Feature info
    feature_names: List[str]
    feature_version: str
    
    # Metrics
    train_auc: float
    val_auc: float
    cv_auc_mean: float
    cv_auc_std: float
    
    precision: float
    recall: float
    f1: float
    
    # Threshold
    optimal_threshold: float
    threshold_precision: float
    threshold_recall: float
    threshold_fpr: float
    
    # Confusion matrix at optimal threshold
    confusion_matrix: List[List[int]]
    
    # Model artifact path
    artifact_path: str
    
    # Git commit (if available)
    git_commit: Optional[str] = None


class FraudModelTrainer:
    """
    Trains fraud detection models
    
    Supports multiple algorithms:
    - HistGradientBoostingClassifier (default, fast and good)
    - RandomForestClassifier
    - XGBoost (if available)
    - LightGBM (if available)
    """
    
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = TransactionFeatures.feature_names()
        self.optimal_threshold = 0.5
    
    def load_training_data(
        self,
        data_source: str = "postgres",
        connection_string: Optional[str] = None,
        parquet_path: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Load training data from database or parquet files
        
        Expected columns:
        - All feature columns from TransactionFeatures
        - is_fraud: boolean label (1 = fraud, 0 = legitimate)
        - transaction_timestamp: datetime
        """
        if data_source == "parquet" and parquet_path:
            logger.info(f"Loading training data from {parquet_path}")
            df = pd.read_parquet(parquet_path)
        elif data_source == "postgres":
            logger.info("Loading training data from PostgreSQL")
            df = self._load_from_postgres(connection_string)
        else:
            raise ValueError(f"Unknown data source: {data_source}")
        
        # Filter by date range if specified
        if self.config.train_start_date:
            df = df[df['transaction_timestamp'] >= self.config.train_start_date]
        if self.config.train_end_date:
            df = df[df['transaction_timestamp'] <= self.config.train_end_date]
        
        logger.info(f"Loaded {len(df)} samples, {df['is_fraud'].sum()} frauds ({df['is_fraud'].mean()*100:.2f}%)")
        
        return df
    
    def _load_from_postgres(self, connection_string: Optional[str] = None) -> pd.DataFrame:
        """Load training data from PostgreSQL"""
        conn_str = connection_string or os.getenv("DATABASE_URL")
        
        if not conn_str:
            raise ValueError("No database connection string provided")
        
        try:
            import asyncpg
            import asyncio
            
            async def fetch_data():
                conn = await asyncpg.connect(conn_str)
                
                # Query to get labeled transactions with features
                query = """
                SELECT 
                    t.id as transaction_id,
                    t.user_id,
                    t.amount,
                    t.currency,
                    t.channel,
                    t.merchant_category,
                    t.device_id,
                    t.ip_address,
                    t.latitude,
                    t.longitude,
                    t.is_international,
                    t.created_at as transaction_timestamp,
                    COALESCE(f.is_fraud, false) as is_fraud
                FROM transactions t
                LEFT JOIN fraud_labels f ON t.id = f.transaction_id
                WHERE t.created_at >= NOW() - INTERVAL '365 days'
                ORDER BY t.created_at
                """
                
                rows = await conn.fetch(query)
                await conn.close()
                
                return pd.DataFrame([dict(r) for r in rows])
            
            return asyncio.run(fetch_data())
            
        except ImportError as exc:
            logger.error("asyncpg is required for postgres-backed training but is not installed")
            raise RuntimeError("asyncpg is required for postgres-backed training") from exc
    
    def _generate_mock_training_data(self, n_samples: int = 10000) -> pd.DataFrame:
        """Generate mock training data for testing the pipeline"""
        np.random.seed(self.config.random_state)
        
        # Generate features
        data = {
            'amount': np.random.exponential(50000, n_samples),
            'hour_of_day': np.random.randint(0, 24, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'is_weekend': np.random.randint(0, 2, n_samples),
            'is_night': np.random.randint(0, 2, n_samples),
            'is_international': np.random.randint(0, 2, n_samples),
            'amount_zscore': np.random.normal(0, 1, n_samples),
            'amount_to_avg_ratio': np.random.exponential(1, n_samples),
            'is_round_amount': np.random.randint(0, 2, n_samples),
            'txn_count_1h': np.random.poisson(2, n_samples),
            'txn_count_24h': np.random.poisson(10, n_samples),
            'amount_1h': np.random.exponential(100000, n_samples),
            'amount_24h': np.random.exponential(500000, n_samples),
            'velocity_1h_ratio': np.random.exponential(1, n_samples),
            'is_new_device': np.random.randint(0, 2, n_samples),
            'is_new_ip': np.random.randint(0, 2, n_samples),
            'distance_from_primary_km': np.random.exponential(50, n_samples),
            'is_impossible_travel': np.random.randint(0, 2, n_samples) * 0.01,  # Rare
            'is_unusual_category': np.random.randint(0, 2, n_samples),
            'is_unusual_channel': np.random.randint(0, 2, n_samples),
            'is_unusual_hour': np.random.randint(0, 2, n_samples),
            'account_age_days': np.random.exponential(365, n_samples),
            'total_transactions': np.random.poisson(100, n_samples),
            'has_fraud_history': np.random.randint(0, 2, n_samples) * 0.05,  # Rare
        }
        
        df = pd.DataFrame(data)
        
        # Generate labels with realistic fraud rate (~1%)
        # Fraud is more likely with: high amount, new device, unusual patterns
        fraud_prob = (
            0.001 +  # Base rate
            0.01 * (df['amount'] > 500000).astype(float) +
            0.02 * df['is_new_device'] +
            0.03 * df['is_impossible_travel'] +
            0.01 * df['is_unusual_category'] +
            0.02 * (df['velocity_1h_ratio'] > 3).astype(float) +
            0.05 * df['has_fraud_history']
        )
        df['is_fraud'] = (np.random.random(n_samples) < fraud_prob).astype(int)
        
        # Add timestamp
        base_date = datetime.now() - timedelta(days=365)
        df['transaction_timestamp'] = [
            base_date + timedelta(days=np.random.randint(0, 365))
            for _ in range(n_samples)
        ]
        
        logger.info(f"Generated synthetic test dataset: {n_samples} samples, {df['is_fraud'].sum()} frauds")
        
        return df
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare feature matrix and labels"""
        # Extract features in correct order
        X = df[self.feature_names].values
        y = df['is_fraud'].values
        
        return X, y
    
    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None
    ) -> TrainingResult:
        """
        Train the fraud detection model
        
        Returns TrainingResult with metrics and model artifact path
        """
        training_start = datetime.utcnow()
        
        # Split data if validation set not provided
        if X_val is None:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y,
                test_size=self.config.test_size,
                random_state=self.config.random_state,
                stratify=y
            )
        else:
            X_train, y_train = X, y
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        # Create model based on algorithm
        self.model = self._create_model()
        
        logger.info(f"Training {self.config.algorithm} model...")
        
        # Train model
        self.model.fit(X_train_scaled, y_train)
        
        # Get predictions
        train_proba = self.model.predict_proba(X_train_scaled)[:, 1]
        val_proba = self.model.predict_proba(X_val_scaled)[:, 1]
        
        # Calculate metrics
        train_auc = roc_auc_score(y_train, train_proba)
        val_auc = roc_auc_score(y_val, val_proba)
        
        # Cross-validation
        cv = StratifiedKFold(n_splits=self.config.n_folds, shuffle=True, random_state=self.config.random_state)
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=cv, scoring='roc_auc')
        
        logger.info(f"Train AUC: {train_auc:.4f}, Val AUC: {val_auc:.4f}, CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
        
        # Optimize threshold
        if self.config.optimize_threshold:
            self.optimal_threshold, threshold_metrics = self._optimize_threshold(y_val, val_proba)
        else:
            self.optimal_threshold = 0.5
            threshold_metrics = self._calculate_threshold_metrics(y_val, val_proba, 0.5)
        
        # Get predictions at optimal threshold
        val_pred = (val_proba >= self.optimal_threshold).astype(int)
        
        # Calculate final metrics
        precision = threshold_metrics['precision']
        recall = threshold_metrics['recall']
        f1 = f1_score(y_val, val_pred)
        cm = confusion_matrix(y_val, val_pred).tolist()
        
        training_end = datetime.utcnow()
        
        # Generate model ID
        model_id = f"fraud_{self.config.algorithm}_{training_end.strftime('%Y%m%d_%H%M%S')}"
        version = f"1.0.{int(training_end.timestamp())}"
        
        # Save model artifact
        artifact_path = self._save_model(model_id)
        
        result = TrainingResult(
            model_id=model_id,
            model_type="fraud",
            algorithm=self.config.algorithm,
            version=version,
            training_start=training_start.isoformat(),
            training_end=training_end.isoformat(),
            data_start_date=self.config.train_start_date or "N/A",
            data_end_date=self.config.train_end_date or "N/A",
            n_samples=len(X_train) + len(X_val),
            n_positive=int(y_train.sum() + y_val.sum()),
            n_negative=int(len(y_train) + len(y_val) - y_train.sum() - y_val.sum()),
            feature_names=self.feature_names,
            feature_version="v1",
            train_auc=train_auc,
            val_auc=val_auc,
            cv_auc_mean=cv_scores.mean(),
            cv_auc_std=cv_scores.std(),
            precision=precision,
            recall=recall,
            f1=f1,
            optimal_threshold=self.optimal_threshold,
            threshold_precision=threshold_metrics['precision'],
            threshold_recall=threshold_metrics['recall'],
            threshold_fpr=threshold_metrics['fpr'],
            confusion_matrix=cm,
            artifact_path=artifact_path,
        )
        
        logger.info(f"Training complete. Model saved to {artifact_path}")
        
        return result
    
    def _create_model(self):
        """Create model based on algorithm configuration"""
        algorithm = self.config.algorithm
        
        common_params = {
            'random_state': self.config.random_state,
        }
        
        if algorithm == "random_forest":
            return RandomForestClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                min_samples_leaf=self.config.min_samples_leaf,
                class_weight=self.config.class_weight,
                n_jobs=-1,
                **common_params
            )
        
        elif algorithm == "gradient_boosting":
            return GradientBoostingClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                min_samples_leaf=self.config.min_samples_leaf,
                **common_params
            )
        
        elif algorithm == "hist_gradient_boosting":
            return HistGradientBoostingClassifier(
                max_iter=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                min_samples_leaf=self.config.min_samples_leaf,
                class_weight=self.config.class_weight,
                **common_params
            )
        
        elif algorithm == "xgboost" and HAS_XGBOOST:
            # Calculate scale_pos_weight for imbalanced data
            return xgb.XGBClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                use_label_encoder=False,
                eval_metric='auc',
                **common_params
            )
        
        elif algorithm == "lightgbm" and HAS_LIGHTGBM:
            return lgb.LGBMClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                min_child_samples=self.config.min_samples_leaf,
                class_weight=self.config.class_weight,
                **common_params
            )
        
        else:
            logger.warning(f"Algorithm {algorithm} not available, falling back to HistGradientBoosting")
            return HistGradientBoostingClassifier(
                max_iter=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                **common_params
            )
    
    def _optimize_threshold(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray
    ) -> Tuple[float, Dict[str, float]]:
        """
        Find optimal threshold that meets recall target while minimizing FPR
        """
        precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
        
        # Find thresholds that meet recall target
        valid_indices = np.where(recalls[:-1] >= self.config.target_recall)[0]
        
        if len(valid_indices) == 0:
            # Can't meet recall target, use threshold with highest recall
            best_idx = np.argmax(recalls[:-1])
            logger.warning(f"Cannot meet target recall {self.config.target_recall}, using best available")
        else:
            # Among valid thresholds, find one with highest precision (lowest FPR)
            best_idx = valid_indices[np.argmax(precisions[valid_indices])]
        
        optimal_threshold = thresholds[best_idx]
        metrics = self._calculate_threshold_metrics(y_true, y_proba, optimal_threshold)
        
        logger.info(f"Optimal threshold: {optimal_threshold:.4f} (precision={metrics['precision']:.4f}, recall={metrics['recall']:.4f}, fpr={metrics['fpr']:.4f})")
        
        return optimal_threshold, metrics
    
    def _calculate_threshold_metrics(
        self,
        y_true: np.ndarray,
        y_proba: np.ndarray,
        threshold: float
    ) -> Dict[str, float]:
        """Calculate metrics at a specific threshold"""
        y_pred = (y_proba >= threshold).astype(int)
        
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        return {
            'precision': precision,
            'recall': recall,
            'fpr': fpr,
            'tp': int(tp),
            'fp': int(fp),
            'tn': int(tn),
            'fn': int(fn),
        }
    
    def _save_model(self, model_id: str) -> str:
        """Save model and scaler to disk"""
        models_dir = os.getenv("ML_MODELS_DIR", "/home/ubuntu/54link-dev_platform/54link-dev-unified-platform/services/ml-service/models_store")
        model_dir = os.path.join(models_dir, "fraud", model_id)
        os.makedirs(model_dir, exist_ok=True)
        
        # Save model
        model_path = os.path.join(model_dir, "model.pkl")
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        
        # Save scaler
        scaler_path = os.path.join(model_dir, "scaler.pkl")
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        
        # Save threshold
        threshold_path = os.path.join(model_dir, "threshold.json")
        with open(threshold_path, 'w') as f:
            json.dump({'optimal_threshold': self.optimal_threshold}, f)
        
        # Save feature names
        features_path = os.path.join(model_dir, "features.json")
        with open(features_path, 'w') as f:
            json.dump({'feature_names': self.feature_names}, f)
        
        return model_dir
    
    def load_model(self, model_dir: str):
        """Load model from disk"""
        model_path = os.path.join(model_dir, "model.pkl")
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        scaler_path = os.path.join(model_dir, "scaler.pkl")
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        
        threshold_path = os.path.join(model_dir, "threshold.json")
        if os.path.exists(threshold_path):
            with open(threshold_path, 'r') as f:
                self.optimal_threshold = json.load(f)['optimal_threshold']
        
        logger.info(f"Loaded model from {model_dir}")
    
    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make predictions
        
        Returns:
            probabilities: Fraud probability for each sample
            predictions: Binary predictions at optimal threshold
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        X_scaled = self.scaler.transform(X)
        probabilities = self.model.predict_proba(X_scaled)[:, 1]
        predictions = (probabilities >= self.optimal_threshold).astype(int)
        
        return probabilities, predictions


def train_fraud_model(
    data_source: str = "postgres",
    parquet_path: Optional[str] = None,
    algorithm: str = "hist_gradient_boosting",
    **kwargs
) -> TrainingResult:
    """
    Convenience function to train a fraud model
    
    Args:
        data_source: "postgres" or "parquet"
        parquet_path: Path to parquet file if data_source is "parquet"
        algorithm: Model algorithm to use
        **kwargs: Additional TrainingConfig parameters
    
    Returns:
        TrainingResult with metrics and artifact path
    """
    config = TrainingConfig(
        model_type="fraud",
        algorithm=algorithm,
        **kwargs
    )
    
    trainer = FraudModelTrainer(config)
    
    # Load data
    df = trainer.load_training_data(data_source, parquet_path=parquet_path)
    
    # Prepare features
    X, y = trainer.prepare_features(df)
    
    # Train model
    result = trainer.train(X, y)
    
    return result


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    result = train_fraud_model(
        data_source="postgres",
        algorithm="hist_gradient_boosting",
        n_estimators=100,
        max_depth=10,
    )
    
    print(f"\nTraining Results:")
    print(f"  Model ID: {result.model_id}")
    print(f"  Val AUC: {result.val_auc:.4f}")
    print(f"  CV AUC: {result.cv_auc_mean:.4f} (+/- {result.cv_auc_std:.4f})")
    print(f"  Precision: {result.precision:.4f}")
    print(f"  Recall: {result.recall:.4f}")
    print(f"  Optimal Threshold: {result.optimal_threshold:.4f}")
    print(f"  Artifact Path: {result.artifact_path}")
