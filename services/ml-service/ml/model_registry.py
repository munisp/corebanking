"""
54link-dev ML Model Registry
Manages model artifacts, versioning, and deployment

Features:
- Model artifact storage and retrieval
- Version tracking with metadata
- Model promotion (staging -> production)
- Rollback capability
- A/B testing support
"""

import os
import json
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import pickle
import hashlib

logger = logging.getLogger(__name__)


class ModelStage(Enum):
    """Model deployment stages"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


@dataclass
class ModelMetadata:
    """Metadata for a registered model"""
    model_id: str
    model_type: str  # fraud, credit, categorization
    version: str
    algorithm: str
    
    # Training info
    training_date: str
    training_samples: int
    feature_version: str
    feature_names: List[str]
    
    # Metrics
    metrics: Dict[str, float]
    optimal_threshold: float
    
    # Deployment info
    stage: ModelStage = ModelStage.DEVELOPMENT
    deployed_at: Optional[str] = None
    deployed_by: Optional[str] = None
    
    # Artifact paths
    artifact_path: str = ""
    
    # Git info
    git_commit: Optional[str] = None
    
    # Description
    description: str = ""
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class ModelRegistry:
    """
    Central registry for ML models
    
    Provides:
    - Model registration and versioning
    - Stage management (dev -> staging -> production)
    - Model loading for inference
    - Rollback capability
    """
    
    _instance: Optional['ModelRegistry'] = None
    
    def __init__(self):
        self.base_path = os.getenv(
            "ML_MODELS_DIR",
            "/home/ubuntu/54link-dev_platform/54link-dev-unified-platform/services/ml-service/models_store"
        )
        self.registry_file = os.path.join(self.base_path, "registry.json")
        
        # In-memory cache of loaded models
        self._loaded_models: Dict[str, Any] = {}
        self._loaded_scalers: Dict[str, Any] = {}
        self._loaded_thresholds: Dict[str, float] = {}
        
        # Registry data
        self._registry: Dict[str, List[ModelMetadata]] = {}
        self._active_models: Dict[str, str] = {}  # model_type -> model_id
        
        # Initialize
        self._ensure_directories()
        self._load_registry()
    
    @classmethod
    def get_instance(cls) -> 'ModelRegistry':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _ensure_directories(self):
        """Ensure model directories exist"""
        for model_type in ["fraud", "credit", "categorization"]:
            os.makedirs(os.path.join(self.base_path, model_type), exist_ok=True)
    
    def _load_registry(self):
        """Load registry from disk"""
        if os.path.exists(self.registry_file):
            try:
                with open(self.registry_file, 'r') as f:
                    data = json.load(f)
                
                # Parse registry
                for model_type, models in data.get("models", {}).items():
                    self._registry[model_type] = [
                        ModelMetadata(
                            **{**m, "stage": ModelStage(m.get("stage", "development"))}
                        )
                        for m in models
                    ]
                
                self._active_models = data.get("active_models", {})
                
                logger.info(f"Loaded registry with {sum(len(m) for m in self._registry.values())} models")
                
            except Exception as e:
                logger.error(f"Failed to load registry: {e}")
                self._registry = {}
                self._active_models = {}
        else:
            logger.info("No existing registry found, starting fresh")
    
    def _save_registry(self):
        """Save registry to disk"""
        data = {
            "models": {
                model_type: [
                    {**asdict(m), "stage": m.stage.value}
                    for m in models
                ]
                for model_type, models in self._registry.items()
            },
            "active_models": self._active_models,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        try:
            with open(self.registry_file, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info("Registry saved")
        except Exception as e:
            logger.error(f"Failed to save registry: {e}")
    
    def register_model(
        self,
        model_id: str,
        model_type: str,
        version: str,
        algorithm: str,
        artifact_path: str,
        metrics: Dict[str, float],
        optimal_threshold: float,
        feature_names: List[str],
        training_samples: int,
        feature_version: str = "v1",
        description: str = "",
        tags: List[str] = None,
        git_commit: Optional[str] = None,
    ) -> ModelMetadata:
        """
        Register a new model in the registry
        
        Args:
            model_id: Unique identifier for the model
            model_type: Type of model (fraud, credit, etc.)
            version: Model version string
            algorithm: Algorithm used (xgboost, lightgbm, etc.)
            artifact_path: Path to model artifacts
            metrics: Dictionary of evaluation metrics
            optimal_threshold: Optimal classification threshold
            feature_names: List of feature names
            training_samples: Number of training samples
            feature_version: Version of feature engineering
            description: Human-readable description
            tags: List of tags for filtering
            git_commit: Git commit hash
        
        Returns:
            ModelMetadata for the registered model
        """
        metadata = ModelMetadata(
            model_id=model_id,
            model_type=model_type,
            version=version,
            algorithm=algorithm,
            training_date=datetime.utcnow().isoformat(),
            training_samples=training_samples,
            feature_version=feature_version,
            feature_names=feature_names,
            metrics=metrics,
            optimal_threshold=optimal_threshold,
            stage=ModelStage.DEVELOPMENT,
            artifact_path=artifact_path,
            description=description,
            tags=tags or [],
            git_commit=git_commit,
        )
        
        # Add to registry
        if model_type not in self._registry:
            self._registry[model_type] = []
        
        self._registry[model_type].append(metadata)
        
        # Save metadata alongside artifacts
        metadata_path = os.path.join(artifact_path, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump({**asdict(metadata), "stage": metadata.stage.value}, f, indent=2)
        
        self._save_registry()
        
        logger.info(f"Registered model {model_id} (type={model_type}, version={version})")
        
        return metadata
    
    def get_model(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata by ID"""
        for models in self._registry.values():
            for model in models:
                if model.model_id == model_id:
                    return model
        return None
    
    def get_models_by_type(
        self,
        model_type: str,
        stage: Optional[ModelStage] = None
    ) -> List[ModelMetadata]:
        """Get all models of a specific type, optionally filtered by stage"""
        models = self._registry.get(model_type, [])
        
        if stage is not None:
            models = [m for m in models if m.stage == stage]
        
        return sorted(models, key=lambda m: m.training_date, reverse=True)
    
    def get_active_model(self, model_type: str) -> Optional[ModelMetadata]:
        """Get the currently active (production) model for a type"""
        model_id = self._active_models.get(model_type)
        if model_id:
            return self.get_model(model_id)
        
        # Fall back to latest production model
        production_models = self.get_models_by_type(model_type, ModelStage.PRODUCTION)
        if production_models:
            return production_models[0]
        
        return None
    
    def promote_model(
        self,
        model_id: str,
        to_stage: ModelStage,
        deployed_by: str = "system"
    ) -> bool:
        """
        Promote a model to a new stage
        
        Args:
            model_id: Model to promote
            to_stage: Target stage
            deployed_by: User/system performing the promotion
        
        Returns:
            True if successful
        """
        model = self.get_model(model_id)
        if not model:
            logger.error(f"Model {model_id} not found")
            return False
        
        old_stage = model.stage
        model.stage = to_stage
        model.deployed_at = datetime.utcnow().isoformat()
        model.deployed_by = deployed_by
        
        # If promoting to production, set as active
        if to_stage == ModelStage.PRODUCTION:
            # Demote current production model to staging
            current_active = self.get_active_model(model.model_type)
            if current_active and current_active.model_id != model_id:
                current_active.stage = ModelStage.STAGING
            
            self._active_models[model.model_type] = model_id
        
        self._save_registry()
        
        logger.info(f"Promoted model {model_id} from {old_stage.value} to {to_stage.value}")
        
        return True
    
    def rollback(self, model_type: str) -> Optional[str]:
        """
        Rollback to the previous production model
        
        Returns:
            model_id of the new active model, or None if rollback failed
        """
        # Get all production/staging models
        candidates = self.get_models_by_type(model_type, ModelStage.STAGING)
        
        if not candidates:
            logger.error(f"No staging models available for rollback")
            return None
        
        # Demote current production
        current = self.get_active_model(model_type)
        if current:
            current.stage = ModelStage.ARCHIVED
        
        # Promote latest staging to production
        new_active = candidates[0]
        self.promote_model(new_active.model_id, ModelStage.PRODUCTION, "rollback")
        
        logger.info(f"Rolled back {model_type} to {new_active.model_id}")
        
        return new_active.model_id
    
    def load_model_for_inference(
        self,
        model_type: str,
        model_id: Optional[str] = None
    ) -> Tuple[Any, Any, float]:
        """
        Load a model for inference
        
        Args:
            model_type: Type of model to load
            model_id: Specific model ID, or None for active model
        
        Returns:
            Tuple of (model, scaler, threshold)
        """
        # Get model metadata
        if model_id:
            metadata = self.get_model(model_id)
        else:
            metadata = self.get_active_model(model_type)
        
        if not metadata:
            raise ValueError(f"No model found for type={model_type}, id={model_id}")
        
        # Check cache
        cache_key = metadata.model_id
        if cache_key in self._loaded_models:
            return (
                self._loaded_models[cache_key],
                self._loaded_scalers[cache_key],
                self._loaded_thresholds[cache_key]
            )
        
        # Load from disk
        artifact_path = metadata.artifact_path
        
        model_path = os.path.join(artifact_path, "model.pkl")
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        scaler_path = os.path.join(artifact_path, "scaler.pkl")
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
        
        threshold = metadata.optimal_threshold
        
        # Cache
        self._loaded_models[cache_key] = model
        self._loaded_scalers[cache_key] = scaler
        self._loaded_thresholds[cache_key] = threshold
        
        logger.info(f"Loaded model {metadata.model_id} for inference")
        
        return model, scaler, threshold
    
    def clear_cache(self, model_id: Optional[str] = None):
        """Clear loaded model cache"""
        if model_id:
            self._loaded_models.pop(model_id, None)
            self._loaded_scalers.pop(model_id, None)
            self._loaded_thresholds.pop(model_id, None)
        else:
            self._loaded_models.clear()
            self._loaded_scalers.clear()
            self._loaded_thresholds.clear()
    
    def delete_model(self, model_id: str, delete_artifacts: bool = False) -> bool:
        """
        Delete a model from the registry
        
        Args:
            model_id: Model to delete
            delete_artifacts: Also delete artifact files
        
        Returns:
            True if successful
        """
        model = self.get_model(model_id)
        if not model:
            return False
        
        # Can't delete active model
        if self._active_models.get(model.model_type) == model_id:
            logger.error(f"Cannot delete active model {model_id}")
            return False
        
        # Remove from registry
        self._registry[model.model_type] = [
            m for m in self._registry[model.model_type]
            if m.model_id != model_id
        ]
        
        # Delete artifacts
        if delete_artifacts and model.artifact_path and os.path.exists(model.artifact_path):
            shutil.rmtree(model.artifact_path)
        
        # Clear from cache
        self.clear_cache(model_id)
        
        self._save_registry()
        
        logger.info(f"Deleted model {model_id}")
        
        return True
    
    def get_registry_summary(self) -> Dict[str, Any]:
        """Get summary of all registered models"""
        summary = {
            "total_models": sum(len(m) for m in self._registry.values()),
            "active_models": self._active_models,
            "by_type": {},
        }
        
        for model_type, models in self._registry.items():
            summary["by_type"][model_type] = {
                "total": len(models),
                "by_stage": {
                    stage.value: len([m for m in models if m.stage == stage])
                    for stage in ModelStage
                },
                "latest": models[0].model_id if models else None,
            }
        
        return summary
    
    def compare_models(
        self,
        model_id_1: str,
        model_id_2: str
    ) -> Dict[str, Any]:
        """Compare two models"""
        model1 = self.get_model(model_id_1)
        model2 = self.get_model(model_id_2)
        
        if not model1 or not model2:
            raise ValueError("One or both models not found")
        
        return {
            "model_1": {
                "id": model1.model_id,
                "version": model1.version,
                "algorithm": model1.algorithm,
                "metrics": model1.metrics,
                "threshold": model1.optimal_threshold,
            },
            "model_2": {
                "id": model2.model_id,
                "version": model2.version,
                "algorithm": model2.algorithm,
                "metrics": model2.metrics,
                "threshold": model2.optimal_threshold,
            },
            "metric_diff": {
                metric: model2.metrics.get(metric, 0) - model1.metrics.get(metric, 0)
                for metric in set(model1.metrics.keys()) | set(model2.metrics.keys())
            }
        }


# Singleton accessor
def get_model_registry() -> ModelRegistry:
    """Get model registry instance"""
    return ModelRegistry.get_instance()
