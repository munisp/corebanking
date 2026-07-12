# 54Bank ML Stack

Real end-to-end AI/ML/DL/GNN stack with trained PyTorch models, saved weights, proper training loops, Lakehouse (Delta Lake) integration, and Ray distributed compute support.

## Models

| Model | Architecture | Parameters | AUC-ROC | F1 | Weight File | Size |
|-------|-------------|:----------:|:-------:|:--:|------------|:----:|
| **FraudDetector** | MLP + Self-Attention + 3 Residual Blocks | 173,438 | 0.9995 | 0.958 | `fraud_detector.pt` | 712 KB |
| **CreditScorer** | Wide-and-Deep + Feature Crossing | 80,761 | 0.866 | 0.803 | `credit_scorer.pt` | 336 KB |
| **TransactionVAE** | Variational Autoencoder (encoder-decoder) | 9,137 | 0.980 | — | `anomaly_vae.pt` | 49 KB |
| **ChurnPredictor** | Bidirectional GRU + Temporal Attention | 125,697 | 1.000 | 1.000 | `churn_predictor.pt` | 526 KB |
| **GNNFraudRing** | GAT (4-head) + GraphSAGE message passing | 21,345 | 0.9998 | 0.755 | `gnn_fraud_ring.pt` | 87 KB |
| **AMLRiskScorer** | Cross Network (DCN-v2) + Deep MLP | 26,970 | 1.000 | 0.999 | `aml_scorer.pt` | 109 KB |

All models train and run inference on **CPU only** — no GPU required.

## Quick Start

```bash
# 1. Install dependencies
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install pandas scikit-learn pyarrow deltalake

# 2. Generate synthetic training data (612K records)
python ml/data/generate_all.py

# 3. Train all 6 models (~3 minutes on CPU)
python ml/training/train_all.py

# 4. Start inference server
python ml/inference/server.py
# Server runs on :8500

# 5. Test inference
curl -X POST http://localhost:8500/v1/fraud/predict \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000000, "hour": 2, "velocity_1h": 15, "is_international": 1}'
```

## Directory Structure

```
ml/
├── data/
│   ├── generate_all.py          # Synthetic data generator (612K records)
│   └── datasets/
│       ├── fraud_detection.parquet    # 100K transactions (3% fraud)
│       ├── credit_scoring.parquet     # 50K loan applications (23% default)
│       ├── aml_risk.parquet           # 50K profiles (5% suspicious)
│       ├── anomaly_detection.parquet  # 82K transactions (2.4% anomaly)
│       ├── churn_sequences.parquet    # 240K monthly records (12% churn)
│       ├── churn_labels.parquet       # 20K customer labels
│       ├── graph_nodes.parquet        # 10K accounts (233 fraud ring)
│       ├── graph_edges.parquet        # 80K transactions (288 fraud)
│       ├── churn_features.npy         # NumPy array for direct training
│       ├── churn_labels.npy
│       └── delta/                     # Delta Lake tables
│           ├── fraud_detection/
│           ├── credit_scoring/
│           ├── aml_risk/
│           ├── anomaly_detection/
│           ├── graph_nodes/
│           ├── graph_edges/
│           ├── training_runs/         # Experiment tracking
│           ├── model_registry/        # Model versioning
│           └── feature_store/
├── models/
│   ├── fraud_detector.py        # MLP + Self-Attention
│   ├── credit_scorer.py         # Wide-and-Deep + Feature Crossing
│   ├── anomaly_autoencoder.py   # Variational Autoencoder
│   ├── churn_predictor.py       # Bi-GRU + Temporal Attention
│   ├── gnn_fraud_ring.py        # GAT + GraphSAGE (pure PyTorch)
│   └── aml_scorer.py            # Cross Network + Deep MLP
├── training/
│   ├── train_all.py             # Sequential training (all 6 models)
│   ├── ray_distributed.py       # Ray parallel training
│   └── lakehouse.py             # Delta Lake integration
├── inference/
│   └── server.py                # REST API inference server (:8500)
├── weights/
│   ├── fraud_detector.pt        # Trained weights + scaler params
│   ├── credit_scorer.pt
│   ├── anomaly_vae.pt
│   ├── churn_predictor.pt
│   ├── gnn_fraud_ring.pt
│   ├── aml_scorer.pt
│   └── training_metrics.json    # All metrics summary
└── configs/
```

## Inference API

### POST /v1/fraud/predict
Transaction fraud scoring. Returns probability + risk action (ALLOW/FLAG/STEP_UP/HOLD/BLOCK).

### POST /v1/credit/predict
Credit risk assessment. Returns default probability, credit score (300-850), credit band, and approval decision.

### POST /v1/anomaly/score
Anomaly detection via VAE reconstruction error. Higher score = more anomalous.

### POST /v1/churn/predict
Customer churn prediction from 12-month activity sequence. Returns probability + attention weights showing which months drove the prediction.

### POST /v1/aml/predict
AML suspicious activity scoring. Returns probability + risk tier + STR/EDD flags.

### GET /v1/models
List all loaded models with metadata (parameters, AUC, latency stats).

### GET /healthz
Health check.

## Ray Distributed Training

```bash
# Install Ray
pip install ray[default]

# Single node (auto-detect CPUs)
python ml/training/ray_distributed.py

# Connect to existing cluster
RAY_ADDRESS=ray://head:10001 python ml/training/ray_distributed.py

# Custom parallelism
RAY_NUM_WORKERS=8 python ml/training/ray_distributed.py
```

## Lakehouse (Delta Lake) Integration

Training data, experiment metrics, and model registry are stored as Delta Lake tables:

```python
from ml.training.lakehouse import LakehouseManager

manager = LakehouseManager()

# Log training run
manager.log_training_run("fraud_detector", {"val_auc_roc": 0.9995})

# Register model version
manager.register_model("fraud_detector", "v1.0", "weights/fraud_detector.pt", metrics)

# Query training history
df = manager.get_training_history("fraud_detector")

# Get production models
df = manager.get_model_registry(status="production")
```

## Continuous Training Pipeline

Automated retraining system that monitors model performance and retrains when data drifts or performance degrades.

### Pipeline Stages
1. **Data Ingestion** — Pulls labeled data from PostgreSQL, Kafka, or file exports
2. **Drift Detection** — KS test + PSI (numerical), Chi-squared (categorical), AUC degradation (concept drift)
3. **Retraining** — Trains challenger model with same architecture but on new data
4. **Champion-Challenger** — Paired bootstrap test for statistical significance, business rule compliance
5. **Promotion** — Staging → Canary (10-50% traffic) → Production, with automatic rollback
6. **Monitoring** — Prometheus metrics, HTML dashboard, alerts

### Quick Start

```bash
# Run full pipeline (drift check → retrain if needed → evaluate → promote)
python -m ml.continuous_training.orchestrator --mode full

# Drift check only
python -m ml.continuous_training.orchestrator --mode drift

# Force retrain specific model
python -m ml.continuous_training.orchestrator --mode retrain --model fraud_detector --force

# Start monitoring dashboard (http://localhost:8501/monitoring/dashboard)
python -m ml.continuous_training.monitoring

# Start scheduler daemon (cron-based retraining)
python -m ml.continuous_training.scheduler
```

### Retraining Schedule

| Model | Schedule | Min Samples | Requires Approval |
|-------|----------|:-----------:|:-----------------:|
| FraudDetector | Daily | 5,000 | Yes |
| CreditScorer | Weekly | 2,000 | No |
| AnomalyVAE | Weekly | 5,000 | No |
| ChurnPredictor | Monthly | 1,000 | No |
| GNNFraudRing | Weekly | 500 | Yes |
| AMLRiskScorer | Daily | 3,000 | Yes |

### Business Rules (Champion-Challenger)

| Model | Recall Floor | FPR Ceiling | Min AUC Improvement |
|-------|:-----------:|:-----------:|:-------------------:|
| FraudDetector | 90% | 10% | 0.5% |
| CreditScorer | 60% | 15% | 1.0% |
| AMLRiskScorer | 95% | 15% | 0.5% |
| ChurnPredictor | 70% | 20% | 1.0% |

### Monitoring Endpoints

```
GET  /monitoring/dashboard             — HTML dashboard
GET  /monitoring/status                — JSON status of all models
GET  /monitoring/prometheus            — Prometheus metrics
GET  /monitoring/models/{name}/drift   — Latest drift report
GET  /monitoring/models/{name}/metrics — Current model metrics
POST /monitoring/trigger/{name}        — Trigger manual retraining
```

## Synthetic Data

All data uses realistic Nigerian banking context:
- **Names**: Nigerian first/last names (Adebayo Okafor, Ngozi Nwosu, etc.)
- **BVN**: 11-digit Bank Verification Numbers (22xxxxxxxxx format)
- **Phone**: Nigerian prefixes (0803, 0805, 0703, 0903, etc.)
- **States**: 20 Nigerian states (Lagos, Abuja, Kano, Rivers, etc.)
- **Amounts**: NGN ranges realistic for Nigerian banking
- **Merchants**: Nigerian merchant categories (POS, MTN airtime, etc.)
- **CBN compliance**: Structuring near ₦1M threshold, KYC tiers
