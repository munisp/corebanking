#!/usr/bin/env python3
"""54Bank — Train All ML Models
Trains all 6 PyTorch models on synthetic data, saves weights,
logs metrics, and exports training artifacts.

Models:
1. FraudDetector — Transaction fraud classification (MLP + Attention)
2. CreditScorer — Credit risk prediction (Wide-and-Deep)
3. TransactionVAE — Anomaly detection (Variational Autoencoder)
4. ChurnPredictor — Customer churn (Bidirectional GRU + Attention)
5. GNNFraudRingDetector — Fraud ring detection (GAT + GraphSAGE)
6. AMLRiskScorer — AML suspicious activity (Cross Network + MLP)

All models trained on CPU with reproducible seeds.
"""
import os
import sys
import json
import time
import math
import logging
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset, random_split
from sklearn.metrics import (
    roc_auc_score, precision_recall_fscore_support,
    accuracy_score, classification_report, average_precision_score
)
from sklearn.preprocessing import StandardScaler

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from models.fraud_detector import FraudDetector
from models.credit_scorer import CreditScorer
from models.anomaly_autoencoder import TransactionVAE
from models.churn_predictor import ChurnPredictor
from models.gnn_fraud_ring import GNNFraudRingDetector
from models.aml_scorer import AMLRiskScorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("54bank-training")

SEED = 54
torch.manual_seed(SEED)
np.random.seed(SEED)

DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device("cpu")
METRICS_LOG = {}

MERCHANT_CATEGORIES = [
    "grocery", "fuel", "restaurant", "electronics", "clothing",
    "pharmacy", "telecom", "utilities", "transport", "education",
    "healthcare", "entertainment", "real_estate", "agriculture",
    "government", "insurance", "pos_terminal", "atm_withdrawal",
    "online_shopping", "p2p_transfer"
]
TRANSACTION_CHANNELS = ["mobile", "web", "ussd", "pos", "atm", "branch", "api"]
CARD_TYPES = ["verve", "mastercard", "visa"]
NIGERIAN_STATES = [
    "Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu",
    "Delta", "Ogun", "Anambra", "Edo", "Kwara", "Imo", "Borno",
    "Cross River", "Abia", "Osun", "Niger", "Katsina", "Plateau"
]
ACCOUNT_TYPES = ["savings", "current", "domiciliary", "fixed_deposit", "corporate"]
SECTORS = ["oil_gas", "manufacturing", "agriculture", "telecom", "fintech",
           "real_estate", "healthcare", "education", "retail", "transport"]


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════
class FocalLoss(nn.Module):
    """Focal loss for handling class imbalance."""
    def __init__(self, alpha: float = 0.25, gamma: float = 2.0):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce = F.binary_cross_entropy_with_logits(logits, targets, reduction="none")
        pt = torch.exp(-bce)
        focal = self.alpha * (1 - pt) ** self.gamma * bce
        return focal.mean()


class EarlyStopping:
    def __init__(self, patience: int = 10, min_delta: float = 1e-4):
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = float("inf")

    def should_stop(self, val_loss: float) -> bool:
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
            return False
        self.counter += 1
        return self.counter >= self.patience


def compute_class_weights(labels: np.ndarray) -> torch.Tensor:
    n_pos = labels.sum()
    n_neg = len(labels) - n_pos
    weight = n_neg / max(n_pos, 1)
    return torch.tensor([weight], dtype=torch.float32)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. TRAIN FRAUD DETECTOR
# ═══════════════════════════════════════════════════════════════════════════════
def train_fraud_detector(epochs: int = 30, batch_size: int = 512, lr: float = 1e-3):
    logger.info("=" * 60)
    logger.info("TRAINING: Fraud Detector (MLP + Attention)")
    logger.info("=" * 60)

    df = pd.read_parquet(DATA_DIR / "fraud_detection.parquet")

    # Encode categoricals
    merchant_map = {c: i for i, c in enumerate(MERCHANT_CATEGORIES)}
    channel_map = {c: i for i, c in enumerate(TRANSACTION_CHANNELS)}
    card_map = {c: i for i, c in enumerate(CARD_TYPES)}
    state_map = {s: i for i, s in enumerate(NIGERIAN_STATES)}

    df["merchant_cat_idx"] = df["merchant_category"].map(merchant_map).fillna(0).astype(int)
    df["channel_idx"] = df["channel"].map(channel_map).fillna(0).astype(int)
    df["card_type_idx"] = df["card_type"].map(card_map).fillna(0).astype(int)
    df["state_idx"] = df["state"].map(state_map).fillna(0).astype(int)

    num_cols = ["amount", "hour", "day_of_week", "velocity_1h", "velocity_24h",
                "amount_vs_avg", "geo_distance_km", "device_age_days",
                "is_new_beneficiary", "is_international", "account_age_days",
                "balance_ratio"]

    # Normalize numerical features
    scaler = StandardScaler()
    num_data = scaler.fit_transform(df[num_cols].values)

    X_num = torch.tensor(num_data, dtype=torch.float32)
    X_merchant = torch.tensor(df["merchant_cat_idx"].values, dtype=torch.long)
    X_channel = torch.tensor(df["channel_idx"].values, dtype=torch.long)
    X_card = torch.tensor(df["card_type_idx"].values, dtype=torch.long)
    X_state = torch.tensor(df["state_idx"].values, dtype=torch.long)
    y = torch.tensor(df["is_fraud"].values, dtype=torch.float32).unsqueeze(1)

    # Train/val split (80/20)
    n = len(df)
    n_train = int(n * 0.8)
    indices = torch.randperm(n)
    train_idx, val_idx = indices[:n_train], indices[n_train:]

    model = FraudDetector(hidden_dim=128, n_residual_blocks=3, dropout=0.3).to(DEVICE)
    criterion = FocalLoss(alpha=0.75, gamma=2.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=8)

    # Save scaler params for inference
    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "columns": num_cols}

    best_val_auc = 0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        # Mini-batch training
        perm = train_idx[torch.randperm(len(train_idx))]
        epoch_loss = 0
        n_batches = 0

        for i in range(0, len(perm), batch_size):
            batch_idx = perm[i:i + batch_size]
            logits = model(X_num[batch_idx], X_merchant[batch_idx],
                           X_channel[batch_idx], X_card[batch_idx], X_state[batch_idx])
            loss = criterion(logits, y[batch_idx])
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1

        scheduler.step()

        # Validation
        model.eval()
        with torch.no_grad():
            val_logits = model(X_num[val_idx], X_merchant[val_idx],
                               X_channel[val_idx], X_card[val_idx], X_state[val_idx])
            val_loss = criterion(val_logits, y[val_idx]).item()
            val_probs = torch.sigmoid(val_logits).squeeze().numpy()
            val_labels = y[val_idx].squeeze().numpy()
            val_auc = roc_auc_score(val_labels, val_probs)
            val_ap = average_precision_score(val_labels, val_probs)
            val_preds = (val_probs >= 0.5).astype(int)
            val_acc = accuracy_score(val_labels, val_preds)

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_auc": val_auc,
                "val_ap": val_ap,
                "architecture": {
                    "hidden_dim": 128, "n_residual_blocks": 3, "dropout": 0.3,
                    "num_features": 12, "cat_configs": FraudDetector.CAT_CONFIGS,
                },
            }, WEIGHTS_DIR / "fraud_detector.pt")

        if epoch % 5 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {epoch_loss/n_batches:.4f} | "
                        f"Val Loss: {val_loss:.4f} | "
                        f"Val AUC: {val_auc:.4f} | "
                        f"Val AP: {val_ap:.4f} | "
                        f"Val Acc: {val_acc:.4f}")

        if early_stop.should_stop(val_loss):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time

    # Final evaluation
    checkpoint = torch.load(WEIGHTS_DIR / "fraud_detector.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        val_logits = model(X_num[val_idx], X_merchant[val_idx],
                           X_channel[val_idx], X_card[val_idx], X_state[val_idx])
        val_probs = torch.sigmoid(val_logits).squeeze().numpy()
        val_labels = y[val_idx].squeeze().numpy()
        val_preds = (val_probs >= 0.5).astype(int)

    prec, rec, f1, _ = precision_recall_fscore_support(val_labels, val_preds, average="binary")
    auc = roc_auc_score(val_labels, val_probs)
    ap = average_precision_score(val_labels, val_probs)

    metrics = {
        "model": "FraudDetector",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "val_auc_roc": round(auc, 4),
        "val_avg_precision": round(ap, 4),
        "val_precision": round(prec, 4),
        "val_recall": round(rec, 4),
        "val_f1": round(f1, 4),
        "val_accuracy": round(accuracy_score(val_labels, val_preds), 4),
        "weight_file": "fraud_detector.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "fraud_detector.pt") / 1024, 1),
    }
    METRICS_LOG["fraud_detector"] = metrics
    logger.info(f"  ✓ Fraud Detector trained | AUC: {auc:.4f} | AP: {ap:.4f} | F1: {f1:.4f}")
    logger.info(f"    Params: {metrics['parameters']:,} | Size: {metrics['weight_size_kb']} KB | Time: {elapsed:.1f}s")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 2. TRAIN CREDIT SCORER
# ═══════════════════════════════════════════════════════════════════════════════
def train_credit_scorer(epochs: int = 30, batch_size: int = 256, lr: float = 1e-3):
    logger.info("=" * 60)
    logger.info("TRAINING: Credit Scorer (Wide-and-Deep)")
    logger.info("=" * 60)

    df = pd.read_parquet(DATA_DIR / "credit_scoring.parquet")

    sector_map = {s: i for i, s in enumerate(SECTORS)}
    state_map = {s: i for i, s in enumerate(NIGERIAN_STATES)}
    df["sector_idx"] = df["sector"].map(sector_map).fillna(0).astype(int)
    df["state_idx"] = df["state"].map(state_map).fillna(0).astype(int)

    # Engineered feature
    df["collateral_to_loan_ratio"] = df["collateral_value"] / (df["loan_amount_requested"] + 1)

    num_cols = ["age", "monthly_income", "total_debt", "dti_ratio",
                "employment_years", "num_prior_loans", "num_defaults",
                "loan_amount_requested", "loan_tenure_months", "collateral_value",
                "has_guarantor", "account_age_months", "avg_monthly_balance",
                "num_dependents", "collateral_to_loan_ratio"]

    scaler = StandardScaler()
    num_data = scaler.fit_transform(df[num_cols].values)

    X_num = torch.tensor(num_data, dtype=torch.float32)
    X_sector = torch.tensor(df["sector_idx"].values, dtype=torch.long)
    X_state = torch.tensor(df["state_idx"].values, dtype=torch.long)
    y = torch.tensor(df["will_default"].values, dtype=torch.float32).unsqueeze(1)

    # Derive credit band labels for auxiliary task
    # Band: 0=poor(<550), 1=fair(550-649), 2=good(650-749), 3=excellent(750+)
    scores = 300.0 + (1.0 - df["will_default"].values.astype(np.float64)) * 550.0
    scores = scores + np.random.normal(0, 30, len(scores))
    bands = np.digitize(scores, [550, 650, 750]) 
    y_band = torch.tensor(bands, dtype=torch.long)

    n = len(df)
    n_train = int(n * 0.8)
    indices = torch.randperm(n)
    train_idx, val_idx = indices[:n_train], indices[n_train:]

    model = CreditScorer(hidden_dim=128, dropout=0.25).to(DEVICE)
    criterion_default = FocalLoss(alpha=0.6, gamma=2.0)
    criterion_band = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=8)

    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "columns": num_cols}

    best_val_auc = 0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        perm = train_idx[torch.randperm(len(train_idx))]
        epoch_loss = 0
        n_batches = 0

        for i in range(0, len(perm), batch_size):
            batch_idx = perm[i:i + batch_size]
            out = model(X_num[batch_idx], X_sector[batch_idx], X_state[batch_idx])
            loss_default = criterion_default(out["default_logit"], y[batch_idx])
            loss_band = criterion_band(out["band_logits"], y_band[batch_idx])
            loss = loss_default + 0.3 * loss_band

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1

        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_out = model(X_num[val_idx], X_sector[val_idx], X_state[val_idx])
            val_probs = val_out["default_prob"].squeeze().numpy()
            val_labels = y[val_idx].squeeze().numpy()
            val_auc = roc_auc_score(val_labels, val_probs)

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_auc": val_auc,
            }, WEIGHTS_DIR / "credit_scorer.pt")

        if epoch % 5 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {epoch_loss/n_batches:.4f} | "
                        f"Val AUC: {val_auc:.4f}")

        if early_stop.should_stop(1 - val_auc):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time
    checkpoint = torch.load(WEIGHTS_DIR / "credit_scorer.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        val_out = model(X_num[val_idx], X_sector[val_idx], X_state[val_idx])
        val_probs = val_out["default_prob"].squeeze().numpy()
        val_labels = y[val_idx].squeeze().numpy()
        val_preds = (val_probs >= 0.5).astype(int)

    prec, rec, f1, _ = precision_recall_fscore_support(val_labels, val_preds, average="binary")
    auc = roc_auc_score(val_labels, val_probs)

    metrics = {
        "model": "CreditScorer",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "val_auc_roc": round(auc, 4),
        "val_precision": round(prec, 4),
        "val_recall": round(rec, 4),
        "val_f1": round(f1, 4),
        "weight_file": "credit_scorer.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "credit_scorer.pt") / 1024, 1),
    }
    METRICS_LOG["credit_scorer"] = metrics
    logger.info(f"  ✓ Credit Scorer trained | AUC: {auc:.4f} | F1: {f1:.4f}")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 3. TRAIN ANOMALY AUTOENCODER (VAE)
# ═══════════════════════════════════════════════════════════════════════════════
def train_anomaly_vae(epochs: int = 40, batch_size: int = 512, lr: float = 1e-3):
    logger.info("=" * 60)
    logger.info("TRAINING: Transaction VAE (Anomaly Detection)")
    logger.info("=" * 60)

    df = pd.read_parquet(DATA_DIR / "anomaly_detection.parquet")

    # Train only on normal transactions
    df_train_full = df[df["is_anomaly"] == 0].copy()
    df_anomaly = df[df["is_anomaly"] == 1].copy()

    num_cols = ["amount_log", "hour_sin", "hour_cos", "day_sin", "day_cos",
                "velocity_1h", "velocity_24h", "amount_vs_avg", "balance_ratio"]

    scaler = StandardScaler()
    num_train = scaler.fit_transform(df_train_full[num_cols].values)
    num_anomaly = scaler.transform(df_anomaly[num_cols].values)

    X_num_train = torch.tensor(num_train, dtype=torch.float32)
    X_merchant_train = torch.tensor(df_train_full["merchant_cat_idx"].values, dtype=torch.long)
    X_channel_train = torch.tensor(df_train_full["channel_idx"].values, dtype=torch.long)

    X_num_anom = torch.tensor(num_anomaly, dtype=torch.float32)
    X_merchant_anom = torch.tensor(df_anomaly["merchant_cat_idx"].values, dtype=torch.long)
    X_channel_anom = torch.tensor(df_anomaly["channel_idx"].values, dtype=torch.long)

    # Split train set into train/val
    n = len(X_num_train)
    n_train = int(n * 0.85)
    perm = torch.randperm(n)
    train_idx, val_idx = perm[:n_train], perm[n_train:]

    model = TransactionVAE(input_dim=11, latent_dim=16, beta=0.5).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=10)

    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "columns": num_cols}

    best_val_loss = float("inf")
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        batch_perm = train_idx[torch.randperm(len(train_idx))]
        epoch_loss = 0
        epoch_recon = 0
        epoch_kl = 0
        n_batches = 0

        for i in range(0, len(batch_perm), batch_size):
            batch_idx = batch_perm[i:i + batch_size]
            output = model(X_num_train[batch_idx], X_merchant_train[batch_idx],
                           X_channel_train[batch_idx])
            losses = model.loss_function(output)

            optimizer.zero_grad()
            losses["loss"].backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            epoch_loss += losses["loss"].item()
            epoch_recon += losses["recon_loss"].item()
            epoch_kl += losses["kl_loss"].item()
            n_batches += 1

        scheduler.step()

        # Validation
        model.eval()
        with torch.no_grad():
            val_output = model(X_num_train[val_idx], X_merchant_train[val_idx],
                               X_channel_train[val_idx])
            val_losses = model.loss_function(val_output)
            val_loss = val_losses["loss"].item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_loss": val_loss,
            }, WEIGHTS_DIR / "anomaly_vae.pt")

        if epoch % 5 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {epoch_loss/n_batches:.4f} | "
                        f"Recon: {epoch_recon/n_batches:.4f} | "
                        f"KL: {epoch_kl/n_batches:.4f} | "
                        f"Val Loss: {val_loss:.4f}")

        if early_stop.should_stop(val_loss):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time

    # Evaluate: compute anomaly scores on normal vs anomaly data
    checkpoint = torch.load(WEIGHTS_DIR / "anomaly_vae.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    normal_scores = model.anomaly_score(X_num_train[val_idx], X_merchant_train[val_idx],
                                         X_channel_train[val_idx]).numpy()
    anomaly_scores = model.anomaly_score(X_num_anom, X_merchant_anom, X_channel_anom).numpy()

    # Compute AUC using normal vs anomaly scores
    all_scores = np.concatenate([normal_scores, anomaly_scores])
    all_labels = np.concatenate([np.zeros(len(normal_scores)), np.ones(len(anomaly_scores))])
    auc = roc_auc_score(all_labels, all_scores)

    # Find threshold at 95th percentile of normal scores
    threshold = np.percentile(normal_scores, 95)
    detected = (anomaly_scores > threshold).sum()
    detection_rate = detected / len(anomaly_scores)

    metrics = {
        "model": "TransactionVAE",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "val_loss": round(best_val_loss, 4),
        "anomaly_detection_auc": round(auc, 4),
        "anomaly_detection_rate_at_5pct_fpr": round(detection_rate, 4),
        "threshold_95pct": round(float(threshold), 4),
        "mean_normal_score": round(float(normal_scores.mean()), 4),
        "mean_anomaly_score": round(float(anomaly_scores.mean()), 4),
        "weight_file": "anomaly_vae.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "anomaly_vae.pt") / 1024, 1),
    }
    METRICS_LOG["anomaly_vae"] = metrics
    logger.info(f"  ✓ Anomaly VAE trained | AUC: {auc:.4f} | Detection@5%FPR: {detection_rate:.4f}")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 4. TRAIN CHURN PREDICTOR
# ═══════════════════════════════════════════════════════════════════════════════
def train_churn_predictor(epochs: int = 40, batch_size: int = 128, lr: float = 1e-3):
    logger.info("=" * 60)
    logger.info("TRAINING: Churn Predictor (Bi-GRU + Attention)")
    logger.info("=" * 60)

    features = np.load(DATA_DIR / "churn_features.npy")  # (n_customers, 12, 8)
    labels = np.load(DATA_DIR / "churn_labels.npy")  # (n_customers,)

    # Normalize features per-feature across all timesteps
    n, seq_len, feat_dim = features.shape
    features_flat = features.reshape(-1, feat_dim)
    scaler = StandardScaler()
    features_norm = scaler.fit_transform(features_flat).reshape(n, seq_len, feat_dim)

    X = torch.tensor(features_norm, dtype=torch.float32)
    y = torch.tensor(labels, dtype=torch.float32).unsqueeze(1)

    n_train = int(n * 0.8)
    indices = torch.randperm(n)
    train_idx, val_idx = indices[:n_train], indices[n_train:]

    model = ChurnPredictor(hidden_dim=64, num_layers=2, dropout=0.3, bidirectional=True).to(DEVICE)
    criterion = FocalLoss(alpha=0.6, gamma=2.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=10)

    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}

    best_val_auc = 0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        perm = train_idx[torch.randperm(len(train_idx))]
        epoch_loss = 0
        n_batches = 0

        for i in range(0, len(perm), batch_size):
            batch_idx = perm[i:i + batch_size]
            out = model(X[batch_idx])
            loss = criterion(out["logit"], y[batch_idx])

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1

        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_out = model(X[val_idx])
            val_probs = val_out["probability"].squeeze().numpy()
            val_labels = y[val_idx].squeeze().numpy()
            val_auc = roc_auc_score(val_labels, val_probs)

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_auc": val_auc,
            }, WEIGHTS_DIR / "churn_predictor.pt")

        if epoch % 5 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {epoch_loss/n_batches:.4f} | "
                        f"Val AUC: {val_auc:.4f}")

        if early_stop.should_stop(1 - val_auc):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time
    checkpoint = torch.load(WEIGHTS_DIR / "churn_predictor.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        val_out = model(X[val_idx])
        val_probs = val_out["probability"].squeeze().numpy()
        val_labels = y[val_idx].squeeze().numpy()
        val_preds = (val_probs >= 0.5).astype(int)

    prec, rec, f1, _ = precision_recall_fscore_support(val_labels, val_preds, average="binary")
    auc = roc_auc_score(val_labels, val_probs)

    metrics = {
        "model": "ChurnPredictor",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "val_auc_roc": round(auc, 4),
        "val_precision": round(prec, 4),
        "val_recall": round(rec, 4),
        "val_f1": round(f1, 4),
        "weight_file": "churn_predictor.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "churn_predictor.pt") / 1024, 1),
    }
    METRICS_LOG["churn_predictor"] = metrics
    logger.info(f"  ✓ Churn Predictor trained | AUC: {auc:.4f} | F1: {f1:.4f}")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 5. TRAIN GNN FRAUD RING DETECTOR
# ═══════════════════════════════════════════════════════════════════════════════
def train_gnn_fraud_ring(epochs: int = 50, lr: float = 5e-4):
    logger.info("=" * 60)
    logger.info("TRAINING: GNN Fraud Ring Detector (GAT + GraphSAGE)")
    logger.info("=" * 60)

    df_nodes = pd.read_parquet(DATA_DIR / "graph_nodes.parquet")
    df_edges = pd.read_parquet(DATA_DIR / "graph_edges.parquet")

    # Node features
    node_features = df_nodes[["account_type_idx", "balance", "account_age_days",
                               "kyc_level", "num_products",
                               "avg_incoming_amount", "avg_outgoing_amount"]].values.copy()
    # Log-transform monetary features
    for col_idx in [1, 5, 6]:
        node_features[:, col_idx] = np.log1p(node_features[:, col_idx])

    scaler = StandardScaler()
    node_features = scaler.fit_transform(node_features)

    X = torch.tensor(node_features, dtype=torch.float32)
    y = torch.tensor(df_nodes["is_fraud_ring"].values, dtype=torch.float32).unsqueeze(1)

    # Edge index
    edge_src = torch.tensor(df_edges["src"].values, dtype=torch.long)
    edge_dst = torch.tensor(df_edges["dst"].values, dtype=torch.long)
    edge_index = torch.stack([edge_src, edge_dst], dim=0)

    # Edge features (log amount)
    edge_amounts = torch.tensor(np.log1p(df_edges["amount"].values), dtype=torch.float32).unsqueeze(1)

    # Train/val mask (node-level split)
    n_nodes = len(df_nodes)
    indices = torch.randperm(n_nodes)
    n_train = int(n_nodes * 0.7)
    n_val = int(n_nodes * 0.15)
    train_mask = torch.zeros(n_nodes, dtype=torch.bool)
    val_mask = torch.zeros(n_nodes, dtype=torch.bool)
    test_mask = torch.zeros(n_nodes, dtype=torch.bool)
    train_mask[indices[:n_train]] = True
    val_mask[indices[n_train:n_train + n_val]] = True
    test_mask[indices[n_train + n_val:]] = True

    model = GNNFraudRingDetector(hidden_dim=64, heads=4, dropout=0.3).to(DEVICE)

    # Class weights for imbalanced node labels
    pos_weight = compute_class_weights(df_nodes["is_fraud_ring"].values)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=15)

    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}

    best_val_auc = 0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        out = model(X, edge_index, edge_amounts)
        loss = criterion(out["logits"][train_mask], y[train_mask])

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        # Validation
        model.eval()
        with torch.no_grad():
            val_out = model(X, edge_index, edge_amounts)
            val_probs = val_out["probabilities"][val_mask].squeeze().numpy()
            val_labels = y[val_mask].squeeze().numpy()
            if len(np.unique(val_labels)) > 1:
                val_auc = roc_auc_score(val_labels, val_probs)
            else:
                val_auc = 0.5

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_auc": val_auc,
            }, WEIGHTS_DIR / "gnn_fraud_ring.pt")

        if epoch % 10 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {loss.item():.4f} | "
                        f"Val AUC: {val_auc:.4f}")

        if early_stop.should_stop(1 - val_auc):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time

    # Final eval on test set
    checkpoint = torch.load(WEIGHTS_DIR / "gnn_fraud_ring.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        test_out = model(X, edge_index, edge_amounts)
        test_probs = test_out["probabilities"][test_mask].squeeze().numpy()
        test_labels = y[test_mask].squeeze().numpy()
        test_preds = (test_probs >= 0.5).astype(int)

    if len(np.unique(test_labels)) > 1:
        test_auc = roc_auc_score(test_labels, test_probs)
        prec, rec, f1, _ = precision_recall_fscore_support(test_labels, test_preds, average="binary")
    else:
        test_auc = 0.5
        prec = rec = f1 = 0.0

    metrics = {
        "model": "GNNFraudRingDetector",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "test_auc_roc": round(test_auc, 4),
        "test_precision": round(prec, 4),
        "test_recall": round(rec, 4),
        "test_f1": round(f1, 4),
        "num_nodes": n_nodes,
        "num_edges": len(df_edges),
        "num_fraud_ring_nodes": int(df_nodes["is_fraud_ring"].sum()),
        "weight_file": "gnn_fraud_ring.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "gnn_fraud_ring.pt") / 1024, 1),
    }
    METRICS_LOG["gnn_fraud_ring"] = metrics
    logger.info(f"  ✓ GNN Fraud Ring trained | Test AUC: {test_auc:.4f} | F1: {f1:.4f}")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 6. TRAIN AML RISK SCORER
# ═══════════════════════════════════════════════════════════════════════════════
def train_aml_scorer(epochs: int = 30, batch_size: int = 256, lr: float = 1e-3):
    logger.info("=" * 60)
    logger.info("TRAINING: AML Risk Scorer (Wide-and-Deep + CrossNet)")
    logger.info("=" * 60)

    df = pd.read_parquet(DATA_DIR / "aml_risk.parquet")

    account_type_map = {t: i for i, t in enumerate(ACCOUNT_TYPES)}
    kyc_map = {"tier1": 0, "tier2": 1, "tier3": 2}
    df["account_type_idx"] = df["account_type"].map(account_type_map).fillna(0).astype(int)
    df["kyc_level_idx"] = df["kyc_level"].map(kyc_map).fillna(0).astype(int)

    num_cols = ["transaction_count_30d", "unique_counterparties_30d",
                "cash_ratio", "international_ratio", "avg_transaction_amount",
                "max_transaction_amount", "round_amount_ratio",
                "night_ratio", "structuring_score", "days_since_last_kyc_update"]

    # Log-transform monetary columns
    df["avg_transaction_amount"] = np.log1p(df["avg_transaction_amount"])
    df["max_transaction_amount"] = np.log1p(df["max_transaction_amount"])

    scaler = StandardScaler()
    num_data = scaler.fit_transform(df[num_cols].values)

    X_num = torch.tensor(num_data, dtype=torch.float32)
    X_pep = torch.tensor(df["pep_flag"].values, dtype=torch.long)
    X_high_risk = torch.tensor(df["high_risk_country"].values, dtype=torch.long)
    X_account = torch.tensor(df["account_type_idx"].values, dtype=torch.long)
    X_kyc = torch.tensor(df["kyc_level_idx"].values, dtype=torch.long)
    y = torch.tensor(df["is_suspicious"].values, dtype=torch.float32).unsqueeze(1)

    n = len(df)
    n_train = int(n * 0.8)
    indices = torch.randperm(n)
    train_idx, val_idx = indices[:n_train], indices[n_train:]

    model = AMLRiskScorer(hidden_dim=96, cross_layers=3, dropout=0.25).to(DEVICE)
    criterion = FocalLoss(alpha=0.7, gamma=2.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    early_stop = EarlyStopping(patience=8)

    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "columns": num_cols}

    best_val_auc = 0
    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        perm = train_idx[torch.randperm(len(train_idx))]
        epoch_loss = 0
        n_batches = 0

        for i in range(0, len(perm), batch_size):
            batch_idx = perm[i:i + batch_size]
            out = model(X_num[batch_idx], X_pep[batch_idx], X_high_risk[batch_idx],
                        X_account[batch_idx], X_kyc[batch_idx])
            loss = criterion(out["suspicious_logit"], y[batch_idx])
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1

        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_out = model(X_num[val_idx], X_pep[val_idx], X_high_risk[val_idx],
                            X_account[val_idx], X_kyc[val_idx])
            val_probs = val_out["suspicious_prob"].squeeze().numpy()
            val_labels = y[val_idx].squeeze().numpy()
            val_auc = roc_auc_score(val_labels, val_probs)

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler_params": scaler_params,
                "epoch": epoch,
                "val_auc": val_auc,
            }, WEIGHTS_DIR / "aml_scorer.pt")

        if epoch % 5 == 0 or epoch == epochs - 1:
            logger.info(f"  Epoch {epoch+1:3d}/{epochs} | "
                        f"Loss: {epoch_loss/n_batches:.4f} | "
                        f"Val AUC: {val_auc:.4f}")

        if early_stop.should_stop(1 - val_auc):
            logger.info(f"  Early stopping at epoch {epoch+1}")
            break

    elapsed = time.time() - start_time
    checkpoint = torch.load(WEIGHTS_DIR / "aml_scorer.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        val_out = model(X_num[val_idx], X_pep[val_idx], X_high_risk[val_idx],
                        X_account[val_idx], X_kyc[val_idx])
        val_probs = val_out["suspicious_prob"].squeeze().numpy()
        val_labels = y[val_idx].squeeze().numpy()
        val_preds = (val_probs >= 0.5).astype(int)

    prec, rec, f1, _ = precision_recall_fscore_support(val_labels, val_preds, average="binary")
    auc = roc_auc_score(val_labels, val_probs)

    metrics = {
        "model": "AMLRiskScorer",
        "parameters": sum(p.numel() for p in model.parameters()),
        "epochs_trained": checkpoint["epoch"] + 1,
        "training_time_seconds": round(elapsed, 1),
        "val_auc_roc": round(auc, 4),
        "val_precision": round(prec, 4),
        "val_recall": round(rec, 4),
        "val_f1": round(f1, 4),
        "weight_file": "aml_scorer.pt",
        "weight_size_kb": round(os.path.getsize(WEIGHTS_DIR / "aml_scorer.pt") / 1024, 1),
    }
    METRICS_LOG["aml_scorer"] = metrics
    logger.info(f"  ✓ AML Scorer trained | AUC: {auc:.4f} | F1: {f1:.4f}")
    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — TRAIN ALL MODELS
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    logger.info("=" * 70)
    logger.info("54Bank — Training All ML Models")
    logger.info(f"Device: {DEVICE}")
    logger.info(f"PyTorch: {torch.__version__}")
    logger.info(f"Data dir: {DATA_DIR}")
    logger.info(f"Weights dir: {WEIGHTS_DIR}")
    logger.info("=" * 70)

    total_start = time.time()

    # Check data exists
    if not (DATA_DIR / "fraud_detection.parquet").exists():
        logger.error("Training data not found. Run `python ml/data/generate_all.py` first.")
        sys.exit(1)

    # Train each model
    models_trained = {}
    try:
        m, _ = train_fraud_detector(epochs=30, batch_size=512, lr=1e-3)
        models_trained["fraud_detector"] = m
    except Exception as e:
        logger.error(f"Fraud Detector training failed: {e}", exc_info=True)

    try:
        m, _ = train_credit_scorer(epochs=30, batch_size=256, lr=1e-3)
        models_trained["credit_scorer"] = m
    except Exception as e:
        logger.error(f"Credit Scorer training failed: {e}", exc_info=True)

    try:
        m, _ = train_anomaly_vae(epochs=40, batch_size=512, lr=1e-3)
        models_trained["anomaly_vae"] = m
    except Exception as e:
        logger.error(f"Anomaly VAE training failed: {e}", exc_info=True)

    try:
        m, _ = train_churn_predictor(epochs=40, batch_size=128, lr=1e-3)
        models_trained["churn_predictor"] = m
    except Exception as e:
        logger.error(f"Churn Predictor training failed: {e}", exc_info=True)

    try:
        m, _ = train_gnn_fraud_ring(epochs=50, lr=5e-4)
        models_trained["gnn_fraud_ring"] = m
    except Exception as e:
        logger.error(f"GNN Fraud Ring training failed: {e}", exc_info=True)

    try:
        m, _ = train_aml_scorer(epochs=30, batch_size=256, lr=1e-3)
        models_trained["aml_scorer"] = m
    except Exception as e:
        logger.error(f"AML Scorer training failed: {e}", exc_info=True)

    total_elapsed = time.time() - total_start

    # Save metrics summary
    summary = {
        "training_date": datetime.now(timezone.utc).isoformat(),
        "device": str(DEVICE),
        "pytorch_version": torch.__version__,
        "total_training_time_seconds": round(total_elapsed, 1),
        "models_trained": len(models_trained),
        "models_failed": 6 - len(models_trained),
        "models": METRICS_LOG,
    }
    metrics_path = WEIGHTS_DIR / "training_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(summary, f, indent=2)

    logger.info("\n" + "=" * 70)
    logger.info("TRAINING COMPLETE")
    logger.info(f"Models trained: {len(models_trained)}/6")
    logger.info(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    logger.info(f"Metrics: {metrics_path}")
    logger.info("Weight files:")
    for f_name in sorted(WEIGHTS_DIR.glob("*.pt")):
        size_kb = os.path.getsize(f_name) / 1024
        logger.info(f"  {f_name.name}: {size_kb:.1f} KB")
    logger.info("=" * 70)
