---
name: testing-ml-pipeline
description: Test the 54Bank ML inference server, continuous training pipeline, drift detection, champion-challenger, model promoter, and monitoring dashboard end-to-end. Use when verifying ML model changes, training pipeline modifications, or monitoring API updates.
---

# Testing the 54Bank ML Pipeline

## Prerequisites

- Python 3.12+ with packages: torch, pandas, numpy, sklearn, pyarrow, deltalake, scipy
- Weight files in `ml/weights/` (6 .pt files: fraud_detector, credit_scorer, anomaly_vae, churn_predictor, gnn_fraud_ring, aml_scorer)
- Training data parquet files in `ml/data/datasets/`
- Ports 8500 (inference) and 8501 (monitoring) must be free

## Devin Secrets Needed

None — all testing runs locally with CPU inference.

## Quick Check: Are Ports Free?

```bash
fuser -k 8500/tcp 2>/dev/null; fuser -k 8501/tcp 2>/dev/null
```

## Step 1: Start Inference Server

```bash
cd /home/ubuntu/repos/corebanking
python -m ml.inference.server 2>&1 &
sleep 3
curl -s http://localhost:8500/healthz
```

**Expected**: `{"status": "healthy", "models_loaded": 6, "device": "cpu"}`

If `models_loaded` < 6, check that all .pt weight files exist in `ml/weights/`.

## Step 2: Test Inference Endpoints

All 5 working endpoints (note: `/v1/gnn/predict` might not be routed — check `do_POST` in `ml/inference/server.py`):

```bash
# Fraud — suspicious transaction
curl -s -X POST http://localhost:8500/v1/fraud/predict \
  -H "Content-Type: application/json" \
  -d '{"amount":5000000,"hour":2,"day_of_week":6,"velocity_1h":5,"velocity_24h":15,"amount_vs_avg":50.0,"geo_distance_km":800,"device_age_days":1,"is_new_beneficiary":1,"is_international":1,"account_age_days":30,"balance_ratio":0.95}'

# Credit — good borrower
curl -s -X POST http://localhost:8500/v1/credit/predict \
  -H "Content-Type: application/json" \
  -d '{"age":42,"monthly_income":450000,"total_debt":50000,"dti_ratio":0.11,"employment_years":8,"num_prior_loans":3,"num_defaults":0,"loan_amount_requested":2000000,"loan_tenure_months":36,"collateral_value":3000000,"has_guarantor":1,"account_age_months":60,"avg_monthly_balance":600000,"num_dependents":2,"sector_idx":1,"state_idx":5}'

# AML — PEP with structuring
curl -s -X POST http://localhost:8500/v1/aml/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction_count_30d":45,"unique_counterparties_30d":20,"cash_ratio":0.8,"international_ratio":0.5,"avg_transaction_amount":950000,"max_transaction_amount":4900000,"round_amount_ratio":0.7,"night_ratio":0.4,"structuring_score":0.9,"days_since_last_kyc_update":400,"pep_flag":1,"high_risk_country":1,"account_type_idx":0,"kyc_level_idx":0}'

# Anomaly — normal transaction
curl -s -X POST http://localhost:8500/v1/anomaly/score \
  -H "Content-Type: application/json" \
  -d '{"amount":15000,"hour":14,"day_of_week":2,"velocity_1h":1,"velocity_24h":3,"amount_vs_avg":1.0,"balance_ratio":0.05,"merchant_cat_idx":2,"channel_idx":1}'

# Churn — declining activity (12 months)
curl -s -X POST http://localhost:8500/v1/churn/predict \
  -H "Content-Type: application/json" \
  -d '{"monthly_activity":[[10,500000,5,3,1,0,200000,1],[8,400000,4,2,1,0,180000,1],[7,350000,3,2,1,0,160000,1],[5,250000,3,1,1,0,120000,1],[4,200000,2,1,0,0,100000,0],[3,150000,2,1,0,0,80000,0],[2,100000,1,0,0,0,50000,0],[1,50000,1,0,0,0,30000,0],[1,30000,0,0,0,0,20000,0],[0,10000,0,0,0,1,10000,0],[0,5000,0,0,0,1,5000,0],[0,0,0,0,0,1,0,0]]}'
```

**Key assertions**:
- Fraud: `fraud_probability` > 0.5 for suspicious input, `predictions` is an array
- Credit: `credit_score` is a float, `credit_band` in [poor, fair, good, excellent]
- AML: `suspicious_probability` is a float, `risk_tier` in [low, medium, high, critical]
- Anomaly: `anomaly_score` >= 0, `is_anomaly` is boolean
- Churn: `attention_weights` is list of 12 floats summing to ~1.0, `critical_months` has 3 entries

## Step 3: Test Continuous Training Pipeline

```bash
cd /home/ubuntu/repos/corebanking

# Drift check (no drift expected on same data)
python -m ml.continuous_training.orchestrator --mode drift --model credit_scorer

# Forced retrain (takes ~45-60 seconds)
python -m ml.continuous_training.orchestrator --mode full --model credit_scorer --force
```

**Key assertions**:
- Drift check: `drift=no, retrain=no`
- Forced retrain: `retrained: true`, `val_auc_roc` > 0.5, wall-clock > 5 seconds
- Champion-challenger: `recommendation` is one of: promote, keep_champion, inconclusive
- Pipeline result saved to `ml/weights/ct_pipeline_*.json`

## Step 4: Test Model Promoter

```bash
cd /home/ubuntu/repos/corebanking
python3 -c "
import sys; sys.path.insert(0, '.')
from ml.continuous_training.model_promoter import ModelPromoter
p = ModelPromoter()
status = p.get_model_status()
for name, info in status.items():
    print(f'{name}: {info}')

# Verify approval gate for high-risk models
try:
    p.promote_to_production('fraud_detector', approved_by='auto')
    print('ERROR: Should have raised PermissionError')
except PermissionError as e:
    print(f'PASS: {e}')
except FileNotFoundError as e:
    print(f'SKIP (no staging): {e}')
"
```

**Key assertions**:
- 6 models in status, all with `production: True`
- fraud_detector and aml_scorer require human approval (REQUIRES_APPROVAL set)

## Step 5: Test Monitoring Server

```bash
cd /home/ubuntu/repos/corebanking
python -m ml.continuous_training.monitoring 2>&1 &
sleep 2

curl -s http://localhost:8501/monitoring/healthz
curl -s http://localhost:8501/monitoring/status | python3 -m json.tool
curl -s http://localhost:8501/monitoring/prometheus
curl -s http://localhost:8501/monitoring/dashboard | head -5

# Manual retrain trigger
curl -s -X POST http://localhost:8501/monitoring/trigger/credit_scorer
curl -s -X POST http://localhost:8501/monitoring/trigger/nonexistent_model
```

**Key assertions**:
- `/monitoring/status`: 6 models with production/staging/canary flags
- `/monitoring/prometheus`: `ml_model_weight_exists{model="..."}` = 1 for all 6
- `/monitoring/dashboard`: HTML starts with `<!DOCTYPE html>`, title "54Bank ML Monitoring"
- Valid trigger returns `{"status": "triggered"}`, invalid returns 400

## Step 6: Browser Dashboard Verification

Open `http://localhost:8501/monitoring/dashboard` in the browser. Verify:
- Title "54Bank ML Model Monitoring"
- 6 model cards with AUC-ROC, F1, Parameters, Weight Size, Epochs
- PROD/STAGING badges on cards
- Active Alerts section at bottom

## Known Issues / Gotchas

- **Port conflicts**: Always kill existing processes on 8500/8501 before starting servers (`fuser -k PORT/tcp`)
- **GNN endpoint**: The `/v1/gnn/predict` endpoint might not be wired in `do_POST` — the model loads but the router might be missing the route. Check `ml/inference/server.py` POST handler.
- **cd + && in exec**: Some shell environments block `cd X && cmd`. Use separate commands or absolute paths.
- **Retrain time**: credit_scorer retrain takes ~45-60s on CPU. Don't set short timeouts.
- **Staging files**: After forced retrain, `credit_scorer_staging.pt` remains in `ml/weights/`. The monitoring dashboard will show a STAGING badge.
- **System restarts**: If the VM restarts, all running servers are killed. Files on disk are preserved — just restart the servers.
