#!/usr/bin/env python3
"""54Bank — Ray Distributed Training Support
Wraps all model training in Ray for distributed compute.
Supports single-node multi-worker and multi-node configurations.

Usage:
    # Single node (auto-detect CPUs):
    python ray_distributed.py

    # Connect to existing Ray cluster:
    RAY_ADDRESS=ray://head-node:10001 python ray_distributed.py

    # Custom parallelism:
    RAY_NUM_WORKERS=4 python ray_distributed.py
"""
import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("54bank-ray")

WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"


def train_single_model(model_name: str, config: dict) -> dict:
    """Train a single model — designed to run as a Ray remote task.
    Each call is self-contained: loads data, trains, saves weights.
    """
    import numpy as np
    import torch
    from pathlib import Path
    import sys, time

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from training.train_all import (
        train_fraud_detector, train_credit_scorer, train_anomaly_vae,
        train_churn_predictor, train_gnn_fraud_ring, train_aml_scorer,
    )

    torch.manual_seed(config.get("seed", 54))
    np.random.seed(config.get("seed", 54))

    start = time.time()
    try:
        trainers = {
            "fraud_detector": lambda: train_fraud_detector(
                epochs=config.get("epochs", 30),
                batch_size=config.get("batch_size", 512),
                lr=config.get("lr", 1e-3)),
            "credit_scorer": lambda: train_credit_scorer(
                epochs=config.get("epochs", 30),
                batch_size=config.get("batch_size", 256),
                lr=config.get("lr", 1e-3)),
            "anomaly_vae": lambda: train_anomaly_vae(
                epochs=config.get("epochs", 40),
                batch_size=config.get("batch_size", 512),
                lr=config.get("lr", 1e-3)),
            "churn_predictor": lambda: train_churn_predictor(
                epochs=config.get("epochs", 40),
                batch_size=config.get("batch_size", 128),
                lr=config.get("lr", 1e-3)),
            "gnn_fraud_ring": lambda: train_gnn_fraud_ring(
                epochs=config.get("epochs", 50),
                lr=config.get("lr", 5e-4)),
            "aml_scorer": lambda: train_aml_scorer(
                epochs=config.get("epochs", 30),
                batch_size=config.get("batch_size", 256),
                lr=config.get("lr", 1e-3)),
        }

        if model_name not in trainers:
            return {"model": model_name, "status": "error", "error": f"Unknown model: {model_name}"}

        _, metrics = trainers[model_name]()
        metrics["status"] = "success"
        metrics["total_time"] = round(time.time() - start, 1)
        return metrics

    except Exception as e:
        return {
            "model": model_name,
            "status": "error",
            "error": str(e),
            "total_time": round(time.time() - start, 1),
        }


def run_distributed_training():
    """Run all model training tasks in parallel using Ray."""
    try:
        import ray
    except ImportError:
        logger.warning("Ray not installed. Running sequential training instead.")
        logger.info("Install with: pip install ray[default]")
        return run_sequential_training()

    ray_address = os.environ.get("RAY_ADDRESS", None)
    num_workers = int(os.environ.get("RAY_NUM_WORKERS", "0"))

    logger.info("=" * 70)
    logger.info("54Bank — Ray Distributed Training")
    logger.info(f"Ray address: {ray_address or 'local'}")
    logger.info("=" * 70)

    # Initialize Ray
    if ray_address:
        ray.init(address=ray_address)
    else:
        ray.init(num_cpus=num_workers if num_workers > 0 else None)

    logger.info(f"Ray cluster: {ray.cluster_resources()}")

    # Define training configs
    model_configs = {
        "fraud_detector": {"epochs": 30, "batch_size": 512, "lr": 1e-3, "seed": 54},
        "credit_scorer": {"epochs": 30, "batch_size": 256, "lr": 1e-3, "seed": 54},
        "anomaly_vae": {"epochs": 40, "batch_size": 512, "lr": 1e-3, "seed": 54},
        "churn_predictor": {"epochs": 40, "batch_size": 128, "lr": 1e-3, "seed": 54},
        "gnn_fraud_ring": {"epochs": 50, "lr": 5e-4, "seed": 54},
        "aml_scorer": {"epochs": 30, "batch_size": 256, "lr": 1e-3, "seed": 54},
    }

    # Create remote function
    train_remote = ray.remote(num_cpus=2)(train_single_model)

    # Submit all training tasks
    start_time = time.time()
    futures = {}
    for model_name, config in model_configs.items():
        logger.info(f"  Submitting {model_name}...")
        futures[model_name] = train_remote.remote(model_name, config)

    # Collect results
    results = {}
    for model_name, future in futures.items():
        try:
            result = ray.get(future)
            results[model_name] = result
            status = result.get("status", "unknown")
            if status == "success":
                logger.info(f"  {model_name}: AUC={result.get('val_auc_roc', result.get('test_auc_roc', 'N/A'))}")
            else:
                logger.error(f"  {model_name}: FAILED — {result.get('error', 'unknown')}")
        except Exception as e:
            results[model_name] = {"status": "error", "error": str(e)}
            logger.error(f"  {model_name}: Ray task failed — {e}")

    total_time = time.time() - start_time

    # Save summary
    summary = {
        "training_date": datetime.now(timezone.utc).isoformat(),
        "mode": "ray_distributed",
        "ray_address": ray_address or "local",
        "ray_resources": dict(ray.cluster_resources()),
        "total_time_seconds": round(total_time, 1),
        "models": results,
    }
    summary_path = WEIGHTS_DIR / "ray_training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)

    ray.shutdown()

    logger.info(f"\nDistributed training complete in {total_time:.1f}s")
    logger.info(f"Summary: {summary_path}")
    return results


def run_sequential_training():
    """Fallback: run all training sequentially when Ray is not available."""
    logger.info("Running sequential training (Ray not available)...")
    from training.train_all import (
        train_fraud_detector, train_credit_scorer, train_anomaly_vae,
        train_churn_predictor, train_gnn_fraud_ring, train_aml_scorer,
    )

    results = {}
    for name, trainer in [
        ("fraud_detector", lambda: train_fraud_detector(30, 512, 1e-3)),
        ("credit_scorer", lambda: train_credit_scorer(30, 256, 1e-3)),
        ("anomaly_vae", lambda: train_anomaly_vae(40, 512, 1e-3)),
        ("churn_predictor", lambda: train_churn_predictor(40, 128, 1e-3)),
        ("gnn_fraud_ring", lambda: train_gnn_fraud_ring(50, 5e-4)),
        ("aml_scorer", lambda: train_aml_scorer(30, 256, 1e-3)),
    ]:
        try:
            _, metrics = trainer()
            results[name] = metrics
        except Exception as e:
            results[name] = {"status": "error", "error": str(e)}
            logger.error(f"{name} failed: {e}")

    return results


if __name__ == "__main__":
    run_distributed_training()
