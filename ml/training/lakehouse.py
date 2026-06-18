#!/usr/bin/env python3
"""54Bank — Lakehouse (Delta Lake) Integration for ML Pipelines
Handles:
1. Writing training datasets to Delta Lake format
2. Logging training metrics to Delta Lake tables
3. Model registry metadata persisted in Delta Lake
4. Feature store for inference-time feature serving
5. Experiment tracking with Delta Lake versioning

Directory structure:
    ml/data/datasets/delta/
        ├── fraud_detection/        # Training data (Delta table)
        ├── credit_scoring/         # Training data
        ├── aml_risk/               # Training data
        ├── anomaly_detection/      # Training data
        ├── graph_nodes/            # Graph node features
        ├── graph_edges/            # Graph edge list
        ├── training_runs/          # Experiment metrics log
        ├── model_registry/         # Model version registry
        └── feature_store/          # Precomputed features for serving
"""
import os
import json
import time
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

try:
    from deltalake import DeltaTable, write_deltalake
    DELTA_AVAILABLE = True
except ImportError:
    DELTA_AVAILABLE = False

DELTA_DIR = Path(__file__).parent.parent / "data" / "datasets" / "delta"
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"


class LakehouseManager:
    """Manages Delta Lake tables for the ML pipeline."""

    def __init__(self, base_dir: str = None):
        self.base_dir = Path(base_dir) if base_dir else DELTA_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)
        if not DELTA_AVAILABLE:
            print("Warning: deltalake not installed. Using Parquet fallback.")

    def log_training_run(self, model_name: str, metrics: dict,
                          hyperparams: dict = None, tags: dict = None):
        """Log a training run to the training_runs Delta table."""
        record = {
            "run_id": f"{model_name}_{int(time.time())}",
            "model_name": model_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "val_auc_roc": metrics.get("val_auc_roc", None),
            "val_f1": metrics.get("val_f1", None),
            "val_precision": metrics.get("val_precision", None),
            "val_recall": metrics.get("val_recall", None),
            "training_time_seconds": metrics.get("training_time_seconds", 0),
            "epochs_trained": metrics.get("epochs_trained", 0),
            "parameters": metrics.get("parameters", 0),
            "weight_file": metrics.get("weight_file", ""),
            "weight_size_kb": metrics.get("weight_size_kb", 0),
            "hyperparams": json.dumps(hyperparams or {}),
            "tags": json.dumps(tags or {}),
        }

        df = pd.DataFrame([record])
        table_path = str(self.base_dir / "training_runs")

        if DELTA_AVAILABLE:
            try:
                write_deltalake(table_path, df, mode="append")
            except Exception:
                write_deltalake(table_path, df, mode="overwrite")
        else:
            df.to_parquet(table_path + f"/{record['run_id']}.parquet", index=False)

        return record["run_id"]

    def register_model(self, model_name: str, version: str, weight_path: str,
                        metrics: dict, status: str = "staging"):
        """Register a model version in the model_registry Delta table."""
        record = {
            "model_name": model_name,
            "version": version,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "weight_path": weight_path,
            "status": status,  # staging, production, archived
            "val_auc_roc": metrics.get("val_auc_roc", None),
            "val_f1": metrics.get("val_f1", None),
            "parameters": metrics.get("parameters", 0),
            "weight_size_kb": metrics.get("weight_size_kb", 0),
        }

        df = pd.DataFrame([record])
        table_path = str(self.base_dir / "model_registry")

        if DELTA_AVAILABLE:
            try:
                write_deltalake(table_path, df, mode="append")
            except Exception:
                write_deltalake(table_path, df, mode="overwrite")
        else:
            df.to_parquet(table_path + f"/{model_name}_{version}.parquet", index=False)

        return record

    def write_feature_store(self, entity_type: str, features_df: pd.DataFrame):
        """Write precomputed features to the feature store Delta table."""
        table_path = str(self.base_dir / "feature_store" / entity_type)

        if DELTA_AVAILABLE:
            write_deltalake(table_path, features_df, mode="overwrite")
        else:
            Path(table_path).mkdir(parents=True, exist_ok=True)
            features_df.to_parquet(table_path + "/features.parquet", index=False)

    def get_training_history(self, model_name: str = None) -> pd.DataFrame:
        """Read training run history from Delta table."""
        table_path = str(self.base_dir / "training_runs")

        if DELTA_AVAILABLE:
            try:
                dt = DeltaTable(table_path)
                df = dt.to_pandas()
                if model_name:
                    df = df[df["model_name"] == model_name]
                return df
            except Exception:
                return pd.DataFrame()
        else:
            parquets = list(Path(table_path).glob("*.parquet"))
            if not parquets:
                return pd.DataFrame()
            df = pd.concat([pd.read_parquet(p) for p in parquets])
            if model_name:
                df = df[df["model_name"] == model_name]
            return df

    def get_model_registry(self, model_name: str = None, status: str = None) -> pd.DataFrame:
        """Read model registry from Delta table."""
        table_path = str(self.base_dir / "model_registry")

        if DELTA_AVAILABLE:
            try:
                dt = DeltaTable(table_path)
                df = dt.to_pandas()
                if model_name:
                    df = df[df["model_name"] == model_name]
                if status:
                    df = df[df["status"] == status]
                return df
            except Exception:
                return pd.DataFrame()
        else:
            parquets = list(Path(table_path).glob("*.parquet"))
            if not parquets:
                return pd.DataFrame()
            df = pd.concat([pd.read_parquet(p) for p in parquets])
            if model_name:
                df = df[df["model_name"] == model_name]
            if status:
                df = df[df["status"] == status]
            return df

    def log_all_models(self):
        """Log all trained models from weights directory to Lakehouse."""
        metrics_path = WEIGHTS_DIR / "training_metrics.json"
        if not metrics_path.exists():
            print("No training_metrics.json found. Train models first.")
            return

        with open(metrics_path) as f:
            all_metrics = json.load(f)

        for model_name, metrics in all_metrics.get("models", {}).items():
            # Log training run
            run_id = self.log_training_run(model_name, metrics)
            print(f"  Logged training run: {run_id}")

            # Register model
            version = f"v1.0.{metrics.get('epochs_trained', 0)}"
            weight_path = str(WEIGHTS_DIR / metrics.get("weight_file", ""))
            self.register_model(model_name, version, weight_path, metrics, status="production")
            print(f"  Registered model: {model_name} {version}")


if __name__ == "__main__":
    print("=" * 70)
    print("54Bank — Lakehouse Integration")
    print(f"Delta Lake available: {DELTA_AVAILABLE}")
    print("=" * 70)

    manager = LakehouseManager()
    manager.log_all_models()

    # Show training history
    history = manager.get_training_history()
    if not history.empty:
        print(f"\nTraining runs: {len(history)}")
        print(history[["model_name", "val_auc_roc", "val_f1", "training_time_seconds"]].to_string())

    # Show model registry
    registry = manager.get_model_registry()
    if not registry.empty:
        print(f"\nModel registry: {len(registry)}")
        print(registry[["model_name", "version", "status", "val_auc_roc"]].to_string())

    print("\nDone.")
