"""
54link-dev ML Module
Production-ready machine learning for fraud detection and credit scoring

Components:
- feature_store: Redis-backed feature store for shared user profiles
- rollout_config: Rollout mode control and A/B testing
- training_pipeline: Model training with cross-validation
- model_registry: Model versioning and deployment
- model_evaluation: Comprehensive evaluation harness
"""

from .feature_store import (
    FeatureStore,
    UserProfile,
    TransactionFeatures,
    FeatureWindow,
    get_feature_store,
)

from .rollout_config import (
    RolloutConfig,
    RolloutMode,
    ModelVariant,
    ModelConfig,
    ExperimentConfig,
    get_rollout_config,
)

from .model_registry import (
    ModelRegistry,
    ModelStage,
    ModelMetadata,
    get_model_registry,
)

from .model_evaluation import (
    ModelEvaluator,
    EvaluationMetrics,
    EvaluationReport,
    ThresholdAnalysis,
    evaluate_model,
)

from .training_pipeline import (
    FraudModelTrainer,
    TrainingConfig,
    TrainingResult,
    train_fraud_model,
)

__all__ = [
    # Feature Store
    "FeatureStore",
    "UserProfile", 
    "TransactionFeatures",
    "FeatureWindow",
    "get_feature_store",
    
    # Rollout Config
    "RolloutConfig",
    "RolloutMode",
    "ModelVariant",
    "ModelConfig",
    "ExperimentConfig",
    "get_rollout_config",
    
    # Model Registry
    "ModelRegistry",
    "ModelStage",
    "ModelMetadata",
    "get_model_registry",
    
    # Model Evaluation
    "ModelEvaluator",
    "EvaluationMetrics",
    "EvaluationReport",
    "ThresholdAnalysis",
    "evaluate_model",
    
    # Training Pipeline
    "FraudModelTrainer",
    "TrainingConfig",
    "TrainingResult",
    "train_fraud_model",
]
