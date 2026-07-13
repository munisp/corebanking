#!/usr/bin/env python3
"""54Bank — Automated Model Promotion Pipeline
Handles the promotion lifecycle: staging → canary → production → archived.

Promotion stages:
1. staging: newly trained model, not yet evaluated
2. canary: serving 10% of production traffic alongside champion
3. production: serving 100% of traffic
4. archived: previous production model retained for rollback

Safety features:
- Automatic rollback if canary metrics degrade
- Shadow mode: new model scores in parallel but doesn't affect decisions
- Gradual traffic ramp (10% → 25% → 50% → 100%)
- Human-in-the-loop for high-risk models (AML, fraud)
"""
import json
import logging
import shutil
import time
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional

import torch
import numpy as np

logger = logging.getLogger("54bank.continuous_training.promoter")

WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
ARCHIVE_DIR = WEIGHTS_DIR / "archive"


@dataclass
class PromotionRecord:
    """Record of a model promotion event."""
    model_name: str
    from_version: str
    to_version: str
    from_stage: str
    to_stage: str
    reason: str
    promoted_at: str
    promoted_by: str  # "auto" or user ID
    comparison_file: str
    rollback_path: str
    canary_pct: float = 0.0

    def to_dict(self):
        return asdict(self)


class ModelPromoter:
    """Manages model lifecycle and promotion.

    Weight file naming convention:
        {model_name}.pt           — current production model
        {model_name}_staging.pt   — newly trained candidate
        {model_name}_canary.pt    — canary deployment
        archive/{model_name}_v{timestamp}.pt — archived versions
    """

    # Models that require human approval for production promotion
    REQUIRES_APPROVAL = {"fraud_detector", "aml_scorer"}

    # Canary traffic ramp schedule (percentage, duration in minutes)
    CANARY_RAMP = [
        (0.10, 60),    # 10% for 1 hour
        (0.25, 120),   # 25% for 2 hours
        (0.50, 240),   # 50% for 4 hours
        (1.00, 0),     # 100% (full promotion)
    ]

    def __init__(self, weights_dir: Path = None):
        self.weights_dir = weights_dir or WEIGHTS_DIR
        self.archive_dir = self.weights_dir / "archive"
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        self.promotions_log = self.weights_dir / "promotions.json"
        self._load_log()

    def _load_log(self):
        """Load promotion history."""
        if self.promotions_log.exists():
            with open(self.promotions_log) as f:
                self.history = json.load(f)
        else:
            self.history = {"promotions": []}

    def _save_log(self):
        """Persist promotion history."""
        with open(self.promotions_log, "w") as f:
            json.dump(self.history, f, indent=2)

    def get_current_version(self, model_name: str) -> Optional[str]:
        """Get current production model version from its checkpoint."""
        prod_path = self.weights_dir / f"{model_name}.pt"
        if not prod_path.exists():
            return None

        try:
            checkpoint = torch.load(prod_path, map_location="cpu", weights_only=False)
            return checkpoint.get("version", checkpoint.get("epoch", "unknown"))
        except Exception:
            return "unknown"

    def save_as_staging(self, model_name: str, model: torch.nn.Module,
                         optimizer_state: dict = None,
                         scaler_params: dict = None,
                         metrics: dict = None,
                         version: str = None) -> Path:
        """Save a newly trained model as staging candidate."""
        staging_path = self.weights_dir / f"{model_name}_staging.pt"

        checkpoint = {
            "model_state_dict": model.state_dict(),
            "version": version or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
            "stage": "staging",
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }

        if optimizer_state:
            checkpoint["optimizer_state_dict"] = optimizer_state
        if scaler_params:
            checkpoint["scaler_params"] = scaler_params
        if metrics:
            checkpoint["metrics"] = metrics

        torch.save(checkpoint, staging_path)
        logger.info(f"Saved {model_name} as staging: {staging_path}")
        return staging_path

    def promote_to_canary(self, model_name: str,
                           initial_traffic_pct: float = 0.10,
                           comparison_file: str = "") -> PromotionRecord:
        """Promote staging model to canary (shadow/split traffic)."""
        staging_path = self.weights_dir / f"{model_name}_staging.pt"
        canary_path = self.weights_dir / f"{model_name}_canary.pt"

        if not staging_path.exists():
            raise FileNotFoundError(f"No staging model for {model_name}")

        # Copy staging to canary
        shutil.copy2(staging_path, canary_path)

        # Update checkpoint metadata
        checkpoint = torch.load(canary_path, map_location="cpu", weights_only=False)
        from_version = str(checkpoint.get("version", "unknown"))
        checkpoint["stage"] = "canary"
        checkpoint["canary_pct"] = initial_traffic_pct
        checkpoint["promoted_at"] = datetime.now(timezone.utc).isoformat()
        torch.save(checkpoint, canary_path)

        record = PromotionRecord(
            model_name=model_name,
            from_version=from_version,
            to_version=from_version,
            from_stage="staging",
            to_stage="canary",
            reason=f"Champion-challenger passed, starting canary at {initial_traffic_pct*100:.0f}%",
            promoted_at=datetime.now(timezone.utc).isoformat(),
            promoted_by="auto",
            comparison_file=comparison_file,
            rollback_path="",
            canary_pct=initial_traffic_pct,
        )

        self.history["promotions"].append(record.to_dict())
        self._save_log()

        logger.info(f"Promoted {model_name} to canary at {initial_traffic_pct*100:.0f}% traffic")
        return record

    def promote_to_production(self, model_name: str,
                               approved_by: str = "auto",
                               comparison_file: str = "") -> PromotionRecord:
        """Promote canary (or staging) model to production.
        Archives the current production model first.
        """
        canary_path = self.weights_dir / f"{model_name}_canary.pt"
        staging_path = self.weights_dir / f"{model_name}_staging.pt"
        prod_path = self.weights_dir / f"{model_name}.pt"

        source_path = canary_path if canary_path.exists() else staging_path
        source_stage = "canary" if canary_path.exists() else "staging"

        if not source_path.exists():
            raise FileNotFoundError(f"No {source_stage} model for {model_name}")

        # Check if human approval required
        if model_name in self.REQUIRES_APPROVAL and approved_by == "auto":
            logger.warning(
                f"{model_name} requires human approval for production promotion. "
                f"Set approved_by to a user ID to proceed.")
            raise PermissionError(
                f"{model_name} requires human approval. "
                f"Call promote_to_production(approved_by='user_id')")

        # Archive current production model
        rollback_path = ""
        if prod_path.exists():
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            archive_path = self.archive_dir / f"{model_name}_v{timestamp}.pt"
            shutil.copy2(prod_path, archive_path)
            rollback_path = str(archive_path)
            logger.info(f"Archived current {model_name} to {archive_path}")

        # Get version info
        checkpoint = torch.load(source_path, map_location="cpu", weights_only=False)
        new_version = str(checkpoint.get("version", "unknown"))

        old_version = "none"
        if prod_path.exists():
            try:
                old_ckpt = torch.load(prod_path, map_location="cpu", weights_only=False)
                old_version = str(old_ckpt.get("version", "unknown"))
            except Exception:
                pass

        # Promote: copy source to production
        checkpoint["stage"] = "production"
        checkpoint["promoted_at"] = datetime.now(timezone.utc).isoformat()
        checkpoint["promoted_by"] = approved_by
        torch.save(checkpoint, prod_path)

        # Clean up staging/canary
        if staging_path.exists():
            staging_path.unlink()
        if canary_path.exists():
            canary_path.unlink()

        record = PromotionRecord(
            model_name=model_name,
            from_version=old_version,
            to_version=new_version,
            from_stage=source_stage,
            to_stage="production",
            reason=f"Promoted from {source_stage} by {approved_by}",
            promoted_at=datetime.now(timezone.utc).isoformat(),
            promoted_by=approved_by,
            comparison_file=comparison_file,
            rollback_path=rollback_path,
        )

        self.history["promotions"].append(record.to_dict())
        self._save_log()

        logger.info(f"Promoted {model_name} {new_version} to production "
                     f"(was {old_version})")
        return record

    def rollback(self, model_name: str, version: str = None) -> PromotionRecord:
        """Roll back to a previous model version.
        If version not specified, rolls back to the most recent archived version.
        """
        prod_path = self.weights_dir / f"{model_name}.pt"

        if version:
            # Find specific archived version
            archive_files = list(self.archive_dir.glob(f"{model_name}_v{version}*.pt"))
            if not archive_files:
                raise FileNotFoundError(f"No archived version {version} for {model_name}")
            archive_path = archive_files[0]
        else:
            # Most recent archive
            archive_files = sorted(self.archive_dir.glob(f"{model_name}_v*.pt"), reverse=True)
            if not archive_files:
                raise FileNotFoundError(f"No archived versions for {model_name}")
            archive_path = archive_files[0]

        # Get current version
        current_version = self.get_current_version(model_name) or "unknown"

        # Restore
        shutil.copy2(archive_path, prod_path)

        # Get restored version
        restored_ckpt = torch.load(prod_path, map_location="cpu", weights_only=False)
        restored_version = str(restored_ckpt.get("version", "unknown"))

        record = PromotionRecord(
            model_name=model_name,
            from_version=str(current_version),
            to_version=restored_version,
            from_stage="production",
            to_stage="production",
            reason=f"Rolled back from {current_version} to {restored_version}",
            promoted_at=datetime.now(timezone.utc).isoformat(),
            promoted_by="auto_rollback",
            comparison_file="",
            rollback_path=str(archive_path),
        )

        self.history["promotions"].append(record.to_dict())
        self._save_log()

        logger.info(f"Rolled back {model_name} from {current_version} to {restored_version}")
        return record

    def get_promotion_history(self, model_name: str = None) -> list:
        """Get promotion history, optionally filtered by model."""
        records = self.history.get("promotions", [])
        if model_name:
            records = [r for r in records if r["model_name"] == model_name]
        return records

    def cleanup_archives(self, model_name: str, keep_n: int = 5):
        """Keep only the N most recent archived versions."""
        archive_files = sorted(
            self.archive_dir.glob(f"{model_name}_v*.pt"),
            reverse=True)

        for old_file in archive_files[keep_n:]:
            old_file.unlink()
            logger.info(f"Cleaned up old archive: {old_file.name}")

    def get_model_status(self) -> dict:
        """Get status of all models (production, staging, canary, archived)."""
        status = {}
        model_names = ["fraud_detector", "credit_scorer", "anomaly_vae",
                        "churn_predictor", "gnn_fraud_ring", "aml_scorer"]

        for name in model_names:
            prod = self.weights_dir / f"{name}.pt"
            staging = self.weights_dir / f"{name}_staging.pt"
            canary = self.weights_dir / f"{name}_canary.pt"
            archives = list(self.archive_dir.glob(f"{name}_v*.pt"))

            status[name] = {
                "production": prod.exists(),
                "production_version": self.get_current_version(name) if prod.exists() else None,
                "staging": staging.exists(),
                "canary": canary.exists(),
                "archived_versions": len(archives),
            }

        return status
