"""
54link-dev ML Rollout Configuration
Controls how ML models are deployed and used in production

Features:
- Mode control: MONITOR, CHALLENGE, BLOCK
- Traffic allocation between rule engine and ML models
- Gradual rollout percentages
- Feature flags for new models
- A/B testing configuration
"""

import os
import json
import logging
import hashlib
from enum import Enum
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, asdict, field
from datetime import datetime

logger = logging.getLogger(__name__)


class RolloutMode(Enum):
    """
    Rollout modes for ML models
    
    MONITOR: Score transactions but never auto-block. Log decisions for analysis.
    CHALLENGE: Allow blocking for HIGH risk, but require additional auth instead of blocking.
    BLOCK: Full production mode - auto-block CRITICAL risk transactions.
    """
    MONITOR = "monitor"      # Log only, never block
    CHALLENGE = "challenge"  # Request additional auth for high risk
    BLOCK = "block"          # Full blocking enabled


class ModelVariant(Enum):
    """Model variants for A/B testing"""
    RULE_ENGINE = "rule_engine"
    ML_V1 = "ml_v1"
    ML_V2 = "ml_v2"
    ENSEMBLE = "ensemble"  # Rule + ML combined


@dataclass
class ExperimentConfig:
    """A/B testing experiment configuration"""
    experiment_id: str
    name: str
    description: str
    
    # Traffic allocation (must sum to 1.0)
    variants: Dict[str, float] = field(default_factory=dict)
    
    # Experiment status
    is_active: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    
    # Metrics to track
    primary_metric: str = "fraud_detection_rate"
    secondary_metrics: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if not self.variants:
            self.variants = {
                ModelVariant.RULE_ENGINE.value: 1.0,
                ModelVariant.ML_V1.value: 0.0,
            }
        if not self.secondary_metrics:
            self.secondary_metrics = ["false_positive_rate", "latency_p95"]


@dataclass
class ModelConfig:
    """Configuration for a specific model"""
    model_id: str
    model_type: str  # fraud, credit, categorization
    version: str
    
    # Rollout settings
    mode: RolloutMode = RolloutMode.MONITOR
    traffic_percentage: float = 0.0  # 0-100
    
    # Thresholds
    block_threshold: float = 80.0  # Score above this = BLOCK
    challenge_threshold: float = 60.0  # Score above this = CHALLENGE
    monitor_threshold: float = 40.0  # Score above this = MONITOR
    
    # Feature flags
    use_ml_score: bool = False
    use_rule_score: bool = True
    ensemble_weight_ml: float = 0.5  # Weight for ML in ensemble
    
    # Model artifact path
    artifact_path: Optional[str] = None
    
    # Metadata
    deployed_at: Optional[str] = None
    deployed_by: Optional[str] = None


class RolloutConfig:
    """
    Central rollout configuration manager
    
    Provides:
    - Mode control for each model type
    - Traffic allocation for A/B testing
    - Threshold configuration
    - Experiment management
    """
    
    _instance: Optional['RolloutConfig'] = None
    
    def __init__(self):
        # Default configurations
        self.models: Dict[str, ModelConfig] = {}
        self.experiments: Dict[str, ExperimentConfig] = {}
        
        # Load from environment or config file
        self._load_config()
    
    @classmethod
    def get_instance(cls) -> 'RolloutConfig':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _load_config(self):
        """Load configuration from environment or file"""
        # Try to load from config file first
        config_path = os.getenv("ML_ROLLOUT_CONFIG", "/etc/54link-dev/ml_rollout.json")
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self._apply_config(config)
                    logger.info(f"Loaded rollout config from {config_path}")
                    return
            except Exception as e:
                logger.warning(f"Failed to load config from {config_path}: {e}")
        
        # Fall back to environment variables
        self._load_from_env()
    
    def _load_from_env(self):
        """Load configuration from environment variables"""
        # Fraud model config
        fraud_mode = os.getenv("ML_FRAUD_MODE", "monitor").lower()
        fraud_traffic = float(os.getenv("ML_FRAUD_TRAFFIC_PCT", "0"))
        fraud_use_ml = os.getenv("ML_FRAUD_USE_ML", "false").lower() == "true"
        
        self.models["fraud"] = ModelConfig(
            model_id="fraud_v1",
            model_type="fraud",
            version="1.0.0",
            mode=RolloutMode(fraud_mode),
            traffic_percentage=fraud_traffic,
            use_ml_score=fraud_use_ml,
            use_rule_score=True,
            block_threshold=float(os.getenv("ML_FRAUD_BLOCK_THRESHOLD", "80")),
            challenge_threshold=float(os.getenv("ML_FRAUD_CHALLENGE_THRESHOLD", "60")),
            monitor_threshold=float(os.getenv("ML_FRAUD_MONITOR_THRESHOLD", "40")),
        )
        
        # Credit model config
        credit_mode = os.getenv("ML_CREDIT_MODE", "monitor").lower()
        credit_use_ml = os.getenv("ML_CREDIT_USE_ML", "false").lower() == "true"
        
        self.models["credit"] = ModelConfig(
            model_id="credit_v1",
            model_type="credit",
            version="1.0.0",
            mode=RolloutMode(credit_mode),
            traffic_percentage=float(os.getenv("ML_CREDIT_TRAFFIC_PCT", "0")),
            use_ml_score=credit_use_ml,
            use_rule_score=True,
        )
        
        # Default experiment
        self.experiments["default"] = ExperimentConfig(
            experiment_id="default",
            name="Default A/B Test",
            description="Rule engine vs ML model comparison",
            variants={
                ModelVariant.RULE_ENGINE.value: 1.0,
                ModelVariant.ML_V1.value: 0.0,
            },
            is_active=True,
        )
        
        logger.info("Loaded rollout config from environment variables")
    
    def _apply_config(self, config: Dict):
        """Apply configuration from dict"""
        if "models" in config:
            for model_type, model_config in config["models"].items():
                model_config["mode"] = RolloutMode(model_config.get("mode", "monitor"))
                self.models[model_type] = ModelConfig(**model_config)
        
        if "experiments" in config:
            for exp_id, exp_config in config["experiments"].items():
                self.experiments[exp_id] = ExperimentConfig(**exp_config)
    
    def get_model_config(self, model_type: str) -> ModelConfig:
        """Get configuration for a model type"""
        if model_type not in self.models:
            # Return default config
            return ModelConfig(
                model_id=f"{model_type}_default",
                model_type=model_type,
                version="0.0.0",
                mode=RolloutMode.MONITOR,
            )
        return self.models[model_type]
    
    def get_rollout_mode(self, model_type: str) -> RolloutMode:
        """Get rollout mode for a model type"""
        config = self.get_model_config(model_type)
        return config.mode
    
    def should_use_ml(self, model_type: str) -> bool:
        """Check if ML model should be used"""
        config = self.get_model_config(model_type)
        return config.use_ml_score and config.traffic_percentage > 0
    
    def get_action_for_score(
        self,
        model_type: str,
        score: float,
        risk_level: str
    ) -> str:
        """
        Determine action based on score and rollout mode
        
        Returns: ALLOW, MONITOR, CHALLENGE, or BLOCK
        """
        config = self.get_model_config(model_type)
        mode = config.mode
        
        # In MONITOR mode, never block or challenge
        if mode == RolloutMode.MONITOR:
            if score >= config.monitor_threshold:
                return "MONITOR"
            return "ALLOW"
        
        # In CHALLENGE mode, challenge high risk but don't auto-block
        if mode == RolloutMode.CHALLENGE:
            if score >= config.block_threshold:
                return "CHALLENGE"  # Request additional auth instead of blocking
            elif score >= config.challenge_threshold:
                return "CHALLENGE"
            elif score >= config.monitor_threshold:
                return "MONITOR"
            return "ALLOW"
        
        # In BLOCK mode, full production behavior
        if mode == RolloutMode.BLOCK:
            if score >= config.block_threshold:
                return "BLOCK"
            elif score >= config.challenge_threshold:
                return "CHALLENGE"
            elif score >= config.monitor_threshold:
                return "MONITOR"
            return "ALLOW"
        
        return "ALLOW"
    
    def assign_variant(
        self,
        user_id: str,
        experiment_id: str = "default"
    ) -> ModelVariant:
        """
        Assign user to experiment variant using deterministic hashing
        
        This ensures the same user always gets the same variant.
        """
        experiment = self.experiments.get(experiment_id)
        if not experiment or not experiment.is_active:
            return ModelVariant.RULE_ENGINE
        
        # Hash user_id to get deterministic bucket (0-99)
        hash_input = f"{experiment_id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        bucket = hash_value % 100
        
        # Assign to variant based on traffic allocation
        cumulative = 0.0
        for variant_name, allocation in experiment.variants.items():
            cumulative += allocation * 100
            if bucket < cumulative:
                return ModelVariant(variant_name)
        
        return ModelVariant.RULE_ENGINE
    
    def update_model_config(
        self,
        model_type: str,
        mode: Optional[RolloutMode] = None,
        traffic_percentage: Optional[float] = None,
        use_ml_score: Optional[bool] = None,
        **kwargs
    ):
        """Update model configuration dynamically"""
        config = self.get_model_config(model_type)
        
        if mode is not None:
            config.mode = mode
        if traffic_percentage is not None:
            config.traffic_percentage = traffic_percentage
        if use_ml_score is not None:
            config.use_ml_score = use_ml_score
        
        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)
        
        self.models[model_type] = config
        logger.info(f"Updated {model_type} config: mode={config.mode.value}, traffic={config.traffic_percentage}%")
    
    def update_experiment(
        self,
        experiment_id: str,
        variants: Optional[Dict[str, float]] = None,
        is_active: Optional[bool] = None
    ):
        """Update experiment configuration"""
        if experiment_id not in self.experiments:
            logger.warning(f"Experiment {experiment_id} not found")
            return
        
        experiment = self.experiments[experiment_id]
        
        if variants is not None:
            # Validate variants sum to 1.0
            if abs(sum(variants.values()) - 1.0) > 0.001:
                raise ValueError("Variant allocations must sum to 1.0")
            experiment.variants = variants
        
        if is_active is not None:
            experiment.is_active = is_active
        
        logger.info(f"Updated experiment {experiment_id}: active={experiment.is_active}, variants={experiment.variants}")
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get summary of current configuration"""
        return {
            "models": {
                model_type: {
                    "mode": config.mode.value,
                    "traffic_percentage": config.traffic_percentage,
                    "use_ml_score": config.use_ml_score,
                    "use_rule_score": config.use_rule_score,
                    "thresholds": {
                        "block": config.block_threshold,
                        "challenge": config.challenge_threshold,
                        "monitor": config.monitor_threshold,
                    }
                }
                for model_type, config in self.models.items()
            },
            "experiments": {
                exp_id: {
                    "name": exp.name,
                    "is_active": exp.is_active,
                    "variants": exp.variants,
                }
                for exp_id, exp in self.experiments.items()
            }
        }
    
    def save_config(self, path: Optional[str] = None):
        """Save current configuration to file"""
        path = path or os.getenv("ML_ROLLOUT_CONFIG", "/etc/54link-dev/ml_rollout.json")
        
        config = {
            "models": {
                model_type: {
                    **asdict(config),
                    "mode": config.mode.value,
                }
                for model_type, config in self.models.items()
            },
            "experiments": {
                exp_id: asdict(exp)
                for exp_id, exp in self.experiments.items()
            }
        }
        
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info(f"Saved rollout config to {path}")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")


# Singleton accessor
def get_rollout_config() -> RolloutConfig:
    """Get rollout configuration instance"""
    return RolloutConfig.get_instance()
