#!/usr/bin/env python3
"""54Bank — Continuous Training Orchestrator
Central coordinator for the continuous training pipeline.

Pipeline stages:
1. Ingest production data (DB/Kafka/files)
2. Run drift detection against reference distribution
3. If drift detected OR scheduled: retrain model
4. Evaluate challenger vs champion on held-out data
5. If challenger wins: promote through canary → production
6. Log everything to Delta Lake / metrics store

Scheduling:
- Scheduled retraining: configurable per model (daily/weekly/monthly)
- Event-driven retraining: triggered by drift detection
- Manual retraining: via CLI or API call

Usage:
    # Full pipeline for all models
    python -m ml.continuous_training.orchestrator --mode full

    # Drift check only
    python -m ml.continuous_training.orchestrator --mode drift

    # Retrain specific model
    python -m ml.continuous_training.orchestrator --mode retrain --model fraud_detector

    # Evaluate staging model
    python -m ml.continuous_training.orchestrator --mode evaluate --model fraud_detector
"""
import os
import sys
import json
import time
import logging
import argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.continuous_training.data_ingestion import ProductionDataIngestion
from ml.continuous_training.drift_detector import DriftDetector
from ml.continuous_training.champion_challenger import ChampionChallenger
from ml.continuous_training.model_promoter import ModelPromoter

logger = logging.getLogger("54bank.continuous_training")

WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"


class RetrainingConfig:
    """Configuration for continuous retraining per model."""

    CONFIGS = {
        "fraud_detector": {
            "schedule": "daily",
            "min_samples": 5000,
            "epochs": 15,
            "batch_size": 256,
            "lr": 1e-3,
            "focal_alpha": 0.75,
            "focal_gamma": 2.0,
            "early_stopping_patience": 5,
            "val_split": 0.2,
            "requires_approval": True,
        },
        "credit_scorer": {
            "schedule": "weekly",
            "min_samples": 2000,
            "epochs": 20,
            "batch_size": 128,
            "lr": 1e-3,
            "focal_alpha": 0.6,
            "focal_gamma": 2.0,
            "early_stopping_patience": 7,
            "val_split": 0.2,
            "requires_approval": False,
        },
        "anomaly_vae": {
            "schedule": "weekly",
            "min_samples": 5000,
            "epochs": 50,
            "batch_size": 256,
            "lr": 1e-3,
            "beta": 0.5,
            "early_stopping_patience": 10,
            "val_split": 0.2,
            "requires_approval": False,
        },
        "churn_predictor": {
            "schedule": "monthly",
            "min_samples": 1000,
            "epochs": 20,
            "batch_size": 64,
            "lr": 5e-4,
            "focal_alpha": 0.6,
            "focal_gamma": 2.0,
            "early_stopping_patience": 5,
            "val_split": 0.2,
            "requires_approval": False,
        },
        "gnn_fraud_ring": {
            "schedule": "weekly",
            "min_samples": 500,
            "epochs": 60,
            "batch_size": 0,  # full-batch for GNN
            "lr": 5e-3,
            "early_stopping_patience": 15,
            "val_split": 0.2,
            "requires_approval": True,
        },
        "aml_scorer": {
            "schedule": "daily",
            "min_samples": 3000,
            "epochs": 15,
            "batch_size": 128,
            "lr": 1e-3,
            "focal_alpha": 0.7,
            "focal_gamma": 2.0,
            "early_stopping_patience": 5,
            "val_split": 0.2,
            "requires_approval": True,
        },
    }

    @classmethod
    def get(cls, model_name: str) -> dict:
        return cls.CONFIGS.get(model_name, {})


class ContinuousTrainingOrchestrator:
    """Orchestrates the end-to-end continuous training pipeline."""

    def __init__(self, db_url: str = None, kafka_brokers: str = None):
        self.ingestion = ProductionDataIngestion(db_url, kafka_brokers)
        self.drift_detector = DriftDetector()
        self.evaluator = ChampionChallenger(n_bootstrap=500)
        self.promoter = ModelPromoter()
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self.results = {}

    def _load_reference_data(self, model_name: str) -> Optional[pd.DataFrame]:
        """Load reference (training) data for drift comparison."""
        fallbacks = {
            "fraud_detector": DATA_DIR / "fraud_detection.parquet",
            "credit_scorer": DATA_DIR / "credit_scoring.parquet",
            "aml_scorer": DATA_DIR / "aml_risk.parquet",
            "anomaly_vae": DATA_DIR / "anomaly_detection.parquet",
        }
        path = fallbacks.get(model_name)
        if path and path.exists():
            return pd.read_parquet(path)
        return None

    def _load_model(self, model_name: str, weight_path: Path):
        """Load a trained model from weights file."""
        from ml.models.fraud_detector import FraudDetector
        from ml.models.credit_scorer import CreditScorer
        from ml.models.anomaly_autoencoder import TransactionVAE
        from ml.models.churn_predictor import ChurnPredictor
        from ml.models.gnn_fraud_ring import GNNFraudRingDetector
        from ml.models.aml_scorer import AMLRiskScorer

        model_classes = {
            "fraud_detector": FraudDetector,
            "credit_scorer": CreditScorer,
            "anomaly_vae": TransactionVAE,
            "churn_predictor": ChurnPredictor,
            "gnn_fraud_ring": GNNFraudRingDetector,
            "aml_scorer": AMLRiskScorer,
        }

        model_class = model_classes.get(model_name)
        if not model_class:
            raise ValueError(f"Unknown model: {model_name}")

        model = model_class()
        checkpoint = torch.load(weight_path, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()

        scaler_params = checkpoint.get("scaler_params", None)
        return model, checkpoint, scaler_params

    def _retrain_model(self, model_name: str, train_df: pd.DataFrame,
                        config: dict) -> tuple:
        """Retrain a specific model on new data. Returns (model, metrics, scaler_params)."""
        from ml.models.fraud_detector import FraudDetector
        from ml.models.credit_scorer import CreditScorer
        from ml.models.anomaly_autoencoder import TransactionVAE
        from ml.models.churn_predictor import ChurnPredictor
        from ml.models.gnn_fraud_ring import GNNFraudRingDetector
        from ml.models.aml_scorer import AMLRiskScorer

        logger.info(f"Retraining {model_name} on {len(train_df)} samples")
        start_time = time.time()

        # This delegates to the training functions from train_all.py
        # but with configurable hyperparameters from the continuous training config
        model, metrics, scaler_params = self._run_training_loop(
            model_name, train_df, config)

        elapsed = time.time() - start_time
        metrics["training_time_seconds"] = round(elapsed, 1)

        logger.info(f"Retrained {model_name} in {elapsed:.1f}s — "
                     f"AUC: {metrics.get('val_auc_roc', 'N/A')}")

        return model, metrics, scaler_params

    def _run_training_loop(self, model_name: str, df: pd.DataFrame,
                            config: dict) -> tuple:
        """Generic training loop that works for all model types."""
        from ml.models.fraud_detector import FraudDetector
        from ml.models.credit_scorer import CreditScorer
        from ml.models.aml_scorer import AMLRiskScorer

        torch.manual_seed(54)
        np.random.seed(54)

        if model_name == "fraud_detector":
            return self._train_fraud_detector(df, config)
        elif model_name == "credit_scorer":
            return self._train_credit_scorer(df, config)
        elif model_name == "aml_scorer":
            return self._train_aml_scorer(df, config)
        else:
            raise NotImplementedError(
                f"Continuous retraining for {model_name} — "
                f"use ml.training.train_all for initial training")

    def _train_fraud_detector(self, df: pd.DataFrame, config: dict) -> tuple:
        """Retrain fraud detection model."""
        from ml.models.fraud_detector import FraudDetector

        # Feature columns
        num_cols = ["amount", "hour", "day_of_week", "velocity_1h", "velocity_24h",
                    "amount_vs_avg", "geo_distance_km", "device_age_days",
                    "is_new_beneficiary", "is_international", "account_age_days",
                    "balance_ratio"]
        cat_cols = {"merchant_cat_idx": 20, "channel_idx": 7,
                    "card_type_idx": 3, "state_idx": 20}

        # Handle column name variations
        for old, new in [("merchant_category", "merchant_cat_idx"),
                          ("channel", "channel_idx"),
                          ("card_type", "card_type_idx"),
                          ("state", "state_idx")]:
            if old in df.columns and new not in df.columns:
                df[new] = pd.Categorical(df[old]).codes

        label_col = "is_fraud"
        available_num = [c for c in num_cols if c in df.columns]
        available_cat = {k: v for k, v in cat_cols.items() if k in df.columns}

        # Scale numerical features
        scaler = StandardScaler()
        X_num = scaler.fit_transform(df[available_num].fillna(0).values)

        labels = df[label_col].values.astype(np.float32)

        # Split
        idx = np.arange(len(df))
        train_idx, val_idx = train_test_split(idx, test_size=config["val_split"],
                                               stratify=labels, random_state=54)

        # Model
        model = FraudDetector()
        optimizer = torch.optim.AdamW(model.parameters(), lr=config["lr"], weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config["epochs"])

        # Focal loss
        alpha = config.get("focal_alpha", 0.75)
        gamma = config.get("focal_gamma", 2.0)

        best_auc = 0
        best_state = None
        patience_counter = 0

        for epoch in range(config["epochs"]):
            model.train()
            # Mini-batch training
            np.random.shuffle(train_idx)
            batch_size = config["batch_size"]
            total_loss = 0
            n_batches = 0

            for i in range(0, len(train_idx), batch_size):
                batch_idx = train_idx[i:i + batch_size]

                num_t = torch.tensor(X_num[batch_idx], dtype=torch.float32)
                y_t = torch.tensor(labels[batch_idx], dtype=torch.float32).unsqueeze(1)

                cat_tensors = {}
                for cat_name in available_cat:
                    cat_tensors[cat_name] = torch.tensor(
                        df[cat_name].values[batch_idx], dtype=torch.long)

                merchant = cat_tensors.get("merchant_cat_idx", torch.zeros(len(batch_idx), dtype=torch.long))
                channel = cat_tensors.get("channel_idx", torch.zeros(len(batch_idx), dtype=torch.long))
                card = cat_tensors.get("card_type_idx", torch.zeros(len(batch_idx), dtype=torch.long))
                state = cat_tensors.get("state_idx", torch.zeros(len(batch_idx), dtype=torch.long))

                logits = model(num_t, merchant, channel, card, state)
                probs = torch.sigmoid(logits)

                # Focal loss
                bce = torch.nn.functional.binary_cross_entropy_with_logits(logits, y_t, reduction="none")
                pt = torch.where(y_t == 1, probs, 1 - probs)
                at = torch.where(y_t == 1, alpha, 1 - alpha)
                focal = at * (1 - pt) ** gamma * bce
                loss = focal.mean()

                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

                total_loss += loss.item()
                n_batches += 1

            scheduler.step()

            # Validation
            model.eval()
            with torch.no_grad():
                val_num = torch.tensor(X_num[val_idx], dtype=torch.float32)
                val_merchant = torch.tensor(df["merchant_cat_idx"].values[val_idx] if "merchant_cat_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_channel = torch.tensor(df["channel_idx"].values[val_idx] if "channel_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_card = torch.tensor(df["card_type_idx"].values[val_idx] if "card_type_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_state = torch.tensor(df["state_idx"].values[val_idx] if "state_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)

                val_logits = model(val_num, val_merchant, val_channel, val_card, val_state)
                val_probs = torch.sigmoid(val_logits).numpy().flatten()
                val_labels = labels[val_idx]

                val_auc = roc_auc_score(val_labels, val_probs)

            if val_auc > best_auc:
                best_auc = val_auc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= config["early_stopping_patience"]:
                    break

        if best_state:
            model.load_state_dict(best_state)

        scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}
        metrics = {
            "val_auc_roc": round(best_auc, 6),
            "epochs_trained": epoch + 1,
            "parameters": sum(p.numel() for p in model.parameters()),
        }

        return model, metrics, scaler_params

    def _train_credit_scorer(self, df: pd.DataFrame, config: dict) -> tuple:
        """Retrain credit scoring model."""
        from ml.models.credit_scorer import CreditScorer

        num_cols = ["age", "monthly_income", "total_debt", "dti_ratio",
                    "employment_years", "num_prior_loans", "num_defaults",
                    "loan_amount_requested", "loan_tenure_months",
                    "collateral_value", "has_guarantor", "account_age_months",
                    "avg_monthly_balance", "num_dependents",
                    "collateral_to_loan_ratio"]

        # Compute derived features if missing
        if "collateral_to_loan_ratio" not in df.columns:
            df = df.copy()
            df["collateral_to_loan_ratio"] = (
                df.get("collateral_value", pd.Series(0, index=df.index)).fillna(0) /
                df.get("loan_amount_requested", pd.Series(1, index=df.index)).fillna(1).clip(lower=1)
            )

        if "sector" in df.columns and "sector_idx" not in df.columns:
            df["sector_idx"] = pd.Categorical(df["sector"]).codes
        if "state" in df.columns and "state_idx" not in df.columns:
            df["state_idx"] = pd.Categorical(df["state"]).codes

        available_num = [c for c in num_cols if c in df.columns]
        label_col = "will_default"

        # Remove rows without labels
        df = df.dropna(subset=[label_col])

        scaler = StandardScaler()
        X_num = scaler.fit_transform(df[available_num].fillna(0).values)
        labels = df[label_col].values.astype(np.float32)

        idx = np.arange(len(df))
        train_idx, val_idx = train_test_split(idx, test_size=config["val_split"],
                                               stratify=labels, random_state=54)

        model = CreditScorer()
        optimizer = torch.optim.AdamW(model.parameters(), lr=config["lr"], weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config["epochs"])

        best_auc = 0
        best_state = None
        patience_counter = 0

        for epoch in range(config["epochs"]):
            model.train()
            np.random.shuffle(train_idx)
            batch_size = config["batch_size"]

            for i in range(0, len(train_idx), batch_size):
                batch_idx = train_idx[i:i + batch_size]
                num_t = torch.tensor(X_num[batch_idx], dtype=torch.float32)
                y_t = torch.tensor(labels[batch_idx], dtype=torch.float32).unsqueeze(1)
                sector_t = torch.tensor(df["sector_idx"].values[batch_idx] if "sector_idx" in df else np.zeros(len(batch_idx)), dtype=torch.long)
                state_t = torch.tensor(df["state_idx"].values[batch_idx] if "state_idx" in df else np.zeros(len(batch_idx)), dtype=torch.long)

                outputs = model(num_t, sector_t, state_t)
                logit = outputs["default_logit"]
                probs = torch.sigmoid(logit)

                bce = torch.nn.functional.binary_cross_entropy_with_logits(logit, y_t, reduction="none")
                alpha = config.get("focal_alpha", 0.6)
                gamma = config.get("focal_gamma", 2.0)
                pt = torch.where(y_t == 1, probs, 1 - probs)
                at = torch.where(y_t == 1, alpha, 1 - alpha)
                loss = (at * (1 - pt) ** gamma * bce).mean()

                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            scheduler.step()

            model.eval()
            with torch.no_grad():
                val_num = torch.tensor(X_num[val_idx], dtype=torch.float32)
                val_sector = torch.tensor(df["sector_idx"].values[val_idx] if "sector_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_state = torch.tensor(df["state_idx"].values[val_idx] if "state_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)

                val_out = model(val_num, val_sector, val_state)
                val_probs = val_out["default_prob"].numpy().flatten()
                val_labels = labels[val_idx]
                val_auc = roc_auc_score(val_labels, val_probs)

            if val_auc > best_auc:
                best_auc = val_auc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= config["early_stopping_patience"]:
                    break

        if best_state:
            model.load_state_dict(best_state)

        scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}
        metrics = {
            "val_auc_roc": round(best_auc, 6),
            "epochs_trained": epoch + 1,
            "parameters": sum(p.numel() for p in model.parameters()),
        }

        return model, metrics, scaler_params

    def _train_aml_scorer(self, df: pd.DataFrame, config: dict) -> tuple:
        """Retrain AML risk scoring model."""
        from ml.models.aml_scorer import AMLRiskScorer

        num_cols = ["transaction_count_30d", "unique_counterparties_30d",
                    "cash_ratio", "international_ratio",
                    "avg_transaction_amount", "max_transaction_amount",
                    "round_amount_ratio", "night_ratio",
                    "structuring_score", "days_since_last_kyc_update"]

        if "account_type" in df.columns and "account_type_idx" not in df.columns:
            df["account_type_idx"] = pd.Categorical(df["account_type"]).codes
        if "kyc_level" in df.columns and "kyc_level_idx" not in df.columns:
            df["kyc_level_idx"] = pd.Categorical(df["kyc_level"]).codes

        available_num = [c for c in num_cols if c in df.columns]
        label_col = "is_suspicious"
        df = df.dropna(subset=[label_col])

        scaler = StandardScaler()
        X_num = scaler.fit_transform(df[available_num].fillna(0).values)
        labels = df[label_col].values.astype(np.float32)

        idx = np.arange(len(df))
        train_idx, val_idx = train_test_split(idx, test_size=config["val_split"],
                                               stratify=labels, random_state=54)

        model = AMLRiskScorer()
        optimizer = torch.optim.AdamW(model.parameters(), lr=config["lr"], weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config["epochs"])

        best_auc = 0
        best_state = None
        patience_counter = 0

        for epoch in range(config["epochs"]):
            model.train()
            np.random.shuffle(train_idx)
            batch_size = config["batch_size"]

            for i in range(0, len(train_idx), batch_size):
                batch_idx = train_idx[i:i + batch_size]
                num_t = torch.tensor(X_num[batch_idx], dtype=torch.float32)
                y_t = torch.tensor(labels[batch_idx], dtype=torch.float32).unsqueeze(1)
                pep_t = torch.tensor(df["pep_flag"].values[batch_idx] if "pep_flag" in df else np.zeros(len(batch_idx)), dtype=torch.long)
                hrc_t = torch.tensor(df["high_risk_country"].values[batch_idx] if "high_risk_country" in df else np.zeros(len(batch_idx)), dtype=torch.long)
                acct_t = torch.tensor(df["account_type_idx"].values[batch_idx] if "account_type_idx" in df else np.zeros(len(batch_idx)), dtype=torch.long)
                kyc_t = torch.tensor(df["kyc_level_idx"].values[batch_idx] if "kyc_level_idx" in df else np.zeros(len(batch_idx)), dtype=torch.long)

                outputs = model(num_t, pep_t, hrc_t, acct_t, kyc_t)
                logit = outputs["suspicious_logit"]
                probs = torch.sigmoid(logit)

                bce = torch.nn.functional.binary_cross_entropy_with_logits(logit, y_t, reduction="none")
                alpha = config.get("focal_alpha", 0.7)
                gamma = config.get("focal_gamma", 2.0)
                pt = torch.where(y_t == 1, probs, 1 - probs)
                at = torch.where(y_t == 1, alpha, 1 - alpha)
                loss = (at * (1 - pt) ** gamma * bce).mean()

                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            scheduler.step()

            model.eval()
            with torch.no_grad():
                val_num = torch.tensor(X_num[val_idx], dtype=torch.float32)
                val_pep = torch.tensor(df["pep_flag"].values[val_idx] if "pep_flag" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_hrc = torch.tensor(df["high_risk_country"].values[val_idx] if "high_risk_country" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_acct = torch.tensor(df["account_type_idx"].values[val_idx] if "account_type_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)
                val_kyc = torch.tensor(df["kyc_level_idx"].values[val_idx] if "kyc_level_idx" in df else np.zeros(len(val_idx)), dtype=torch.long)

                val_out = model(val_num, val_pep, val_hrc, val_acct, val_kyc)
                val_probs = torch.sigmoid(val_out["suspicious_logit"]).numpy().flatten()
                val_labels = labels[val_idx]
                val_auc = roc_auc_score(val_labels, val_probs)

            if val_auc > best_auc:
                best_auc = val_auc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= config["early_stopping_patience"]:
                    break

        if best_state:
            model.load_state_dict(best_state)

        scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}
        metrics = {
            "val_auc_roc": round(best_auc, 6),
            "epochs_trained": epoch + 1,
            "parameters": sum(p.numel() for p in model.parameters()),
        }

        return model, metrics, scaler_params

    def run_drift_check(self, model_name: str,
                         current_data: pd.DataFrame = None) -> dict:
        """Run drift detection for a model."""
        reference_data = self._load_reference_data(model_name)
        if reference_data is None:
            logger.warning(f"No reference data for {model_name}. Skipping drift check.")
            return {"drift_detected": False, "reason": "no_reference_data"}

        if current_data is None:
            current_data = self.ingestion.ingest_from_files(model_name)
        if current_data is None:
            logger.warning(f"No current data for {model_name}. Skipping drift check.")
            return {"drift_detected": False, "reason": "no_current_data"}

        report = self.drift_detector.full_drift_check(
            model_name, reference_data, current_data)

        self.drift_detector.save_report(report)

        return {
            "drift_detected": report.overall_drift_detected,
            "should_retrain": report.should_retrain,
            "features_drifted": report.features_drifted,
            "total_features": report.total_features_checked,
            "report": report.to_dict(),
        }

    def run_retraining(self, model_name: str,
                        training_data: pd.DataFrame = None) -> dict:
        """Run retraining pipeline for a model."""
        config = RetrainingConfig.get(model_name)
        if not config:
            return {"success": False, "reason": f"No config for {model_name}"}

        # Get training data
        if training_data is None:
            training_data = self.ingestion.ingest_from_files(model_name)
        if training_data is None or len(training_data) < config.get("min_samples", 100):
            return {
                "success": False,
                "reason": f"Insufficient data: {len(training_data) if training_data is not None else 0} "
                          f"< {config.get('min_samples', 100)}",
            }

        # Version the training data
        version_id = self.ingestion.version_dataset(model_name, training_data, {
            "run_id": self.run_id,
            "source": "continuous_training",
        })

        # Retrain
        try:
            model, metrics, scaler_params = self._retrain_model(
                model_name, training_data, config)
        except Exception as e:
            logger.error(f"Retraining failed for {model_name}: {e}")
            return {"success": False, "reason": str(e)}

        # Save as staging
        version = f"ct_{self.run_id}"
        staging_path = self.promoter.save_as_staging(
            model_name, model,
            scaler_params=scaler_params,
            metrics=metrics,
            version=version,
        )

        # Log to Lakehouse
        try:
            from ml.training.lakehouse import LakehouseManager
            lakehouse = LakehouseManager()
            lakehouse.log_training_run(model_name, {
                **metrics,
                "weight_file": f"{model_name}_staging.pt",
                "data_version": version_id,
                "pipeline": "continuous_training",
            })
        except Exception as e:
            logger.warning(f"Lakehouse logging failed: {e}")

        return {
            "success": True,
            "model_name": model_name,
            "version": version,
            "staging_path": str(staging_path),
            "metrics": metrics,
            "data_version": version_id,
            "data_samples": len(training_data),
        }

    def run_evaluation(self, model_name: str,
                        eval_data: pd.DataFrame = None) -> dict:
        """Evaluate staging model against production champion."""
        staging_path = WEIGHTS_DIR / f"{model_name}_staging.pt"
        prod_path = WEIGHTS_DIR / f"{model_name}.pt"

        if not staging_path.exists():
            return {"success": False, "reason": "No staging model to evaluate"}
        if not prod_path.exists():
            return {"success": False, "reason": "No production model to compare against"}

        # Get evaluation data
        if eval_data is None:
            eval_data = self.ingestion.ingest_from_files(model_name)
        if eval_data is None:
            return {"success": False, "reason": "No evaluation data available"}

        # This is a simplified evaluation — in production would run full inference
        # For now, return metrics from the staging checkpoint
        staging_ckpt = torch.load(staging_path, map_location="cpu", weights_only=False)
        prod_ckpt = torch.load(prod_path, map_location="cpu", weights_only=False)

        staging_metrics = staging_ckpt.get("metrics", {})
        prod_metrics = prod_ckpt.get("metrics", {})

        if not prod_metrics:
            # Load from training_metrics.json
            metrics_file = WEIGHTS_DIR / "training_metrics.json"
            if metrics_file.exists():
                with open(metrics_file) as f:
                    all_metrics = json.load(f)
                prod_metrics = all_metrics.get("models", {}).get(model_name, {})

        staging_auc = staging_metrics.get("val_auc_roc", 0)
        prod_auc = prod_metrics.get("val_auc_roc", 0)

        improvement = staging_auc - prod_auc
        min_threshold = RetrainingConfig.get(model_name).get("min_auc_improvement", 0.005)

        if staging_auc == 0:
            recommendation = "keep_champion"
            reason = "Staging model has no AUC metric"
        elif improvement > min_threshold:
            recommendation = "promote"
            reason = f"AUC improved by {improvement:.4f} (>{min_threshold})"
        elif improvement > 0:
            recommendation = "inconclusive"
            reason = f"AUC improved by {improvement:.4f} but below threshold {min_threshold}"
        else:
            recommendation = "keep_champion"
            reason = f"No AUC improvement ({improvement:.4f})"

        return {
            "success": True,
            "model_name": model_name,
            "champion_auc": prod_auc,
            "challenger_auc": staging_auc,
            "improvement": round(improvement, 6),
            "recommendation": recommendation,
            "reason": reason,
        }

    def run_promotion(self, model_name: str, force: bool = False) -> dict:
        """Promote staging model to production if evaluation passes."""
        eval_result = self.run_evaluation(model_name)

        if not eval_result.get("success"):
            return {"success": False, "reason": eval_result.get("reason")}

        recommendation = eval_result["recommendation"]

        if recommendation == "promote" or force:
            config = RetrainingConfig.get(model_name)

            if config.get("requires_approval") and not force:
                # Promote to canary first for high-risk models
                try:
                    record = self.promoter.promote_to_canary(model_name)
                    return {
                        "success": True,
                        "action": "canary",
                        "reason": "High-risk model promoted to canary. "
                                  "Call promote_to_production(approved_by='user') to go live.",
                        "record": record.to_dict(),
                    }
                except Exception as e:
                    return {"success": False, "reason": str(e)}
            else:
                try:
                    approved_by = "auto" if not config.get("requires_approval") else "force"
                    record = self.promoter.promote_to_production(
                        model_name, approved_by=approved_by)
                    return {
                        "success": True,
                        "action": "production",
                        "reason": eval_result["reason"],
                        "record": record.to_dict(),
                    }
                except Exception as e:
                    return {"success": False, "reason": str(e)}
        else:
            return {
                "success": True,
                "action": "no_promotion",
                "reason": eval_result["reason"],
                "recommendation": recommendation,
            }

    def run_full_pipeline(self, model_names: list = None,
                           force_retrain: bool = False) -> dict:
        """Run complete continuous training pipeline for specified models."""
        if model_names is None:
            model_names = list(RetrainingConfig.CONFIGS.keys())

        results = {}
        for model_name in model_names:
            logger.info(f"\n{'='*60}")
            logger.info(f"Pipeline: {model_name}")
            logger.info(f"{'='*60}")

            pipeline_result = {
                "model_name": model_name,
                "run_id": self.run_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            # Step 1: Drift check
            logger.info(f"[1/4] Drift check for {model_name}")
            drift_result = self.run_drift_check(model_name)
            pipeline_result["drift"] = {
                "detected": drift_result.get("drift_detected", False),
                "should_retrain": drift_result.get("should_retrain", False),
                "features_drifted": drift_result.get("features_drifted", 0),
            }

            # Step 2: Decide whether to retrain
            should_retrain = drift_result.get("should_retrain", False) or force_retrain
            if not should_retrain:
                logger.info(f"No drift detected for {model_name}. Skipping retraining.")
                pipeline_result["retrained"] = False
                pipeline_result["reason"] = "no_drift"
                results[model_name] = pipeline_result
                continue

            # Step 3: Retrain
            logger.info(f"[2/4] Retraining {model_name}")
            retrain_result = self.run_retraining(model_name)
            pipeline_result["retrained"] = retrain_result.get("success", False)
            pipeline_result["retrain_metrics"] = retrain_result.get("metrics", {})

            if not retrain_result.get("success"):
                pipeline_result["reason"] = retrain_result.get("reason")
                results[model_name] = pipeline_result
                continue

            # Step 4: Evaluate and promote
            logger.info(f"[3/4] Evaluating {model_name}")
            eval_result = self.run_evaluation(model_name)
            pipeline_result["evaluation"] = eval_result

            logger.info(f"[4/4] Promotion decision for {model_name}")
            promotion_result = self.run_promotion(model_name)
            pipeline_result["promotion"] = promotion_result

            results[model_name] = pipeline_result

        # Save pipeline results
        results_path = WEIGHTS_DIR / f"ct_pipeline_{self.run_id}.json"
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2, default=str)

        logger.info(f"\nPipeline results saved: {results_path}")
        return results


def main():
    parser = argparse.ArgumentParser(description="54Bank Continuous Training Pipeline")
    parser.add_argument("--mode", choices=["full", "drift", "retrain", "evaluate", "promote", "status"],
                        default="full", help="Pipeline mode")
    parser.add_argument("--model", type=str, default=None,
                        help="Specific model to process (default: all)")
    parser.add_argument("--force", action="store_true",
                        help="Force retraining regardless of drift")
    parser.add_argument("--db-url", type=str, default=None,
                        help="PostgreSQL connection string")
    parser.add_argument("--kafka-brokers", type=str, default=None,
                        help="Kafka broker addresses")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    orchestrator = ContinuousTrainingOrchestrator(
        db_url=args.db_url, kafka_brokers=args.kafka_brokers)

    models = [args.model] if args.model else None

    if args.mode == "full":
        results = orchestrator.run_full_pipeline(models, force_retrain=args.force)
        print(json.dumps(results, indent=2, default=str))

    elif args.mode == "drift":
        for name in (models or list(RetrainingConfig.CONFIGS.keys())):
            result = orchestrator.run_drift_check(name)
            print(f"\n{name}: drift={'YES' if result['drift_detected'] else 'no'}, "
                  f"retrain={'YES' if result.get('should_retrain') else 'no'}")

    elif args.mode == "retrain":
        for name in (models or list(RetrainingConfig.CONFIGS.keys())):
            result = orchestrator.run_retraining(name)
            print(f"\n{name}: {'SUCCESS' if result['success'] else 'FAILED'} — "
                  f"{result.get('reason', result.get('metrics', {}))}")

    elif args.mode == "evaluate":
        for name in (models or list(RetrainingConfig.CONFIGS.keys())):
            result = orchestrator.run_evaluation(name)
            print(f"\n{name}: {result.get('recommendation', 'N/A')} — {result.get('reason', '')}")

    elif args.mode == "promote":
        for name in (models or list(RetrainingConfig.CONFIGS.keys())):
            result = orchestrator.run_promotion(name, force=args.force)
            print(f"\n{name}: {result.get('action', 'N/A')} — {result.get('reason', '')}")

    elif args.mode == "status":
        status = orchestrator.promoter.get_model_status()
        for name, info in status.items():
            print(f"\n{name}:")
            for k, v in info.items():
                print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
