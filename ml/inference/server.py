#!/usr/bin/env python3
"""54Bank — Unified ML Inference Server
Loads all trained PyTorch models and serves predictions via REST API.
All models run on CPU. Supports batch inference.

Endpoints:
    POST /v1/fraud/predict          — Transaction fraud scoring
    POST /v1/credit/predict         — Credit risk scoring
    POST /v1/anomaly/score          — Anomaly detection (reconstruction error)
    POST /v1/churn/predict          — Customer churn prediction
    POST /v1/aml/predict            — AML suspicious activity scoring
    POST /v1/gnn/predict            — GNN fraud ring detection
    GET  /v1/models                 — List loaded models + metadata
    GET  /healthz                   — Health check
    GET  /metrics                   — Prometheus metrics
"""
import os
import sys
import json
import time
import logging
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.fraud_detector import FraudDetector
from models.credit_scorer import CreditScorer
from models.anomaly_autoencoder import TransactionVAE
from models.churn_predictor import ChurnPredictor
from models.gnn_fraud_ring import GNNFraudRingDetector
from models.aml_scorer import AMLRiskScorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("54bank-inference")

PORT = int(os.environ.get("INFERENCE_PORT", "8500"))
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
DEVICE = torch.device("cpu")

# ── Metrics ───────────────────────────────────────────────────────────────────
request_count = 0
inference_count = 0
error_count = 0
latency_sum = 0.0
model_latencies = {}
metrics_lock = threading.Lock()

def inc_request():
    global request_count
    with metrics_lock: request_count += 1

def inc_inference(model_name: str, latency_ms: float):
    global inference_count, latency_sum
    with metrics_lock:
        inference_count += 1
        latency_sum += latency_ms
        if model_name not in model_latencies:
            model_latencies[model_name] = {"count": 0, "total_ms": 0.0}
        model_latencies[model_name]["count"] += 1
        model_latencies[model_name]["total_ms"] += latency_ms

def inc_error():
    global error_count
    with metrics_lock: error_count += 1


# ── Model Registry ───────────────────────────────────────────────────────────
class ModelRegistry:
    """Loads and manages all trained models."""

    def __init__(self, weights_dir: Path):
        self.weights_dir = weights_dir
        self.models = {}
        self.scalers = {}
        self.metadata = {}
        self._load_all()

    def _load_all(self):
        start = time.time()

        # 1. Fraud Detector
        self._load_model("fraud_detector", "fraud_detector.pt",
                          lambda: FraudDetector(hidden_dim=128, n_residual_blocks=3, dropout=0.3))

        # 2. Credit Scorer
        self._load_model("credit_scorer", "credit_scorer.pt",
                          lambda: CreditScorer(hidden_dim=128, dropout=0.25))

        # 3. Anomaly VAE
        self._load_model("anomaly_vae", "anomaly_vae.pt",
                          lambda: TransactionVAE(input_dim=11, latent_dim=16, beta=0.5))

        # 4. Churn Predictor
        self._load_model("churn_predictor", "churn_predictor.pt",
                          lambda: ChurnPredictor(hidden_dim=64, num_layers=2, dropout=0.3))

        # 5. GNN Fraud Ring
        self._load_model("gnn_fraud_ring", "gnn_fraud_ring.pt",
                          lambda: GNNFraudRingDetector(hidden_dim=64, heads=4, dropout=0.3))

        # 6. AML Scorer
        self._load_model("aml_scorer", "aml_scorer.pt",
                          lambda: AMLRiskScorer(hidden_dim=96, cross_layers=3, dropout=0.25))

        elapsed = time.time() - start
        logger.info(f"All models loaded in {elapsed:.2f}s ({len(self.models)} models)")

    def _load_model(self, name: str, weight_file: str, model_fn):
        path = self.weights_dir / weight_file
        if not path.exists():
            logger.warning(f"Weight file not found: {path}")
            return

        try:
            checkpoint = torch.load(path, map_location=DEVICE, weights_only=False)
            model = model_fn()
            model.load_state_dict(checkpoint["model_state_dict"])
            model.eval()
            model.to(DEVICE)

            self.models[name] = model
            self.scalers[name] = checkpoint.get("scaler_params", {})
            self.metadata[name] = {
                "epoch": checkpoint.get("epoch", -1),
                "val_auc": checkpoint.get("val_auc", None),
                "weight_file": weight_file,
                "weight_size_kb": round(os.path.getsize(path) / 1024, 1),
                "parameters": sum(p.numel() for p in model.parameters()),
            }
            logger.info(f"  Loaded {name}: {self.metadata[name]['parameters']:,} params, "
                         f"{self.metadata[name]['weight_size_kb']} KB")
        except Exception as e:
            logger.error(f"Failed to load {name}: {e}")

    def get(self, name: str):
        return self.models.get(name)

    def scale(self, name: str, data: np.ndarray) -> np.ndarray:
        params = self.scalers.get(name, {})
        if "mean" in params and "scale" in params:
            mean = np.array(params["mean"])
            scale = np.array(params["scale"])
            return (data - mean) / (scale + 1e-8)
        return data


# ── Inference Functions ──────────────────────────────────────────────────────
def predict_fraud(registry: ModelRegistry, data: dict) -> dict:
    model = registry.get("fraud_detector")
    if model is None:
        return {"error": "fraud_detector model not loaded"}

    start = time.time()
    transactions = data.get("transactions", [data])

    results = []
    for txn in transactions:
        num_features = np.array([[
            txn.get("amount", 0), txn.get("hour", 12), txn.get("day_of_week", 0),
            txn.get("velocity_1h", 0), txn.get("velocity_24h", 0),
            txn.get("amount_vs_avg", 1.0), txn.get("geo_distance_km", 0),
            txn.get("device_age_days", 365), txn.get("is_new_beneficiary", 0),
            txn.get("is_international", 0), txn.get("account_age_days", 365),
            txn.get("balance_ratio", 0.1),
        ]], dtype=np.float32)

        num_scaled = registry.scale("fraud_detector", num_features)
        with torch.no_grad():
            prob = model.predict_proba(
                torch.tensor(num_scaled, dtype=torch.float32),
                torch.tensor([txn.get("merchant_cat_idx", 0)], dtype=torch.long),
                torch.tensor([txn.get("channel_idx", 0)], dtype=torch.long),
                torch.tensor([txn.get("card_type_idx", 0)], dtype=torch.long),
                torch.tensor([txn.get("state_idx", 0)], dtype=torch.long),
            )
        fraud_prob = float(prob.squeeze().item())
        risk_action = ("BLOCK" if fraud_prob > 0.95 else "HOLD" if fraud_prob > 0.80
                        else "STEP_UP" if fraud_prob > 0.60 else "FLAG" if fraud_prob > 0.30
                        else "ALLOW")
        results.append({
            "fraud_probability": round(fraud_prob, 6),
            "risk_action": risk_action,
            "model": "FraudDetector-v1",
            "inference_device": "cpu",
        })

    latency = (time.time() - start) * 1000
    inc_inference("fraud_detector", latency)
    return {"predictions": results, "latency_ms": round(latency, 2)}


def predict_credit(registry: ModelRegistry, data: dict) -> dict:
    model = registry.get("credit_scorer")
    if model is None:
        return {"error": "credit_scorer model not loaded"}

    start = time.time()
    num_features = np.array([[
        data.get("age", 35), data.get("monthly_income", 200000),
        data.get("total_debt", 50000), data.get("dti_ratio", 0.25),
        data.get("employment_years", 5), data.get("num_prior_loans", 2),
        data.get("num_defaults", 0), data.get("loan_amount_requested", 1000000),
        data.get("loan_tenure_months", 24), data.get("collateral_value", 500000),
        data.get("has_guarantor", 0), data.get("account_age_months", 36),
        data.get("avg_monthly_balance", 300000), data.get("num_dependents", 2),
        data.get("collateral_value", 500000) / max(data.get("loan_amount_requested", 1), 1),
    ]], dtype=np.float32)

    num_scaled = registry.scale("credit_scorer", num_features)
    with torch.no_grad():
        out = model(
            torch.tensor(num_scaled, dtype=torch.float32),
            torch.tensor([data.get("sector_idx", 0)], dtype=torch.long),
            torch.tensor([data.get("state_idx", 0)], dtype=torch.long),
        )

    default_prob = float(out["default_prob"].squeeze().item())
    credit_score = float(out["credit_score"].squeeze().item())
    band_idx = int(torch.argmax(out["band_logits"], dim=-1).item())
    band_names = ["poor", "fair", "good", "excellent"]

    latency = (time.time() - start) * 1000
    inc_inference("credit_scorer", latency)
    return {
        "default_probability": round(default_prob, 6),
        "credit_score": round(credit_score, 1),
        "credit_band": band_names[band_idx],
        "approved": credit_score >= 550,
        "max_loan_amount": round(data.get("monthly_income", 200000) * 12 * (0.4 if credit_score >= 650 else 0.2), 2),
        "model": "CreditScorer-v1",
        "inference_device": "cpu",
        "latency_ms": round(latency, 2),
    }


def predict_anomaly(registry: ModelRegistry, data: dict) -> dict:
    model = registry.get("anomaly_vae")
    if model is None:
        return {"error": "anomaly_vae model not loaded"}

    start = time.time()
    import math
    amount = max(data.get("amount", 1000), 1)
    hour = data.get("hour", 12)
    day = data.get("day_of_week", 0)
    num_features = np.array([[
        math.log(amount), math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24), math.sin(2 * math.pi * day / 7),
        math.cos(2 * math.pi * day / 7), data.get("velocity_1h", 0),
        data.get("velocity_24h", 0), data.get("amount_vs_avg", 1.0),
        data.get("balance_ratio", 0.1),
    ]], dtype=np.float32)

    num_scaled = registry.scale("anomaly_vae", num_features)
    score = model.anomaly_score(
        torch.tensor(num_scaled, dtype=torch.float32),
        torch.tensor([data.get("merchant_cat_idx", 0)], dtype=torch.long),
        torch.tensor([data.get("channel_idx", 0)], dtype=torch.long),
    )

    anomaly_score = float(score.item())
    threshold = data.get("threshold", 0.5)
    is_anomaly = anomaly_score > threshold

    latency = (time.time() - start) * 1000
    inc_inference("anomaly_vae", latency)
    return {
        "anomaly_score": round(anomaly_score, 6),
        "is_anomaly": is_anomaly,
        "threshold": threshold,
        "model": "TransactionVAE-v1",
        "inference_device": "cpu",
        "latency_ms": round(latency, 2),
    }


def predict_churn(registry: ModelRegistry, data: dict) -> dict:
    model = registry.get("churn_predictor")
    if model is None:
        return {"error": "churn_predictor model not loaded"}

    start = time.time()
    # Expect sequence of 12 months with 8 features each
    sequence = data.get("monthly_activity", [])
    if len(sequence) < 12:
        # Pad with zeros if shorter
        sequence = sequence + [[0] * 8] * (12 - len(sequence))
    sequence = sequence[:12]

    features = np.array([sequence], dtype=np.float32)
    features_scaled = registry.scale("churn_predictor", features.reshape(-1, 8)).reshape(1, 12, 8)

    with torch.no_grad():
        out = model(torch.tensor(features_scaled, dtype=torch.float32))

    churn_prob = float(out["probability"].squeeze().item())
    attn_weights = out["attention_weights"].squeeze().tolist()

    # Find the months the model is paying most attention to
    top_months = sorted(enumerate(attn_weights), key=lambda x: x[1], reverse=True)[:3]

    latency = (time.time() - start) * 1000
    inc_inference("churn_predictor", latency)
    return {
        "churn_probability": round(churn_prob, 6),
        "churn_risk": "high" if churn_prob > 0.7 else "medium" if churn_prob > 0.4 else "low",
        "attention_weights": [round(w, 4) for w in attn_weights],
        "critical_months": [{"month": m, "attention": round(w, 4)} for m, w in top_months],
        "model": "ChurnPredictor-v1",
        "inference_device": "cpu",
        "latency_ms": round(latency, 2),
    }


def predict_aml(registry: ModelRegistry, data: dict) -> dict:
    model = registry.get("aml_scorer")
    if model is None:
        return {"error": "aml_scorer model not loaded"}

    start = time.time()
    import math
    num_features = np.array([[
        data.get("transaction_count_30d", 10),
        data.get("unique_counterparties_30d", 5),
        data.get("cash_ratio", 0.1), data.get("international_ratio", 0.0),
        math.log1p(data.get("avg_transaction_amount", 50000)),
        math.log1p(data.get("max_transaction_amount", 100000)),
        data.get("round_amount_ratio", 0.1), data.get("night_ratio", 0.05),
        data.get("structuring_score", 0.0), data.get("days_since_last_kyc_update", 90),
    ]], dtype=np.float32)

    num_scaled = registry.scale("aml_scorer", num_features)
    with torch.no_grad():
        out = model(
            torch.tensor(num_scaled, dtype=torch.float32),
            torch.tensor([data.get("pep_flag", 0)], dtype=torch.long),
            torch.tensor([data.get("high_risk_country", 0)], dtype=torch.long),
            torch.tensor([data.get("account_type_idx", 0)], dtype=torch.long),
            torch.tensor([data.get("kyc_level_idx", 0)], dtype=torch.long),
        )

    suspicious_prob = float(out["suspicious_prob"].squeeze().item())
    tier_idx = int(torch.argmax(out["risk_tier_logits"], dim=-1).item())
    tier_names = ["low", "medium", "high", "critical"]

    latency = (time.time() - start) * 1000
    inc_inference("aml_scorer", latency)
    return {
        "suspicious_probability": round(suspicious_prob, 6),
        "risk_tier": tier_names[tier_idx],
        "requires_str": suspicious_prob > 0.7,
        "requires_edd": suspicious_prob > 0.5,
        "model": "AMLRiskScorer-v1",
        "inference_device": "cpu",
        "latency_ms": round(latency, 2),
    }


# ── HTTP Server ──────────────────────────────────────────────────────────────
registry = None

class InferenceHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        inc_request()
        path = self.path.split("?")[0]

        if path == "/healthz":
            self.respond(200, {
                "status": "healthy",
                "models_loaded": len(registry.models),
                "device": str(DEVICE),
            })
        elif path == "/v1/models":
            models_info = {}
            for name, meta in registry.metadata.items():
                models_info[name] = {
                    **meta,
                    "loaded": name in registry.models,
                    "avg_latency_ms": round(
                        model_latencies.get(name, {}).get("total_ms", 0) /
                        max(model_latencies.get(name, {}).get("count", 1), 1), 2
                    ) if name in model_latencies else None,
                    "inference_count": model_latencies.get(name, {}).get("count", 0),
                }
            self.respond(200, {
                "models": models_info,
                "total_inferences": inference_count,
                "device": str(DEVICE),
                "pytorch_version": torch.__version__,
            })
        elif path == "/metrics":
            avg_latency = latency_sum / max(inference_count, 1)
            self.respond(200, {
                "requests_total": request_count,
                "inferences_total": inference_count,
                "errors_total": error_count,
                "avg_latency_ms": round(avg_latency, 2),
                "per_model": model_latencies,
            })
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self):
        inc_request()
        path = self.path.split("?")[0]

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except Exception:
            self.respond(400, {"error": "invalid_json"})
            return

        try:
            if path == "/v1/fraud/predict":
                result = predict_fraud(registry, body)
            elif path == "/v1/credit/predict":
                result = predict_credit(registry, body)
            elif path == "/v1/anomaly/score":
                result = predict_anomaly(registry, body)
            elif path == "/v1/churn/predict":
                result = predict_churn(registry, body)
            elif path == "/v1/aml/predict":
                result = predict_aml(registry, body)
            else:
                self.respond(404, {"error": "not_found"})
                return
            self.respond(200, result)
        except Exception as e:
            inc_error()
            logger.error(f"Inference error on {path}: {e}", exc_info=True)
            self.respond(500, {"error": str(e)})


def main():
    global registry
    logger.info(f"Loading models from {WEIGHTS_DIR}...")
    registry = ModelRegistry(WEIGHTS_DIR)

    server = HTTPServer(("0.0.0.0", PORT), InferenceHandler)
    logger.info(f"54Bank ML Inference Server listening on :{PORT}")
    logger.info(f"Models loaded: {list(registry.models.keys())}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
